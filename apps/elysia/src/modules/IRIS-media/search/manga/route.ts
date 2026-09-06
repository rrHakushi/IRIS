import { defineRoute, t } from "@/router"
import { queueMangaSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { MangaSearchResponseSchema, type MangaSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"
import { findMatchingSynonymIds } from "../../helpers/search-synonyms"

const SEARCH_MANGA_TTL = 5 * 60 // 5 minutes

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: MangaSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search manga",
      description:
        "Searches manga by title or synonyms and returns matching manga preview records.",
      tags: ["Media - Manga"],
    },
  },

  cacheKeys: {
    search: {
      manga: (q: string) => `search:manga:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys, logger }) {
    const cleanQuery = decodeURIComponent(String(query.q || "")).replace(/\+/g, " ").trim()
    const cacheKey = cacheKeys.search.manga(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<MangaSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const synonymIds = await findMatchingSynonymIds(prisma, "Manga", cleanQuery)

    const data = await prisma.manga.findMany({
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
        isAdult: true,
        format: true,
        startDateYear: true,
      },
      orderBy: {
        titlePrimary: "asc",
      },
    })

    if (data.length === 0) {
      logger.warn(`No data found for query: ${cleanQuery}, triggering refresh`)
      const rawResults = await queueMangaSearchFetch(cleanQuery)
      const results = rawResults.map((item: any) => ({
        ...item,
        queuedForFetch: true,
      }))
      await cache.set(cacheKey, results, SEARCH_MANGA_TTL)
      return results
    }

    await cache.set(cacheKey, data, SEARCH_MANGA_TTL)
    void queueMangaSearchFetch(cleanQuery).catch((err) => {
      logger.error(
        `[SearchMangaRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
