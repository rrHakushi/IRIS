import { defineRoute, t } from "@/router"

export const CalendarItemSchema = t.Object({
  id: t.String({ description: "Unique calendar event identifier" }),
  mediaType: t.Union([
    t.Literal("anime"),
    t.Literal("manga"),
    t.Literal("movie"),
    t.Literal("tv"),
    t.Literal("game"),
    t.Literal("book"),
    t.Literal("music"),
  ]),
  mediaId: t.Number({ description: "Primary media resource ID" }),
  title: t.String(),
  titleSecondary: t.Optional(t.Nullable(t.String())),
  titleNative: t.Optional(t.Nullable(t.String())),
  coverImage: t.Optional(t.Nullable(t.String())),
  bannerImage: t.Optional(t.Nullable(t.String())),
  releaseDate: t.String({ description: "ISO 8601 release timestamp" }),
  detail: t.Optional(t.Nullable(t.String())),
  format: t.Optional(t.Nullable(t.String())),
  status: t.Optional(t.Nullable(t.String())),
  episodeNumber: t.Optional(t.Nullable(t.Number())),
  seasonNumber: t.Optional(t.Nullable(t.Number())),
  episodeTitle: t.Optional(t.Nullable(t.String())),
  eventKind: t.Optional(t.Nullable(t.String())),
  inUserList: t.Optional(t.Boolean()),
})

export const CalendarQuerySchema = t.Object({
  start: t.Optional(
    t.String({
      description: "Range start ISO string or YYYY-MM-DD",
    })
  ),
  end: t.Optional(
    t.String({
      description: "Range end ISO string or YYYY-MM-DD",
    })
  ),
  types: t.Optional(
    t.String({
      description: "Comma-separated media types e.g. anime,tv,manga",
    })
  ),
  onlyInLists: t.Optional(
    t.Union([t.Boolean(), t.String()], {
      description: "Whether to only return items in authenticated user's lists",
    })
  ),
})

export const CalendarResponseSchema = t.Object({
  success: t.Boolean(),
  items: t.Array(CalendarItemSchema),
  meta: t.Object({
    start: t.String(),
    end: t.String(),
    total: t.Number(),
    counts: t.Record(t.String(), t.Number()),
  }),
})

const CALENDAR_CACHE_TTL = 12 * 60 * 60 // 12 hours (43,200 seconds)

