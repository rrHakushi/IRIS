import { prisma } from '@IRIS/database'
import { cache } from '../../utils/cache'
import { encryptConnectionData } from '@IRIS/connections'
import { BadRequest, BadGateway, TooManyRequests } from '../../lib/errors'

export interface SearchOptions {
  q: string
  category?: string
  pageno?: string
  time_range?: string
  language?: string
  safesearch?: string
  isPrivate?: string
}

export interface SuggestionOptions {
  q: string
  format?: string
}

const searchCache = cache.withNamespace('search:queries')
const suggestionCache = cache.withNamespace('search:suggestions')

export class KiroshiSearchServ {
  /**
   * Dispatches web search to upstream SearXNG core, normalizes results,
   * caches responses, and persists encrypted search history for the user.
   */
  public static async search(userId: string, query: SearchOptions) {
    const q = (query.q || '').trim()
    if (!q) {
      throw new BadRequest("Query string 'q' is required.")
    }

    const category = (query.category || 'general').toLowerCase()
    const pageno = Math.max(1, parseInt(query.pageno || '1', 10) || 1)
    const timeRange = query.time_range || ''
    const language = query.language || 'auto'
    const safeSearch = query.safesearch || '0'
    const isPrivateWindow = query.isPrivate === 'true' || query.isPrivate === '1'

    // 1. Check user history preference
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    })
    const userSettings = (dbUser?.settings as any) || {}
    const historyEnabled = userSettings?.search?.historyEnabled !== false

    // 2. Encrypted Search History persistence
    if (!isPrivateWindow && historyEnabled) {
      try {
        const encrypted = encryptConnectionData(q, userId)
        await prisma.searchHistory.create({
          data: {
            userId,
            encryptedQuery: encrypted,
            category,
          },
        })

        // Background 30-day retention cleanup
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        prisma.searchHistory
          .deleteMany({
            where: {
              userId,
              createdAt: { lt: thirtyDaysAgo },
            },
          })
          .catch(() => {})
      } catch (err) {
        console.warn('[Kiroshi] Failed to save encrypted search history:', err)
      }
    }

    // 3. Query Cache check (60s TTL)
    const cacheKey = `${category}:${language}:${safeSearch}:${timeRange}:${pageno}:${q.toLowerCase()}`
    const cached = await searchCache.get<any>(cacheKey)
    if (cached) {
      return cached
    }

    // 4. Proxy to SearXNG core
    const searxBase = process.env.SEARXNG_URL || 'http://192.168.0.44:4500'
    const url = new URL('/search', searxBase)
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'json')

    if (category && category !== 'general') {
      const searxCategory = category === 'social_media' ? 'social media' : category
      url.searchParams.set('categories', searxCategory)
    }
    if (pageno > 1) {
      url.searchParams.set('pageno', String(pageno))
    }
    if (timeRange && timeRange !== 'anytime') {
      url.searchParams.set('time_range', timeRange)
    }
    if (language && language !== 'auto') {
      url.searchParams.set('language', language)
    }
    if (safeSearch) {
      url.searchParams.set('safesearch', String(safeSearch))
    }

    const startTime = performance.now()
    let searxResponse: Response

    try {
      searxResponse = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IRIS-Search/1.0',
        },
      })
    } catch (fetchErr: any) {
      throw new BadGateway(
        `Could not reach SearXNG instance at ${searxBase}: ${fetchErr?.message || 'connection failed'}`
      )
    }

    if (searxResponse.status === 403) {
      throw new BadGateway(
        "SearXNG JSON output is disabled. Please ensure 'json' is included in search.formats in SearXNG settings.yml."
      )
    }

    if (searxResponse.status === 429) {
      throw new TooManyRequests(
        'SearXNG rate limit exceeded. Please wait a few moments before searching again.'
      )
    }

    if (!searxResponse.ok) {
      const text = await searxResponse.text().catch(() => '')
      throw new BadGateway(
        `SearXNG returned error ${searxResponse.status}: ${text.slice(0, 150)}`
      )
    }

    const json = (await searxResponse.json().catch(() => null)) as any
    if (!json) {
      throw new BadGateway('Failed to parse SearXNG JSON response')
    }

    const durationMs = Math.round(performance.now() - startTime)

    // 5. Normalize results
    const rawResults = Array.isArray(json.results) ? json.results : []
    const results = rawResults.map((item: any) => {
      let contentStr = typeof item.content === 'string' ? item.content : item.snippet || ''
      if (!contentStr && item.address && typeof item.address === 'object') {
        contentStr = Object.values(item.address).filter(Boolean).join(', ')
      }
      let urlStr = item.url || ''
      if (!urlStr && item.latitude && item.longitude) {
        urlStr = `https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}`
      }
      return {
        title: String(item.title || item.name || item.address_label || 'Result'),
        url: urlStr,
        content: contentStr,
        engine: item.engine ? String(item.engine) : undefined,
        engines: Array.isArray(item.engines)
          ? item.engines.map(String)
          : item.engine
            ? [String(item.engine)]
            : [],
        publishedDate: item.publishedDate || item.pubdate || null,
        thumbnail: item.thumbnail || item.img_src || null,
        img_src: item.img_src || item.thumbnail || null,
        resolution: item.resolution ? String(item.resolution) : null,
        template: item.template ? String(item.template) : undefined,
        score: typeof item.score === 'number' ? item.score : undefined,
      }
    })

    const rawInfoboxes = Array.isArray(json.infoboxes) ? json.infoboxes : []
    const infoboxes = rawInfoboxes.map((ib: any) => ({
      infobox: String(ib.infobox || 'Information'),
      id: ib.id ? String(ib.id) : undefined,
      content: typeof ib.content === 'string' ? ib.content : null,
      img_src: ib.img_src || null,
      urls: Array.isArray(ib.urls)
        ? ib.urls.map((u: any) => ({
            title: u?.title ? String(u.title) : '',
            url: u?.url ? String(u.url) : '',
          }))
        : [],
      attributes: Array.isArray(ib.attributes) ? ib.attributes : [],
    }))

    const responsePayload = {
      success: true,
      query: json.query || q,
      category,
      page: pageno,
      numberOfResults:
        typeof json.number_of_results === 'number' ? json.number_of_results : results.length,
      results,
      suggestions: Array.isArray(json.suggestions)
        ? json.suggestions.map((s: any) => (typeof s === 'string' ? s : s?.suggestion || String(s)))
        : [],
      answers: Array.isArray(json.answers)
        ? json.answers.map((a: any) => (typeof a === 'string' ? a : a?.answer || JSON.stringify(a)))
        : [],
      infoboxes,
      corrections: Array.isArray(json.corrections)
        ? json.corrections.map((c: any) => (typeof c === 'string' ? c : String(c)))
        : [],
      responseTimeMs: durationMs,
    }

    // Cache successful response for 60 seconds
    await searchCache.set(cacheKey, responsePayload, 60)

    return responsePayload
  }

  /**
   * Fetches search autocomplete suggestions from upstream SearXNG autocompleter.
   */
  public static async getSuggestions(query: SuggestionOptions) {
    const q = (query.q || '').trim()
    if (!q) {
      return query.format === 'opensearch' ? [q, []] : { suggestions: [] }
    }

    const cacheKey = q.toLowerCase()
    const cached = await suggestionCache.get<string[]>(cacheKey)
    if (cached) {
      if (query.format === 'opensearch') {
        return [q, cached]
      }
      return { suggestions: cached }
    }

    const searxBase = process.env.SEARXNG_URL || 'http://192.168.0.44:4500'
    const url = new URL('/autocompleter', searxBase)
    url.searchParams.set('q', q)

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IRIS-Search/1.0',
        },
      })

      if (!res.ok) {
        return query.format === 'opensearch' ? [q, []] : { suggestions: [] }
      }

      const data = (await res.json().catch(() => null)) as any
      let suggestions: string[] = []

      if (Array.isArray(data)) {
        if (Array.isArray(data[1])) {
          suggestions = data[1].filter((s: unknown) => typeof s === 'string')
        } else {
          suggestions = data.filter((s: unknown) => typeof s === 'string')
        }
      } else if (data && Array.isArray(data.suggestions)) {
        suggestions = data.suggestions
      }

      await suggestionCache.set(cacheKey, suggestions, 300) // 5 minutes TTL

      if (query.format === 'opensearch') {
        return [q, suggestions]
      }

      return { suggestions }
    } catch {
      return query.format === 'opensearch' ? [q, []] : { suggestions: [] }
    }
  }
}
