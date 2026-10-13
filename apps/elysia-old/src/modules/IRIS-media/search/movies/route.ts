import { defineRoute, t } from "@/router"
import { queueMovieSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { MovieSearchResponseSchema, type MovieSearchResponse } from "./types"
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
      200: MovieSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search movies",
      description:
        "Searches movies by title or synonyms and returns matching movie preview records.",
      tags: ["Media - Movie"],
    },
  },

  async GET({ query, prisma, logger }) {
    const cleanQuery = decodeURIComponent(String(query.q || ""))
      .replace(/\+/g, " ")
      .trim()

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const synonymIds = await findMatchingSynonymIds(prisma, "Movie", cleanQuery)

    const data = await prisma.movie.findMany({
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
        bannerImage: true,
        releaseDateYear: true,
      },
      orderBy: {
        titlePrimary: "asc",
      },
    })

    if (data.length === 0) {
      logger.warn(`No data found for query: ${cleanQuery}, triggering refresh`)
      const rawResults = await queueMovieSearchFetch(cleanQuery)
      const results = rawResults.map((item: any) => ({
        ...item,
        queuedForFetch: true,
      }))
      return results
    }

    void queueMovieSearchFetch(cleanQuery).catch((err) => {
      logger.error(
        `[SearchMoviesRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
