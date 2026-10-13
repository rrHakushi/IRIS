import { LogFactory } from '@Iris/logger'

const logger = new LogFactory('Borealis:Provider:Deezer')

export interface DeezerTrackPayload {
  id: number
  title: string
  title_short?: string
  duration: number
  preview?: string
  explicit_lyrics?: boolean
  artist?: {
    id: number
    name: string
    picture?: string
    picture_medium?: string
  }
  album?: {
    id: number
    title: string
    cover?: string
    cover_medium?: string
    cover_big?: string
  }
}

export interface DeezerAlbumPayload {
  id: number
  title: string
  cover?: string
  cover_medium?: string
  cover_big?: string
  release_date?: string
  nb_tracks?: number
  duration?: number
  artist?: {
    id: number
    name: string
    picture?: string
  }
  tracks?: {
    data?: DeezerTrackPayload[]
  }
}

export class DeezerProvider {
  private readonly baseUrl = 'https://api.deezer.com'
  private lastRequestTime = 0
  private readonly minDelayMs = 100 // 10 req/s

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed))
    }
    this.lastRequestTime = Date.now()
  }

  private async fetchJson<T>(endpoint: string): Promise<T | null> {
    await this.waitForRateLimit()
    try {
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'IRIS-Platform/1.0 (https://iris.app)',
          Accept: 'application/json',
        },
      })
      if (!res.ok) return null
      const data = await res.json()
      if (typeof data === 'object' && data !== null && 'error' in data) return null
      return data as T
    } catch {
      return null
    }
  }

  async searchTracks(query: string, limit = 25): Promise<DeezerTrackPayload[]> {
    const res = await this.fetchJson<{ data?: DeezerTrackPayload[] }>(
      `/search?q=${encodeURIComponent(query)}&limit=${limit}`
    )
    return res?.data ?? []
  }

  async searchAlbums(query: string, limit = 25): Promise<DeezerAlbumPayload[]> {
    const res = await this.fetchJson<{ data?: DeezerAlbumPayload[] }>(
      `/search/album?q=${encodeURIComponent(query)}&limit=${limit}`
    )
    return res?.data ?? []
  }

  async getTrack(id: number | string): Promise<DeezerTrackPayload | null> {
    return this.fetchJson<DeezerTrackPayload>(`/track/${id}`)
  }

  async getAlbum(id: number | string): Promise<DeezerAlbumPayload | null> {
    return this.fetchJson<DeezerAlbumPayload>(`/album/${id}`)
  }
}
