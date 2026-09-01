export interface LrcLibLyricsPayload {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export class LrcLibProvider {
  private readonly baseUrl = "https://lrclib.net/api";
  private lastRequestTime = 0;
  private readonly minDelayMs = 500; // 2 req/s

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetches lyrics for a track by name, artist, album, and duration.
   */
  async fetchLyrics(
    trackName: string,
    artistName: string,
    albumName?: string,
    durationSeconds?: number
  ): Promise<LrcLibLyricsPayload | null> {
    await this.waitForRateLimit();

    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });

    if (albumName) params.set("album_name", albumName);
    if (durationSeconds) params.set("duration", String(Math.round(durationSeconds)));

    try {
      const getUrl = `${this.baseUrl}/get?${params.toString()}`;
      const res = await fetch(getUrl, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (https://iris.app, contact@iris.app)",
          Accept: "application/json",
        },
      });

      if (res.ok) {
        return (await res.json()) as LrcLibLyricsPayload;
      }

      // If exact match fails, try fuzzy search
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(`${trackName} ${artistName}`)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (https://iris.app, contact@iris.app)",
          Accept: "application/json",
        },
      });

      if (searchRes.ok) {
        const results = (await searchRes.json()) as LrcLibLyricsPayload[];
        return results[0] || null;
      }
    } catch {
      return null;
    }

    return null;
  }
}
