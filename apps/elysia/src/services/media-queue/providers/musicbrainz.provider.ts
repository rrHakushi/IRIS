export interface MusicBrainzRecordingPayload {
  id: string;
  title: string;
  length?: number; // Duration in milliseconds
  disambiguation?: string;
  isrcs?: string[];
  "artist-credit"?: Array<{
    name: string;
    artist: { id: string; name: string; "sort-name"?: string };
  }>;
  releases?: Array<{
    id: string;
    title: string;
    date?: string;
    country?: string;
    "release-group"?: { id: string; "primary-type"?: string };
  }>;
  tags?: Array<{ name: string; count?: number }>;
  genres?: Array<{ id: string; name: string }>;
  rating?: { value?: number; "votes-count"?: number };
  coverImageUrl?: string;
}

export class MusicBrainzProvider {
  private readonly baseUrl = "https://musicbrainz.org/ws/2";
  private lastRequestTime = 0;
  private readonly minDelayMs = 1100; // Strict 1 req/s for MusicBrainz

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetches recording metadata by MusicBrainz recording MBID.
   */
  async fetchRecording(mbid: string): Promise<MusicBrainzRecordingPayload> {
    await this.waitForRateLimit();

    const cleanMbid = encodeURIComponent(mbid.trim());
    const url = `${this.baseUrl}/recording/${cleanMbid}?inc=artists+releases+ratings+url-rels+tags+isrcs+genres&fmt=json`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "IRIS-Platform/1.0 (https://iris.app; contact@iris.app)",
        Accept: "application/json",
      },
    });

    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 3;
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.fetchRecording(mbid);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`[MusicBrainzProvider] HTTP ${res.status}: ${errText}`);
    }

    const payload = (await res.json()) as MusicBrainzRecordingPayload;

    // Attempt to fetch cover art from Cover Art Archive if release exists
    const releaseId = payload.releases?.[0]?.id;
    if (releaseId) {
      try {
        const caaRes = await fetch(`https://coverartarchive.org/release/${releaseId}`, {
          headers: { Accept: "application/json" },
        });
        if (caaRes.ok) {
          const caaJson = (await caaRes.json()) as { images?: Array<{ image: string; front: boolean }> };
          const frontImg = caaJson.images?.find((img) => img.front)?.image || caaJson.images?.[0]?.image;
          if (frontImg) {
            payload.coverImageUrl = frontImg;
          }
        }
      } catch {
        // Ignore Cover Art Archive lookup errors
      }
    }

    return payload;
  }

  /**
   * Searches recordings by track title and artist name.
   */
  async searchRecording(query: string): Promise<MusicBrainzRecordingPayload[]> {
    await this.waitForRateLimit();

    const url = `${this.baseUrl}/recording?query=${encodeURIComponent(query)}&limit=5&fmt=json`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "IRIS-Platform/1.0 (https://iris.app; contact@iris.app)",
        Accept: "application/json",
      },
    });

    if (!res.ok) return [];

    const json = (await res.json()) as { recordings?: MusicBrainzRecordingPayload[] };
    return json.recordings || [];
  }
}
