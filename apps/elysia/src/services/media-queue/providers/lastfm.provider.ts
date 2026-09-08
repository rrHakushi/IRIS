import { logQueue } from "../logger.js"
import { c } from "../../../utils/colors.js"

export interface LastFmImage {
  "#text": string
  size: "small" | "medium" | "large" | "extralarge" | "mega" | string
}

export interface LastFmTag {
  name: string
  url?: string
}

export interface LastFmWiki {
  published?: string
  summary?: string
  content?: string
}

export interface LastFmTrackInfo {
  name: string
  mbid?: string
  url?: string
  duration?: string | number // milliseconds in Last.fm
  listeners?: string | number
  playcount?: string | number
  artist?: {
    name: string
    mbid?: string
    url?: string
  }
  album?: {
    artist?: string
    title?: string
    mbid?: string
    url?: string
    image?: LastFmImage[]
    "@attr"?: { position?: string | number }
  }
  toptags?: {
    tag: LastFmTag | LastFmTag[]
  }
  wiki?: LastFmWiki
}

export interface LastFmAlbumTrack {
  name: string
  url?: string
  duration?: string | number // seconds or milliseconds
  "@attr"?: {
    rank: string | number
  }
  artist?: {
    name: string
    mbid?: string
    url?: string
  }
  streamable?: string | number | { fulltrack?: string; "#text"?: string } | null
}

export interface LastFmAlbumInfo {
  name: string
  artist: string
  mbid?: string
  url?: string
  image?: LastFmImage[]
  listeners?: string | number
  playcount?: string | number
  tracks?: {
    track?: LastFmAlbumTrack | LastFmAlbumTrack[]
  }
  tags?: {
    tag?: LastFmTag | LastFmTag[]
  }
  wiki?: LastFmWiki
}

export interface LastFmArtistInfo {
  name: string
  mbid?: string
  url?: string
  image?: LastFmImage[]
  stats?: {
    listeners?: string | number
    playcount?: string | number
  }
  similar?: {
    artist?: Array<{ name: string; url: string; image?: LastFmImage[] }>
  }
  tags?: {
    tag?: LastFmTag | LastFmTag[]
  }
  bio?: LastFmWiki
}

export interface LastFmAlbumSearchResult {
  name: string
  artist: string
  url: string
  image?: LastFmImage[]
  mbid?: string
}

export interface LastFmTrackSearchResult {
  name: string
  artist: string
  url: string
  image?: LastFmImage[]
  listeners?: string | number
  mbid?: string
}

export interface LastFmArtistSearchResult {
  name: string
  listeners?: string | number
  mbid?: string
  url: string
  image?: LastFmImage[]
}

export class LastFmProvider {
  private readonly baseUrl = "https://ws.audioscrobbler.com/2.0/"
  private lastRequestTime = 0
  private readonly minDelayMs = 250 // 4 req/s

