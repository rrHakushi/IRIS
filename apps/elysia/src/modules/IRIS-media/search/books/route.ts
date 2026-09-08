import { defineRoute, t } from "@/router"
import { queueBookSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { BookSearchResponseSchema, type BookSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"
import { findMatchingSynonymIds } from "../../helpers/search-synonyms"

const SEARCH_BOOKS_TTL = 5 * 60 // 5 minutes

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
    const cleanQuery = decodeURIComponent(String(query.q || ""))
      .replace(/\+/g, " ")
      .trim()
    const cacheKey = cacheKeys.search.books(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<BookSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const synonymIds = await findMatchingSynonymIds(prisma, "Book", cleanQuery)

    const data = await prisma.book.findMany({
      where: {
        OR: [
          { titlePrimary: { contains: cleanQuery, mode: "insensitive" } },
          { titleSecondary: { contains: cleanQuery, mode: "insensitive" } },
          { subtitle: { contains: cleanQuery, mode: "insensitive" } },
          ...(synonymIds.length > 0 ? [{ id: { in: synonymIds } }] : []),
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
      const rawResults = await queueBookSearchFetch(cleanQuery)
      const results = rawResults.map((item: any) => ({
        ...item,
        queuedForFetch: true,
      }))
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
