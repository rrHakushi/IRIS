import { defineRoute, t } from "@/router"
import { NotFound } from "elysia"
import {
  StudioResponseSchema,
  type StudioCreationItem,
  type StudioDetails,
} from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"

const STUDIO_CACHE_TTL = 5 * 60 // 5 minutes

export const mediaStudioInclude = {
  anime: {
    select: {
      id: true,
      titlePrimary: true,
      titleSecondary: true,
      titleNative: true,
      coverImage: true,
      bannerImage: true,
      format: true,
      seasonYear: true,
      startDateYear: true,
      averageScore: true,
      popularity: true,
      favorites: true,
      status: true,
      genres: { select: { name: true } },
    },
  },
  movie: {
    select: {
      id: true,
      titlePrimary: true,
      titleSecondary: true,
      titleNative: true,
      coverImage: true,
      bannerImage: true,
      releaseDateYear: true,
      averageScore: true,
      popularity: true,
      favorites: true,
      status: true,
      genres: { select: { name: true } },
    },
  },
  tv: {
    select: {
      id: true,
      titlePrimary: true,
      titleSecondary: true,
      titleNative: true,
      coverImage: true,
      bannerImage: true,
      firstAiredYear: true,
      averageScore: true,
      popularity: true,
      favorites: true,
      status: true,
      genres: { select: { name: true } },
    },
  },
  game: {
    select: {
      id: true,
      titlePrimary: true,
      titleSecondary: true,
      titleNative: true,
      coverImage: true,
      bannerImage: true,
      backgroundImage: true,
      releaseDateYear: true,
      averageScore: true,
      popularity: true,
      favorites: true,
      status: true,
      genres: { select: { name: true } },
    },
  },
  book: {
    select: {
      id: true,
      titlePrimary: true,
      titleSecondary: true,
      coverImage: true,
      bannerImage: true,
      releaseDateYear: true,
      averageScore: true,
      popularity: true,
      favorites: true,
      status: true,
      genres: { select: { name: true } },
    },
  },
} as const

