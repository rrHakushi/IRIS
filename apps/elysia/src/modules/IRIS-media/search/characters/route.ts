import { defineRoute, t } from "@/router"
import { NotFound } from "elysia"

import {
  CharacterSearchResponseSchema,
  type CharacterSearchResponse,
} from "./types"
import { NotFoundResponseSchema } from "../../../../../types"
import { findMatchingAlternativeNameIds } from "../../helpers/search-synonyms"

const SEARCH_CHARACTERS_TTL = 5 * 60 // 5 minutes

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: CharacterSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search characters",
      description:
        "Searches characters by name or aliases and returns matching character preview records.",
      tags: ["Media - Character"],
    },
  },

  cacheKeys: {
    search: {
      characters: (q: string) => `search:characters:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys }) {
    const cleanQuery = decodeURIComponent(String(query.q || "")).replace(/\+/g, " ").trim()
    const cacheKey = cacheKeys.search.characters(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<CharacterSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const alternativeNameIds = await findMatchingAlternativeNameIds(
      prisma,
      "Character",
      cleanQuery
    )

    const data = await prisma.character.findMany({
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
        gender: true,
      },
      orderBy: {
        namePrimary: "asc",
      },
    })

    await cache.set(cacheKey, data, SEARCH_CHARACTERS_TTL)
    return data
  },
})
