import { logQueue } from "../logger.js"
import { c } from "../../../utils/colors.js"

export interface TvdbSearchItem {
  objectID?: string
  id?: string | number
  tvdb_id?: string | number
  name?: string
  image_url?: string
  year?: string
  status?: string
  overview?: string
}

export interface TvdbCharacter {
  id: number
  name?: string
  image?: string
  isFeatured?: boolean
  type?: number
  typeName?: string
  peopleId?: number
  personName?: string
  personImgURL?: string
  peopleType?: string
}

export interface TvdbEpisode {
  id: number
  seriesId: number
  name?: string
  aired?: string
  runtime?: number
  overview?: string
  image?: string
  seasonNumber: number
  number: number
  year?: string
  finaleType?: string
}

export interface TvdbSeason {
  id: number
  seriesId: number
  type?: { id: number; name: string }
  number: number
  image?: string
  name?: string
  year?: string
}

export interface TvdbSeriesPayload {
  id: number
  name: string
  slug?: string
  image?: string
  artworks?: Array<{ image?: string; type?: number; language?: string }>
  originalLanguage?: string
  firstAired?: string
  lastAired?: string
  overview?: string
  status?: { id?: number; name?: string }
  score?: number
  genres?: Array<{ id: number; name: string }>
  networks?: Array<{ id: number; name: string }>
  trailers?: Array<{ id: number; url: string; language?: string }>
  contentRatings?: Array<{
    name: string
    country: string
    description?: string
    fullname?: string
  }>
  airsDays?: {
    sunday?: boolean
    monday?: boolean
    tuesday?: boolean
    wednesday?: boolean
    thursday?: boolean
    friday?: boolean
    saturday?: boolean
  }
  airsTime?: string
  seasons?: TvdbSeason[]
  characters?: TvdbCharacter[]
  companies?: any
  production_countries?: Array<{ id?: number; country?: string; name?: string }>
  remoteIds?: Array<{ id: string; type: number; sourceName: string }>
  averageRuntime?: number
}

export interface TvdbMoviePayload {
  id: number
  name: string
  slug?: string
  image?: string
  artworks?: Array<{ image?: string; type?: number; language?: string }>
  runtime?: number
  first_release_date?: string
  first_release?: {
    country?: string
    date?: string
    detail?: string | null
  }
  releases?: Array<{
    country?: string
    date?: string
    detail?: string | null
  }>
  overview?: string
  status?: { id?: number; name?: string }
  score?: number
  genres?: Array<{ id: number; name: string }>
  companies?: {
    studio?: Array<{ id: number; name: string }>
    production?: Array<{ id: number; name: string }>
    distributor?: Array<{ id: number; name: string }>
  }
  trailers?: Array<{ id: number; url: string; language?: string }>
  contentRatings?: Array<{
    name: string
    country: string
    description?: string
    fullname?: string
  }>
  budget?: string
  boxOffice?: string
  originalLanguage?: string
  production_countries?: Array<{ id?: number; country?: string; name?: string }>
  remoteIds?: Array<{ id: string; type: number; sourceName: string }>
  characters?: TvdbCharacter[]
}

export function normalizeTvdbImageUrl(url?: string): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed
  if (trimmed.startsWith("/")) return `https://artworks.thetvdb.com${trimmed}`
  return `https://artworks.thetvdb.com/${trimmed}`
}

export class TheTVDBProvider {
  private readonly baseUrl = "https://api4.thetvdb.com/v4"
  private bearerToken: string | null = null
  private tokenExpiresAt = 0
  private lastRequestTime = 0
  private readonly minDelayMs = 200 // 5 req/s

