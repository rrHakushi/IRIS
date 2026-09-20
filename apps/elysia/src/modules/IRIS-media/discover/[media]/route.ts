import { defineRoute, t } from "@/router"
import { NotFound } from "elysia"
import { NotFoundResponseSchema } from "../../../../../types"
import {
  DiscoverPaginatedResponseSchema,
  DiscoverQuerySchema,
  type DiscoverItem,
  type DiscoverPaginatedResponse,
} from "./types"
import {
  findMatchingSynonymIds,
  findMatchingAlternativeNameIds,
  type MediaSearchTable,
} from "../../helpers/search-synonyms"

const DISCOVER_CACHE_TTL = 5 * 60 // 5 minutes

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

function parseCommaSeparated(val?: unknown): string[] {
  if (!val || typeof val !== "string") return []
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseYears(val?: unknown): number[] {
  return parseCommaSeparated(val)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n))
}

export default defineRoute({
  schema: {
    params: t.Object({
      media: MediaParamSchema,
    }),
    query: DiscoverQuerySchema,
    response: {
      200: DiscoverPaginatedResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Discover paginated media with multi-filters and search",
      description:
        "Fetches infinitely scrollable media records with cursor pagination, multi-select filtering (genres, formats, statuses, years), search with synonym matching, and sorting.",
      tags: ["Media - Discover"],
    },
  },

  cacheKeys: {
    discover: {
      items: (media: string, queryStr: string) =>
        `discover:${media}:items:${queryStr}`,
    },
  },

  async GET({ params, query, prisma, cache, cacheKeys }) {
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

    const limit = Number(query?.limit ?? 30)
    const cursor = query?.cursor
      ? parseInt(String(query.cursor), 10)
      : undefined
    const cleanCursor =
      typeof cursor === "number" && !isNaN(cursor) && cursor > 0
        ? cursor
        : undefined

    const statuses = parseCommaSeparated(query?.status).sort()
    const formats = parseCommaSeparated(query?.mediaFormat).sort()
    const genres = parseCommaSeparated(query?.genres).sort()
    const years = parseYears(query?.year).sort((a, b) => a - b)
    const seasons = parseCommaSeparated(query?.seasonSeason).sort()
    const artists = parseCommaSeparated(query?.artist).sort()
    const sortBy = (query?.sortBy ?? "popularity") as string
    const order = (query?.order ?? "desc") as "asc" | "desc"
    const rawSearch = query?.q ? String(query.q).trim() : ""

    const queryKeyStr = JSON.stringify({
      cursor: cleanCursor,
      limit,
      statuses,
      formats,
      genres,
      years,
      seasons,
      artists,
      sortBy,
      order,
      q: rawSearch,
    })

    const cacheKey = cacheKeys.discover.items(media, queryKeyStr)
    const cached = await cache.get<DiscoverPaginatedResponse>(cacheKey)
    if (cached) {
      return cached
    }

    let items: DiscoverItem[] = []
    let total = 0
    let nextCursor: number | null = null
    let hasMore = false

    // Common search filter builder for title & synonyms
    const buildSearchWhere = async (
      table: MediaSearchTable,
      q: string
    ) => {
      if (!q) return {}
      const synonymIds = await findMatchingSynonymIds(prisma, table, q, 100)
      if (table === "Book") {
        return {
          OR: [
            { titlePrimary: { contains: q, mode: "insensitive" as const } },
            { titleSecondary: { contains: q, mode: "insensitive" as const } },
            { subtitle: { contains: q, mode: "insensitive" as const } },
            ...(synonymIds.length > 0 ? [{ id: { in: synonymIds } }] : []),
          ],
        }
      }
      return {
        OR: [
          { titlePrimary: { contains: q, mode: "insensitive" as const } },
          { titleSecondary: { contains: q, mode: "insensitive" as const } },
          { titleNative: { contains: q, mode: "insensitive" as const } },
          ...(synonymIds.length > 0 ? [{ id: { in: synonymIds } }] : []),
        ],
      }
    }

    switch (media) {
      case "anime": {
        const searchWhere = await buildSearchWhere("Anime", rawSearch)
        const andFilters: any[] = []

        if (Object.keys(searchWhere).length > 0) {
          andFilters.push(searchWhere)
        }
        if (statuses.length > 0) {
          andFilters.push({ status: { in: statuses } })
        }
        if (formats.length > 0) {
          andFilters.push({ format: { in: formats } })
        }
        if (years.length > 0) {
          andFilters.push({
            OR: [
              { seasonYear: { in: years } },
              { startDateYear: { in: years } },
            ],
          })
        }
        if (seasons.length > 0) {
          andFilters.push({ seasonSeason: { in: seasons } })
        }
        if (genres.length > 0) {
          for (const g of genres) {
            andFilters.push({
              genres: {
                some: {
                  name: { equals: g, mode: "insensitive" as const },
                },
              },
            })
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "popularity") {
          orderBy = [{ popularity: order }, { id: "desc" }]
        } else if (sortBy === "score") {
          orderBy = [
            { averageScore: { sort: order, nulls: "last" } },
            { popularity: "desc" },
          ]
        } else if (sortBy === "favorites") {
          orderBy = [{ favorites: order }, { popularity: "desc" }]
        } else if (sortBy === "title") {
          orderBy = [{ titlePrimary: order }, { id: "asc" }]
        } else if (sortBy === "releaseDate") {
          orderBy = [
            { seasonYear: { sort: order, nulls: "last" } },
            { startDateMonth: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ updatedAt: order }, { id: "desc" }]
        }

        const [records, count] = await Promise.all([
          prisma.anime.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor
              ? { cursor: { id: cleanCursor }, skip: 1 }
              : {}),
            include: { genres: { select: { name: true } } },
          }),
          prisma.anime.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
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
          genres: (item.genres || []).map((g) => g.name),
          releaseYear: item.seasonYear || item.startDateYear,
          seasonSeason: item.seasonSeason,
          status: item.status,
          isAdult: item.isAdult,
        }))
        break
      }

      case "manga": {
        const searchWhere = await buildSearchWhere("Manga", rawSearch)
        const andFilters: any[] = []

        if (Object.keys(searchWhere).length > 0) {
          andFilters.push(searchWhere)
        }
        if (statuses.length > 0) {
          andFilters.push({ status: { in: statuses } })
        }
        if (formats.length > 0) {
          andFilters.push({ format: { in: formats } })
        }
        if (years.length > 0) {
          andFilters.push({ startDateYear: { in: years } })
        }
        if (genres.length > 0) {
          for (const g of genres) {
            andFilters.push({
              genres: {
                some: {
                  name: { equals: g, mode: "insensitive" as const },
                },
              },
            })
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "popularity") {
          orderBy = [{ popularity: order }, { id: "desc" }]
        } else if (sortBy === "score") {
          orderBy = [
            { averageScore: { sort: order, nulls: "last" } },
            { popularity: "desc" },
          ]
        } else if (sortBy === "favorites") {
          orderBy = [{ favorites: order }, { popularity: "desc" }]
        } else if (sortBy === "title") {
          orderBy = [{ titlePrimary: order }, { id: "asc" }]
        } else if (sortBy === "releaseDate") {
          orderBy = [
            { startDateYear: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ updatedAt: order }, { id: "desc" }]
        }

        const [records, count] = await Promise.all([
          prisma.manga.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor
              ? { cursor: { id: cleanCursor }, skip: 1 }
              : {}),
            include: { genres: { select: { name: true } } },
          }),
          prisma.manga.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
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
          genres: (item.genres || []).map((g) => g.name),
          releaseYear: item.startDateYear,
          seasonSeason: null,
          status: item.status,
          isAdult: false,
        }))
        break
      }

      case "movies": {
        const searchWhere = await buildSearchWhere("Movie", rawSearch)
        const andFilters: any[] = []

        if (Object.keys(searchWhere).length > 0) {
          andFilters.push(searchWhere)
        }
        if (statuses.length > 0) {
          andFilters.push({ status: { in: statuses } })
        }
        if (formats.length > 0) {
          andFilters.push({ format: { in: formats } })
        }
        if (years.length > 0) {
          andFilters.push({ releaseDateYear: { in: years } })
        }
        if (genres.length > 0) {
          for (const g of genres) {
            andFilters.push({
              genres: {
                some: {
                  name: { equals: g, mode: "insensitive" as const },
                },
              },
            })
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "popularity") {
          orderBy = [{ popularity: order }, { id: "desc" }]
        } else if (sortBy === "score") {
          orderBy = [
            { averageScore: { sort: order, nulls: "last" } },
            { popularity: "desc" },
          ]
        } else if (sortBy === "favorites") {
          orderBy = [{ favorites: order }, { popularity: "desc" }]
        } else if (sortBy === "title") {
          orderBy = [{ titlePrimary: order }, { id: "asc" }]
        } else if (sortBy === "releaseDate") {
          orderBy = [
            { releaseDateYear: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ updatedAt: order }, { id: "desc" }]
        }

        const [records, count] = await Promise.all([
          prisma.movie.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor
              ? { cursor: { id: cleanCursor }, skip: 1 }
              : {}),
            include: { genres: { select: { name: true } } },
          }),
          prisma.movie.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
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
          genres: (item.genres || []).map((g) => g.name),
          releaseYear: item.releaseDateYear,
          seasonSeason: null,
          status: item.status,
          isAdult: item.isAdult,
        }))
        break
      }

      case "tv": {
        const searchWhere = await buildSearchWhere("Tv", rawSearch)
        const andFilters: any[] = []

        if (Object.keys(searchWhere).length > 0) {
          andFilters.push(searchWhere)
        }
        if (statuses.length > 0) {
          andFilters.push({ status: { in: statuses } })
        }
        if (formats.length > 0) {
          andFilters.push({ format: { in: formats } })
        }
        if (years.length > 0) {
          andFilters.push({ firstAiredYear: { in: years } })
        }
        if (genres.length > 0) {
          for (const g of genres) {
            andFilters.push({
              genres: {
                some: {
                  name: { equals: g, mode: "insensitive" as const },
                },
              },
            })
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "popularity") {
          orderBy = [{ popularity: order }, { id: "desc" }]
        } else if (sortBy === "score") {
          orderBy = [
            { averageScore: { sort: order, nulls: "last" } },
            { popularity: "desc" },
          ]
        } else if (sortBy === "favorites") {
          orderBy = [{ favorites: order }, { popularity: "desc" }]
        } else if (sortBy === "title") {
          orderBy = [{ titlePrimary: order }, { id: "asc" }]
        } else if (sortBy === "releaseDate") {
          orderBy = [
            { firstAiredYear: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ updatedAt: order }, { id: "desc" }]
        }

        const [records, count] = await Promise.all([
          prisma.tv.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor
              ? { cursor: { id: cleanCursor }, skip: 1 }
              : {}),
            include: { genres: { select: { name: true } } },
          }),
          prisma.tv.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
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
          genres: (item.genres || []).map((g) => g.name),
          releaseYear: item.firstAiredYear,
          seasonSeason: null,
          status: item.status,
          isAdult: item.isAdult,
        }))
        break
      }

      case "games": {
        const searchWhere = await buildSearchWhere("Game", rawSearch)
        const andFilters: any[] = []

        if (Object.keys(searchWhere).length > 0) {
          andFilters.push(searchWhere)
        }
        if (statuses.length > 0) {
          andFilters.push({ status: { in: statuses } })
        }
        if (formats.length > 0) {
          andFilters.push({
            OR: [
              { format: { in: formats } },
              { platforms: { hasSome: formats } },
            ],
          })
        }
        if (years.length > 0) {
          andFilters.push({ releaseDateYear: { in: years } })
        }
        if (genres.length > 0) {
          for (const g of genres) {
            andFilters.push({
              genres: {
                some: {
                  name: { equals: g, mode: "insensitive" as const },
                },
              },
            })
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "popularity") {
          orderBy = [{ popularity: order }, { id: "desc" }]
        } else if (sortBy === "score") {
          orderBy = [
            { averageScore: { sort: order, nulls: "last" } },
            { popularity: "desc" },
          ]
        } else if (sortBy === "favorites") {
          orderBy = [{ favorites: order }, { popularity: "desc" }]
        } else if (sortBy === "title") {
          orderBy = [{ titlePrimary: order }, { id: "asc" }]
        } else if (sortBy === "releaseDate") {
          orderBy = [
            { releaseDateYear: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ updatedAt: order }, { id: "desc" }]
        }

        const [records, count] = await Promise.all([
          prisma.game.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor
              ? { cursor: { id: cleanCursor }, skip: 1 }
              : {}),
            include: { genres: { select: { name: true } } },
          }),
          prisma.game.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
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
              ? item.platforms[0] ?? null
              : "GAME",
          averageScore: item.averageScore,
          popularity: item.popularity,
          favorites: item.favorites,
          genres: (item.genres || []).map((g) => g.name),
          releaseYear: item.releaseDateYear,
          seasonSeason: null,
          status: item.status,
          isAdult: item.isAdult,
        }))
        break
      }

      case "books": {
        const searchWhere = await buildSearchWhere("Book", rawSearch)
        const andFilters: any[] = []

        if (Object.keys(searchWhere).length > 0) {
          andFilters.push(searchWhere)
        }
        if (formats.length > 0) {
          andFilters.push({ format: { in: formats } })
        }
        if (years.length > 0) {
          andFilters.push({ releaseDateYear: { in: years } })
        }
        if (genres.length > 0) {
          for (const g of genres) {
            andFilters.push({
              genres: {
                some: {
                  name: { equals: g, mode: "insensitive" as const },
                },
              },
            })
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "popularity") {
          orderBy = [{ popularity: order }, { id: "desc" }]
        } else if (sortBy === "score") {
          orderBy = [
            { averageScore: { sort: order, nulls: "last" } },
            { popularity: "desc" },
          ]
        } else if (sortBy === "favorites") {
          orderBy = [{ favorites: order }, { popularity: "desc" }]
        } else if (sortBy === "title") {
          orderBy = [{ titlePrimary: order }, { id: "asc" }]
        } else if (sortBy === "releaseDate") {
          orderBy = [
            { releaseDateYear: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ updatedAt: order }, { id: "desc" }]
        }

        const [records, count] = await Promise.all([
          prisma.book.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor
              ? { cursor: { id: cleanCursor }, skip: 1 }
              : {}),
            include: { genres: { select: { name: true } } },
          }),
          prisma.book.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
          id: item.id,
          titlePrimary: item.titlePrimary,
          titleSecondary: item.titleSecondary,
          titleNative: null,
          coverImage: item.coverImage,
          bannerImage: item.bannerImage || item.coverImage,
          description: item.description,
          format: "BOOK",
          averageScore: item.averageScore,
          popularity: item.popularity,
          favorites: item.favorites,
          genres: (item.genres || []).map((g) => g.name),
          releaseYear: item.releaseDateYear,
          seasonSeason: null,
          status: null,
          isAdult: item.isAdult,
        }))
        break
      }

      case "music": {
        const andFilters: any[] = []

        if (rawSearch) {
          andFilters.push({
            OR: [
              {
                titlePrimary: {
                  contains: rawSearch,
                  mode: "insensitive" as const,
                },
              },
              {
                titleSecondary: {
                  contains: rawSearch,
                  mode: "insensitive" as const,
                },
              },
              {
                artistName: {
                  contains: rawSearch,
                  mode: "insensitive" as const,
                },
              },
            ],
          })
        }
        if (formats.length > 0) {
          andFilters.push({ type: { in: formats } })
        }
        if (years.length > 0) {
          andFilters.push({ releaseDateYear: { in: years } })
        }
        if (artists.length > 0) {
          andFilters.push({
            OR: artists.map((a) => ({
              artistName: { equals: a, mode: "insensitive" as const },
            })),
          })
        }
        if (genres.length > 0) {
          for (const g of genres) {
            andFilters.push({
              genres: {
                some: {
                  name: { equals: g, mode: "insensitive" as const },
                },
              },
            })
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "popularity") {
          orderBy = [{ popularity: order }, { id: "desc" }]
        } else if (sortBy === "favorites") {
          orderBy = [{ favorites: order }, { popularity: "desc" }]
        } else if (sortBy === "title") {
          orderBy = [{ titlePrimary: order }, { id: "asc" }]
        } else if (sortBy === "releaseDate") {
          orderBy = [
            { releaseDateYear: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ updatedAt: order }, { id: "desc" }]
        }

        const [records, count] = await Promise.all([
          prisma.music.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor
              ? { cursor: { id: cleanCursor }, skip: 1 }
              : {}),
            include: { genres: { select: { name: true } } },
          }),
          prisma.music.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
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
          genres: (item.genres || []).map((g) => g.name),
          releaseYear: item.releaseDateYear,
          seasonSeason: null,
          status: null,
          isAdult: item.explicitLyrics,
          artistName: item.artistName,
          duration: item.duration,
          itemType: item.type,
          audioPreviewUrl: item.audioPreviewUrl,
        }))
        break
      }

      case "characters": {
        const andFilters: any[] = []

        if (rawSearch) {
          const altIds = await findMatchingAlternativeNameIds(
            prisma,
            "Character",
            rawSearch,
            100
          )
          andFilters.push({
            OR: [
              {
                namePrimary: {
                  contains: rawSearch,
                  mode: "insensitive" as const,
                },
              },
              {
                nameNative: {
                  contains: rawSearch,
                  mode: "insensitive" as const,
                },
              },
              ...(altIds.length > 0 ? [{ id: { in: altIds } }] : []),
            ],
          })
        }

        if (formats.length > 0) {
          andFilters.push({
            OR: formats.map((f) => ({
              gender: { equals: f, mode: "insensitive" as const },
            })),
          })
        }

        if (years.length > 0) {
          andFilters.push({ dateOfBirthYear: { in: years } })
        }

        if (genres.length > 0) {
          for (const g of genres) {
            const upper = g.toUpperCase()
            if (upper === "ANIME") {
              andFilters.push({
                mediaCharacters: { some: { mediaType: "ANIME" } },
              })
            } else if (upper === "MANGA") {
              andFilters.push({
                mediaCharacters: { some: { mediaType: "MANGA" } },
              })
            } else if (upper === "MOVIE" || upper === "MOVIES") {
              andFilters.push({
                mediaCharacters: { some: { mediaType: "MOVIE" } },
              })
            } else if (upper === "TV" || upper === "TV SHOWS") {
              andFilters.push({
                mediaCharacters: { some: { mediaType: "TV" } },
              })
            } else if (upper === "BOOK" || upper === "BOOKS") {
              andFilters.push({
                mediaCharacters: { some: { mediaType: "BOOK" } },
              })
            }
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "title") {
          orderBy = [{ namePrimary: order }, { id: "asc" }]
        } else if (sortBy === "favorites" || sortBy === "popularity") {
          orderBy = [
            { favorites: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ id: order }]
        }

        const [records, count] = await Promise.all([
          prisma.character.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor ? { cursor: { id: cleanCursor }, skip: 1 } : {}),
          }),
          prisma.character.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
          id: item.id,
          titlePrimary: item.namePrimary,
          titleSecondary:
            item.nameAlternative && item.nameAlternative.length > 0
              ? item.nameAlternative[0] ?? null
              : null,
          titleNative: item.nameNative,
          coverImage: item.image,
          bannerImage: null,
          description: item.description ?? null,
          format: item.gender ? item.gender.toUpperCase() : "CHARACTER",
          averageScore: null,
          popularity: item.favorites,
          favorites: item.favorites,
          genres: [],
          releaseYear: item.dateOfBirthYear,
          seasonSeason: null,
          status: null,
          isAdult: false,
        }))
        break
      }

      case "staff":
      case "people": {
        const andFilters: any[] = []

        if (rawSearch) {
          const altIds = await findMatchingAlternativeNameIds(
            prisma,
            "Person",
            rawSearch,
            100
          )
          andFilters.push({
            OR: [
              {
                namePrimary: {
                  contains: rawSearch,
                  mode: "insensitive" as const,
                },
              },
              {
                nameNative: {
                  contains: rawSearch,
                  mode: "insensitive" as const,
                },
              },
              ...(altIds.length > 0 ? [{ id: { in: altIds } }] : []),
            ],
          })
        }

        if (formats.length > 0) {
          andFilters.push({
            OR: formats.map((f) => ({
              gender: { equals: f, mode: "insensitive" as const },
            })),
          })
        }

        if (years.length > 0) {
          andFilters.push({ dateOfBirthYear: { in: years } })
        }

        if (genres.length > 0) {
          for (const g of genres) {
            andFilters.push({ primaryOccupations: { has: g } })
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "title") {
          orderBy = [{ namePrimary: order }, { id: "asc" }]
        } else if (sortBy === "favorites" || sortBy === "popularity") {
          orderBy = [
            { favorites: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ id: order }]
        }

        const [records, count] = await Promise.all([
          prisma.person.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor ? { cursor: { id: cleanCursor }, skip: 1 } : {}),
          }),
          prisma.person.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
          id: item.id,
          titlePrimary: item.namePrimary,
          titleSecondary:
            item.givenName && item.familyName
              ? `${item.givenName} ${item.familyName}`
              : null,
          titleNative: item.nameNative,
          coverImage: item.image,
          bannerImage: null,
          description: item.description ?? null,
          format:
            (item.primaryOccupations && item.primaryOccupations.length > 0
              ? item.primaryOccupations[0]
              : item.language) ?? "STAFF",
          averageScore: null,
          popularity: item.favorites,
          favorites: item.favorites,
          genres: item.primaryOccupations || [],
          releaseYear: item.dateOfBirthYear,
          seasonSeason: null,
          status: null,
          isAdult: false,
        }))
        break
      }

      case "studios": {
        const andFilters: any[] = []

        if (rawSearch) {
          andFilters.push({
            name: { contains: rawSearch, mode: "insensitive" as const },
          })
        }

        if (formats.length > 0) {
          if (formats.includes("ANIMATION_STUDIO") && !formats.includes("STUDIO")) {
            andFilters.push({ isAnimationStudio: true })
          } else if (formats.includes("STUDIO") && !formats.includes("ANIMATION_STUDIO")) {
            andFilters.push({ isAnimationStudio: false })
          }
        }

        const where: any = andFilters.length > 0 ? { AND: andFilters } : {}

        let orderBy: any[] = []
        if (sortBy === "title") {
          orderBy = [{ name: order }, { id: "asc" }]
        } else if (sortBy === "favorites" || sortBy === "popularity") {
          orderBy = [
            { favorites: { sort: order, nulls: "last" } },
            { id: "desc" },
          ]
        } else {
          orderBy = [{ id: order }]
        }

        const [records, count] = await Promise.all([
          prisma.studio.findMany({
            where,
            orderBy,
            take: limit + 1,
            ...(cleanCursor ? { cursor: { id: cleanCursor }, skip: 1 } : {}),
          }),
          prisma.studio.count({ where }),
        ])

        total = count
        hasMore = records.length > limit
        const paged = hasMore ? records.slice(0, limit) : records
        nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

        items = paged.map((item) => ({
          id: item.id,
          titlePrimary: item.name,
          titleSecondary: null,
          titleNative: null,
          coverImage: null,
          bannerImage: null,
          description: item.siteUrl,
          format: item.isAnimationStudio ? "ANIMATION_STUDIO" : "STUDIO",
          averageScore: null,
          popularity: item.favorites ?? item.alFavorites,
          favorites: item.favorites ?? item.alFavorites,
          genres: [],
          releaseYear: null,
          seasonSeason: null,
          status: null,
          isAdult: false,
        }))
        break
      }

      default:
        throw new NotFound(`Media type '${media}' not supported`)
    }

    const response: DiscoverPaginatedResponse = {
      success: true,
      media,
      items,
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    }

    await cache.set(cacheKey, response, DISCOVER_CACHE_TTL)
    return response
  },
})
