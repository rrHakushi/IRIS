import { defineRoute, t } from "@/router"
import { NotFound } from "elysia"
import { NotFoundResponseSchema } from "../../../../../../types"
import {
  DiscoverFiltersResponseSchema,
  type DiscoverFiltersResponse,
} from "../types"

const FILTERS_CACHE_TTL = 30 * 60 // 30 minutes

const MediaParamSchema = t.Union([
  t.Literal("anime"),
  t.Literal("manga"),
  t.Literal("movies"),
  t.Literal("tv"),
  t.Literal("games"),
  t.Literal("books"),
  t.Literal("music"),
  t.Literal("characters"),
  t.Literal("staff"),
  t.Literal("people"),
  t.Literal("studios"),
])

export default defineRoute({
  schema: {
    params: t.Object({
      media: MediaParamSchema,
    }),
    response: {
      200: DiscoverFiltersResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get discover filter facets and counts for a media type",
      description:
        "Returns available filter facets (statuses, formats, genres, years, seasons, artists) and item counts for the specified media category.",
      tags: ["Media - Discover"],
    },
  },

  cacheKeys: {
    discover: {
      filters: (media: string) => `discover:${media}:filters`,
    },
  },

  async GET({ params, prisma, cache, cacheKeys }) {
    const media = params.media as
      | "anime"
      | "manga"
      | "movies"
      | "tv"
      | "games"
      | "books"
      | "music"
      | "characters"
      | "staff"
      | "people"
      | "studios"

    const cacheKey = cacheKeys.discover.filters(media)
    const cached = await cache.get<DiscoverFiltersResponse>(cacheKey)
    if (cached) {
      return cached
    }

    let statuses: Array<{ value: string; count: number }> = []
    let formats: Array<{ value: string; count: number }> = []
    let genres: Array<{ value: string; count: number }> = []
    let years: Array<{ value: number; count: number }> = []
    let seasons: Array<{ value: string; count: number }> | undefined = undefined
    let artists: Array<{ value: string; count: number }> | undefined = undefined

    switch (media) {
      case "anime": {
        const [statusGroup, formatGroup, genreRecords, yearGroup, seasonGroup] =
          await Promise.all([
            prisma.anime.groupBy({
              by: ["status"],
              _count: { id: true },
            }),
            prisma.anime.groupBy({
              by: ["format"],
              _count: { id: true },
            }),
            prisma.genre.findMany({
              where: { anime: { some: {} } },
              select: {
                name: true,
                _count: { select: { anime: true } },
              },
              orderBy: { anime: { _count: "desc" } },
              take: 40,
            }),
            prisma.anime.groupBy({
              by: ["seasonYear"],
              _count: { id: true },
              where: { seasonYear: { not: null } },
              orderBy: { seasonYear: "desc" },
              take: 30,
            }),
            prisma.anime.groupBy({
              by: ["seasonSeason"],
              _count: { id: true },
            }),
          ])

        statuses = statusGroup
          .filter((g) => g.status)
          .map((g) => ({ value: g.status!, count: g._count.id }))
          .sort((a, b) => b.count - a.count)

        formats = formatGroup
          .filter((g) => g.format)
          .map((g) => ({ value: g.format!, count: g._count.id }))
          .sort((a, b) => b.count - a.count)

        genres = genreRecords.map((g) => ({
          value: g.name,
          count: g._count.anime,
        }))

        years = yearGroup
          .filter((g) => g.seasonYear && g.seasonYear > 1950)
          .map((g) => ({ value: g.seasonYear!, count: g._count.id }))
          .sort((a, b) => b.value - a.value)

        seasons = seasonGroup
          .filter((g) => g.seasonSeason)
          .map((g) => ({
            value: g.seasonSeason!,
            count: g._count.id,
          }))
        break
      }

      case "manga": {
        const [statusGroup, formatGroup, genreRecords, yearGroup] =
          await Promise.all([
            prisma.manga.groupBy({
              by: ["status"],
              _count: { id: true },
            }),
            prisma.manga.groupBy({
              by: ["format"],
              _count: { id: true },
            }),
            prisma.genre.findMany({
              where: { manga: { some: {} } },
              select: {
                name: true,
                _count: { select: { manga: true } },
              },
              orderBy: { manga: { _count: "desc" } },
              take: 40,
            }),
            prisma.manga.groupBy({
              by: ["startDateYear"],
              _count: { id: true },
              where: { startDateYear: { not: null } },
              orderBy: { startDateYear: "desc" },
              take: 30,
            }),
          ])

        statuses = statusGroup
          .filter((g) => g.status)
          .map((g) => ({ value: g.status!, count: g._count.id }))
          .sort((a, b) => b.count - a.count)

        formats = formatGroup
          .filter((g) => g.format)
          .map((g) => ({ value: g.format!, count: g._count.id }))
          .sort((a, b) => b.count - a.count)

        genres = genreRecords.map((g) => ({
          value: g.name,
          count: g._count.manga,
        }))

        years = yearGroup
          .filter((g) => g.startDateYear && g.startDateYear > 1950)
          .map((g) => ({
            value: g.startDateYear!,
            count: g._count.id,
          }))
          .sort((a, b) => b.value - a.value)
        break
      }

      case "movies": {
        const [statusGroup, genreRecords, yearGroup] = await Promise.all([
          prisma.movie.groupBy({
            by: ["status"],
            _count: { id: true },
          }),
          prisma.genre.findMany({
            where: { movies: { some: {} } },
            select: {
              name: true,
              _count: { select: { movies: true } },
            },
            orderBy: { movies: { _count: "desc" } },
            take: 40,
          }),
          prisma.movie.groupBy({
            by: ["releaseDateYear"],
            _count: { id: true },
            where: { releaseDateYear: { not: null } },
            orderBy: { releaseDateYear: "desc" },
            take: 30,
          }),
        ])

        statuses = statusGroup
          .filter((g) => g.status)
          .map((g) => ({ value: g.status!, count: g._count.id }))
          .sort((a, b) => b.count - a.count)

        formats = [{ value: "MOVIE", count: 0 }]

        genres = genreRecords.map((g) => ({
          value: g.name,
          count: g._count.movies,
        }))

        years = yearGroup
          .filter((g) => g.releaseDateYear && g.releaseDateYear > 1950)
          .map((g) => ({
            value: g.releaseDateYear!,
            count: g._count.id,
          }))
          .sort((a, b) => b.value - a.value)
        break
      }

      case "tv": {
        const [statusGroup, genreRecords, yearGroup] = await Promise.all([
          prisma.tv.groupBy({
            by: ["status"],
            _count: { id: true },
          }),
          prisma.genre.findMany({
            where: { tv: { some: {} } },
            select: {
              name: true,
              _count: { select: { tv: true } },
            },
            orderBy: { tv: { _count: "desc" } },
            take: 40,
          }),
          prisma.tv.groupBy({
            by: ["firstAiredYear"],
            _count: { id: true },
            where: { firstAiredYear: { not: null } },
            orderBy: { firstAiredYear: "desc" },
            take: 30,
          }),
        ])

        statuses = statusGroup
          .filter((g) => g.status)
          .map((g) => ({ value: g.status!, count: g._count.id }))
          .sort((a, b) => b.count - a.count)

        formats = [
          { value: "SERIES", count: 0 },
          { value: "MINISERIES", count: 0 },
        ]

        genres = genreRecords.map((g) => ({
          value: g.name,
          count: g._count.tv,
        }))

        years = yearGroup
          .filter((g) => g.firstAiredYear && g.firstAiredYear > 1950)
          .map((g) => ({
            value: g.firstAiredYear!,
            count: g._count.id,
          }))
          .sort((a, b) => b.value - a.value)
        break
      }

      case "games": {
        const [statusGroup, genreRecords, yearGroup] = await Promise.all([
          prisma.game.groupBy({
            by: ["status"],
            _count: { id: true },
          }),
          prisma.genre.findMany({
            where: { games: { some: {} } },
            select: {
              name: true,
              _count: { select: { games: true } },
            },
            orderBy: { games: { _count: "desc" } },
            take: 40,
          }),
          prisma.game.groupBy({
            by: ["releaseDateYear"],
            _count: { id: true },
            where: { releaseDateYear: { not: null } },
            orderBy: { releaseDateYear: "desc" },
            take: 30,
          }),
        ])

        statuses = statusGroup
          .filter((g) => g.status)
          .map((g) => ({ value: g.status!, count: g._count.id }))
          .sort((a, b) => b.count - a.count)

        formats = [
          { value: "GAME", count: 0 },
          { value: "DLC", count: 0 },
        ]

        genres = genreRecords.map((g) => ({
          value: g.name,
          count: g._count.games,
        }))

        years = yearGroup
          .filter((g) => g.releaseDateYear && g.releaseDateYear > 1950)
          .map((g) => ({
            value: g.releaseDateYear!,
            count: g._count.id,
          }))
          .sort((a, b) => b.value - a.value)
        break
      }

      case "books": {
        const [genreRecords, yearGroup] = await Promise.all([
          prisma.genre.findMany({
            where: { books: { some: {} } },
            select: {
              name: true,
              _count: { select: { books: true } },
            },
            orderBy: { books: { _count: "desc" } },
            take: 40,
          }),
          prisma.book.groupBy({
            by: ["releaseDateYear"],
            _count: { id: true },
            where: { releaseDateYear: { not: null } },
            orderBy: { releaseDateYear: "desc" },
            take: 30,
          }),
        ])

        statuses = []

        formats = [
          { value: "BOOK", count: 0 },
          { value: "NOVEL", count: 0 },
          { value: "HARDCOVER", count: 0 },
          { value: "PAPERBACK", count: 0 },
          { value: "EBOOK", count: 0 },
          { value: "AUDIOBOOK", count: 0 },
        ]

        genres = genreRecords.map((g) => ({
          value: g.name,
          count: g._count.books,
        }))

        years = yearGroup
          .filter((g) => g.releaseDateYear && g.releaseDateYear > 1950)
          .map((g) => ({
            value: g.releaseDateYear!,
            count: g._count.id,
          }))
          .sort((a, b) => b.value - a.value)
        break
      }

      case "music": {
        const [typeGroup, genreRecords, yearGroup, artistGroup] =
          await Promise.all([
            prisma.music.groupBy({
              by: ["type"],
              _count: { id: true },
            }),
            prisma.genre.findMany({
              where: { music: { some: {} } },
              select: {
                name: true,
                _count: { select: { music: true } },
              },
              orderBy: { music: { _count: "desc" } },
              take: 40,
            }),
            prisma.music.groupBy({
              by: ["releaseDateYear"],
              _count: { id: true },
              where: { releaseDateYear: { not: null } },
              orderBy: { releaseDateYear: "desc" },
              take: 30,
            }),
            prisma.music.groupBy({
              by: ["artistName"],
              _count: { id: true },
              where: { artistName: { not: null } },
              orderBy: { _count: { artistName: "desc" } },
              take: 30,
            }),
          ])

        statuses = []

        formats = typeGroup.map((g) => ({
          value: g.type,
          count: g._count.id,
        }))

        genres = genreRecords.map((g) => ({
          value: g.name,
          count: g._count.music,
        }))

        years = yearGroup
          .filter((g) => g.releaseDateYear && g.releaseDateYear > 1950)
          .map((g) => ({
            value: g.releaseDateYear!,
            count: g._count.id,
          }))
          .sort((a, b) => b.value - a.value)

        artists = artistGroup
          .filter((g) => g.artistName && g.artistName.trim().length > 0)
          .map((g) => ({
            value: g.artistName!,
            count: g._count.id,
          }))
        break
      }

      case "characters": {
        const [genderGroup, yearGroup, animeCount, mangaCount] =
          await Promise.all([
            prisma.character.groupBy({
              by: ["gender"],
              _count: { id: true },
              where: { gender: { not: null } },
              orderBy: { _count: { id: "desc" } },
            }),
            prisma.character.groupBy({
              by: ["dateOfBirthYear"],
              _count: { id: true },
              where: { dateOfBirthYear: { not: null, gt: 1900 } },
              orderBy: { dateOfBirthYear: "desc" },
              take: 30,
            }),
            prisma.mediaCharacter.count({
              where: { mediaType: "ANIME" },
            }),
            prisma.mediaCharacter.count({
              where: { mediaType: "MANGA" },
            }),
          ])

        formats = genderGroup
          .filter((g) => g.gender && g.gender.trim().length > 0)
          .map((g) => ({
            value: g.gender!,
            count: g._count.id,
          }))

        years = yearGroup
          .filter((g) => g.dateOfBirthYear)
          .map((g) => ({
            value: g.dateOfBirthYear!,
            count: g._count.id,
          }))
          .sort((a, b) => b.value - a.value)

        genres = [
          { value: "Anime", count: animeCount },
          { value: "Manga", count: mangaCount },
        ].filter((g) => g.count > 0)
        break
      }

      case "staff":
      case "people": {
        const [genderGroup, yearGroup, personRecords] = await Promise.all([
          prisma.person.groupBy({
            by: ["gender"],
            _count: { id: true },
            where: { gender: { not: null } },
            orderBy: { _count: { id: "desc" } },
          }),
          prisma.person.groupBy({
            by: ["dateOfBirthYear"],
            _count: { id: true },
            where: { dateOfBirthYear: { not: null, gt: 1900 } },
            orderBy: { dateOfBirthYear: "desc" },
            take: 30,
          }),
          prisma.person.findMany({
            where: { primaryOccupations: { isEmpty: false } },
            select: { primaryOccupations: true },
            take: 500,
          }),
        ])

        formats = genderGroup
          .filter((g) => g.gender && g.gender.trim().length > 0)
          .map((g) => ({
            value: g.gender!,
            count: g._count.id,
          }))

        years = yearGroup
          .filter((g) => g.dateOfBirthYear)
          .map((g) => ({
            value: g.dateOfBirthYear!,
            count: g._count.id,
          }))
          .sort((a, b) => b.value - a.value)

        const occMap = new Map<string, number>()
        for (const p of personRecords) {
          for (const occ of p.primaryOccupations || []) {
            if (occ && occ.trim().length > 0) {
              occMap.set(occ, (occMap.get(occ) || 0) + 1)
            }
          }
        }

        genres = Array.from(occMap.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30)
        break
      }

      case "studios": {
        const studioGroup = await prisma.studio.groupBy({
          by: ["isAnimationStudio"],
          _count: { id: true },
        })

        formats = studioGroup.map((g) => ({
          value: g.isAnimationStudio ? "ANIMATION_STUDIO" : "STUDIO",
          count: g._count.id,
        }))
        break
      }

      default:
        throw new NotFound(`Media type '${media}' not supported`)
    }

    const response: DiscoverFiltersResponse = {
      success: true,
      media,
      statuses,
      formats,
      genres,
      years,
      ...(seasons ? { seasons } : {}),
      ...(artists ? { artists } : {}),
    }

    await cache.set(cacheKey, response, FILTERS_CACHE_TTL)
    return response
  },
})
