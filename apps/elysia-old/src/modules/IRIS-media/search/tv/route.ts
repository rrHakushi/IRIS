import { defineRoute, t } from "@/router"
import { queueTvSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { TvSearchResponseSchema, type TvSearchResponse } from "./types"
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

  async GET({ query, prisma, logger }) {
    const cleanQuery = decodeURIComponent(String(query.q || ""))
      .replace(/\+/g, " ")
      .trim()

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
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
      const rawResults = await queueTvSearchFetch(cleanQuery)
      const results = rawResults.map((item: any) => ({
        ...item,
        queuedForFetch: true,
      }))
      return results
    }

    void queueTvSearchFetch(cleanQuery).catch((err) => {
      logger.error(
        `[SearchTvRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