export default defineRoute({
  cacheKeys: {
    calendar: {
      range: (start: string, end: string, types: string, userScope: string) =>
        `calendar:${start}:${end}:${types}:${userScope}`,
    },
  },

  schema: {
    query: CalendarQuerySchema,
    response: {
      200: CalendarResponseSchema,
    },
    detail: {
      summary: "Fetch media releases for calendar",
      description:
        "Fetches upcoming and past media releases across Anime (airingSchedule), Manga (start/end dates), Games, Books, Movies, TV Episodes (airDate and season), and Music with list filtering.",
      tags: ["Calendar", "Media"],
    },
  },

  async GET({ query, prisma, session, cache, cacheKeys }) {
    // 1. Resolve date boundaries
    const now = new Date()
    const defaultStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    )
    const defaultEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    )

    const startParam =
      typeof query?.start === "string" ? query.start : undefined
    const endParam = typeof query?.end === "string" ? query.end : undefined

    const startDate = startParam ? new Date(startParam) : defaultStart
    const endDate = endParam ? new Date(endParam) : defaultEnd

    // Fallback if invalid date strings were passed
    const validStart = isNaN(startDate.getTime()) ? defaultStart : startDate
    const validEnd = isNaN(endDate.getTime()) ? defaultEnd : endDate

    const startYear = validStart.getUTCFullYear()
    const endYear = validEnd.getUTCFullYear()

    // 2. Resolve requested types
    const typesParam =
      typeof query?.types === "string" ? query.types : undefined
    const rawTypes = typesParam
      ? typesParam
          .toLowerCase()
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []

    const isRequested = (type: string) =>
      rawTypes.length === 0 || rawTypes.includes(type)

    // 3. Resolve list filter & authentication
    const onlyInLists =
      query?.onlyInLists === true ||
      query?.onlyInLists === "true" ||
      query?.onlyInLists === "1"

    const currentUser =
      session && typeof session.getUser === "function"
        ? session.getUser()
        : null
    const currentUserId = currentUser?.id ?? null

    // If user requested list-only filtering but is not authenticated, return empty set
    if (onlyInLists && !currentUserId) {
      return {
        success: true,
        items: [],
        meta: {
          start: validStart.toISOString(),
          end: validEnd.toISOString(),
          total: 0,
          counts: {
            anime: 0,
            manga: 0,
            movie: 0,
            tv: 0,
            game: 0,
            book: 0,
            music: 0,
          },
        },
      }
    }

    // 4. Cache check (12 hours TTL)
    const startKey = validStart.toISOString().split("T")[0]
    const endKey = validEnd.toISOString().split("T")[0]
    const typesKey = rawTypes.slice().sort().join(",") || "all"
    const userScope =
      onlyInLists && currentUserId ? `user:${currentUserId}` : "public"
    const cacheKey = `calendar:${startKey}:${endKey}:${typesKey}:${userScope}`

    if (cache) {
      const cached = await cache.get<any>(cacheKey)
      if (cached) {
        return cached
      }
    }

    type CalendarItem = {
      id: string
      mediaType: "anime" | "manga" | "movie" | "tv" | "game" | "book" | "music"
      mediaId: number
      title: string
      titleSecondary?: string | null
      titleNative?: string | null
      coverImage?: string | null
      bannerImage?: string | null
      releaseDate: string
      detail?: string | null
      format?: string | null
      status?: string | null
      episodeNumber?: number | null
      seasonNumber?: number | null
      episodeTitle?: string | null
      eventKind?: string | null
      inUserList?: boolean
    }

    const calendarItems: CalendarItem[] = []

    // 4. Parallel database queries for all requested media types
    const [
      animeSchedules,
      mangaList,
      gameList,
      bookList,
      movieList,
      tvEpisodes,
      musicList,
    ] = await Promise.all([
      // Anime: airing schedule
      isRequested("anime")
        ? prisma.animeAiringSchedule.findMany({
            where: {
              airingAt: {
                gte: validStart,
                lte: validEnd,
              },
              ...(onlyInLists && currentUserId
                ? {
                    anime: {
                      userLists: {
                        some: { userId: currentUserId },
                      },
                    },
                  }
                : {}),
            },
            include: {
              anime: {
                select: {
                  id: true,
                  titlePrimary: true,
                  titleSecondary: true,
                  titleNative: true,
                  coverImage: true,
                  bannerImage: true,
                  format: true,
                  status: true,
                  userLists: currentUserId
                    ? {
                        where: { userId: currentUserId },
                        select: { id: true },
                        take: 1,
                      }
                    : false,
                },
              },
            },
            orderBy: { airingAt: "asc" },
            take: 200,
          })
        : Promise.resolve([]),

      // Manga: start dates / end dates
      isRequested("manga")
        ? prisma.manga.findMany({
            where: {
              OR: [
                {
                  startDateYear: { gte: startYear, lte: endYear },
                },
                {
                  endDateYear: { gte: startYear, lte: endYear },
                },
              ],
              ...(onlyInLists && currentUserId
                ? {
                    userLists: {
                      some: { userId: currentUserId },
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              format: true,
              status: true,
              startDateYear: true,
              startDateMonth: true,
              startDateDay: true,
              endDateYear: true,
              endDateMonth: true,
              endDateDay: true,
              chapterCount: true,
              volumeCount: true,
              userLists: currentUserId
                ? {
                    where: { userId: currentUserId },
                    select: { id: true },
                    take: 1,
                  }
                : false,
            },
            take: 200,
          })
        : Promise.resolve([]),

      // Games: releaseDate with fallback to releaseDateYear/Month/Day
      isRequested("game")
        ? prisma.game.findMany({
            where: {
              OR: [
                {
                  releaseDate: {
                    gte: validStart,
                    lte: validEnd,
                  },
                },
                {
                  releaseDateYear: { gte: startYear, lte: endYear },
                },
              ],
              ...(onlyInLists && currentUserId
                ? {
                    userLists: {
                      some: { userId: currentUserId },
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              releaseDate: true,
              releaseDateYear: true,
              releaseDateMonth: true,
              releaseDateDay: true,
              platforms: true,
              status: true,
              userLists: currentUserId
                ? {
                    where: { userId: currentUserId },
                    select: { id: true },
                    take: 1,
                  }
                : false,
            },
            take: 200,
          })
        : Promise.resolve([]),

      // Books: releaseDate with fallback to releaseDateYear/Month/Day
      isRequested("book")
        ? prisma.book.findMany({
            where: {
              OR: [
                {
                  releaseDate: {
                    gte: validStart,
                    lte: validEnd,
                  },
                },
                {
                  releaseDateYear: { gte: startYear, lte: endYear },
                },
              ],
              ...(onlyInLists && currentUserId
                ? {
                    userLists: {
                      some: { userId: currentUserId },
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              bannerImage: true,
              releaseDate: true,
              releaseDateYear: true,
              releaseDateMonth: true,
              releaseDateDay: true,
              authors: true,
              series: true,
              format: true,
              userLists: currentUserId
                ? {
                    where: { userId: currentUserId },
                    select: { id: true },
                    take: 1,
                  }
                : false,
            },
            take: 200,
          })
        : Promise.resolve([]),

      // Movies: releaseDateYear / month / day
      isRequested("movie")
        ? prisma.movie.findMany({
            where: {
              releaseDateYear: { gte: startYear, lte: endYear },
              ...(onlyInLists && currentUserId
                ? {
                    userLists: {
                      some: { userId: currentUserId },
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              bannerImage: true,
              releaseDateYear: true,
              releaseDateMonth: true,
              releaseDateDay: true,
              runtime: true,
              status: true,
              userLists: currentUserId
                ? {
                    where: { userId: currentUserId },
                    select: { id: true },
                    take: 1,
                  }
                : false,
            },
            take: 200,
          })
        : Promise.resolve([]),

      // TV: tvEpisode airDate (also show what season)
      isRequested("tv")
        ? prisma.tvEpisode.findMany({
            where: {
              airDate: {
                gte: validStart,
                lte: validEnd,
              },
              ...(onlyInLists && currentUserId
                ? {
                    tv: {
                      userLists: {
                        some: { userId: currentUserId },
                      },
                    },
                  }
                : {}),
            },
            include: {
              tv: {
                select: {
                  id: true,
                  titlePrimary: true,
                  titleSecondary: true,
                  titleNative: true,
                  coverImage: true,
                  bannerImage: true,
                  status: true,
                  userLists: currentUserId
                    ? {
                        where: { userId: currentUserId },
                        select: { id: true },
                        take: 1,
                      }
                    : false,
                },
              },
              season: {
                select: {
                  seasonNumber: true,
                  titlePrimary: true,
                },
              },
            },
            orderBy: { airDate: "asc" },
            take: 200,
          })
        : Promise.resolve([]),

      // Music: releaseDate
      isRequested("music")
        ? prisma.music.findMany({
            where: {
              OR: [
                {
                  releaseDate: {
                    gte: validStart,
                    lte: validEnd,
                  },
                },
                {
                  releaseDateYear: { gte: startYear, lte: endYear },
                },
              ],
              ...(onlyInLists && currentUserId
                ? {
                    userLists: {
                      some: { userId: currentUserId },
                    },
                  }
                : {}),
            },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
              releaseDate: true,
              releaseDateYear: true,
              releaseDateMonth: true,
              releaseDateDay: true,
              type: true,
              artistName: true,
              recordType: true,
              userLists: currentUserId
                ? {
                    where: { userId: currentUserId },
                    select: { id: true },
                    take: 1,
                  }
                : false,
            },
            take: 200,
          })
        : Promise.resolve([]),
    ])

    // 5. Transform Anime schedules
    for (const schedule of animeSchedules) {
      calendarItems.push({
        id: `anime-${schedule.id}`,
        mediaType: "anime",
        mediaId: schedule.anime.id,
        title: schedule.anime.titlePrimary,
        titleSecondary: schedule.anime.titleSecondary,
        titleNative: schedule.anime.titleNative,
        coverImage: schedule.anime.coverImage,
        bannerImage: schedule.anime.bannerImage,
        releaseDate: schedule.airingAt.toISOString(),
        detail: `Episode ${schedule.episodeNumber}`,
        format: schedule.anime.format,
        status: schedule.anime.status,
        episodeNumber: schedule.episodeNumber,
        inUserList: Array.isArray(schedule.anime.userLists)
          ? schedule.anime.userLists.length > 0
          : false,
      })
    }

    // 6. Transform Manga start/end dates
    for (const manga of mangaList) {
      const inUserList = Array.isArray(manga.userLists)
        ? manga.userLists.length > 0
        : false

      if (manga.startDateYear) {
        const startD = new Date(
          Date.UTC(
            manga.startDateYear,
            (manga.startDateMonth || 1) - 1,
            manga.startDateDay || 1
          )
        )
        if (startD >= validStart && startD <= validEnd) {
          calendarItems.push({
            id: `manga-start-${manga.id}`,
            mediaType: "manga",
            mediaId: manga.id,
            title: manga.titlePrimary,
            titleSecondary: manga.titleSecondary,
            titleNative: manga.titleNative,
            coverImage: manga.coverImage,
            bannerImage: manga.bannerImage,
            releaseDate: startD.toISOString(),
            detail: "Publishing Start",
            format: manga.format,
            status: manga.status,
            eventKind: "START",
            inUserList,
          })
        }
      }

      if (manga.endDateYear) {
        const endD = new Date(
          Date.UTC(
            manga.endDateYear,
            (manga.endDateMonth || 1) - 1,
            manga.endDateDay || 1
          )
        )
        if (endD >= validStart && endD <= validEnd) {
          calendarItems.push({
            id: `manga-end-${manga.id}`,
            mediaType: "manga",
            mediaId: manga.id,
            title: manga.titlePrimary,
            titleSecondary: manga.titleSecondary,
            titleNative: manga.titleNative,
            coverImage: manga.coverImage,
            bannerImage: manga.bannerImage,
            releaseDate: endD.toISOString(),
            detail: "Publishing End",
            format: manga.format,
            status: manga.status,
            eventKind: "END",
            inUserList,
          })
        }
      }
    }

    // 7. Transform Games
    for (const game of gameList) {
      let rDate: Date | null = null
      if (game.releaseDate) {
        rDate = new Date(game.releaseDate)
      } else if (game.releaseDateYear) {
        rDate = new Date(
          Date.UTC(
            game.releaseDateYear,
            (game.releaseDateMonth || 1) - 1,
            game.releaseDateDay || 1
          )
        )
      }

      if (rDate && rDate >= validStart && rDate <= validEnd) {
        const platformText =
          game.platforms && game.platforms.length > 0
            ? game.platforms.slice(0, 2).join(", ")
            : "Game Launch"

        calendarItems.push({
          id: `game-${game.id}`,
          mediaType: "game",
          mediaId: game.id,
          title: game.titlePrimary,
          titleSecondary: game.titleSecondary,
          titleNative: game.titleNative,
          coverImage: game.coverImage,
          bannerImage: game.bannerImage,
          releaseDate: rDate.toISOString(),
          detail: platformText,
          status: game.status,
          inUserList: Array.isArray(game.userLists)
            ? game.userLists.length > 0
            : false,
        })
      }
    }

    // 8. Transform Books
    for (const book of bookList) {
      let rDate: Date | null = null
      if (book.releaseDate) {
        rDate = new Date(book.releaseDate)
      } else if (book.releaseDateYear) {
        rDate = new Date(
          Date.UTC(
            book.releaseDateYear,
            (book.releaseDateMonth || 1) - 1,
            book.releaseDateDay || 1
          )
        )
      }

      if (rDate && rDate >= validStart && rDate <= validEnd) {
        const authorText =
          book.authors && book.authors.length > 0
            ? book.authors[0]
            : book.series || "Book Release"

        calendarItems.push({
          id: `book-${book.id}`,
          mediaType: "book",
          mediaId: book.id,
          title: book.titlePrimary,
          titleSecondary: book.titleSecondary,
          coverImage: book.coverImage,
          bannerImage: book.bannerImage,
          releaseDate: rDate.toISOString(),
          detail: authorText,
          format: book.format,
          inUserList: Array.isArray(book.userLists)
            ? book.userLists.length > 0
            : false,
        })
      }
    }

    // 9. Transform Movies
    for (const movie of movieList) {
      if (movie.releaseDateYear) {
        const rDate = new Date(
          Date.UTC(
            movie.releaseDateYear,
            (movie.releaseDateMonth || 1) - 1,
            movie.releaseDateDay || 1
          )
        )

        if (rDate >= validStart && rDate <= validEnd) {
          calendarItems.push({
            id: `movie-${movie.id}`,
            mediaType: "movie",
            mediaId: movie.id,
            title: movie.titlePrimary,
            titleSecondary: movie.titleSecondary,
            titleNative: movie.titleNative,
            coverImage: movie.coverImage,
            bannerImage: movie.bannerImage,
            releaseDate: rDate.toISOString(),
            detail: movie.runtime ? `${movie.runtime}m` : "Movie Premiere",
            status: movie.status,
            inUserList: Array.isArray(movie.userLists)
              ? movie.userLists.length > 0
              : false,
          })
        }
      }
    }

    // 10. Transform TV episodes
    for (const ep of tvEpisodes) {
      if (ep.airDate) {
        const seasonNum = ep.seasonNumber ?? ep.season?.seasonNumber ?? 1
        const epNum = ep.episodeNumber
        const detailText = `Season ${seasonNum} • Ep ${epNum}`

        calendarItems.push({
          id: `tv-ep-${ep.id}`,
          mediaType: "tv",
          mediaId: ep.tv.id,
          title: ep.tv.titlePrimary,
          titleSecondary: ep.tv.titleSecondary,
          titleNative: ep.tv.titleNative,
          coverImage: ep.thumbnail || ep.tv.coverImage,
          bannerImage: ep.tv.bannerImage,
          releaseDate: ep.airDate.toISOString(),
          detail: detailText,
          seasonNumber: seasonNum,
          episodeNumber: epNum,
          episodeTitle: ep.titlePrimary,
          status: ep.tv.status,
          inUserList: Array.isArray(ep.tv.userLists)
            ? ep.tv.userLists.length > 0
            : false,
        })
      }
    }

    // 11. Transform Music
    for (const music of musicList) {
      let rDate: Date | null = null
      if (music.releaseDate) {
        rDate = new Date(music.releaseDate)
      } else if (music.releaseDateYear) {
        rDate = new Date(
          Date.UTC(
            music.releaseDateYear,
            (music.releaseDateMonth || 1) - 1,
            music.releaseDateDay || 1
          )
        )
      }

      if (rDate && rDate >= validStart && rDate <= validEnd) {
        const typeLabel = music.type === "ALBUM" ? "Album" : "Track"
        const detailText = music.artistName
          ? `${music.artistName} • ${typeLabel}`
          : typeLabel

        calendarItems.push({
          id: `music-${music.id}`,
          mediaType: "music",
          mediaId: music.id,
          title: music.titlePrimary,
          titleSecondary: music.titleSecondary,
          coverImage: music.coverImage,
          releaseDate: rDate.toISOString(),
          detail: detailText,
          format: music.recordType || typeLabel,
          inUserList: Array.isArray(music.userLists)
            ? music.userLists.length > 0
            : false,
        })
      }
    }

    // 12. Sort items chronologically
    calendarItems.sort(
      (a, b) =>
        new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
    )

    // 13. Aggregate counts per media type
    const counts: Record<string, number> = {
      anime: 0,
      manga: 0,
      movie: 0,
      tv: 0,
      game: 0,
      book: 0,
      music: 0,
    }

    for (const item of calendarItems) {
      counts[item.mediaType] = (counts[item.mediaType] || 0) + 1
    }

    const responsePayload = {
      success: true,
      items: calendarItems,
      meta: {
        start: validStart.toISOString(),
        end: validEnd.toISOString(),
        total: calendarItems.length,
        counts,
      },
    }

    if (cache) {
      await cache.set(cacheKey, responsePayload, CALENDAR_CACHE_TTL)
    }

    return responsePayload
  },
})
