import { LogFactory } from '@Iris/logger'

const logger = new LogFactory('Borealis:Provider:GoogleBooks')

export interface GoogleBookPayload {
  id: string
  volumeInfo: {
    title: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    pageCount?: number
    categories?: string[]
    averageRating?: number
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
      large?: string
      medium?: string
    }
  }
}

export class GoogleBooksProvider {
  private readonly baseUrl = 'https://www.googleapis.com/books/v1/volumes'
  private lastRequestTime = 0
  private readonly minDelayMs = 500 // 2 req/s

  private getApiKey(): string {
    return Bun.env.GOOGLE_BOOKS_API_KEY || ''
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed))
    }
    this.lastRequestTime = Date.now()
  }

  /**
   * Searches Google Books by title/query.
   */
  async searchBooks(query: string, limit: number = 25): Promise<GoogleBookPayload[]> {
    const clean = query.trim()
    if (!clean) return []

    await this.waitForRateLimit()
    const apiKey = this.getApiKey()
    const maxResults = Math.min(Math.max(limit, 1), 40)
    const url = `${this.baseUrl}?q=${encodeURIComponent(clean)}&maxResults=${maxResults}${apiKey ? `&key=${apiKey}` : ''}`

    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 5
        logger.warn(`Google Books HTTP 429. Backing off for ${retryAfter}s...`)
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
        return this.searchBooks(query, limit)
      }

      if (!res.ok) return []

      const searchJson = (await res.json()) as { items?: GoogleBookPayload[] }
      if (!searchJson.items || !Array.isArray(searchJson.items)) return []

      return searchJson.items.filter((b) => Boolean(b && b.id))
    } catch (err: any) {
      logger.error(`searchBooks failed: ${err.message}`)
      return []
    }
  }

  /**
   * Fetches book details by Google Books volume ID.
   */
  async fetchBook(volumeId: string): Promise<GoogleBookPayload | null> {
    await this.waitForRateLimit()
    const apiKey = this.getApiKey()
    const url = `${this.baseUrl}/${encodeURIComponent(volumeId)}${apiKey ? `?key=${apiKey}` : ''}`

    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return null
      return (await res.json()) as GoogleBookPayload
    } catch (err: any) {
      logger.error(`fetchBook failed: ${err.message}`)
      return null
    }
  }
}
