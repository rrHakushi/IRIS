import { defineRoute, t } from "@/router"
import { NotFound, NotFoundResponseSchema } from "@/utils/errors"
import type { Prisma } from "@IRIS/database"
import {
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
      music: (id: number) => `music:${id}:similar`,
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
      summary: "Get similar music tracks",
      description:
        "Finds similar music tracks based on title (20 pts, >= 60% match) and genres (1 pt each) with a minimum score of 17 points.",
      tags: ["Media - Music"],
    },
  },

  async GET({ params, query, prisma, cache, cacheKeys }) {
    const id = params.id
    const limit = Math.max(1, Math.min(query?.limit ?? 10, 50))

    const cacheKey = cacheKeys.similar.music(id)
    const cached = await cache.get<SimilarMediaItem[]>(cacheKey)
    if (cached) {
      return cached.slice(0, limit)
    }

    const source = await prisma.music.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        artist: true,
        album: true,
        genres: {
          select: { id: true },
        },
      },
    })

    if (!source) {
      return new NotFound(`Music track not found with ID ${id}`)
    }

    const sourceGenreIds = new Set(source.genres.map((g) => g.id))

    // Title & artist keywords
    const keywords = extractSearchKeywords([
      source.titlePrimary,
      source.titleSecondary,
      source.album,
    ])

    const orConditions: Prisma.MusicWhereInput[] = []

    if (source.artist && source.artist.trim().length > 0) {
      orConditions.push({
        artist: { equals: source.artist.trim(), mode: "insensitive" },
      })
    }

    for (const kw of keywords) {
      orConditions.push(
        { titlePrimary: { contains: kw, mode: "insensitive" } },
        { titleSecondary: { contains: kw, mode: "insensitive" } }
      )
    }

    if (orConditions.length === 0) {
      await cache.set(cacheKey, [], SIMILAR_MEDIA_TTL)
      return []
    }

    const candidates = await prisma.music.findMany({
      where: {
        id: { not: source.id },
        OR: orConditions,
      },
      select: {
        id: true,
        coverImage: true,
        titlePrimary: true,
        titleSecondary: true,
        artist: true,
        album: true,
        popularity: true,
        genres: {
          select: { id: true },
        },
      },
    })

    const sourceTitles = [source.titlePrimary, source.titleSecondary]
    const scoredList: Array<{
      candidate: (typeof candidates)[number]
      score: number
    }> = []

    for (const candidate of candidates) {
      let score = 0

      // Title (20 points) (primary, secondary) - 60% match threshold
      const candidateTitles = [candidate.titlePrimary, candidate.titleSecondary]
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
        type: "MUSIC",
        format: candidate.album ? "ALBUM_TRACK" : "TRACK",
        coverImage: candidate.coverImage,
        titles: {
          primary: candidate.titlePrimary,
          secondary: candidate.titleSecondary,
          native: candidate.artist ?? null,
        },
      })
    )

    await cache.set(cacheKey, formattedList, SIMILAR_MEDIA_TTL)

    return formattedList.slice(0, limit)
  },
})
