import { LogFactory, c } from '@Iris/logger'

const logger = new LogFactory('Borealis:Provider:AniList')

export interface AniListMediaRelationNode {
  id: number
  type: 'ANIME' | 'MANGA'
  format?: string
  status?: string
  title: {
    userPreferred: string
    romaji?: string
    english?: string
    native?: string
  }
  coverImage?: {
    extraLarge?: string
    large?: string
    medium?: string
  }
}

export interface AniListMediaRelationEdge {
  relationType: string
  node: AniListMediaRelationNode
}

export interface AniListAnimePayload {
  id: number
  idMal?: number
  updatedAt?: number
  title: {
    userPreferred: string
    romaji?: string
    english?: string
    native?: string
  }
  coverImage?: {
    extraLarge?: string
    large?: string
    medium?: string
    color?: string
  }
  bannerImage?: string
  description?: string
  hashtag?: string
  countryOfOrigin?: string
  episodes?: number
  duration?: number
  startDate?: { year?: number; month?: number; day?: number }
  endDate?: { year?: number; month?: number; day?: number }
  genres?: string[]
  source?: string
  format?: string
  status?: string
  season?: string
  seasonYear?: number
  averageScore?: number
  popularity?: number
  favourites?: number
  isAdult?: boolean
  synonyms?: string[]
  siteUrl?: string
  externalLinks?: Array<{
    id: number
    url: string
    site: string
    type?: string
    icon?: string
    color?: string
    language?: string
    notes?: string
    isDisabled?: boolean
  }>
  trailer?: { id?: string; site?: string }
  nextAiringEpisode?: { episode: number; airingAt: number }
  streamingEpisodes?: Array<{
    title?: string
    thumbnail?: string
    url?: string
    site?: string
  }>
  airingSchedule?: {
    nodes: Array<{ id: number; episode: number; airingAt: number }>
  }
  studios?: {
    edges: Array<{
      isMain: boolean
      node: {
        id: number
        name: string
        isAnimationStudio: boolean
        siteUrl?: string
      }
    }>
  }
  characters?: {
    edges: Array<{
      role: string
      node: {
        id: number
        name: {
          full: string
          native?: string
          alternative?: string[]
          alternativeSpoiler?: string[]
        }
        image?: { large?: string; medium?: string }
        description?: string
        gender?: string
        age?: string
        bloodType?: string
        dateOfBirth?: { year?: number; month?: number; day?: number }
        favourites?: number
      }
      voiceActors?: Array<{
        id: number
        name: { full: string; native?: string; alternative?: string[] }
        image?: { large?: string; medium?: string }
        description?: string
        languageV2?: string
      }>
    }>
  }
  staff?: {
    edges: Array<{
      role: string
      node: {
        id: number
        name: { full: string; native?: string; alternative?: string[] }
        image?: { large?: string; medium?: string }
        description?: string
        primaryOccupations?: string[]
      }
    }>
  }
  relations?: {
    edges: AniListMediaRelationEdge[]
  }
}

export interface AniListMangaPayload {
  id: number
  idMal?: number
  updatedAt?: number
  title: {
    userPreferred: string
    romaji?: string
    english?: string
    native?: string
  }
  coverImage?: {
    extraLarge?: string
    large?: string
    medium?: string
    color?: string
  }
  bannerImage?: string
  description?: string
  hashtag?: string
  countryOfOrigin?: string
  chapters?: number
  volumes?: number
  startDate?: { year?: number; month?: number; day?: number }
  endDate?: { year?: number; month?: number; day?: number }
  genres?: string[]
  source?: string
  format?: string
  status?: string
  averageScore?: number
  popularity?: number
  favourites?: number
  isAdult?: boolean
  synonyms?: string[]
  siteUrl?: string
  externalLinks?: Array<{
    id: number
    url: string
    site: string
    type?: string
    icon?: string
    color?: string
    language?: string
    notes?: string
    isDisabled?: boolean
  }>
  characters?: {
    edges: Array<{
      role: string
      node: {
        id: number
        name: {
          full: string
          native?: string
          alternative?: string[]
          alternativeSpoiler?: string[]
        }
        image?: { large?: string; medium?: string }
        description?: string
        gender?: string
        age?: string
        bloodType?: string
        dateOfBirth?: { year?: number; month?: number; day?: number }
        favourites?: number
      }
    }>
  }
  staff?: {
    edges: Array<{
      role: string
      node: {
        id: number
        name: { full: string; native?: string; alternative?: string[] }
        image?: { large?: string; medium?: string }
        description?: string
        primaryOccupations?: string[]
      }
    }>
  }
  relations?: {
    edges: AniListMediaRelationEdge[]
  }
}

