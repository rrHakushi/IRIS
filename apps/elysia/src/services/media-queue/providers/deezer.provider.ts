export interface DeezerArtistPayload {
  id: number
  name: string
  link?: string
  share?: string
  picture?: string
  picture_small?: string
  picture_medium?: string
  picture_big?: string
  picture_xl?: string
  nb_album?: number
  nb_fan?: number
  radio?: boolean
  tracklist?: string
  role?: string
}

export interface DeezerAlbumPayload {
  id: number
  title: string
  upc?: string
  link?: string
  share?: string
  cover?: string
  cover_small?: string
  cover_medium?: string
  cover_big?: string
  cover_xl?: string
  genre_id?: number
  genres?: {
    data?: Array<{ id: number; name: string; picture?: string }>
  }
  label?: string
  nb_tracks?: number
  duration?: number
  fans?: number
  release_date?: string
  record_type?: string
  available?: boolean
  tracklist?: string
  explicit_lyrics?: boolean
  explicit_content_lyrics?: number
  explicit_content_cover?: number
  contributors?: DeezerArtistPayload[]
  artist?: DeezerArtistPayload
  tracks?: {
    data?: DeezerTrackPayload[]
  }
}

export interface DeezerTrackPayload {
  id: number
  title: string
  title_short?: string
  title_version?: string
  unseen?: boolean
  isrc?: string
  link?: string
  share?: string
  duration: number
  track_position?: number
  disk_number?: number
  rank?: number
  release_date?: string
  explicit_lyrics?: boolean
  explicit_content_lyrics?: number
  explicit_content_cover?: number
  preview?: string
  bpm?: number
  gain?: number
  available_countries?: string[]
  contributors?: DeezerArtistPayload[]
  artist?: DeezerArtistPayload
  album?: DeezerAlbumPayload
}

export interface DeezerPlaylistPayload {
  id: number
  title: string
  description?: string
  duration?: number
  public?: boolean
  is_loved_track?: boolean
  collaborative?: boolean
  nb_tracks: number
  fans?: number
  link?: string
  share?: string
  picture?: string
  picture_small?: string
  picture_medium?: string
  picture_big?: string
  picture_xl?: string
  creator?: {
    id: number
    name: string
    tracklist?: string
  }
  tracks?: {
    data?: DeezerTrackPayload[]
  }
}

export class DeezerProvider {
  private readonly baseUrl = "https://api.deezer.com"
  private lastRequestTime = 0
  private readonly minDelayMs = 100 // 10 req/s Deezer public limit safe buffer

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
      const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`
      const res = await fetch(url, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (https://iris.app)",
          Accept: "application/json",
        },
      })
      if (!res.ok) return null
      const data = await res.json()
      if (typeof data === "object" && data !== null && "error" in data) return null
      return data as T
    } catch {
      return null
    }
  }

  async getTrack(id: number | string): Promise<DeezerTrackPayload | null> {
    return this.fetchJson<DeezerTrackPayload>(`/track/${id}`)
  }

  async getAlbum(id: number | string): Promise<DeezerAlbumPayload | null> {
    return this.fetchJson<DeezerAlbumPayload>(`/album/${id}`)
  }

  async getArtist(id: number | string): Promise<DeezerArtistPayload | null> {
    return this.fetchJson<DeezerArtistPayload>(`/artist/${id}`)
  }

  async getPlaylist(id: number | string): Promise<DeezerPlaylistPayload | null> {
    return this.fetchJson<DeezerPlaylistPayload>(`/playlist/${id}`)
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

  async searchArtists(query: string, limit = 25): Promise<DeezerArtistPayload[]> {
    const res = await this.fetchJson<{ data?: DeezerArtistPayload[] }>(
      `/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`
    )
    return res?.data ?? []
  }
}