  private getApiKey(): string {
    return process.env.LASTFM_API_KEY || ""
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed))
    }
    this.lastRequestTime = Date.now()
  }

  public extractBestImage(images?: LastFmImage[]): string | null {
    if (!images || !Array.isArray(images) || images.length === 0) return null
    // Prefer mega, then extralarge, then large
    const order = ["mega", "extralarge", "large", "medium", "small"]
    for (const size of order) {
      const match = images.find(
        (img) => img.size === size && img["#text"]?.trim()
      )
      if (match && match["#text"].trim()) {
        return match["#text"].trim()
      }
    }
    // Fallback to last available with text
    const lastWithText = [...images]
      .reverse()
      .find((img) => img["#text"]?.trim())
    return lastWithText ? lastWithText["#text"].trim() : null
  }

  private normalizeArray<T>(item?: T | T[]): T[] {
    if (!item) return []
    return Array.isArray(item) ? item : [item]
  }

  /**
   * Search albums by query
   */
  async searchAlbums(
    query: string,
    limit: number = 10
  ): Promise<LastFmAlbumSearchResult[]> {
    const clean = query.trim()
    if (!clean) return []

    const apiKey = this.getApiKey()
    if (!apiKey) {
      logQueue(
        `${c.magenta(c.bold("[MediaQueue]"))} ${c.yellow("⚠️ LASTFM_API_KEY is not configured. Skipping Last.fm searchAlbums.")}`
      )
      return []
    }

    await this.waitForRateLimit()

    try {
      const params = new URLSearchParams({
        method: "album.search",
        album: clean,
        limit: String(Math.min(limit, 30)),
        api_key: apiKey,
        format: "json",
      })

      const res = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (contact@iris.app)",
          Accept: "application/json",
        },
      })

      if (!res.ok) {
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} ${c.yellow(`⚠️ Last.fm album.search HTTP ${res.status}`)}`
        )
        return []
      }

      const data = (await res.json()) as any
      const matches = data?.results?.albummatches?.album
      return this.normalizeArray<LastFmAlbumSearchResult>(matches)
    } catch (err: any) {
      console.error(`[LastFmProvider] searchAlbums error: ${err.message}`)
      return []
    }
  }

  /**
   * Search tracks by title and optional artist
   */
  async searchTracks(
    query: string,
    artist?: string,
    limit: number = 10
  ): Promise<LastFmTrackSearchResult[]> {
    const clean = query.trim()
    if (!clean) return []

    const apiKey = this.getApiKey()
    if (!apiKey) {
      logQueue(
        `${c.magenta(c.bold("[MediaQueue]"))} ${c.yellow("⚠️ LASTFM_API_KEY is not configured. Skipping Last.fm searchTracks.")}`
      )
      return []
    }

    await this.waitForRateLimit()

    try {
      const params = new URLSearchParams({
        method: "track.search",
        track: clean,
        limit: String(Math.min(limit, 30)),
        api_key: apiKey,
        format: "json",
      })
      if (artist?.trim()) {
        params.set("artist", artist.trim())
      }

      const res = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (contact@iris.app)",
          Accept: "application/json",
        },
      })

      if (!res.ok) {
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} ${c.yellow(`⚠️ Last.fm track.search HTTP ${res.status}`)}`
        )
        return []
      }

      const data = (await res.json()) as any
      const matches = data?.results?.trackmatches?.track
      return this.normalizeArray<LastFmTrackSearchResult>(matches)
    } catch (err: any) {
      console.error(`[LastFmProvider] searchTracks error: ${err.message}`)
      return []
    }
  }

  /**
   * Search artists by query
   */
  async searchArtist(
    query: string,
    limit: number = 10
  ): Promise<LastFmArtistSearchResult[]> {
    const clean = query.trim()
    if (!clean) return []

    const apiKey = this.getApiKey()
    if (!apiKey) return []

    await this.waitForRateLimit()

    try {
      const params = new URLSearchParams({
        method: "artist.search",
        artist: clean,
        limit: String(Math.min(limit, 30)),
        api_key: apiKey,
        format: "json",
      })

      const res = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (contact@iris.app)",
          Accept: "application/json",
        },
      })

      if (!res.ok) return []

      const data = (await res.json()) as any
      const matches = data?.results?.artistmatches?.artist
      return this.normalizeArray<LastFmArtistSearchResult>(matches)
    } catch (err: any) {
      console.error(`[LastFmProvider] searchArtist error: ${err.message}`)
      return []
    }
  }

  /**
   * Fetch complete album metadata including tracklist, tags, wiki, cover images, and stats
   */
  async fetchAlbum(
    artist: string,
    album: string,
    mbid?: string
  ): Promise<LastFmAlbumInfo | null> {
    const apiKey = this.getApiKey()
    if (!apiKey) return null

    await this.waitForRateLimit()

    try {
      const params = new URLSearchParams({
        method: "album.getInfo",
        api_key: apiKey,
        format: "json",
        autocorrect: "1",
      })

      if (artist?.trim()) {
        params.set("artist", artist.trim())
      }
      if (album?.trim()) {
        params.set("album", album.trim())
      }
      if (mbid?.trim()) {
        params.set("mbid", mbid.trim())
      }

      const res = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (contact@iris.app)",
          Accept: "application/json",
        },
      })

      if (!res.ok) return null

      const data = (await res.json()) as any
      if (!data?.album) return null

      return data.album as LastFmAlbumInfo
    } catch (err: any) {
      console.error(`[LastFmProvider] fetchAlbum error: ${err.message}`)
      return null
    }
  }

  /**
   * Fetch track metadata including duration, album, tags, wiki, and stats
   */
  async fetchTrack(
    artist: string,
    track: string,
    mbid?: string
  ): Promise<LastFmTrackInfo | null> {
    const apiKey = this.getApiKey()
    if (!apiKey) return null

    await this.waitForRateLimit()

    try {
      const params = new URLSearchParams({
        method: "track.getInfo",
        api_key: apiKey,
        format: "json",
        autocorrect: "1",
      })

      if (artist?.trim()) {
        params.set("artist", artist.trim())
      }
      if (track?.trim()) {
        params.set("track", track.trim())
      }
      if (mbid?.trim()) {
        params.set("mbid", mbid.trim())
      }

      const res = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (contact@iris.app)",
          Accept: "application/json",
        },
      })

      if (!res.ok) return null

      const data = (await res.json()) as any
      if (!data?.track) return null

      return data.track as LastFmTrackInfo
    } catch (err: any) {
      console.error(`[LastFmProvider] fetchTrack error: ${err.message}`)
      return null
    }
  }

  /**
   * Fetch artist metadata including bio, stats, tags, similar artists
   */
  async fetchArtist(
    artist: string,
    mbid?: string
  ): Promise<LastFmArtistInfo | null> {
    const apiKey = this.getApiKey()
    if (!apiKey) return null

    await this.waitForRateLimit()

    try {
      const params = new URLSearchParams({
        method: "artist.getInfo",
        api_key: apiKey,
        format: "json",
        autocorrect: "1",
      })

      if (mbid?.trim()) {
        params.set("mbid", mbid.trim())
      } else {
        params.set("artist", artist.trim())
      }

      const res = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (contact@iris.app)",
          Accept: "application/json",
        },
      })

      if (!res.ok) return null

      const data = (await res.json()) as any
      if (!data?.artist) return null

      return data.artist as LastFmArtistInfo
    } catch (err: any) {
      console.error(`[LastFmProvider] fetchArtist error: ${err.message}`)
      return null
    }
  }

  /**
   * Helper to get the best cover image URL from an album/track/artist image array
   */
  getBestImage(images?: LastFmImage[]): string | null {
    return this.extractBestImage(images)
  }
}