export interface AniListAnimeSearchPreview {
  id: number
  title: {
    userPreferred: string
    romaji?: string
    english?: string
    native?: string
  }
  coverImage?: {
    medium?: string
    large?: string
  }
  isAdult?: boolean
  format?: string
  seasonYear?: number
  season?: string
}

export interface AniListMangaSearchPreview {
  id: number
  title: {
    userPreferred: string
    romaji?: string
    english?: string
    native?: string
  }
  coverImage?: {
    medium?: string
    large?: string
  }
  isAdult?: boolean
  format?: string
  startDate?: {
    year?: number
  }
}

export interface AniListCharacterPayload {
  id: number
  name: {
    full: string
    native?: string
    alternative?: string[]
    alternativeSpoiler?: string[]
  }
  image?: {
    medium?: string
    large?: string
  }
  description?: string
  gender?: string
  age?: string
  bloodType?: string
  dateOfBirth?: { year?: number; month?: number; day?: number }
  favourites?: number
}

export interface AniListStaffPayload {
  id: number
  name: {
    full: string
    native?: string
    alternative?: string[]
  }
  image?: {
    medium?: string
    large?: string
  }
  description?: string
  gender?: string
  age?: string
  dateOfBirth?: { year?: number; month?: number; day?: number }
  primaryOccupations?: string[]
  favourites?: number
}

export class AniListProvider {
  private readonly endpoint = 'https://graphql.anilist.co'
  private lastRequestTime = 0
  private readonly minDelayMs = 2000 // ~30 requests/min safe pacing (AniList degraded rate limit)
  private rateLimitRemaining = 30
  private rateLimitResetTimestamp = 0
  private pauseUntil = 0
  private last429LogTime = 0
  private requestQueue: Promise<void> = Promise.resolve()
  private appToken: string | null = null
  private tokenExpiresAt = 0