  private getApiKey(): string {
    return (
      process.env.THETVDB_KEY ||
      process.env.TVDB_API_KEY ||
      process.env.THETVDB_API_KEY ||
      process.env.TVDB_KEY ||
      ""
    )
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed))
    }
    this.lastRequestTime = Date.now()
  }

  private async getValidToken(): Promise<string> {
    const now = Date.now()
    if (this.bearerToken && this.tokenExpiresAt > now + 60000) {
      return this.bearerToken
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error(
        "[TheTVDBProvider] THETVDB_KEY / TVDB_API_KEY is not configured in .env"
      )
    }

    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ apikey: apiKey }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(
        `[TheTVDBProvider] Login failed HTTP ${res.status}: ${errText}`
      )
    }

    const json = (await res.json()) as { data?: { token?: string } }
    if (!json.data?.token) {
      throw new Error("[TheTVDBProvider] TVDB login returned no bearer token")
    }

    this.bearerToken = json.data.token
    // TVDB tokens last ~1 month, refresh every 24 hours
    this.tokenExpiresAt = now + 24 * 60 * 60 * 1000
    return this.bearerToken
  }

  private async fetchJson<T>(endpoint: string): Promise<T> {
    await this.waitForRateLimit()
    const token = await this.getValidToken()

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "IRIS-Platform/1.0 (https://iris.app)",
      },
    })

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 5
      logQueue(
        `${c.magenta(c.bold("[MediaQueue]"))} ${c.red(c.bold("⚠️ [RATE LIMIT 429]"))} ${c.red(`TheTVDB HTTP 429 Too Many Requests. Backing off for ${retryAfter}s...`)}`
      )
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      return this.fetchJson<T>(endpoint)
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(
        `[TheTVDBProvider] HTTP ${res.status} for ${endpoint}: ${errText}`
      )
    }

    const json = (await res.json()) as { data?: T; status?: string }
    if (!json.data) {
      throw new Error(`[TheTVDBProvider] Empty data response for ${endpoint}`)
    }

    return json.data
  }

  /**
   * Fetches extended TV series metadata.
   */
  async fetchTvSeries(tvdbId: number): Promise<TvdbSeriesPayload> {
    return await this.fetchJson<TvdbSeriesPayload>(`/series/${tvdbId}/extended`)
  }

  /**
   * Fetches translation for a TV series (e.g. English name & overview).
   */
  async fetchTvSeriesTranslation(
    tvdbId: number,
    language: string = "eng"
  ): Promise<{ name?: string; overview?: string; language?: string } | null> {
    try {
      return await this.fetchJson<{
        name?: string
        overview?: string
        language?: string
      }>(`/series/${tvdbId}/translations/${language}`)
    } catch {
      return null
    }
  }

  /**
   * Fetches translation for a Movie (e.g. English name & overview).
   */
  async fetchMovieTranslation(
    tvdbId: number,
    language: string = "eng"
  ): Promise<{ name?: string; overview?: string; language?: string } | null> {
    try {
      return await this.fetchJson<{
        name?: string
        overview?: string
        language?: string
      }>(`/movies/${tvdbId}/translations/${language}`)
    } catch {
      return null
    }
  }

  /**
   * Fetches all characters & cast for a TV series.
   */
  async fetchTvCharacters(tvdbId: number): Promise<TvdbCharacter[]> {
    try {
      return await this.fetchJson<TvdbCharacter[]>(
        `/series/${tvdbId}/characters`
      )
    } catch {
      return []
    }
  }

  /**
   * Fetches all episodes across all seasons for a TV series (paginated).
   */
  async fetchTvEpisodes(tvdbId: number): Promise<TvdbEpisode[]> {
    const allEpisodes: TvdbEpisode[] = []
    let page = 0
    let hasMore = true

    while (hasMore && page < 20) {
      try {
        const res = await this.fetchJson<{
          episodes?: TvdbEpisode[]
        }>(`/series/${tvdbId}/episodes/default?page=${page}`)

        const episodes = res.episodes || []
        if (episodes.length === 0) {
          hasMore = false
        } else {
          allEpisodes.push(...episodes)
          page++
        }
      } catch (err) {
        hasMore = false
      }
    }

    return allEpisodes
  }

  /**
   * Fetches all artworks and images (posters, banners, backgrounds, icons, seasons) for a series.
   */
  async fetchTvSeriesArtworks(tvdbId: number): Promise<string[]> {
    const urls = new Set<string>()

    // 1. Fetch /series/{id}/extended to get main image, artworks array, and season images
    try {
      const series = await this.fetchTvSeries(tvdbId)
      if (series.image) {
        const img = normalizeTvdbImageUrl(series.image)
        if (img) urls.add(img)
      }
      if (series.artworks && Array.isArray(series.artworks)) {
        for (const art of series.artworks) {
          const img = normalizeTvdbImageUrl(art.image)
          if (img) urls.add(img)
        }
      }
      if (series.seasons && Array.isArray(series.seasons)) {
        for (const s of series.seasons) {
          if (s.image) {
            const img = normalizeTvdbImageUrl(s.image)
            if (img) urls.add(img)
          }
        }
      }
    } catch {}

    // 2. Fetch /series/{id}/artworks dedicated endpoint to get all remaining artwork types
    try {
      const res = await this.fetchJson<{
        artworks?: Array<{ image?: string; thumbnail?: string }>
      }>(`/series/${tvdbId}/artworks`)

      if (res.artworks && Array.isArray(res.artworks)) {
        for (const art of res.artworks) {
          const img = normalizeTvdbImageUrl(art.image || art.thumbnail)
          if (img) urls.add(img)
        }
      }
    } catch {}

    return Array.from(urls)
  }

  /**
   * Fetches extended Movie metadata including characters & cast.
   */
  async fetchMovie(tvdbId: number): Promise<TvdbMoviePayload> {
    return await this.fetchJson<TvdbMoviePayload>(`/movies/${tvdbId}/extended`)
  }

  /**
   * Fetches all artworks and images (posters, backgrounds, logos) for a movie.
   */
  async fetchMovieArtworks(tvdbId: number): Promise<string[]> {
    const urls = new Set<string>()

    try {
      const movie = await this.fetchMovie(tvdbId)
      if (movie.image) {
        const img = normalizeTvdbImageUrl(movie.image)
        if (img) urls.add(img)
      }
      if (movie.artworks && Array.isArray(movie.artworks)) {
        for (const art of movie.artworks) {
          const img = normalizeTvdbImageUrl(art.image)
          if (img) urls.add(img)
        }
      }
    } catch {}

    try {
      const res = await this.fetchJson<{
        artworks?: Array<{ image?: string; thumbnail?: string }>
      }>(`/movies/${tvdbId}/artworks`)

      if (res.artworks && Array.isArray(res.artworks)) {
        for (const art of res.artworks) {
          const img = normalizeTvdbImageUrl(art.image || art.thumbnail)
          if (img) urls.add(img)
        }
      }
    } catch {}

    return Array.from(urls)
  }

  /**
   * Searches TVDB specifically for TV Series and returns search preview items.
   */
  async searchTvSeries(
    query: string,
    limit: number = 10
  ): Promise<TvdbSearchItem[]> {
    const clean = query.trim()
    if (!clean) return []

    try {
      const maxLimit = Math.min(Math.max(limit, 1), 50)
      const url = `/search?query=${encodeURIComponent(clean)}&type=series&limit=${maxLimit}`
      const results = await this.fetchJson<TvdbSearchItem[]>(url)

      if (!Array.isArray(results)) return []
      return results
    } catch (err: any) {
      console.error(`[TheTVDBProvider] searchTvSeries failed: ${err.message}`)
      return []
    }
  }

  /**
   * Searches TVDB specifically for Movies and returns search preview items.
   */
  async searchMovies(
    query: string,
    limit: number = 10
  ): Promise<TvdbSearchItem[]> {
    const clean = query.trim()
    if (!clean) return []

    try {
      const maxLimit = Math.min(Math.max(limit, 1), 50)
      const url = `/search?query=${encodeURIComponent(clean)}&type=movie&limit=${maxLimit}`
      const results = await this.fetchJson<TvdbSearchItem[]>(url)

      if (!Array.isArray(results)) return []
      return results
    } catch (err: any) {
      console.error(`[TheTVDBProvider] searchMovies failed: ${err.message}`)
      return []
    }
  }
}
