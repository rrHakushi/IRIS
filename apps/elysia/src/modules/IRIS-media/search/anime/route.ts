import { defineRoute, t } from "@/router"
import { queueAnimeSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { AnimeSearchResponseSchema, type AnimeSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"
import { findMatchingSynonymIds } from "../../helpers/search-synonyms"

const SEARCH_ANIME_TTL = 5 * 60 // 5 minutes

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: AnimeSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search anime",
      description:
        "Searches anime by title or synonyms and returns matching anime preview records.",
      tags: ["Media - Anime"],
    },
  },

  cacheKeys: {
    search: {
      anime: (q: string) => `search:anime:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys, logger }) {
    const { q } = query
    const cleanQuery = decodeURIComponent(q).replace(/\+/g, " ").trim()
    const cacheKey = cacheKeys.search.anime(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<AnimeSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const synonymIds = await findMatchingSynonymIds(prisma, "Anime", cleanQuery)

    const data = await prisma.anime.findMany({
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
        seasonYear: true,
        seasonSeason: true,
      },
      orderBy: {
        titlePrimary: "asc",
      },
    })

    if (data.length === 0) {
      logger.warn(`No data found for query: ${cleanQuery}, triggering refresh`)
      const rawResults = await queueAnimeSearchFetch(cleanQuery)
      const results = rawResults.map((item: any) => ({
        ...item,
        queuedForFetch: true,
      }))
      await cache.set(cacheKey, results, SEARCH_ANIME_TTL)
      return results
    }

    await cache.set(cacheKey, data, SEARCH_ANIME_TTL)
    void queueAnimeSearchFetch(cleanQuery).catch((err) => {
      logger.error(
        `[SearchAnimeRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