  private async getAppToken(): Promise<string | null> {
    const clientId = Bun.env.ANILIST_CLIENT_ID
    const clientSecret = Bun.env.ANILIST_CLIENT_SECRET
    if (!clientId || !clientSecret) return null

    const now = Date.now()
    if (this.appToken && this.tokenExpiresAt > now + 60000) {
      return this.appToken
    }

    try {
      const res = await fetch('https://anilist.co/api/v2/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as { access_token: string; expires_in: number }
        if (data.access_token) {
          this.appToken = data.access_token
          this.tokenExpiresAt = now + (data.expires_in || 31536000) * 1000
          return this.appToken
        }
      }
    } catch {
      // Fallback to anonymous
    }

    return null
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    if (this.pauseUntil > now) {
      const waitMs = this.pauseUntil - now
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs))
      }
    }

    const currentNow = Date.now()
    if (this.rateLimitRemaining <= 2 && this.rateLimitResetTimestamp > 0) {
      const waitMs = Math.max(0, this.rateLimitResetTimestamp * 1000 - currentNow + 1000)
      if (waitMs > 0 && waitMs < 120000) {
        const sec = (waitMs / 1000).toFixed(1)
        const now2 = Date.now()
        if (now2 - this.last429LogTime > 4000) {
          this.last429LogTime = now2
          logger.warn(`AniList threshold reached (remaining: ${this.rateLimitRemaining}). Pausing for ${sec}s...`)
        }
        await new Promise((r) => setTimeout(r, waitMs))
      }
    }

    const elapsed = Date.now() - this.lastRequestTime
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed))
    }
  }

  private async executeGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const queuePromise = this.requestQueue.then(async () => {
      return await this.performGraphQLRequest<T>(query, variables)
    })
    this.requestQueue = queuePromise.then(() => {}).catch(() => {})
    return queuePromise
  }

  private async performGraphQLRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    await this.waitForRateLimit()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'IRIS-Platform/1.0 (https://iris.app)',
    }

    const token = await this.getAppToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })

    this.lastRequestTime = Date.now()

    const remainingHeader = res.headers.get('x-ratelimit-remaining')
    const resetHeader = res.headers.get('x-ratelimit-reset')
    if (remainingHeader !== null) {
      const parsedRemaining = parseInt(remainingHeader, 10)
      if (!isNaN(parsedRemaining)) this.rateLimitRemaining = parsedRemaining
    }
    if (resetHeader !== null) {
      const parsedReset = parseInt(resetHeader, 10)
      if (!isNaN(parsedReset)) this.rateLimitResetTimestamp = parsedReset
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After')) || 60
      this.pauseUntil = Date.now() + retryAfter * 1000
      logger.warn(`AniList HTTP 429. Pausing for ${retryAfter}s...`)
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      return this.performGraphQLRequest<T>(query, variables)
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`AniList GraphQL failed HTTP ${res.status}: ${text}`)
    }

    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
    if (json.errors && json.errors.length > 0) {
      throw new Error(`AniList GraphQL Error: ${json.errors[0]?.message || 'Unknown error'}`)
    }

    if (!json.data) {
      throw new Error('AniList GraphQL response contained no data payload')
    }

    return json.data
  }

  /**
   * Searches AniList for anime by title/query and returns minimal search preview items.
   */
  async searchAnime(query: string, limit: number = 25): Promise<AniListAnimeSearchPreview[]> {
    const clean = query.trim()
    if (!clean) return []

    const gqlQuery = `
      query SearchAnime($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title {
              userPreferred
              romaji
              english
              native
            }
            coverImage {
              medium
              large
            }
            isAdult
            format
            seasonYear
            season
          }
        }
      }
    `

    try {
      const data = await this.executeGraphQL<{
        Page?: { media?: AniListAnimeSearchPreview[] }
      }>(gqlQuery, { search: clean, perPage: Math.min(limit, 50) })

      return data.Page?.media || []
    } catch (err: any) {
      logger.error(`searchAnime failed: ${err.message}`)
      return []
    }
  }

  /**
   * Searches AniList for manga by title/query and returns minimal search preview items.
   */
  async searchManga(query: string, limit: number = 25): Promise<AniListMangaSearchPreview[]> {
    const clean = query.trim()
    if (!clean) return []

    const gqlQuery = `
      query SearchManga($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
            id
            title {
              userPreferred
              romaji
              english
              native
            }
            coverImage {
              medium
              large
            }
            isAdult
            format
            startDate {
              year
            }
          }
        }
      }
    `

    try {
      const data = await this.executeGraphQL<{
        Page?: { media?: AniListMangaSearchPreview[] }
      }>(gqlQuery, { search: clean, perPage: Math.min(limit, 50) })

      return data.Page?.media || []
    } catch (err: any) {
      logger.error(`searchManga failed: ${err.message}`)
      return []
    }
  }

  /**
   * Fetches rich anime details from AniList by ID.
   */
  async fetchAnime(anilistId: number): Promise<AniListAnimePayload> {
    const query = `
      query GetAnimeDetails($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          updatedAt
          title {
            userPreferred
            romaji
            english
            native
          }
          coverImage {
            medium
            large
            color
          }
          bannerImage
          description(asHtml: false)
          hashtag
          countryOfOrigin
          episodes
          duration
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          genres
          source
          format
          status
          season
          seasonYear
          averageScore
          popularity
          favourites
          isAdult
          synonyms
          siteUrl
          externalLinks {
            id
            url
            site
            type
            icon
            color
            language
            notes
            isDisabled
          }
          trailer {
            id
            site
          }
          nextAiringEpisode {
            episode
            airingAt
          }
          streamingEpisodes {
            title
            thumbnail
            url
            site
          }
          airingSchedule(notYetAired: false, perPage: 100) {
            nodes {
              id
              episode
              airingAt
            }
          }
          studios {
            edges {
              isMain
              node {
                id
                name
                isAnimationStudio
                siteUrl
              }
            }
          }
          characters(page: 1, perPage: 50, sort: [ROLE, RELEVANCE]) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  medium
                  large
                }
                description
                gender
                age
                bloodType
                dateOfBirth {
                  year
                  month
                  day
                }
                favourites
              }
              voiceActors(language: JAPANESE, sort: [RELEVANCE]) {
                id
                name {
                  full
                  native
                }
                image {
                  medium
                  large
                }
                languageV2
              }
            }
          }
          staff(page: 1, perPage: 50) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  medium
                  large
                }
                description
                primaryOccupations
              }
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                type
                format
                title {
                  userPreferred
                  romaji
                  english
                  native
                }
                coverImage {
                  medium
                  large
                }
              }
            }
          }
        }
      }
    `

    const data = await this.executeGraphQL<{ Media: AniListAnimePayload }>(query, { id: anilistId })
    return data.Media
  }

  /**
   * Fetches rich manga details from AniList by ID.
   */
  async fetchManga(anilistId: number): Promise<AniListMangaPayload> {
    const query = `
      query GetMangaDetails($id: Int) {
        Media(id: $id, type: MANGA) {
          id
          idMal
          updatedAt
          title {
            userPreferred
            romaji
            english
            native
          }
          coverImage {
            medium
            large
            color
          }
          bannerImage
          description(asHtml: false)
          hashtag
          countryOfOrigin
          chapters
          volumes
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          genres
          source
          format
          status
          averageScore
          popularity
          favourites
          isAdult
          synonyms
          siteUrl
          externalLinks {
            id
            url
            site
            type
            icon
            color
            language
            notes
            isDisabled
          }
          characters(page: 1, perPage: 50, sort: [ROLE, RELEVANCE]) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  medium
                  large
                }
                description
                gender
                age
              }
            }
          }
          staff(page: 1, perPage: 50) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                }
                image {
                  medium
                  large
                }
                description
              }
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                type
                format
                title {
                  userPreferred
                  romaji
                  english
                  native
                }
                coverImage {
                  medium
                  large
                }
              }
            }
          }
        }
      }
    `

    const data = await this.executeGraphQL<{ Media: AniListMangaPayload }>(query, { id: anilistId })
    return data.Media
  }

  /**
   * Fetches character details from AniList by ID with medium & large images.
   */
  async fetchCharacter(anilistId: number): Promise<AniListCharacterPayload | null> {
    const query = `
      query GetCharacterDetails($id: Int) {
        Character(id: $id) {
          id
          name {
            full
            native
            alternative
            alternativeSpoiler
          }
          image {
            medium
            large
          }
          description(asHtml: false)
          gender
          age
          bloodType
          dateOfBirth {
            year
            month
            day
          }
          favourites
        }
      }
    `

    try {
      const data = await this.executeGraphQL<{ Character?: AniListCharacterPayload }>(query, { id: anilistId })
      return data.Character || null
    } catch (err: any) {
      logger.error(`fetchCharacter failed for AniList #${anilistId}: ${err.message}`)
      return null
    }
  }

  /**
   * Searches AniList for characters by name/query with medium & large images.
   */
  async searchCharacters(query: string, limit: number = 25): Promise<AniListCharacterPayload[]> {
    const clean = query.trim()
    if (!clean) return []

    const gqlQuery = `
      query SearchCharacters($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          characters(search: $search, sort: SEARCH_MATCH) {
            id
            name {
              full
              native
              alternative
            }
            image {
              medium
              large
            }
            gender
            age
            description(asHtml: false)
            favourites
          }
        }
      }
    `

    try {
      const data = await this.executeGraphQL<{
        Page?: { characters?: AniListCharacterPayload[] }
      }>(gqlQuery, { search: clean, perPage: Math.min(limit, 50) })

      return data.Page?.characters || []
    } catch (err: any) {
      logger.error(`searchCharacters failed: ${err.message}`)
      return []
    }
  }

  /**
   * Fetches staff details from AniList by ID with medium & large images.
   */
  async fetchStaff(anilistId: number): Promise<AniListStaffPayload | null> {
    const query = `
      query GetStaffDetails($id: Int) {
        Staff(id: $id) {
          id
          name {
            full
            native
            alternative
          }
          image {
            medium
            large
          }
          description(asHtml: false)
          gender
          age
          dateOfBirth {
            year
            month
            day
          }
          primaryOccupations
          favourites
        }
      }
    `

    try {
      const data = await this.executeGraphQL<{ Staff?: AniListStaffPayload }>(query, { id: anilistId })
      return data.Staff || null
    } catch (err: any) {
      logger.error(`fetchStaff failed for AniList #${anilistId}: ${err.message}`)
      return null
    }
  }

  /**
   * Searches AniList for staff/people by name/query with medium & large images.
   */
  async searchStaff(query: string, limit: number = 25): Promise<AniListStaffPayload[]> {
    const clean = query.trim()
    if (!clean) return []

    const gqlQuery = `
      query SearchStaff($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          staff(search: $search, sort: SEARCH_MATCH) {
            id
            name {
              full
              native
              alternative
            }
            image {
              medium
              large
            }
            primaryOccupations
            description(asHtml: false)
            favourites
          }
        }
      }
    `

    try {
      const data = await this.executeGraphQL<{
        Page?: { staff?: AniListStaffPayload[] }
      }>(gqlQuery, { search: clean, perPage: Math.min(limit, 50) })

      return data.Page?.staff || []
    } catch (err: any) {
      logger.error(`searchStaff failed: ${err.message}`)
      return []
    }
  }
}

