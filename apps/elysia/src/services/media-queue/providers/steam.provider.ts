import { logQueue } from "../logger.js"
import { c } from "../../../utils/colors.js"

export interface SteamAppDetailsPayload {
  name?: string
  steam_appid?: number
  controller_support?: string // "full" | "partial"
  pc_requirements?: { minimum?: string; recommended?: string } | []
  mac_requirements?: { minimum?: string; recommended?: string } | []
  linux_requirements?: { minimum?: string; recommended?: string } | []
  platforms?: {
    windows?: boolean
    mac?: boolean
    linux?: boolean
  }
  achievements?: {
    total?: number
    highlighted?: Array<{
      name: string
      path: string
    }>
  }
  categories?: Array<{ id: number; description: string }>
  genres?: Array<{ id: string; description: string }>
}

export interface SteamDeckCompatibilityReport {
  appid: number
  resolved_category: number // 0=Unknown, 1=Unsupported, 2=Playable, 3=Verified
  resolved_items?: Array<{
    display_type: number
    loc_token: string
    test_timestamp?: number
  }>
  steamos_resolved_category?: number
  machine_resolved_category?: number
}

export class SteamProvider {
  private lastRequestTime = 0
  private readonly minDelayMs = 200 // 5 req/s

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed))
    }
    this.lastRequestTime = Date.now()
  }

  /**
   * Fetches official Steam Store app details.
   */
  async fetchAppDetails(appId: number): Promise<SteamAppDetailsPayload | null> {
    await this.waitForRateLimit()
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`

    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IRIS/1.0",
      },
    })

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 5
      logQueue(
        `${c.magenta(c.bold("[MediaQueue]"))} ${c.red(c.bold("⚠️ [RATE LIMIT 429]"))} ${c.red(`Steam Store HTTP 429 Too Many Requests. Backing off for ${retryAfter}s...`)}`
      )
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      return this.fetchAppDetails(appId)
    }

    if (!res.ok) {
      return null
    }

    const json = (await res.json()) as Record<
      string,
      { success: boolean; data?: SteamAppDetailsPayload }
    >
    const appData = json[String(appId)]
    if (!appData || !appData.success || !appData.data) {
      return null
    }

    return appData.data
  }

  /**
   * Fetches Steam Deck / Proton compatibility report for a given App ID.
   */
  async fetchDeckCompatibility(
    appId: number
  ): Promise<SteamDeckCompatibilityReport | null> {
    await this.waitForRateLimit()
    const url = `https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID=${appId}&l=english`

    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IRIS/1.0",
      },
    })

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 5
      logQueue(
        `${c.magenta(c.bold("[MediaQueue]"))} ${c.red(c.bold("⚠️ [RATE LIMIT 429]"))} ${c.red(`Steam Deck HTTP 429 Too Many Requests. Backing off for ${retryAfter}s...`)}`
      )
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      return this.fetchDeckCompatibility(appId)
    }

    if (!res.ok) {
      return null
    }

    const json = (await res.json()) as {
      success: number
      results?: SteamDeckCompatibilityReport
    }
    if (!json || !json.results) {
      return null
    }

    return json.results
  }
}
