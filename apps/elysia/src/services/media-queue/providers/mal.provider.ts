import { logQueue } from "../logger.js"
import { c } from "../../../utils/colors.js"

export interface MalAnimePayload {
  id: number
  title: string
  main_picture?: { medium?: string; large?: string }
  alternative_titles?: { en?: string; ja?: string; synonyms?: string[] }
  start_date?: string
  end_date?: string
  synopsis?: string
  mean?: number
  rank?: number
  popularity?: number
  num_list_users?: number
  num_scoring_users?: number
  nsfw?: string
  media_type?: string
  status?: string
  genres?: Array<{ id: number; name: string }>
  num_episodes?: number
  start_season?: { year?: number; season?: string }
  broadcast?: { day_of_the_week?: string; start_time?: string }
  source?: string
  average_episode_duration?: number
  rating?: string // e.g. "pg_13", "r", "r+"
  pictures?: Array<{ medium?: string; large?: string }>
  background?: string
  opening_themes?: Array<{ id: number; text: string }>
  ending_themes?: Array<{ id: number; text: string }>
  studios?: Array<{ id: number; name: string }>
  updated_at?: string
}

export interface MalMangaPayload {
  id: number
  title: string
  main_picture?: { medium?: string; large?: string }
  alternative_titles?: { en?: string; ja?: string; synonyms?: string[] }
  start_date?: string
  end_date?: string
  synopsis?: string
  mean?: number
  rank?: number
  popularity?: number
  num_list_users?: number
  num_scoring_users?: number
  nsfw?: string
  media_type?: string
  status?: string
  genres?: Array<{ id: number; name: string }>
  num_volumes?: number
  num_chapters?: number
  pictures?: Array<{ medium?: string; large?: string }>
  background?: string
  serialization?: Array<{ node: { id: number; name: string } }>
  authors?: Array<{
    node: { id: number; first_name?: string; last_name?: string }
    role?: string
  }>
  updated_at?: string
}

export class MyAnimeListProvider {
  private readonly baseUrl = "https://api.myanimelist.net/v2"
  private lastRequestTime = 0
  private readonly minDelayMs = 700 // ~1.4 req/s

