import { defineRoute, t } from "@/router"
import { queueTvSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { TvSearchResponseSchema, type TvSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"
import { findMatchingSynonymIds } from "../../helpers/search-synonyms"

const SEARCH_TV_TTL = 60 * 60 // 1 hour

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: TvSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search TV shows",
      description:
        "Searches TV shows by title or synonyms and returns matching TV show preview records.",
      tags: ["Media - TV"],
    },
  },

  cacheKeys: {
    search: {
      tv: (q: string) => `search:tv:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys, logger }) {
    const { q } = query
    const cleanQuery = decodeURIComponent(q).replace(/\+/g, " ").trim()
    const cacheKey = cacheKeys.search.tv(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<TvSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const synonymIds = await findMatchingSynonymIds(prisma, "Tv", cleanQuery)

    const data = await prisma.tv.findMany({
      where: {
        OR: [
          { titlePrimary: { contains: cleanQuery, mode: "insensitive" } },
          { titleSecondary: { contains: cleanQuery, mode: "insensitive" } },
          { titleNative: { contains: cleanQuery, mode: "insensitive" } },
          ...(synonymIds.length > 0 ? [{ id: { in: synonymIds } }] : []),
        ],
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        coverImage: true,
        firstAiredYear: true,
      },
      orderBy: {
        titlePrimary: "asc",
      },
    })

    if (data.length === 0) {
      logger.warn(`No data found for query: ${cleanQuery}, triggering refresh`)
      const results = await queueTvSearchFetch(cleanQuery)
      await cache.set(cacheKey, results, SEARCH_TV_TTL)
      return results
    }

    await cache.set(cacheKey, data, SEARCH_TV_TTL)
    void queueTvSearchFetch(cleanQuery).catch((err) => {
      logger.error(
        `[SearchTvRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
