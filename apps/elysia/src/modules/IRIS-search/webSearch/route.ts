import { createHash } from "node:crypto"
import { defineRoute, t } from "../../../router"
import { cache } from "../../../utils/cache"
import { encryptConnectionData } from "@IRIS/connections"

const searchCache = cache.withNamespace("search:queries")

export const SearchResultItemSchema = t.Object({
  title: t.String(),
  url: t.String(),
  content: t.String(),
  engine: t.Optional(t.String()),
  engines: t.Optional(t.Array(t.String())),
  publishedDate: t.Optional(t.Nullable(t.Any())),
  thumbnail: t.Optional(t.Nullable(t.String())),
  img_src: t.Optional(t.Nullable(t.String())),
  resolution: t.Optional(t.Nullable(t.String())),
  template: t.Optional(t.String()),
  score: t.Optional(t.Number()),
})

export const SearchInfoboxSchema = t.Object({
  infobox: t.String(),
  id: t.Optional(t.Nullable(t.String())),
  content: t.Optional(t.Nullable(t.String())),
  img_src: t.Optional(t.Nullable(t.String())),
  urls: t.Optional(
    t.Array(
      t.Object({
        title: t.Optional(t.Nullable(t.String())),
        url: t.Optional(t.Nullable(t.String())),
      })
    )
  ),
  attributes: t.Optional(t.Array(t.Any())),
})

