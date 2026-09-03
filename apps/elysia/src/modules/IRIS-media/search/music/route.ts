import { defineRoute, t } from "@/router"
import { queueMusicSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { MusicSearchResponseSchema, type MusicSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"

const SEARCH_MUSIC_TTL = 60 * 60 // 1 hour

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: MusicSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search music",
      description:
        "Searches music tracks by title or artist and returns matching music preview records.",
      tags: ["Media - Music"],
    },
  },

  cacheKeys: {
    search: {
      music: (q: string) => `search:music:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys, logger }) {
    const { q } = query
    const cleanQuery = decodeURIComponent(q).replace(/\+/g, " ").trim()
    const cacheKey = cacheKeys.search.music(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<MusicSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.music.findMany({
      where: {
        OR: [
          { titlePrimary: { contains: cleanQuery, mode: "insensitive" } },
          { titleSecondary: { contains: cleanQuery, mode: "insensitive" } },
          { artist: { contains: cleanQuery, mode: "insensitive" } },
          { album: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        artist: true,
        coverImage: true,
        duration: true,
      },
      orderBy: {
        titlePrimary: "asc",
      },
    })

    if (data.length === 0) {
      logger.warn(`No data found for query: ${cleanQuery}, triggering refresh`)
      const results = await queueMusicSearchFetch(cleanQuery)
      await cache.set(cacheKey, results, SEARCH_MUSIC_TTL)
      return results
    }

    await cache.set(cacheKey, data, SEARCH_MUSIC_TTL)
    void queueMusicSearchFetch(cleanQuery).catch((err) => {
      logger.error(
        `[SearchMusicRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
