import { LogFactory } from '@Iris/logger'

const logger = new LogFactory('Borealis:Provider:TheTVDB')

export function normalizeTvdbImageUrl(url?: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('/')) return `https://artworks.thetvdb.com${trimmed}`
  return `https://artworks.thetvdb.com/${trimmed}`
}

export interface TvdbSearchItem {
  objectID?: string
  id?: string | number
  tvdb_id?: string | number
  name?: string
  image_url?: string
  year?: string
  status?: string
  overview?: string
  primary_language?: string
  translations?: Record<string, string>
  overviews?: Record<string, string>
  aliases?: string[]
}

export interface TvdbSeriesPayload {
  id: number
  name: string
  slug?: string
  image?: string
  firstAired?: string
  lastAired?: string
  overview?: string
  status?: { id?: number; name?: string }
  score?: number
  genres?: Array<{ id: number; name: string }>
  networks?: Array<{ id: number; name: string }>
  averageRuntime?: number
  translations?: Record<string, string>
  overviews?: Record<string, string>
}

export interface TvdbMoviePayload {
  id: number
  name: string
  slug?: string
  image?: string
  runtime?: number
  first_release_date?: string
  overview?: string
  status?: { id?: number; name?: string }
  score?: number
  genres?: Array<{ id: number; name: string }>
}

export class TheTVDBProvider {
  private readonly baseUrl = 'https://api4.thetvdb.com/v4'
  private token: string | null = null
  private tokenExpiresAt = 0
  private lastRequestTime = 0
  private readonly minDelayMs = 250 // 4 req/s

  private getApiKey(): string {
    return (
      process.env.THETVDB_KEY ||
      process.env.TVDB_API_KEY ||
      process.env.TVDB_KEY ||
      ''
    )
  }

  private getPin(): string {
    return process.env.THETVDB_PIN || process.env.TVDB_PIN || ''
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
    if (this.token && this.tokenExpiresAt > now + 60000) {
      return this.token
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error('[TheTVDBProvider] TVDB API key is missing from environment variables')
    }

    const pin = this.getPin()
    const body: Record<string, string> = { apikey: apiKey }
    if (pin) body.pin = pin

    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[TheTVDBProvider] Login failed HTTP ${res.status}: ${errText}`)
    }

    const json = (await res.json()) as { data?: { token?: string } }
    if (!json.data?.token) {
      throw new Error('[TheTVDBProvider] No token received from login')
    }

    this.token = json.data.token
    this.tokenExpiresAt = now + 28 * 24 * 60 * 60 * 1000 // 28 days
    return this.token
  }

  private async fetchJson<T>(endpoint: string): Promise<T | null> {
    await this.waitForRateLimit()
    const token = await this.getValidToken()

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      if (res.status === 404) return null
      throw new Error(`[TheTVDBProvider] Request to ${endpoint} failed HTTP ${res.status}`)
    }

    const json = (await res.json()) as { data?: T }
    return json.data ?? null
  }

  /**
   * Searches TVDB specifically for TV Series and returns search preview items.
   */
  async searchTvSeries(query: string, limit: number = 25): Promise<TvdbSearchItem[]> {
    const clean = query.trim()
    if (!clean) return []

    try {
      const maxLimit = Math.min(Math.max(limit, 1), 50)
      const url = `/search?query=${encodeURIComponent(clean)}&type=series&limit=${maxLimit}`
      const results = await this.fetchJson<TvdbSearchItem[]>(url)
      return Array.isArray(results) ? results : []
    } catch (err: any) {
      logger.error(`searchTvSeries failed: ${err.message}`)
      return []
    }
  }

  /**
   * Searches TVDB specifically for Movies and returns search preview items.
   */
  async searchMovies(query: string, limit: number = 25): Promise<TvdbSearchItem[]> {
    const clean = query.trim()
    if (!clean) return []

    try {
      const maxLimit = Math.min(Math.max(limit, 1), 50)
      const url = `/search?query=${encodeURIComponent(clean)}&type=movie&limit=${maxLimit}`
      const results = await this.fetchJson<TvdbSearchItem[]>(url)
      return Array.isArray(results) ? results : []
    } catch (err: any) {
      logger.error(`searchMovies failed: ${err.message}`)
      return []
    }
  }

  /**
   * Fetches full details for a TV Series.
   */
  async fetchTvSeries(tvdbId: number): Promise<TvdbSeriesPayload | null> {
    return this.fetchJson<TvdbSeriesPayload>(`/series/${tvdbId}/extended`)
  }

  /**
   * Fetches full details for a Movie.
   */
  async fetchMovie(tvdbId: number): Promise<TvdbMoviePayload | null> {
    return this.fetchJson<TvdbMoviePayload>(`/movies/${tvdbId}/extended`)
  }
}