export function mapMediaStudioRecord(record: any): StudioCreationItem | null {
  if (record.anime) {
    return {
      id: record.id,
      mediaType: "ANIME",
      mediaId: record.anime.id,
      isMain: Boolean(record.isMain),
      titlePrimary: record.anime.titlePrimary || "Untitled",
      titleSecondary: record.anime.titleSecondary ?? null,
      titleNative: record.anime.titleNative ?? null,
      coverImage: record.anime.coverImage ?? null,
      bannerImage: record.anime.bannerImage ?? record.anime.coverImage ?? null,
      format: record.anime.format ?? "TV",
      releaseYear:
        record.anime.seasonYear ?? record.anime.startDateYear ?? null,
      averageScore: record.anime.averageScore ?? null,
      popularity: record.anime.popularity ?? null,
      favorites: record.anime.favorites ?? null,
      genres: (record.anime.genres || [])
        .map((g: any) => (typeof g === "string" ? g : (g?.name ?? "")))
        .filter(Boolean),
      status: record.anime.status ?? null,
    }
  }
  if (record.movie) {
    return {
      id: record.id,
      mediaType: "MOVIE",
      mediaId: record.movie.id,
      isMain: Boolean(record.isMain),
      titlePrimary: record.movie.titlePrimary || "Untitled",
      titleSecondary: record.movie.titleSecondary ?? null,
      titleNative: record.movie.titleNative ?? null,
      coverImage: record.movie.coverImage ?? null,
      bannerImage: record.movie.bannerImage ?? record.movie.coverImage ?? null,
      format: "MOVIE",
      releaseYear: record.movie.releaseDateYear ?? null,
      averageScore: record.movie.averageScore ?? null,
      popularity: record.movie.popularity ?? null,
      favorites: record.movie.favorites ?? null,
      genres: (record.movie.genres || [])
        .map((g: any) => (typeof g === "string" ? g : (g?.name ?? "")))
        .filter(Boolean),
      status: record.movie.status ?? null,
    }
  }
  if (record.tv) {
    return {
      id: record.id,
      mediaType: "TV",
      mediaId: record.tv.id,
      isMain: Boolean(record.isMain),
      titlePrimary: record.tv.titlePrimary || "Untitled",
      titleSecondary: record.tv.titleSecondary ?? null,
      titleNative: record.tv.titleNative ?? null,
      coverImage: record.tv.coverImage ?? null,
      bannerImage: record.tv.bannerImage ?? record.tv.coverImage ?? null,
      format: "TV",
      releaseYear: record.tv.firstAiredYear ?? null,
      averageScore: record.tv.averageScore ?? null,
      popularity: record.tv.popularity ?? null,
      favorites: record.tv.favorites ?? null,
      genres: (record.tv.genres || [])
        .map((g: any) => (typeof g === "string" ? g : (g?.name ?? "")))
        .filter(Boolean),
      status: record.tv.status ?? null,
    }
  }
  if (record.game) {
    return {
      id: record.id,
      mediaType: "GAME",
      mediaId: record.game.id,
      isMain: Boolean(record.isMain),
      titlePrimary: record.game.titlePrimary || "Untitled",
      titleSecondary: record.game.titleSecondary ?? null,
      titleNative: record.game.titleNative ?? null,
      coverImage: record.game.coverImage ?? null,
      bannerImage:
        record.game.bannerImage ??
        record.game.backgroundImage ??
        record.game.coverImage ??
        null,
      format: "GAME",
      releaseYear: record.game.releaseDateYear ?? null,
      averageScore: record.game.averageScore ?? null,
      popularity: record.game.popularity ?? null,
      favorites: record.game.favorites ?? null,
      genres: (record.game.genres || [])
        .map((g: any) => (typeof g === "string" ? g : (g?.name ?? "")))
        .filter(Boolean),
      status: record.game.status ?? null,
    }
  }
  if (record.book) {
    return {
      id: record.id,
      mediaType: "BOOK",
      mediaId: record.book.id,
      isMain: Boolean(record.isMain),
      titlePrimary: record.book.titlePrimary || "Untitled",
      titleSecondary: record.book.titleSecondary ?? null,
      titleNative: null,
      coverImage: record.book.coverImage ?? null,
      bannerImage: record.book.bannerImage ?? record.book.coverImage ?? null,
      format: "BOOK",
      releaseYear: record.book.releaseDateYear ?? null,
      averageScore: record.book.averageScore ?? null,
      popularity: record.book.popularity ?? null,
      favorites: record.book.favorites ?? null,
      genres: (record.book.genres || [])
        .map((g: any) => (typeof g === "string" ? g : (g?.name ?? "")))
        .filter(Boolean),
      status: record.book.status ?? null,
    }
  }
  return null
}

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: StudioResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get studio details and creations",
      description:
        "Fetches studio details, metadata, favorite stats, and initial creations across all supported media formats.",
      tags: ["Media - Studio"],
    },
  },

  cacheKeys: {
    studio: {
      id: (id: number) => `studio:${id}:details`,
    },
  },

  async GET({ params, prisma, cache, cacheKeys }) {
    const id = Number(params.id)
    const cacheKey = cacheKeys.studio.id(id)

    const cached = await cache.get<StudioDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const studio = await prisma.studio.findUnique({
      where: { id },
    })

    if (!studio) {
      return new NotFound(`Studio not found with ID ${id}`)
    }

    const [mediaStudioRecords, totalCount] = await Promise.all([
      prisma.mediaStudio.findMany({
        where: { studioId: id },
        include: mediaStudioInclude,
        take: 36,
        orderBy: [{ id: "desc" }],
      }),
      prisma.mediaStudio.count({
        where: { studioId: id },
      }),
    ])

    const creations = mediaStudioRecords
      .map(mapMediaStudioRecord)
      .filter((item): item is StudioCreationItem => item !== null)
      .sort((a, b) => {
        const yearA = a.releaseYear ?? -1
        const yearB = b.releaseYear ?? -1
        if (yearA !== yearB) return yearB - yearA
        return (b.popularity ?? 0) - (a.popularity ?? 0)
      })

    const hasMore = mediaStudioRecords.length < totalCount
    const nextCursor =
      hasMore && mediaStudioRecords.length > 0
        ? mediaStudioRecords[mediaStudioRecords.length - 1]!.id
        : null

    const response: StudioDetails = {
      id: studio.id,
      name: studio.name,
      isAnimationStudio: studio.isAnimationStudio,
      siteUrl: studio.siteUrl ?? null,
      favorites: studio.favorites ?? studio.alFavorites ?? 0,
      alFavorites: studio.alFavorites ?? null,
      sources: studio.sources ?? null,
      creationsCount: totalCount,
      creations,
      pagination: {
        nextCursor,
        hasMore,
        total: totalCount,
      },
    }

    await cache.set(cacheKey, response, STUDIO_CACHE_TTL)
    return response
  },
})
