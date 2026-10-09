import { defineRoute, t } from "../../../../router"
import { cache } from "../../../../utils/cache"

const suggestionCache = cache.withNamespace("search:suggestions")

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        q: t.String({ minLength: 1 }),
        format: t.Optional(t.String()),
      }),
      response: {
        200: t.Union([
          t.Object({
            suggestions: t.Array(t.String()),
          }),
          t.Array(t.Any()),
        ]),
      },
    },
    async handler({ query }: any) {
      const q = (query.q || "").trim()
      if (!q) {
        return query.format === "opensearch"
          ? [q, []]
          : { suggestions: [] }
      }

      const cacheKey = q.toLowerCase()
      const cached = await suggestionCache.get<string[]>(cacheKey)
      if (cached) {
        if (query.format === "opensearch") {
          return [q, cached]
        }
        return { suggestions: cached }
      }

      const searxBase = process.env.SEARXNG_URL || "http://192.168.0.44:4500"
      const url = new URL("/autocompleter", searxBase)
      url.searchParams.set("q", q)

      try {
        const res = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IRIS-Search/1.0",
          },
        })

        if (!res.ok) {
          return query.format === "opensearch" ? [q, []] : { suggestions: [] }
        }

        const data = await res.json().catch(() => null)
        let suggestions: string[] = []

        if (Array.isArray(data)) {
          // OpenSearch format: [query, [sug1, sug2, ...], ...]
          if (Array.isArray(data[1])) {
            suggestions = data[1].filter((s: unknown) => typeof s === "string")
          } else {
            suggestions = data.filter((s: unknown) => typeof s === "string")
          }
        } else if (data && Array.isArray(data.suggestions)) {
          suggestions = data.suggestions
        }

        await suggestionCache.set(cacheKey, suggestions, 300) // 5 minutes cache

        if (query.format === "opensearch") {
          return [q, suggestions]
        }

        return { suggestions }
      } catch {
        return query.format === "opensearch" ? [q, []] : { suggestions: [] }
      }
    },
  },
})