  private getClientId(): string {
    return process.env.MAL_CLIENT_ID || ""
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed))
    }
    this.lastRequestTime = Date.now()
  }

  private async fetchJson<T>(url: string): Promise<T> {
    await this.waitForRateLimit()

    const clientId = this.getClientId()
    if (!clientId) {
      throw new Error(
        "[MyAnimeListProvider] MAL_CLIENT_ID is not configured in .env"
      )
    }

    const res = await fetch(url, {
      headers: {
        "X-MAL-CLIENT-ID": clientId,
        Accept: "application/json",
        "User-Agent": "IRIS-Platform/1.0 (https://iris.app)",
      },
    })

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 10
      logQueue(
        `${c.magenta(c.bold("[MediaQueue]"))} ${c.red(c.bold("⚠️ [RATE LIMIT 429]"))} ${c.red(`MyAnimeList HTTP 429 Too Many Requests. Backing off for ${retryAfter}s...`)}`
      )
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      return this.fetchJson<T>(url)
    }

    if (res.status === 404) {
      throw new Error(`[MyAnimeListProvider] Record not found (404) at ${url}`)
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(`[MyAnimeListProvider] HTTP ${res.status}: ${errText}`)
    }

    return (await res.json()) as T
  }

  /**
   * Fetches official anime data from MyAnimeList v2 API.
   */
  async fetchAnime(malId: number): Promise<MalAnimePayload> {
    const fields = [
      "id",
      "title",
      "main_picture",
      "alternative_titles",
      "start_date",
      "end_date",
      "synopsis",
      "mean",
      "rank",
      "popularity",
      "num_list_users",
      "num_scoring_users",
      "nsfw",
      "media_type",
      "status",
      "genres",
      "num_episodes",
      "start_season",
      "broadcast",
      "source",
      "average_episode_duration",
      "rating",
      "pictures",
      "background",
      "studios",
      "opening_themes",
      "ending_themes",
    ].join(",")

    const url = `${this.baseUrl}/anime/${malId}?fields=${fields}`
    return await this.fetchJson<MalAnimePayload>(url)
  }

  /**
   * Fetches official manga data from MyAnimeList v2 API.
   */
  async fetchManga(malId: number): Promise<MalMangaPayload> {
    const fields = [
      "id",
      "title",
      "main_picture",
      "alternative_titles",
      "start_date",
      "end_date",
      "synopsis",
      "mean",
      "rank",
      "popularity",
      "num_list_users",
      "num_scoring_users",
      "nsfw",
      "media_type",
      "status",
      "genres",
      "num_volumes",
      "num_chapters",
      "pictures",
      "background",
      "serialization",
      "authors{node{id,first_name,last_name},role}",
    ].join(",")

    const url = `${this.baseUrl}/manga/${malId}?fields=${fields}`
    return await this.fetchJson<MalMangaPayload>(url)
  }

  /**
   * Scrapes detailed episode list from MyAnimeList with titles, air dates, fillers, and recaps.
   */
  async fetchAnimeEpisodes(malId: number): Promise<MalScrapedEpisode[]> {
    const episodes: MalScrapedEpisode[] = []
    let offset = 0
    let hasMore = true

    while (hasMore && offset <= 1000) {
      try {
        const url = `https://myanimelist.net/anime/${malId}/_/episode?offset=${offset}`
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        })

        if (!res.ok) break

        const html = await res.text()
        const rowRegex =
          /<tr class="[^"]*episode-list-data[^"]*"[\s\S]*?<\/tr>/g
        let countInPage = 0
        let rowMatch

        while ((rowMatch = rowRegex.exec(html)) !== null) {
          countInPage++
          const rowHtml = rowMatch[0]

          const linkMatch = rowHtml.match(
            /<a\s+href="([^"]*\/episode\/(\d+))"[^>]*>([\s\S]*?)<\/a>/
          )
          if (!linkMatch || !linkMatch[1] || !linkMatch[2] || !linkMatch[3]) continue

          const episodeUrl = linkMatch[1]
          const episodeNum = parseInt(linkMatch[2], 10)
          const titlePrimary = this.decodeHtml(
            linkMatch[3].replace(/<[^>]+>/g, "").trim()
          )

          const subMatch = rowHtml.match(
            /<span\s+class="di-ib">([\s\S]*?)<\/span>/
          )
          let titleSecondary: string | undefined
          let titleNative: string | undefined
          if (subMatch && subMatch[1]) {
            const subText = this.decodeHtml(
              subMatch[1]
                .replace(/<[^>]+>/g, "")
                .replace(/&nbsp;/g, " ")
                .trim()
            )
            const parenMatch = subText.match(/^(.*?)\s*\((.*?)\)$/)
            if (parenMatch) {
              titleSecondary = parenMatch[1]?.trim() || undefined
              titleNative = parenMatch[2]?.trim() || undefined
            } else {
              titleSecondary = subText || undefined
            }
          }

          const airMatch = rowHtml.match(
            /<td\s+class="episode-aired[^"]*">([\s\S]*?)<\/td>/
          )
          let airDate: Date | undefined
          if (airMatch && airMatch[1]) {
            const airText = airMatch[1].replace(/<[^>]+>/g, "").trim()
            if (airText && airText !== "N/A" && !airText.includes("?")) {
              const parsed = new Date(airText)
              if (!isNaN(parsed.getTime())) {
                airDate = parsed
              }
            }
          }

          const isFiller =
            rowHtml.includes("icon-filler") ||
            /class="[^"]*filler[^"]*"/.test(rowHtml)
          const isRecap =
            rowHtml.includes("icon-recap") ||
            /class="[^"]*recap[^"]*"/.test(rowHtml)

          episodes.push({
            number: episodeNum,
            malEpisodeId: episodeNum,
            titlePrimary,
            titleSecondary:
              titleSecondary && titleSecondary !== titlePrimary
                ? titleSecondary
                : undefined,
            titleNative,
            airDate,
            isFiller,
            isRecap,
            malEpisodeUrl: episodeUrl,
          })
        }

        // If fewer than 100 rows on page, or no pagination, stop
        if (countInPage < 100 || !html.includes(`offset=${offset + 100}`)) {
          hasMore = false
        } else {
          offset += 100
        }
      } catch {
        break
      }
    }

    // Fetch single episode detailed synopsis & duration (up to 30 episodes in parallel batches)
    const maxDetailCount = Math.min(episodes.length, 30)
    const BATCH_SIZE = 5
    for (let i = 0; i < maxDetailCount; i += BATCH_SIZE) {
      const batch = episodes.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(async (ep) => {
          try {
            const epUrl = `https://myanimelist.net/anime/${malId}/_/episode/${ep.number}`
            const epRes = await fetch(epUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
            })
            if (!epRes.ok) return
            const epHtml = await epRes.text()

            // Duration: e.g. 00:47:40 -> 48 min
            const durMatch = epHtml.match(
              /<span class="fw-b">Duration:\s*<\/span>\s*([\d:]+)/i
            )
            if (durMatch && durMatch[1]) {
              const parts = durMatch[1].split(":").map(Number)
              if (
                parts.length === 3 &&
                parts[0] !== undefined &&
                parts[1] !== undefined &&
                parts[2] !== undefined
              ) {
                const totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2]
                ep.duration = Math.round(totalSec / 60)
              } else if (
                parts.length === 2 &&
                parts[0] !== undefined &&
                parts[1] !== undefined
              ) {
                const totalSec = parts[0] * 60 + parts[1]
                ep.duration = Math.round(totalSec / 60)
              }
            }

            // Synopsis
            const synMatch = epHtml.match(
              /<h2 class="fw-b">Synopsis<\/h2>([\s\S]*?)(?:<div\s+style|<div\s+class|<\/div>)/i
            )
            if (synMatch && synMatch[1]) {
              const raw = synMatch[1]
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<[^>]+>/g, "")
                .trim()
              if (raw && !raw.startsWith("No synopsis information")) {
                ep.description = this.decodeHtml(raw)
              }
            }
          } catch {}
        })
      )
    }

    return episodes
  }

  private decodeHtml(str: string): string {
    return str
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&rsquo;/g, "'")
      .replace(/&hellip;/g, "...")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
  }
}

export interface MalScrapedEpisode {
  number: number
  malEpisodeId?: number
  titlePrimary: string
  titleSecondary?: string
  titleNative?: string
  description?: string
  duration?: number
  airDate?: Date
  isFiller: boolean
  isRecap: boolean
  malEpisodeUrl?: string
}
