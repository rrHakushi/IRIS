export interface GoogleBookPayload {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    maturityRating?: string;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    language?: string;
    previewLink?: string;
    infoLink?: string;
    canonicalVolumeLink?: string;
  };
  saleInfo?: {
    retailPrice?: {
      amount: number;
      currencyCode: string;
    };
    buyLink?: string;
  };
}

export class GoogleBooksProvider {
  private readonly baseUrl = "https://www.googleapis.com/books/v1/volumes";
  private lastRequestTime = 0;
  private readonly minDelayMs = 500; // 2 req/s

  private getApiKey(): string {
    return process.env.GOOGLE_BOOKS_API_KEY || "";
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetches book details by Google Books Volume ID or ISBN.
   */
  async fetchBook(volumeIdOrIsbn: string): Promise<GoogleBookPayload> {
    await this.waitForRateLimit();

    const apiKey = this.getApiKey();
    const isIsbn = /^[0-9Xx-]{10,17}$/.test(volumeIdOrIsbn.trim());

    let url: string;
    if (isIsbn) {
      const cleanIsbn = volumeIdOrIsbn.replace(/[^0-9Xx]/g, "");
      url = `${this.baseUrl}?q=isbn:${cleanIsbn}${apiKey ? `&key=${apiKey}` : ""}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`[GoogleBooksProvider] Search HTTP ${res.status}`);
      }

      const searchJson = (await res.json()) as { items?: GoogleBookPayload[] };
      if (!searchJson.items || searchJson.items.length === 0) {
        throw new Error(`[GoogleBooksProvider] No volume found for ISBN ${volumeIdOrIsbn}`);
      }
      return searchJson.items[0]!;
    } else {
      url = `${this.baseUrl}/${encodeURIComponent(volumeIdOrIsbn)}${apiKey ? `?key=${apiKey}` : ""}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`[GoogleBooksProvider] HTTP ${res.status}: ${errText}`);
      }

      return (await res.json()) as GoogleBookPayload;
    }
  }
}
