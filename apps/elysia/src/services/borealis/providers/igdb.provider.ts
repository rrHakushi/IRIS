import { LogFactory } from '@Iris/logger'

const logger = new LogFactory('Borealis:Provider:IGDB')

export interface IgdbSearchPreview {
  id: number
  name: string
  cover?: { id: number; image_id: string }
  first_release_date?: number
}

export interface IgdbGamePayload {
  id: number
  name: string
  slug?: string
  summary?: string
  storyline?: string
  cover?: { id: number; image_id: string }
  first_release_date?: number
  genres?: Array<{ id: number; name: string }>
  platforms?: Array<{ id: number; name: string; abbreviation?: string }>
  rating?: number
  aggregated_rating?: number
}

export class IGDBProvider {
  private readonly baseUrl = 'https://api.igdb.com/v4'
  private accessToken: string | null = null
  private tokenExpiresAt = 0
  private lastRequestTime = 0
  private readonly minDelayMs = 250 // 4 req/s

  private getClientId(): string {
    return Bun.env.IGDB_CLIENT_ID || ''
  }

  private getClientSecret(): string {
    return Bun.env.IGDB_CLIENT_SECRET || ''
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
    if (this.accessToken && this.tokenExpiresAt > now + 60000) {
      return this.accessToken
    }

    const clientId = this.getClientId()
    const clientSecret = this.getClientSecret()

    if (!clientId || !clientSecret) {
      throw new Error('[IGDBProvider] IGDB_CLIENT_ID or IGDB_CLIENT_SECRET is missing in environment')
    }

    const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
    const res = await fetch(tokenUrl, { method: 'POST' })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[IGDBProvider] Twitch OAuth token failed HTTP ${res.status}: ${errText}`)
    }

    const json = (await res.json()) as { access_token: string; expires_in: number }
    this.accessToken = json.access_token
    this.tokenExpiresAt = now + (json.expires_in - 300) * 1000
    return this.accessToken
  }

  /**
   * Searches IGDB for games by title/query.
   */
  async searchGames(query: string, limit: number = 25): Promise<IgdbSearchPreview[]> {
    const clean = query.trim()
    if (!clean) return []

    try {
      await this.waitForRateLimit()
      const token = await this.getValidToken()
      const clientId = this.getClientId()

      const maxResults = Math.min(Math.max(limit, 1), 50)
      const sanitized = clean.replace(/"/g, '\\"')
      const igdbQuery = `
        search "${sanitized}";
        fields id, name, cover.image_id, first_release_date;
        limit ${maxResults};
      `

      const res = await fetch(`${this.baseUrl}/games`, {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain',
          Accept: 'application/json',
        },
        body: igdbQuery,
      })

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 5
        logger.warn(`IGDB HTTP 429. Backing off for ${retryAfter}s...`)
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
        return this.searchGames(query, limit)
      }

      if (!res.ok) return []

      const items = (await res.json()) as IgdbSearchPreview[]
      if (!Array.isArray(items)) return []

      return items.filter((g) => Boolean(g && typeof g.id === 'number'))
    } catch (err: any) {
      logger.error(`searchGames failed: ${err.message}`)
      return []
    }
  }

  /**
   * Fetches game details by IGDB Game ID.
   */
  async fetchGame(igdbId: number): Promise<IgdbGamePayload | null> {
    await this.waitForRateLimit()
    const token = await this.getValidToken()
    const clientId = this.getClientId()

    const query = `
      fields 
        name, slug, summary, storyline,
        cover.image_id,
        first_release_date,
        genres.name,
        platforms.name, platforms.abbreviation,
        rating, aggregated_rating;
      where id = ${igdbId};
    `

    const res = await fetch(`${this.baseUrl}/games`, {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
        Accept: 'application/json',
      },
      body: query,
    })

    if (!res.ok) return null

    const items = (await res.json()) as IgdbGamePayload[]
    return items?.[0] ?? null
  }
}
