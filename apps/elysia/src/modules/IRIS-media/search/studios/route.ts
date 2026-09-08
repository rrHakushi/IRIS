import { defineRoute, t } from "@/router"
import { NotFound } from "elysia"

import { StudioSearchResponseSchema, type StudioSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"

const SEARCH_STUDIOS_TTL = 5 * 60 // 5 minutes

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: StudioSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search studios",
      description:
        "Searches production and animation studios by name and returns matching studio preview records.",
      tags: ["Media - Studio"],
    },
  },

  cacheKeys: {
    search: {
      studios: (q: string) => `search:studios:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys }) {
    const cleanQuery = decodeURIComponent(String(query.q || ""))
      .replace(/\+/g, " ")
      .trim()
    const cacheKey = cacheKeys.search.studios(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<StudioSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.studio.findMany({
      where: {
        name: { contains: cleanQuery, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        isAnimationStudio: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    await cache.set(cacheKey, data, SEARCH_STUDIOS_TTL)
    return data
  },
})
