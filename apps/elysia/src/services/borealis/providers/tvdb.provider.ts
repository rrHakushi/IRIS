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

export interface TvdbCharacter {
  id: number
  name: string
  peopleId?: number
  personName?: string
  personImgURL?: string
  image?: string
  isFeatured?: boolean
  typeName?: string
  peopleType?: string
  type?: number
}

export interface TvdbEpisode {
  id: number
  seriesId?: number
  name?: string
  aired?: string
  runtime?: number
  overview?: string
  image?: string
  seasonNumber: number
  number: number
  finaleType?: string
}

export interface TvdbCompany {
  id: number
  name: string
  slug?: string
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
  artworks?: Array<{ image?: string; type?: number; language?: string }>
  companies?: {
    studio?: TvdbCompany[]
    network?: TvdbCompany[]
    production?: TvdbCompany[]
    distributor?: TvdbCompany[]
  }
  trailers?: Array<{ id: number; url: string; language?: string }>
  contentRatings?: Array<{
    name: string
    country: string
    description?: string
    fullname?: string
  }>
  originalLanguage?: string
  originalCountry?: string
  production_countries?: Array<{ id?: number; country?: string; name?: string }>
  remoteIds?: Array<{ id: string; type: number; sourceName: string }>
  characters?: TvdbCharacter[]
  nameTranslations?: string[]
  overviewTranslations?: string[]
  aliases?: Array<{ language?: string; name?: string } | string>
  seasons?: Array<{
    id: number
    seriesId?: number
    type?: { id: number; name: string }
    number: number
    name?: string
    image?: string
    year?: string
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
  tags?: Array<string | { name?: string; tag?: string; tagName?: string; helpText?: string }>
  engTranslation?: {
    name?: string
    overview?: string
    language?: string
    aliases?: string[]
  }
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
    studio?: TvdbCompany[]
    production?: TvdbCompany[]
    distributor?: TvdbCompany[]
    network?: TvdbCompany[]
    special_effects?: TvdbCompany[]
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
  nameTranslations?: string[]
  overviewTranslations?: string[]
  aliases?: Array<{ language?: string; name?: string } | string>
  tags?: Array<string | { name?: string; tag?: string; tagName?: string; helpText?: string }>
  engTranslation?: {
    name?: string
    overview?: string
    language?: string
    aliases?: string[]
  }
}

export class TheTVDBProvider {
  private readonly baseUrl = 'https://api4.thetvdb.com/v4'
  private token: string | null = null
  private tokenExpiresAt = 0
  private lastRequestTime = 0
  private readonly minDelayMs = 250 // 4 req/s

  private getApiKey(): string {
    return (
      Bun.env.THETVDB_KEY ||
      Bun.env.TVDB_API_KEY ||
      Bun.env.TVDB_KEY ||
      ''
    )
  }

  private getPin(): string {
    return Bun.env.THETVDB_PIN || Bun.env.TVDB_PIN || ''
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
   * Fetches translation for a Movie (e.g. English name & overview).
   */
  async fetchMovieTranslation(
    tvdbId: number,
    language: string = 'eng'
  ): Promise<{
    name?: string
    overview?: string
    language?: string
    aliases?: string[]
  } | null> {
    try {
      return await this.fetchJson<{
        name?: string
        overview?: string
        language?: string
        aliases?: string[]
      }>(`/movies/${tvdbId}/translations/${language}`)
    } catch {
      return null
    }
  }

  /**
   * Fetches translation for a TV series (e.g. English name & overview).
   */
  async fetchTvSeriesTranslation(
    tvdbId: number,
    language: string = 'eng'
  ): Promise<{
    name?: string
    overview?: string
    language?: string
    aliases?: string[]
  } | null> {
    try {
      return await this.fetchJson<{
        name?: string
        overview?: string
        language?: string
        aliases?: string[]
      }>(`/series/${tvdbId}/translations/${language}`)
    } catch {
      return null
    }
  }

  /**
   * Fetches all characters & cast for a TV series.
   */
  async fetchTvCharacters(tvdbId: number): Promise<TvdbCharacter[]> {
    try {
      const chars = await this.fetchJson<TvdbCharacter[]>(`/series/${tvdbId}/characters`)
      return Array.isArray(chars) ? chars : []
    } catch {
      return []
    }
  }

  /**
   * Fetches all episodes across all seasons for a TV series (paginated).
   */
  async fetchTvEpisodes(
    tvdbId: number,
    language: string = 'eng'
  ): Promise<TvdbEpisode[]> {
    const allEpisodes: TvdbEpisode[] = []
    let page = 0
    let hasMore = true

    while (hasMore && page < 20) {
      try {
        let res: { episodes?: TvdbEpisode[] } | null = null
        if (language) {
          try {
            res = await this.fetchJson<{
              episodes?: TvdbEpisode[]
            }>(`/series/${tvdbId}/episodes/default/${language}?page=${page}`)
          } catch {
            res = null
          }
        }

        if (!res || !res.episodes || res.episodes.length === 0) {
          res = await this.fetchJson<{
            episodes?: TvdbEpisode[]
          }>(`/series/${tvdbId}/episodes/default?page=${page}`)
        }

        const episodes = res?.episodes || []
        if (episodes.length === 0) {
          hasMore = false
        } else {
          allEpisodes.push(...episodes)
          page++
        }
      } catch {
        hasMore = false
      }
    }

    return allEpisodes
  }

  /**
   * Fetches full details for a TV Series.
   */
  async fetchTvSeries(tvdbId: number): Promise<TvdbSeriesPayload | null> {
    const series = await this.fetchJson<TvdbSeriesPayload>(`/series/${tvdbId}/extended`)
    if (
      series &&
      (series.originalLanguage?.toLowerCase() !== 'eng' ||
        series.nameTranslations?.includes('eng') ||
        series.overviewTranslations?.includes('eng'))
    ) {
      const eng = await this.fetchTvSeriesTranslation(tvdbId, 'eng').catch(() => null)
      if (eng) {
        series.engTranslation = eng
      }
    }
    return series
  }

  /**
   * Fetches full details for a Movie.
   */
  async fetchMovie(tvdbId: number): Promise<TvdbMoviePayload | null> {
    const movie = await this.fetchJson<TvdbMoviePayload>(`/movies/${tvdbId}/extended`)
    if (
      movie &&
      (movie.originalLanguage?.toLowerCase() !== 'eng' ||
        movie.nameTranslations?.includes('eng') ||
        movie.overviewTranslations?.includes('eng'))
    ) {
      const eng = await this.fetchMovieTranslation(tvdbId, 'eng').catch(() => null)
      if (eng) {
        movie.engTranslation = eng
      }
    }
    return movie
  }
}
