import { defineRoute, t } from "@/router"
import { queueBookSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { BookSearchResponseSchema, type BookSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"

const SEARCH_BOOKS_TTL = 60 * 60 // 1 hour

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: BookSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search books",
      description:
        "Searches books by title, authors, or synonyms and returns matching book preview records.",
      tags: ["Media - Book"],
    },
  },

  cacheKeys: {
    search: {
      books: (q: string) => `search:books:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys, logger }) {
    const { q } = query
    const cleanQuery = decodeURIComponent(q).replace(/\+/g, " ").trim()
    const cacheKey = cacheKeys.search.books(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<BookSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.book.findMany({
      where: {
        OR: [
          { titlePrimary: { contains: cleanQuery, mode: "insensitive" } },
          { titleSecondary: { contains: cleanQuery, mode: "insensitive" } },
          { subtitle: { contains: cleanQuery, mode: "insensitive" } },
          { synonyms: { has: cleanQuery } },
        ],
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        authors: true,
        releaseDateYear: true,
      },
      orderBy: {
        titlePrimary: "asc",
      },
    })

    if (data.length === 0) {
      logger.warn(`No data found for query: ${cleanQuery}, triggering refresh`)
      const results = await queueBookSearchFetch(cleanQuery)
      await cache.set(cacheKey, results, SEARCH_BOOKS_TTL)
      return results
    }

    await cache.set(cacheKey, data, SEARCH_BOOKS_TTL)
    void queueBookSearchFetch(cleanQuery).catch((err) => {
      logger.error(
        `[SearchBooksRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
