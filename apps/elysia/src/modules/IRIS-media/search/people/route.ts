import { defineRoute, t } from "@/router"
import { NotFound } from "elysia"

import { PeopleSearchResponseSchema, type PeopleSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"
import { findMatchingAlternativeNameIds } from "../../helpers/search-synonyms"

const SEARCH_PEOPLE_TTL = 5 * 60 // 5 minutes

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: PeopleSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search people",
      description:
        "Searches people and staff by name or aliases and returns matching person preview records.",
      tags: ["Media - Person"],
    },
  },

  cacheKeys: {
    search: {
      people: (q: string) => `search:people:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys }) {
    const cleanQuery = decodeURIComponent(String(query.q || "")).replace(/\+/g, " ").trim()
    const cacheKey = cacheKeys.search.people(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<PeopleSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const alternativeNameIds = await findMatchingAlternativeNameIds(
      prisma,
      "Person",
      cleanQuery
    )

    const data = await prisma.person.findMany({
      where: {
        OR: [
          { namePrimary: { contains: cleanQuery, mode: "insensitive" } },
          { nameNative: { contains: cleanQuery, mode: "insensitive" } },
          ...(alternativeNameIds.length > 0
            ? [{ id: { in: alternativeNameIds } }]
            : []),
        ],
      },
      select: {
        id: true,
        namePrimary: true,
        nameNative: true,
        image: true,
        language: true,
      },
      orderBy: {
        namePrimary: "asc",
      },
    })

    await cache.set(cacheKey, data, SEARCH_PEOPLE_TTL)
    return data
  },
})
