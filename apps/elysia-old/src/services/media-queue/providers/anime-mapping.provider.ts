import { cache } from "../../../utils/cache.js"

export interface AnimeMappingEntry {
  anilistId?: number
  malId?: number
  anidbId?: number
  tvdbId?: number
  bangumiId?: number
  kitsuId?: number
  imdbId?: string
  tmdbId?: number
  livechartId?: number
  animePlanetId?: string
}

export interface MangaMappingEntry {
  mangaUpdatesId?: string
  kitsuId?: number
  bangumiId?: number
}

export class AnimeMappingProvider {
  private anilistMap = new Map<number, any>()
  private malMap = new Map<number, any>()
  private bangumiAnilistMap = new Map<number, number>()
  private bangumiMalMap = new Map<number, number>()
  private isLoaded = false
  private loadPromise: Promise<void> | null = null

  /**
   * Loads mapping databases from cache or remote repositories (Fribb/anime-lists & bangumi-data).
   */
  async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = this.loadData()
    await this.loadPromise
    this.isLoaded = true
    this.loadPromise = null
  }

  private async loadData(): Promise<void> {
    try {
      // 1. Try Redis cache first
      const CACHE_KEY_FRIBB = "media-mapping:anime:fribb:v1"
      const CACHE_KEY_BANGUMI = "media-mapping:anime:bangumi:v1"

      let fribbData = await cache.get<any[]>(CACHE_KEY_FRIBB)
      let bangumiItems = await cache.get<any[]>(CACHE_KEY_BANGUMI)

      if (!fribbData) {
        const res = await fetch(
          "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json"
        )
        if (res.ok) {
          fribbData = (await res.json()) as any[]
          if (Array.isArray(fribbData)) {
            await cache.set(CACHE_KEY_FRIBB, fribbData, 86400 * 3) // 3 days TTL
          }
        }
      }

      if (!bangumiItems) {
        const res = await fetch(
          "https://raw.githubusercontent.com/bangumi-data/bangumi-data/master/dist/data.json"
        )
        if (res.ok) {
          const bgmJson = (await res.json()) as { items?: any[] }
          bangumiItems = bgmJson.items || []
          if (Array.isArray(bangumiItems)) {
            await cache.set(CACHE_KEY_BANGUMI, bangumiItems, 86400 * 3)
          }
        }
      }

      // Populate fast in-memory lookup maps
      if (Array.isArray(fribbData)) {
        for (const item of fribbData) {
          if (item.anilist_id) this.anilistMap.set(item.anilist_id, item)
          if (item.mal_id) this.malMap.set(item.mal_id, item)
        }
      }

      if (Array.isArray(bangumiItems)) {
        for (const item of bangumiItems) {
          const bgmSite = item.sites?.find((s: any) => s.site === "bangumi")
          const bgmId = bgmSite?.id ? parseInt(bgmSite.id, 10) : undefined
          if (!bgmId) continue

          const alSite = item.sites?.find(
            (s: any) => s.site === "aniList" || s.site === "anilist"
          )
          if (alSite?.id)
            this.bangumiAnilistMap.set(parseInt(alSite.id, 10), bgmId)

          const malSite = item.sites?.find((s: any) => s.site === "mal")
          if (malSite?.id)
            this.bangumiMalMap.set(parseInt(malSite.id, 10), bgmId)
        }
      }
    } catch (err: any) {
      console.warn(
        `[AnimeMappingProvider] Warning: failed to load remote mappings: ${err.message}`
      )
    }
  }

  /**
   * Fast O(1) identifier resolution across AniDB, TheTVDB, Bangumi, Kitsu, IMDb, TMDB for Anime.
   */
  async lookup(identifiers: {
    anilistId?: number
    malId?: number
  }): Promise<AnimeMappingEntry> {
    await this.ensureLoaded()

    const entry =
      (identifiers.anilistId
        ? this.anilistMap.get(identifiers.anilistId)
        : null) ||
      (identifiers.malId ? this.malMap.get(identifiers.malId) : null)

    const bangumiId =
      (identifiers.anilistId
        ? this.bangumiAnilistMap.get(identifiers.anilistId)
        : null) ||
      (identifiers.malId ? this.bangumiMalMap.get(identifiers.malId) : null)

    const imdbId = Array.isArray(entry?.imdb_id)
      ? entry.imdb_id[0]
      : entry?.imdb_id
    const tmdbId =
      typeof entry?.themoviedb_id === "object"
        ? entry.themoviedb_id?.tv || entry.themoviedb_id?.movie
        : entry?.themoviedb_id

    const anilistId =
      identifiers.anilistId ||
      (entry?.anilist_id ? parseInt(entry.anilist_id, 10) : undefined)
    const malId =
      identifiers.malId ||
      (entry?.mal_id ? parseInt(entry.mal_id, 10) : undefined)

    return {
      anilistId,
      malId,
      anidbId: entry?.anidb_id,
      tvdbId: entry?.tvdb_id,
      bangumiId: bangumiId || undefined,
      kitsuId: entry?.kitsu_id,
      imdbId: imdbId || undefined,
      tmdbId: tmdbId || undefined,
      livechartId: entry?.livechart_id,
      animePlanetId: entry?.["anime-planet_id"],
    }
  }

  /**
   * Resolves Manga cross-site identifiers (MangaUpdates, Kitsu, Bangumi) via remote APIs with 7-day Redis caching.
   */
  async lookupManga(identifiers: {
    anilistId?: number
    malId?: number
    title: string
    titleNative?: string
  }): Promise<MangaMappingEntry> {
    const keyPart =
      identifiers.anilistId ||
      identifiers.malId ||
      encodeURIComponent(identifiers.title)
    const cacheKey = `media-mapping:manga:${keyPart}`

    const cached = await cache.get<MangaMappingEntry>(cacheKey)
    if (cached) return cached

    const result: MangaMappingEntry = {}
    const searchTitle = identifiers.title.trim()
    if (!searchTitle && !identifiers.titleNative) return result

    // 1. MangaUpdates API search
    const muPromise = (async () => {
      if (!searchTitle) return
      try {
        const res = await fetch(
          "https://api.mangaupdates.com/v1/series/search",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ search: searchTitle, stype: "title" }),
          }
        )
        if (res.ok) {
          const data = (await res.json()) as {
            results?: Array<{ record?: { series_id?: number } }>
          }
          if (
            data.results &&
            data.results.length > 0 &&
            data.results[0]?.record?.series_id
          ) {
            result.mangaUpdatesId = String(data.results[0].record.series_id)
          }
        }
      } catch {}
    })()

    // 2. Kitsu API search
    const kitsuPromise = (async () => {
      if (!searchTitle) return
      try {
        const res = await fetch(
          `https://kitsu.app/api/edge/manga?filter[text]=${encodeURIComponent(searchTitle)}&page[limit]=1`,
          { headers: { Accept: "application/vnd.api+json" } }
        )
        if (res.ok) {
          const data = (await res.json()) as { data?: Array<{ id: string }> }
          if (data.data && data.data.length > 0 && data.data[0]?.id) {
            result.kitsuId = parseInt(data.data[0].id, 10)
          }
        }
      } catch {}
    })()

    // 3. Bangumi search (v0 API, type=1 is Book/Manga/Novel)
    const bangumiPromise = (async () => {
      try {
        const bgmKeyword = identifiers.titleNative?.trim() || searchTitle
        if (!bgmKeyword) return
        const res = await fetch("https://api.bgm.tv/v0/search/subjects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "IRIS-Media/1.0 (https://iris.app)",
          },
          body: JSON.stringify({
            keyword: bgmKeyword,
            filter: { type: [1] },
          }),
        })
        if (res.ok) {
          const data = (await res.json()) as { data?: Array<{ id: number }> }
          if (data.data && data.data.length > 0 && data.data[0]?.id) {
            result.bangumiId = data.data[0].id
          }
        }
      } catch {}
    })()

    await Promise.all([muPromise, kitsuPromise, bangumiPromise])

    if (result.mangaUpdatesId || result.kitsuId || result.bangumiId) {
      await cache.set(cacheKey, result, 86400 * 7) // 7 days TTL
    }

    return result
  }
}
