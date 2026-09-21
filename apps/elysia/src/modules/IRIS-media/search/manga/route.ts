import { defineRoute, t } from "@/router"
import { queueMangaSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { MangaSearchResponseSchema, type MangaSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"
import { findMatchingSynonymIds } from "../../helpers/search-synonyms"

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

  async GET({ query, prisma, logger }) {
    const cleanQuery = decodeURIComponent(String(query.q || ""))
      .replace(/\+/g, " ")
      .trim()

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
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
      return results
    }

    void queueMangaSearchFetch(cleanQuery).catch((err) => {
      logger.error(
        `[SearchMangaRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
