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

async function findSimilarAlbums(
  id: number,
  limit: number,
  prisma: any,
  cache: any,
  cacheKey: string
): Promise<SimilarMediaItem[] | NotFound> {
  const albumSource = await prisma.musicAlbum.findUnique({
    where: { id },
    select: {
      id: true,
      titlePrimary: true,
      titleSecondary: true,
      artistName: true,
      albumType: true,
      genres: { select: { id: true } },
    },
  })

  if (!albumSource) {
    return new NotFound(`Music album not found with ID ${id}`)
  }

  const sourceGenreIds = new Set(albumSource.genres.map((g: { id: number }) => g.id))
  const keywords = extractSearchKeywords([
    albumSource.titlePrimary,
    albumSource.titleSecondary,
  ])

  const orConditions: Prisma.MusicAlbumWhereInput[] = []
  if (albumSource.artistName && albumSource.artistName.trim().length > 0) {
    orConditions.push({
      artistName: { equals: albumSource.artistName.trim(), mode: "insensitive" },
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

  const candidates = await prisma.musicAlbum.findMany({
    where: {
      id: { not: albumSource.id },
      OR: orConditions,
    },
    select: {
      id: true,
      coverImage: true,
      titlePrimary: true,
      titleSecondary: true,
      artistName: true,
      albumType: true,
      popularity: true,
      genres: { select: { id: true } },
    },
  })

  const sourceTitles = [albumSource.titlePrimary, albumSource.titleSecondary]
  const scoredList: Array<{
    candidate: (typeof candidates)[number]
    score: number
  }> = []

  for (const candidate of candidates) {
    let score = 0
    const candidateTitles = [candidate.titlePrimary, candidate.titleSecondary]
    if (isTitleMatch(sourceTitles, candidateTitles)) {
      score += TITLE_MATCH_POINTS
    }

    let matchedGenresCount = 0
    for (const g of candidate.genres) {
      if (sourceGenreIds.has(g.id)) {
        matchedGenresCount++
      }
    }
    score += matchedGenresCount * GENRE_MATCH_POINTS

    if (score >= MIN_SIMILARITY_SCORE) {
      scoredList.push({ candidate, score })
    }
  }

  scoredList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (b.candidate.popularity ?? 0) - (a.candidate.popularity ?? 0)
  })

  const formattedList: SimilarMediaItem[] = scoredList.map(({ candidate }) => ({
    id: candidate.id,
    type: "MUSIC",
    format: candidate.albumType || "ALBUM",
    coverImage: candidate.coverImage ?? null,
    titles: {
      primary: candidate.titlePrimary,
      secondary: candidate.titleSecondary ?? null,
      native: candidate.artistName ?? null,
    },
  }))

  await cache.set(cacheKey, formattedList, SIMILAR_MEDIA_TTL)
  return formattedList.slice(0, limit)
}

async function findSimilarTracks(
  id: number,
  limit: number,
  prisma: any,
  cache: any,
  cacheKey: string
): Promise<SimilarMediaItem[] | NotFound> {
  const source = await prisma.musicTrack.findUnique({
    where: { id },
    select: {
      id: true,
      titlePrimary: true,
      titleSecondary: true,
      artistName: true,
      album: {
        select: { titlePrimary: true },
      },
      genres: {
        select: { id: true },
      },
    },
  })

  if (!source) {
    return new NotFound(`Music track not found with ID ${id}`)
  }

  const sourceGenreIds = new Set(source.genres.map((g: { id: number }) => g.id))

  const keywords = extractSearchKeywords([
    source.titlePrimary,
    source.titleSecondary,
    source.album?.titlePrimary ?? null,
  ])

  const orConditions: Prisma.MusicTrackWhereInput[] = []

  if (source.artistName && source.artistName.trim().length > 0) {
    orConditions.push({
      artistName: { equals: source.artistName.trim(), mode: "insensitive" },
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

  const candidates = await prisma.musicTrack.findMany({
    where: {
      id: { not: source.id },
      OR: orConditions,
    },
    select: {
      id: true,
      coverImage: true,
      titlePrimary: true,
      titleSecondary: true,
      artistName: true,
      albumId: true,
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

    const candidateTitles = [candidate.titlePrimary, candidate.titleSecondary]
    if (isTitleMatch(sourceTitles, candidateTitles)) {
      score += TITLE_MATCH_POINTS
    }

    let matchedGenresCount = 0
    for (const g of candidate.genres) {
      if (sourceGenreIds.has(g.id)) {
        matchedGenresCount++
      }
    }
    score += matchedGenresCount * GENRE_MATCH_POINTS

    if (score >= MIN_SIMILARITY_SCORE) {
      scoredList.push({ candidate, score })
    }
  }

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
      format: candidate.albumId ? "ALBUM_TRACK" : "TRACK",
      coverImage: candidate.coverImage ?? null,
      titles: {
        primary: candidate.titlePrimary,
        secondary: candidate.titleSecondary ?? null,
        native: candidate.artistName ?? null,
      },
    })
  )

  await cache.set(cacheKey, formattedList, SIMILAR_MEDIA_TTL)
  return formattedList.slice(0, limit)
}

export default defineRoute({
  cacheKeys: {
    similar: {
      music: (id: number, type?: string) =>
        type ? `music:${type}:${id}:similar` : `music:${id}:similar`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    query: t.Optional(
      t.Object({
        limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50 })),
        type: t.Optional(t.Union([t.Literal("TRACK"), t.Literal("ALBUM")])),
      })
    ),
    response: {
      200: SimilarMediaResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get similar music tracks or albums",
      description:
        "Finds similar music tracks or albums based on title (20 pts, >= 60% match) and genres (1 pt each).",
      tags: ["Media - Music"],
    },
  },

  async GET({ params, query, prisma, cache, cacheKeys }) {
    const id = Number(params.id)
    const limit = Math.max(1, Math.min(Number((query as any)?.limit ?? 10) || 10, 50))
    const targetType = (query as any)?.type as "TRACK" | "ALBUM" | undefined

    const cacheKey = cacheKeys.similar.music(id, targetType)
    const cached = await cache.get<SimilarMediaItem[]>(cacheKey)
    if (cached) {
      return cached.slice(0, limit)
    }

    if (targetType === "ALBUM") {
      return findSimilarAlbums(id, limit, prisma, cache, cacheKey)
    }

    if (targetType === "TRACK") {
      return findSimilarTracks(id, limit, prisma, cache, cacheKey)
    }

    // Auto-detect target: check if album first
    const isAlbum = await prisma.musicAlbum.findUnique({
      where: { id },
      select: { id: true },
    })
    if (isAlbum) {
      return findSimilarAlbums(id, limit, prisma, cache, cacheKey)
    }

    const isTrack = await prisma.musicTrack.findUnique({
      where: { id },
      select: { id: true },
    })
    if (isTrack) {
      return findSimilarTracks(id, limit, prisma, cache, cacheKey)
    }

    return new NotFound(`Music not found with ID ${id}`)
  },
})