export const SearchResponseSchema = t.Object({
  success: t.Boolean(),
  query: t.String(),
  category: t.String(),
  page: t.Number(),
  numberOfResults: t.Number(),
  results: t.Array(SearchResultItemSchema),
  suggestions: t.Array(t.Any()),
  answers: t.Array(t.Any()),
  infoboxes: t.Array(SearchInfoboxSchema),
  corrections: t.Array(t.Any()),
  responseTimeMs: t.Number(),
})

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        category: t.Optional(t.String()),
        pageno: t.Optional(t.String()),
        time_range: t.Optional(t.String()),
        language: t.Optional(t.String()),
        safesearch: t.Optional(t.String()),
        isPrivate: t.Optional(t.String()),
      }),
      response: {
        200: SearchResponseSchema,
        400: t.Object({ error: t.String(), message: t.String() }),
        401: t.Object({ error: t.String(), message: t.String() }),
        500: t.Object({ error: t.String(), message: t.String() }),
        502: t.Object({ error: t.String(), message: t.String() }),
      },
    },
    async handler({ query, session, prisma, request }: any) {
      const q = (query.q || "").trim()
      if (!q) {
        return new Response(
          JSON.stringify({ error: "Bad Request", message: "Query string 'q' is required" }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      // 1. Authentication resolution: session or API key from request headers
      let authenticatedUserId: string | null = null
      let userSettings: any = null

      if (session?.isAuthenticated && session.user) {
        authenticatedUserId = session.user.id
      } else {
        const authHeader = request.headers.get("authorization") || ""
        const xApiKey = request.headers.get("x-api-key") || request.headers.get("api-key")
        const apiKey = xApiKey || (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null)

        if (apiKey) {
          const hash = createHash("sha256").update(apiKey).digest("hex")
          const keyRecord = await prisma.apiKey.findUnique({
            where: { hash },
            include: { user: true },
          })
          if (keyRecord && (!keyRecord.expiresAt || keyRecord.expiresAt.getTime() > Date.now())) {
            authenticatedUserId = keyRecord.userId
            userSettings = (keyRecord.user as any)?.settings
          }
        }
      }

      if (!authenticatedUserId) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required via IRIS session or header (x-api-key / Authorization)",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      // 2. Load user settings if not already loaded
      if (userSettings === null) {
        const dbUser = await prisma.user.findUnique({
          where: { id: authenticatedUserId },
          select: { settings: true },
        })
        userSettings = dbUser?.settings || null
      }

      const category = (query.category || "general").toLowerCase()
      const pageno = Math.max(1, parseInt(query.pageno || "1", 10) || 1)
      const timeRange = query.time_range || ""
      const language = query.language || "auto"
      const safeSearch = query.safesearch || "0"
      const isPrivateWindow = query.isPrivate === "true" || query.isPrivate === "1"

      // 3. Encrypted Search History persistence (unless in private window or history disabled)
      const historyEnabled = userSettings?.search?.historyEnabled !== false
      if (!isPrivateWindow && historyEnabled) {
        try {
          const encrypted = encryptConnectionData(q, authenticatedUserId)
          await prisma.searchHistory.create({
            data: {
              userId: authenticatedUserId,
              encryptedQuery: encrypted,
              category,
            },
          })

          // 30-day retention cleanup in background
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          prisma.searchHistory
            .deleteMany({
              where: {
                userId: authenticatedUserId,
                createdAt: { lt: thirtyDaysAgo },
              },
            })
            .catch(() => { })
        } catch (err) {
          console.warn("[IRIS-search] Failed to save encrypted search history:", err)
        }
      }

      // 4. Query Cache check (60s TTL)
      const cacheKey = `${category}:${language}:${safeSearch}:${timeRange}:${pageno}:${q.toLowerCase()}`
      const cached = await searchCache.get<any>(cacheKey)
      if (cached) {
        return cached
      }

      // 5. Proxy to SearXNG core
      const searxBase = process.env.SEARXNG_URL || "http://192.168.0.44:4500"
      const url = new URL("/search", searxBase)
      url.searchParams.set("q", q)
      url.searchParams.set("format", "json")
      if (category && category !== "general") {
        const searxCategory = category === "social_media" ? "social media" : category
        url.searchParams.set("categories", searxCategory)
      }
      if (pageno > 1) {
        url.searchParams.set("pageno", String(pageno))
      }
      if (timeRange && timeRange !== "anytime") {
        url.searchParams.set("time_range", timeRange)
      }
      if (language && language !== "auto") {
        url.searchParams.set("language", language)
      }
      if (safeSearch) {
        url.searchParams.set("safesearch", String(safeSearch))
      }

      const startTime = performance.now()
      let searxResponse: Response
      try {
        searxResponse = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IRIS-Search/1.0",
          },
        })
      } catch (fetchErr: any) {
        return new Response(
          JSON.stringify({
            error: "Bad Gateway",
            message: `Could not reach SearXNG instance at ${searxBase}: ${fetchErr?.message || "connection failed"}`,
          }),
          { status: 502, headers: { "content-type": "application/json" } }
        )
      }

      if (searxResponse.status === 403) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message:
              "SearXNG JSON output is disabled. Please ensure 'json' is included in search.formats in SearXNG settings.yml.",
          }),
          { status: 502, headers: { "content-type": "application/json" } }
        )
      }

      if (searxResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Too Many Requests",
            message: "SearXNG rate limit exceeded. Please wait a few moments before searching again.",
          }),
          { status: 429, headers: { "content-type": "application/json" } }
        )
      }

      if (!searxResponse.ok) {
        const text = await searxResponse.text().catch(() => "")
        return new Response(
          JSON.stringify({
            error: "Search Error",
            message: `SearXNG returned error ${searxResponse.status}: ${text.slice(0, 150)}`,
          }),
          { status: 502, headers: { "content-type": "application/json" } }
        )
      }

      const json = await searxResponse.json().catch(() => null)
      if (!json) {
        return new Response(
          JSON.stringify({
            error: "Internal Server Error",
            message: "Failed to parse SearXNG JSON response",
          }),
          { status: 500, headers: { "content-type": "application/json" } }
        )
      }

      const durationMs = Math.round(performance.now() - startTime)

      // Normalize results safely across general, video, map, social media, etc.
      const rawResults = Array.isArray(json.results) ? json.results : []
      const results = rawResults.map((item: any) => {
        let contentStr = typeof item.content === "string" ? item.content : (item.snippet || "")
        if (!contentStr && item.address && typeof item.address === "object") {
          contentStr = Object.values(item.address).filter(Boolean).join(", ")
        }
        let urlStr = item.url || ""
        if (!urlStr && item.latitude && item.longitude) {
          urlStr = `https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}`
        }
        return {
          title: String(item.title || item.name || item.address_label || "Result"),
          url: urlStr,
          content: contentStr,
          engine: item.engine ? String(item.engine) : undefined,
          engines: Array.isArray(item.engines) ? item.engines.map(String) : item.engine ? [String(item.engine)] : [],
          publishedDate: item.publishedDate || item.pubdate || null,
          thumbnail: item.thumbnail || item.img_src || null,
          img_src: item.img_src || item.thumbnail || null,
          resolution: item.resolution ? String(item.resolution) : null,
          template: item.template ? String(item.template) : undefined,
          score: typeof item.score === "number" ? item.score : undefined,
        }
      })

      const rawInfoboxes = Array.isArray(json.infoboxes) ? json.infoboxes : []
      const infoboxes = rawInfoboxes.map((ib: any) => ({
        infobox: String(ib.infobox || "Information"),
        id: ib.id ? String(ib.id) : undefined,
        content: typeof ib.content === "string" ? ib.content : null,
        img_src: ib.img_src || null,
        urls: Array.isArray(ib.urls) ? ib.urls.map((u: any) => ({
          title: u?.title ? String(u.title) : "",
          url: u?.url ? String(u.url) : "",
        })) : [],
        attributes: Array.isArray(ib.attributes) ? ib.attributes : [],
      }))

      const responsePayload = {
        success: true,
        query: json.query || q,
        category,
        page: pageno,
        numberOfResults: typeof json.number_of_results === "number" ? json.number_of_results : results.length,
        results,
        suggestions: Array.isArray(json.suggestions)
          ? json.suggestions.map((s: any) => (typeof s === "string" ? s : s?.suggestion || String(s)))
          : [],
        answers: Array.isArray(json.answers)
          ? json.answers.map((a: any) => (typeof a === "string" ? a : a?.answer || JSON.stringify(a)))
          : [],
        infoboxes,
        corrections: Array.isArray(json.corrections)
          ? json.corrections.map((c: any) => (typeof c === "string" ? c : String(c)))
          : [],
        responseTimeMs: durationMs,
      }

      // Cache successful response for 60 seconds
      await searchCache.set(cacheKey, responsePayload, 60)

      return responsePayload
    },
  },
})
