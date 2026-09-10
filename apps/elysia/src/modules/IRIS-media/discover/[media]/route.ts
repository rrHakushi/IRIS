import { defineRoute, t } from "@/router"
import { NotFound } from "elysia"
import { NotFoundResponseSchema } from "../../../../../types"
import {
  DiscoverResponseSchema,
  type DiscoverResponse,
  type DiscoverItem,
  type DiscoverGenre,
} from "./types"

const DISCOVER_CACHE_TTL = 15 * 60 // 15 minutes

const MediaParamSchema = t.Union([
  t.Literal("anime"),
  t.Literal("manga"),
  t.Literal("movies"),
  t.Literal("tv"),
  t.Literal("games"),
  t.Literal("books"),
  t.Literal("music"),
])

function getCurrentSeason(): "WINTER" | "SPRING" | "SUMMER" | "FALL" {
  const month = new Date().getMonth() + 1
  if (month <= 3) return "WINTER"
  if (month <= 6) return "SPRING"
  if (month <= 9) return "SUMMER"
  return "FALL"
}

function sampleRandom<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = temp
  }
  return copy.slice(0, count)
}

export default defineRoute({
  schema: {
    params: t.Object({
      media: MediaParamSchema,
    }),
    query: t.Object({
      genre: t.Optional(
        t.String({
          description: "Optional genre filter",
        })
      ),
    }),
    response: {
      200: DiscoverResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Discover media",
      description:
        "Fetches curated discover sections, hero spotlight, and genres for a given media type using local community stats.",
      tags: ["Media - Discover"],
    },
  },

  cacheKeys: {
    discover: {
      media: (media: string, genre?: string) =>
        `discover:${media}:${genre ? encodeURIComponent(genre) : "all"}`,
    },
  },

  async GET({ params, query, prisma, cache, cacheKeys }) {
    const media = params.media as
      "anime" | "manga" | "movies" | "tv" | "games" | "books" | "music"
    const rawGenre = typeof query.genre === "string" ? query.genre : undefined
    const genre = rawGenre?.trim() || undefined
    const cacheKey = cacheKeys.discover.media(media, genre)

    const cached = await cache.get<DiscoverResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const currentYear = new Date().getFullYear()
    const currentSeason = getCurrentSeason()
    const genreFilter = genre
      ? {
          genres: {
            some: {
              name: { equals: genre, mode: "insensitive" as const },
            },
          },
        }
      : {}

    let response: DiscoverResponse

    switch (media) {
      case "anime": {
        const [
          heroItems,
          thisSeason,
          topRated,
          popular,
          nextSeason,
          genreRecords,
        ] = await Promise.all([
          prisma.anime.findMany({
            where: {
              ...genreFilter,
              coverImage: { not: null },
            },
            orderBy: [{ popularity: "desc" }, { averageScore: "desc" }],
            take: 25,
            include: { genres: { select: { name: true } } },
          }),
          prisma.anime.findMany({
            where: {
              ...genreFilter,
              OR: [
                { seasonYear: currentYear, seasonSeason: currentSeason },
                { status: "RELEASING" },
              ],
            },
            orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.anime.findMany({
            where: {
              ...genreFilter,
              averageScore: { not: null, gt: 0 },
            },
            orderBy: [{ averageScore: "desc" }, { popularity: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.anime.findMany({
            where: genreFilter,
            orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.anime.findMany({
            where: {
              ...genreFilter,
              status: "NOT_YET_RELEASED",
            },
            orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.genre.findMany({
            where: { anime: { some: {} } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
            take: 25,
          }),
        ])

        const mapAnime = (item: any): DiscoverItem => ({
          id: item.id,
          titlePrimary: item.titlePrimary,
          titleSecondary: item.titleSecondary,
          titleNative: item.titleNative,
          coverImage: item.coverImage,
          bannerImage: item.bannerImage || item.coverImage,
          description: item.description,
          format: item.format,
          averageScore: item.averageScore,
          popularity: item.popularity,
          favorites: item.favorites,
          genres: (item.genres || []).map((g: any) => g.name),
          releaseYear: item.seasonYear || item.startDateYear,
          seasonSeason: item.seasonSeason,
          status: item.status,
          isAdult: item.isAdult,
        })

        const hero = sampleRandom(heroItems, 6).map(mapAnime)
        const sections = [
          {
            id: "this-season",
            title: `Trending This Season (${currentSeason} ${currentYear})`,
            items: thisSeason.map(mapAnime),
          },
          {
            id: "top-rated",
            title: "Top Rated of All Time",
            items: topRated.map(mapAnime),
          },
          {
            id: "popular",
            title: "All-Time Popular",
            items: popular.map(mapAnime),
          },
          {
            id: "upcoming",
            title: "Upcoming Releases",
            items: nextSeason.map(mapAnime),
          },
        ]

        response = {
          media: "anime",
          hero,
          sections: sections.filter((s) => s.items.length > 0),
          genres: genreRecords,
        }
        break
      }

      case "manga": {
        const [
          heroItems,
          trending,
          topRated,
          popular,
          lightNovels,
          genreRecords,
        ] = await Promise.all([
          prisma.manga.findMany({
            where: {
              ...genreFilter,
              coverImage: { not: null },
            },
            orderBy: [{ popularity: "desc" }, { averageScore: "desc" }],
            take: 25,
            include: { genres: { select: { name: true } } },
          }),
          prisma.manga.findMany({
            where: {
              ...genreFilter,
              status: "RELEASING",
            },
            orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.manga.findMany({
            where: {
              ...genreFilter,
              averageScore: { not: null, gt: 0 },
            },
            orderBy: [{ averageScore: "desc" }, { popularity: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.manga.findMany({
            where: genreFilter,
            orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.manga.findMany({
            where: {
              ...genreFilter,
              format: "LIGHT_NOVEL",
            },
            orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.genre.findMany({
            where: { manga: { some: {} } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
            take: 25,
          }),
        ])

        const mapManga = (item: any): DiscoverItem => ({
          id: item.id,
          titlePrimary: item.titlePrimary,
          titleSecondary: item.titleSecondary,
          titleNative: item.titleNative,
          coverImage: item.coverImage,
          bannerImage: item.bannerImage || item.coverImage,
          description: item.description,
          format: item.format,
          averageScore: item.averageScore,
          popularity: item.popularity,
          favorites: item.favorites,
          genres: (item.genres || []).map((g: any) => g.name),
          releaseYear: item.startDateYear,
          seasonSeason: null,
          status: item.status,
          isAdult: false,
        })

        response = {
          media: "manga",
          hero: sampleRandom(heroItems, 6).map(mapManga),
          sections: [
            {
              id: "trending-manga",
              title: "Trending Manga",
              items: trending.map(mapManga),
            },
            {
              id: "top-rated-manga",
              title: "Top Rated Manga",
              items: topRated.map(mapManga),
            },
            {
              id: "popular-manga",
              title: "All-Time Popular",
              items: popular.map(mapManga),
            },
            {
              id: "light-novels",
              title: "Popular Light Novels",
              items: lightNovels.map(mapManga),
            },
          ].filter((s) => s.items.length > 0),
          genres: genreRecords,
        }
        break
      }

      case "movies": {
        const [heroItems, trending, topRated, recent, genreRecords] =
          await Promise.all([
            prisma.movie.findMany({
              where: {
                ...genreFilter,
                coverImage: { not: null },
              },
              orderBy: [{ popularity: "desc" }, { averageScore: "desc" }],
              take: 25,
              include: { genres: { select: { name: true } } },
            }),
            prisma.movie.findMany({
              where: genreFilter,
              orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.movie.findMany({
              where: {
                ...genreFilter,
                averageScore: { not: null, gt: 0 },
              },
              orderBy: [{ averageScore: "desc" }, { popularity: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.movie.findMany({
              where: {
                ...genreFilter,
                releaseDateYear: { gte: currentYear - 1 },
              },
              orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.genre.findMany({
              where: { movies: { some: {} } },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
              take: 25,
            }),
          ])

        const mapMovie = (item: any): DiscoverItem => ({
          id: item.id,
          titlePrimary: item.titlePrimary,
          titleSecondary: item.titleSecondary,
          titleNative: item.titleNative,
          coverImage: item.coverImage,
          bannerImage: item.bannerImage || item.coverImage,
          description: item.description,
          format: "MOVIE",
          averageScore: item.averageScore,
          popularity: item.popularity,
          favorites: item.favorites,
          genres: (item.genres || []).map((g: any) => g.name),
          releaseYear: item.releaseDateYear,
          seasonSeason: null,
          status: item.status,
          isAdult: item.isAdult,
        })

        response = {
          media: "movies",
          hero: sampleRandom(heroItems, 6).map(mapMovie),
          sections: [
            {
              id: "trending-movies",
              title: "Trending Movies",
              items: trending.map(mapMovie),
            },
            {
              id: "recent-movies",
              title: "New & Recent Releases",
              items: recent.map(mapMovie),
            },
            {
              id: "top-rated-movies",
              title: "Top Rated Movies",
              items: topRated.map(mapMovie),
            },
          ].filter((s) => s.items.length > 0),
          genres: genreRecords,
        }
        break
      }

      case "tv": {
        const [heroItems, trending, topRated, returningSeries, genreRecords] =
          await Promise.all([
            prisma.tv.findMany({
              where: {
                ...genreFilter,
                coverImage: { not: null },
              },
              orderBy: [{ popularity: "desc" }, { averageScore: "desc" }],
              take: 25,
              include: { genres: { select: { name: true } } },
            }),
            prisma.tv.findMany({
              where: genreFilter,
              orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.tv.findMany({
              where: {
                ...genreFilter,
                averageScore: { not: null, gt: 0 },
              },
              orderBy: [{ averageScore: "desc" }, { popularity: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.tv.findMany({
              where: {
                ...genreFilter,
                status: "RETURNING_SERIES",
              },
              orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.genre.findMany({
              where: { tv: { some: {} } },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
              take: 25,
            }),
          ])

        const mapTv = (item: any): DiscoverItem => ({
          id: item.id,
          titlePrimary: item.titlePrimary,
          titleSecondary: item.titleSecondary,
          titleNative: item.titleNative,
          coverImage: item.coverImage,
          bannerImage: item.bannerImage || item.coverImage,
          description: item.description,
          format: "TV",
          averageScore: item.averageScore,
          popularity: item.popularity,
          favorites: item.favorites,
          genres: (item.genres || []).map((g: any) => g.name),
          releaseYear: item.firstAiredYear,
          seasonSeason: null,
          status: item.status,
          isAdult: item.isAdult,
        })

        response = {
          media: "tv",
          hero: sampleRandom(heroItems, 6).map(mapTv),
          sections: [
            {
              id: "trending-tv",
              title: "Trending TV Shows",
              items: trending.map(mapTv),
            },
            {
              id: "airing-tv",
              title: "Returning Series & Airing Now",
              items: returningSeries.map(mapTv),
            },
            {
              id: "top-rated-tv",
              title: "Top Rated Shows",
              items: topRated.map(mapTv),
            },
          ].filter((s) => s.items.length > 0),
          genres: genreRecords,
        }
        break
      }

      case "games": {
        const [heroItems, trending, topRated, recent, genreRecords] =
          await Promise.all([
            prisma.game.findMany({
              where: {
                ...genreFilter,
                coverImage: { not: null },
              },
              orderBy: [{ popularity: "desc" }, { averageScore: "desc" }],
              take: 25,
              include: { genres: { select: { name: true } } },
            }),
            prisma.game.findMany({
              where: genreFilter,
              orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.game.findMany({
              where: {
                ...genreFilter,
                averageScore: { not: null, gt: 0 },
              },
              orderBy: [{ averageScore: "desc" }, { popularity: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.game.findMany({
              where: {
                ...genreFilter,
                releaseDateYear: { gte: currentYear - 2 },
              },
              orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.genre.findMany({
              where: { games: { some: {} } },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
              take: 25,
            }),
          ])

        const mapGame = (item: any): DiscoverItem => ({
          id: item.id,
          titlePrimary: item.titlePrimary,
          titleSecondary: item.titleSecondary,
          titleNative: item.titleNative,
          coverImage: item.coverImage,
          bannerImage:
            item.bannerImage || item.backgroundImage || item.coverImage,
          description: item.description,
          format:
            item.platforms && item.platforms.length > 0
              ? item.platforms[0]
              : "GAME",
          averageScore: item.averageScore,
          popularity: item.popularity,
          favorites: item.favorites,
          genres: (item.genres || []).map((g: any) => g.name),
          releaseYear: item.releaseDateYear,
          seasonSeason: null,
          status: item.status,
          isAdult: item.isAdult,
        })

        response = {
          media: "games",
          hero: sampleRandom(heroItems, 6).map(mapGame),
          sections: [
            {
              id: "trending-games",
              title: "Trending Games",
              items: trending.map(mapGame),
            },
            {
              id: "recent-games",
              title: "Recent Releases",
              items: recent.map(mapGame),
            },
            {
              id: "top-rated-games",
              title: "Top Rated of All Time",
              items: topRated.map(mapGame),
            },
          ].filter((s) => s.items.length > 0),
          genres: genreRecords,
        }
        break
      }

      case "books": {
        const [heroItems, trending, topRated, recent, genreRecords] =
          await Promise.all([
            prisma.book.findMany({
              where: {
                ...genreFilter,
                coverImage: { not: null },
              },
              orderBy: [{ popularity: "desc" }, { averageScore: "desc" }],
              take: 25,
              include: { genres: { select: { name: true } } },
            }),
            prisma.book.findMany({
              where: genreFilter,
              orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.book.findMany({
              where: {
                ...genreFilter,
                averageScore: { not: null, gt: 0 },
              },
              orderBy: [{ averageScore: "desc" }, { popularity: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.book.findMany({
              where: {
                ...genreFilter,
                releaseDateYear: { gte: currentYear - 3 },
              },
              orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
              take: 18,
              include: { genres: { select: { name: true } } },
            }),
            prisma.genre.findMany({
              where: { books: { some: {} } },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
              take: 25,
            }),
          ])

        const mapBook = (item: any): DiscoverItem => ({
          id: item.id,
          titlePrimary: item.titlePrimary,
          titleSecondary: item.titleSecondary,
          titleNative: item.titleNative,
          coverImage: item.coverImage,
          bannerImage: item.bannerImage || item.coverImage,
          description: item.description,
          format: "BOOK",
          averageScore: item.averageScore,
          popularity: item.popularity,
          favorites: item.favorites,
          genres: (item.genres || []).map((g: any) => g.name),
          releaseYear: item.releaseDateYear,
          seasonSeason: null,
          status: item.status,
          isAdult: item.isAdult,
        })

        response = {
          media: "books",
          hero: sampleRandom(heroItems, 6).map(mapBook),
          sections: [
            {
              id: "trending-books",
              title: "Trending Books",
              items: trending.map(mapBook),
            },
            {
              id: "top-rated-books",
              title: "Top Rated Books",
              items: topRated.map(mapBook),
            },
            {
              id: "recent-books",
              title: "Recent Releases",
              items: recent.map(mapBook),
            },
          ].filter((s) => s.items.length > 0),
          genres: genreRecords,
        }
        break
      }

      case "music": {
        const [
          heroItems,
          trendingTracks,
          trendingAlbums,
          topRanked,
          genreRecords,
        ] = await Promise.all([
          prisma.music.findMany({
            where: {
              coverImage: { not: null },
            },
            orderBy: [{ popularity: "desc" }, { favorites: "desc" }],
            take: 25,
            include: { genres: { select: { name: true } } },
          }),
          prisma.music.findMany({
            where: { type: "TRACK" },
            orderBy: [{ popularity: "desc" }, { playCount: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.music.findMany({
            where: { type: "ALBUM" },
            orderBy: [{ popularity: "desc" }, { playCount: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.music.findMany({
            orderBy: [{ popularity: "desc" }, { rank: "desc" }],
            take: 18,
            include: { genres: { select: { name: true } } },
          }),
          prisma.genre.findMany({
            where: { music: { some: {} } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
            take: 25,
          }),
        ])

        const mapMusic = (item: any): DiscoverItem => ({
          id: item.id,
          titlePrimary: item.titlePrimary,
          titleSecondary: item.titleSecondary,
          titleNative: item.titleNative,
          coverImage: item.coverImage,
          bannerImage: item.coverImage,
          description: item.description,
          format: item.type,
          averageScore: null,
          popularity: item.popularity,
          favorites: item.favorites,
          genres: (item.genres || []).map((g: any) => g.name),
          releaseYear: item.releaseDateYear,
          seasonSeason: null,
          status: item.status,
          isAdult: item.explicitLyrics,
          artistName: item.artistName,
          duration: item.duration,
          itemType: item.type,
          audioPreviewUrl: item.audioPreviewUrl,
        })

        response = {
          media: "music",
          hero: sampleRandom(heroItems, 6).map(mapMusic),
          sections: [
            {
              id: "trending-tracks",
              title: "Trending Tracks",
              items: trendingTracks.map(mapMusic),
            },
            {
              id: "trending-albums",
              title: "Trending Albums",
              items: trendingAlbums.map(mapMusic),
            },
            {
              id: "chart-toppers",
              title: "Chart Toppers",
              items: topRanked.map(mapMusic),
            },
          ].filter((s) => s.items.length > 0),
          genres: genreRecords,
        }
        break
      }

      default:
        throw new NotFound(`Media type '${media}' not supported`)
    }

    await cache.set(cacheKey, response, DISCOVER_CACHE_TTL)
    return response
  },
})
