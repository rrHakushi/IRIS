import { defineRoute, t } from "@/router"
import { NotFound, NotFoundResponseSchema } from "@/utils/errors"
import type { Prisma } from "@IRIS/database"
import {
  CHARACTER_MATCH_POINTS,
  extractSearchKeywords,
  GENRE_MATCH_POINTS,
  isTitleMatch,
  MIN_SIMILARITY_SCORE,
  SIMILAR_MEDIA_TTL,
  SimilarMediaResponseSchema,
  TITLE_MATCH_POINTS,
  type SimilarMediaItem,
} from "@/modules/IRIS-media/helpers/media-similarity"

export default defineRoute({
  cacheKeys: {
    similar: {
      movies: (id: number) => `movies:${id}:similar`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    query: t.Optional(
      t.Object({
        limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50 })),
      })
    ),
    response: {
      200: SimilarMediaResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get similar movies",
      description:
        "Finds similar movies based on title (20 pts, >= 60% match), genres (1 pt each), and characters (0.5 pts each) with a minimum score of 17 points.",
      tags: ["Media - Movies"],
    },
  },

  async GET({ params, query, prisma, cache, cacheKeys }) {
    const id = params.id
    const limit = Math.max(1, Math.min(query?.limit ?? 10, 50))

    const cacheKey = cacheKeys.similar.movies(id)
    const cached = await cache.get<SimilarMediaItem[]>(cacheKey)
    if (cached) {
      return cached.slice(0, limit)
    }

    const source = await prisma.movie.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        genres: {
          select: { id: true },
        },
        characters: {
          select: { characterId: true },
        },
      },
    })

    if (!source) {
      return new NotFound(`Movie not found with ID ${id}`)
    }

    const sourceCharacterIds = Array.from(
      new Set(source.characters.map((c) => c.characterId))
    )
    const sourceCharacterIdsSet = new Set(sourceCharacterIds)
    const sourceGenreIds = new Set(source.genres.map((g) => g.id))

    const orConditions: Prisma.MovieWhereInput[] = []

    // Character match
    if (sourceCharacterIds.length > 0) {
      orConditions.push({
        characters: {
          some: {
            characterId: { in: sourceCharacterIds },
          },
        },
      })
    }

    // Title keywords
    const keywords = extractSearchKeywords([
      source.titlePrimary,
      source.titleSecondary,
      source.titleNative,
    ])

    for (const kw of keywords) {
      orConditions.push(
        { titlePrimary: { contains: kw, mode: "insensitive" } },
        { titleSecondary: { contains: kw, mode: "insensitive" } },
        { titleNative: { contains: kw, mode: "insensitive" } }
      )
    }

    if (orConditions.length === 0) {
      await cache.set(cacheKey, [], SIMILAR_MEDIA_TTL)
      return []
    }

    const candidates = await prisma.movie.findMany({
      where: {
        id: { not: source.id },
        OR: orConditions,
      },
      select: {
        id: true,
        coverImage: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        popularity: true,
        genres: {
          select: { id: true },
        },
        characters: {
          select: { characterId: true },
        },
      },
    })

    const sourceTitles = [
      source.titlePrimary,
      source.titleSecondary,
      source.titleNative,
    ]
    const scoredList: Array<{
      candidate: (typeof candidates)[number]
      score: number
    }> = []

    for (const candidate of candidates) {
      let score = 0

      // Title (20 points) (native, secondary, primary) - 60% match threshold
      const candidateTitles = [
        candidate.titlePrimary,
        candidate.titleSecondary,
        candidate.titleNative,
      ]
      if (isTitleMatch(sourceTitles, candidateTitles)) {
        score += TITLE_MATCH_POINTS
      }

      // Genres (1 point per matched)
      let matchedGenresCount = 0
      for (const g of candidate.genres) {
        if (sourceGenreIds.has(g.id)) {
          matchedGenresCount++
        }
      }
      score += matchedGenresCount * GENRE_MATCH_POINTS

      // Characters (0.5 points per character matched)
      const candidateCharacterIds = new Set(
        candidate.characters.map((c) => c.characterId)
      )
      let matchedCharactersCount = 0
      for (const charId of candidateCharacterIds) {
        if (sourceCharacterIdsSet.has(charId)) {
          matchedCharactersCount++
        }
      }
      score += matchedCharactersCount * CHARACTER_MATCH_POINTS

      // Return only media that has at least 17 points
      if (score >= MIN_SIMILARITY_SCORE) {
        scoredList.push({ candidate, score })
      }
    }

    // Sort descending by score, then popularity
    scoredList.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      return (b.candidate.popularity ?? 0) - (a.candidate.popularity ?? 0)
    })

    const formattedList: SimilarMediaItem[] = scoredList.map(
      ({ candidate }) => ({
        id: candidate.id,
        type: "MOVIE",
        format: "MOVIE",
        coverImage: candidate.coverImage,
        titles: {
          primary: candidate.titlePrimary,
          secondary: candidate.titleSecondary,
          native: candidate.titleNative,
        },
      })
    )

    await cache.set(cacheKey, formattedList, SIMILAR_MEDIA_TTL)

    return formattedList.slice(0, limit)
  },
})
