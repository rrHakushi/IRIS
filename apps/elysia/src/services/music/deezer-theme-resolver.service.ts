import { prisma } from "@IRIS/database"
import {
  parseMalThemeSong,
  getDeezerFallbackSearchUrl,
  type ParsedThemeSong,
  type EnrichedThemeSongItem,
} from "@IRIS/shared"
import { mediaDbSyncer } from "../media-queue/media-db.syncer.js"
import { mediaQueueService } from "../media-queue/media-queue.service.js"

interface DeezerTrackSummary {
  id: number
  title: string
  title_short?: string
  link?: string
  preview?: string
  readable?: boolean
  duration?: number
  artist?: {
    id: number
    name: string
  }
  album?: {
    id: number
    title: string
    cover?: string
    cover_small?: string
    cover_medium?: string
    cover_big?: string
    cover_xl?: string
  }
}

class DeezerThemeResolverService {
  private lastRequestTime = 0
  private readonly minDelayMs = 120 // safe buffer for Deezer's rate limits

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed))
    }
    this.lastRequestTime = Date.now()
  }

  private normalizeStr(s: string): string {
    return s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  private calculateSimilarity(a: string, b: string): number {
    const s1 = this.normalizeStr(a)
    const s2 = this.normalizeStr(b)
    if (!s1 || !s2) return 0
    if (s1 === s2) return 1.0
    if (s1.includes(s2) || s2.includes(s1)) return 0.9

    const STOP_WORDS = new Set([
      "no",
      "of",
      "the",
      "a",
      "an",
      "to",
      "in",
      "de",
      "ver",
      "version",
    ])
    const t1 = s1.split(" ").filter((w) => w.length > 0 && !STOP_WORDS.has(w))
    const t2 = s2.split(" ").filter((w) => w.length > 0 && !STOP_WORDS.has(w))

    if (t1.length === 0 || t2.length === 0) {
      const rawT1 = s1.split(" ")
      const rawT2 = s2.split(" ")
      const inter = rawT1.filter((x) => rawT2.includes(x))
      return (2 * inter.length) / (rawT1.length + rawT2.length)
    }

    const set2 = new Set(t2)
    const intersection = t1.filter((x) => set2.has(x))
    return (2 * intersection.length) / (t1.length + t2.length)
  }

  /**
   * Search Deezer API using the cascading waterfall strategy.
   */
  async searchDeezer(
    parsed: ParsedThemeSong
  ): Promise<DeezerTrackSummary | null> {
    const queries: string[] = []

    // 1. Strict Romaji field query + keyword
    if (parsed.artistClean && parsed.titleClean) {
      queries.push(
        `artist:"${parsed.artistClean}" track:"${parsed.titleClean}"`
      )
      queries.push(`${parsed.artistClean} ${parsed.titleClean}`)
    }

    // 2. Native variants (e.g. B-Komachi Bのリベンジ, CHANMINA TEST ME)
    if (parsed.artistClean && parsed.titleNative) {
      queries.push(`${parsed.artistClean} ${parsed.titleNative}`)
    }
    if (parsed.artistNative && parsed.titleNative) {
      queries.push(
        `artist:"${parsed.artistNative}" track:"${parsed.titleNative}"`
      )
      queries.push(`${parsed.artistNative} ${parsed.titleNative}`)
    } else if (parsed.artistNative && parsed.titleClean) {
      queries.push(`${parsed.artistNative} ${parsed.titleClean}`)
    }
    if (parsed.titleNative) {
      queries.push(`${parsed.titleNative}`)
    }

    // 3. Multi-artist components (e.g. Machico, LIN -> LIN, Machico)
    if (parsed.artistList.length > 1) {
      for (const art of parsed.artistList) {
        queries.push(`${art} ${parsed.titleClean}`)
      }
    }

    // 4. Track only query fallback
    if (parsed.titleClean) {
      queries.push(`track:"${parsed.titleClean}"`)
    }

    const seenTrackIds = new Set<number>()

    for (const q of queries) {
      await this.waitForRateLimit()
      try {
        const url = `https://api.deezer.com/search?q=${encodeURIComponent(
          q
        )}&limit=5`
        const res = await fetch(url, {
          headers: {
            "User-Agent": "IRIS-Platform/1.0 (https://iris.app)",
            Accept: "application/json",
          },
        }).then((r) => (r.ok ? r.json() : null))

        if (!res?.data || res.data.length === 0) continue

        for (const t of res.data as DeezerTrackSummary[]) {
          if (seenTrackIds.has(t.id)) continue
          seenTrackIds.add(t.id)

          const candidateTitle = t.title || t.title_short || ""
          const candidateArtist = t.artist?.name || ""

          // Title score
          const titleScoreRomaji = this.calculateSimilarity(
            candidateTitle,
            parsed.titleClean
          )
          const titleScoreNative = parsed.titleNative
            ? this.calculateSimilarity(candidateTitle, parsed.titleNative)
            : 0
          const bestTitleScore = Math.max(titleScoreRomaji, titleScoreNative)

          // Artist score
          let bestArtistScore = this.calculateSimilarity(
            candidateArtist,
            parsed.artistClean
          )
          if (parsed.artistNative) {
            bestArtistScore = Math.max(
              bestArtistScore,
              this.calculateSimilarity(candidateArtist, parsed.artistNative)
            )
          }
          for (const art of parsed.artistList) {
            bestArtistScore = Math.max(
              bestArtistScore,
              this.calculateSimilarity(candidateArtist, art)
            )
          }

          // Acceptance criteria
          if (bestTitleScore >= 0.65 && bestArtistScore >= 0.6) {
            return t
          }
        }
      } catch {
        // continue trying next query in waterfall
      }
    }

    return null
  }

  /**
   * Resolves a raw MAL theme song string.
   * If a Deezer track is found:
   * 1. Checks if it already exists in prisma.music.
   * 2. If not, fetches full track details from Deezer, upserts to Music, and enqueues in MediaQueue.
   * 3. Returns the local Music.id as musicId.
   */
  async resolveThemeSong(
    rawItem:
      string | { id?: number | null; text: string; anime_id?: number | null }
  ): Promise<EnrichedThemeSongItem> {
    const rawText = typeof rawItem === "string" ? rawItem : rawItem.text
    const malId = typeof rawItem === "string" ? null : (rawItem.id ?? null)
    const animeId =
      typeof rawItem === "string" ? null : (rawItem.anime_id ?? null)

    const parsed = parseMalThemeSong(rawText)
    const candidate = await this.searchDeezer(parsed)

    if (candidate) {
      const deezerIdStr = String(candidate.id)
      let localMusic = await prisma.music.findUnique({
        where: { deezerId: deezerIdStr },
        select: { id: true, audioPreviewUrl: true, link: true },
      })

      let previewUrl = candidate.preview || null
      let deezerUrl =
        candidate.link || `https://www.deezer.com/track/${candidate.id}`

      // If missing in DB, fetch full track details and upsert
      if (!localMusic) {
        await this.waitForRateLimit()
        try {
          const trackData = await fetch(
            `https://api.deezer.com/track/${candidate.id}`,
            {
              headers: {
                "User-Agent": "IRIS-Platform/1.0 (https://iris.app)",
                Accept: "application/json",
              },
            }
          ).then((r) => (r.ok ? r.json() : null))

          if (trackData && !trackData.error) {
            previewUrl = trackData.preview || previewUrl
            deezerUrl = trackData.link || deezerUrl

            const upserted = await mediaDbSyncer.upsertMusic({
              type: "TRACK",
              deezerId: trackData.id,
              isrc: trackData.isrc,
              titlePrimary: trackData.title,
              titleSecondary: trackData.title_short,
              titleVersion: trackData.title_version,
              link: trackData.link,
              share: trackData.share,
              coverImage:
                trackData.album?.cover_big ||
                trackData.album?.cover_medium ||
                trackData.album?.cover,
              images: trackData.album
                ? {
                    small: trackData.album.cover_small,
                    medium: trackData.album.cover_medium,
                    big: trackData.album.cover_big,
                    xl: trackData.album.cover_xl,
                  }
                : undefined,
              duration: trackData.duration,
              trackPosition: trackData.track_position,
              diskNumber: trackData.disk_number,
              rank: trackData.rank,
              audioPreviewUrl: trackData.preview,
              artist: trackData.artist,
              artistName: trackData.artist?.name,
              deezerArtistId: trackData.artist?.id
                ? String(trackData.artist.id)
                : undefined,
            })

            localMusic = {
              id: upserted.id,
              audioPreviewUrl: previewUrl,
              link: deezerUrl,
            }

            // Enqueue background job to fetch lyrics & album enrichment
            await mediaQueueService
              .enqueueJob("MUSIC_TRACK", candidate.id, { priority: 3 })
              .catch(() => {})
          }
        } catch {
          // Fall back if track detail fetch fails
        }
      }

      return {
        id: malId,
        text: rawText,
        anime_id: animeId,
        musicId: localMusic?.id ?? null,
        title: parsed.titleClean,
        titleNative: parsed.titleNative ?? null,
        artist: parsed.artistClean,
        episodes: parsed.episodes ?? null,
        deezerId: candidate.id,
        deezerUrl,
        previewUrl: localMusic?.audioPreviewUrl || previewUrl,
        isDirectMatch: true,
      }
    }

    // No direct match found: return fallback search link
    return {
      id: malId,
      text: rawText,
      anime_id: animeId,
      musicId: null,
      title: parsed.titleClean,
      titleNative: parsed.titleNative ?? null,
      artist: parsed.artistClean,
      episodes: parsed.episodes ?? null,
      deezerId: null,
      deezerUrl: getDeezerFallbackSearchUrl(
        parsed.artistClean,
        parsed.titleClean
      ),
      previewUrl: null,
      isDirectMatch: false,
    }
  }
}

export const deezerThemeResolver = new DeezerThemeResolverService()
