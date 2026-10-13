import { cache } from "../../../utils/cache.js"

export interface AniSkipResult {
  skipType: "op" | "ed" | "recap" | "mixed-op" | "mixed-ed"
  interval: {
    startTime: number
    endTime: number
  }
  skipId?: string
  episodeLength?: number
}

export interface EpisodeSkipTimestamps {
  opStart?: number
  opEnd?: number
  edStart?: number
  edEnd?: number
  recapStart?: number
  recapEnd?: number
  rawResults?: AniSkipResult[]
}

export class AniSkipProvider {
  private readonly baseUrl = "https://api.aniskip.com/v2/skip-times"

  /**
   * Fetches OP/ED/Recap skip timestamps for a single anime episode by MAL ID.
   */
  async fetchSkipTimes(
    malId: number,
    episodeNumber: number
  ): Promise<EpisodeSkipTimestamps | null> {
    const cacheKey = `media-aniskip:${malId}:${episodeNumber}`
    const cached = await cache.get<EpisodeSkipTimestamps>(cacheKey)
    if (cached) return cached

    try {
      const url = `${this.baseUrl}/${malId}/${episodeNumber}?types[]=op&types[]=ed&types[]=recap&types[]=mixed-op&types[]=mixed-ed&episodeLength=0`
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "IRIS-Media/1.0 (https://iris.app)",
        },
      })

      if (!res.ok) {
        return null
      }

      const json = (await res.json()) as {
        found?: boolean
        results?: AniSkipResult[]
      }

      if (!json.found || !json.results || json.results.length === 0) {
        return null
      }

      const timestamps: EpisodeSkipTimestamps = {
        rawResults: json.results,
      }

      for (const r of json.results) {
        if (r.skipType === "op" || r.skipType === "mixed-op") {
          if (timestamps.opStart === undefined) {
            timestamps.opStart = Math.round(r.interval.startTime)
            timestamps.opEnd = Math.round(r.interval.endTime)
          }
        } else if (r.skipType === "ed" || r.skipType === "mixed-ed") {
          if (timestamps.edStart === undefined) {
            timestamps.edStart = Math.round(r.interval.startTime)
            timestamps.edEnd = Math.round(r.interval.endTime)
          }
        } else if (r.skipType === "recap") {
          if (timestamps.recapStart === undefined) {
            timestamps.recapStart = Math.round(r.interval.startTime)
            timestamps.recapEnd = Math.round(r.interval.endTime)
          }
        }
      }

      // Cache skip timestamps for 14 days
      await cache.set(cacheKey, timestamps, 86400 * 14)
      return timestamps
    } catch {
      return null
    }
  }

  /**
   * Fetches skip timestamps for multiple episodes in parallel batches.
   */
  async fetchEpisodesSkipTimes(
    malId: number,
    episodeNumbers: number[]
  ): Promise<Map<number, EpisodeSkipTimestamps>> {
    const map = new Map<number, EpisodeSkipTimestamps>()
    if (!malId || !episodeNumbers || episodeNumbers.length === 0) return map

    const batchSize = 10
    for (let i = 0; i < episodeNumbers.length; i += batchSize) {
      const batch = episodeNumbers.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(async (epNum) => {
          const ts = await this.fetchSkipTimes(malId, epNum)
          return { epNum, ts }
        })
      )

      for (const { epNum, ts } of results) {
        if (ts) map.set(epNum, ts)
      }
    }

    return map
  }
}
