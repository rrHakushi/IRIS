import { prisma, and, or, toDate } from '@IRIS/database'
import { cache } from '../../utils/cache'

export interface CalendarQuery {
  start?: string
  end?: string
  types?: string
  onlyInLists?: boolean | string
}

export type CalendarMediaType =
  | 'anime'
  | 'manga'
  | 'movie'
  | 'tv'
  | 'game'
  | 'book'
  | 'music'

export interface CalendarItem {
  id: string
  mediaType: CalendarMediaType
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

export interface CalendarResponse {
  success: boolean
  items: CalendarItem[]
  meta: {
    start: string
    end: string
    total: number
    counts: Record<string, number>
  }
}

const CALENDAR_CACHE_TTL = 12 * 60 * 60 // 12 hours

const TYPE_ALIAS_MAP: Record<string, CalendarMediaType> = {
  movies: 'movie',
  movie: 'movie',
  games: 'game',
  game: 'game',
  books: 'book',
  book: 'book',
  anime: 'anime',
  manga: 'manga',
  tv: 'tv',
  music: 'music',
}

export class BorealisCalendarServ {
  public static async getCalendar(
    query?: CalendarQuery,
    userId?: string | null
  ): Promise<CalendarResponse> {
    // 1. Resolve date boundaries
    const now = new Date()
    const defaultStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    )
    const defaultEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    )

    const startParam =
      typeof query?.start === 'string' ? query.start : undefined
    const endParam = typeof query?.end === 'string' ? query.end : undefined

    const startDate = startParam ? new Date(startParam) : defaultStart
    const endDate = endParam ? new Date(endParam) : defaultEnd

    const validStart = isNaN(startDate.getTime()) ? defaultStart : startDate
    const validEnd = isNaN(endDate.getTime()) ? defaultEnd : endDate

    const startYear = validStart.getUTCFullYear()
    const endYear = validEnd.getUTCFullYear()

    // 2. Resolve requested types with normalization & aliases
    const typesParam =
      typeof query?.types === 'string' ? query.types : undefined
    const rawTypes = typesParam
      ? typesParam
          .toLowerCase()
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => (TYPE_ALIAS_MAP[t] ?? t) as CalendarMediaType)
      : []

    const isRequested = (type: CalendarMediaType) =>
      rawTypes.length === 0 || rawTypes.includes(type)

    // 3. Resolve list filter & authentication
    const onlyInLists =
      query?.onlyInLists === true ||
      query?.onlyInLists === 'true' ||
      query?.onlyInLists === '1'

    const currentUserId = userId ?? null

    // If list-only requested without authenticated user, return empty response immediately
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

    // 4. Cache resolution
    const startKey = validStart.toISOString().split('T')[0]
    const endKey = validEnd.toISOString().split('T')[0]
    const typesKey = rawTypes.slice().sort().join(',') || 'all'
    const userScope =
      onlyInLists && currentUserId ? `user:${currentUserId}` : 'public'
    const cacheKey = `calendar:${startKey}:${endKey}:${typesKey}:${userScope}`

    return await cache.getOrSet(
      cacheKey,
      async () => {
        const calendarItems: CalendarItem[] = []

        // 5. Parallel database queries for all requested media types
        const [
          userAnimeIds,
          userMangaIds,
          userGameIds,
          userBookIds,
          userMovieIds,
          userTvIds,
          userMusicIds,
        ] = currentUserId
          ? await Promise.all([
              isRequested('anime')
                ? prisma.orm.public.AnimeList.where((l) =>
                    l.userId.eq(currentUserId)
                  )
                    .select('animeId')
                    .all()
                    .then((rows) => new Set(rows.map((r) => r.animeId)))
                : Promise.resolve(new Set<number>()),
              isRequested('manga')
                ? prisma.orm.public.MangaList.where((l) =>
                    l.userId.eq(currentUserId)
                  )
                    .select('mangaId')
                    .all()
                    .then((rows) => new Set(rows.map((r) => r.mangaId)))
                : Promise.resolve(new Set<number>()),
              isRequested('game')
                ? prisma.orm.public.GameList.where((l) =>
                    l.userId.eq(currentUserId)
                  )
                    .select('gameId')
                    .all()
                    .then((rows) => new Set(rows.map((r) => r.gameId)))
                : Promise.resolve(new Set<number>()),
              isRequested('book')
                ? prisma.orm.public.BookList.where((l) =>
                    l.userId.eq(currentUserId)
                  )
                    .select('bookId')
                    .all()
                    .then((rows) => new Set(rows.map((r) => r.bookId)))
                : Promise.resolve(new Set<number>()),
              isRequested('movie')
                ? prisma.orm.public.MovieList.where((l) =>
                    l.userId.eq(currentUserId)
                  )
                    .select('movieId')
                    .all()
                    .then((rows) => new Set(rows.map((r) => r.movieId)))
                : Promise.resolve(new Set<number>()),
              isRequested('tv')
                ? prisma.orm.public.TvList.where((l) =>
                    l.userId.eq(currentUserId)
                  )
                    .select('tvId')
                    .all()
                    .then((rows) => new Set(rows.map((r) => r.tvId)))
                : Promise.resolve(new Set<number>()),
              isRequested('music')
                ? prisma.orm.public.MusicList.where((l) =>
                    l.userId.eq(currentUserId)
                  )
                    .select('musicId')
                    .all()
                    .then((rows) => new Set(rows.map((r) => r.musicId)))
                : Promise.resolve(new Set<number>()),
            ])
          : [
              new Set<number>(),
              new Set<number>(),
              new Set<number>(),
              new Set<number>(),
              new Set<number>(),
              new Set<number>(),
              new Set<number>(),
            ]

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
          isRequested('anime') && (!onlyInLists || userAnimeIds.size > 0)
            ? (() => {
                let q = prisma.orm.public.AnimeAiringSchedule.where((s) =>
                  and(s.airingAt.gte(validStart), s.airingAt.lte(validEnd))
                )
                if (onlyInLists && currentUserId) {
                  q = q.where((s) => s.animeId.in(Array.from(userAnimeIds)))
                }
                return q
                  .include('anime', (a) =>
                    a.select(
                      'id',
                      'titlePrimary',
                      'titleSecondary',
                      'titleNative',
                      'coverImage',
                      'bannerImage',
                      'format',
                      'status'
                    )
                  )
                  .orderBy((s) => s.airingAt.asc())
                  .limit(200)
                  .all()
              })()
            : Promise.resolve([]),

          // Manga: start dates / end dates
          isRequested('manga') && (!onlyInLists || userMangaIds.size > 0)
            ? (() => {
                let q = prisma.orm.public.Manga.where((m) =>
                  or(
                    and(
                      m.startDateYear.gte(startYear),
                      m.startDateYear.lte(endYear)
                    ),
                    and(
                      m.endDateYear.gte(startYear),
                      m.endDateYear.lte(endYear)
                    )
                  )
                )
                if (onlyInLists && currentUserId) {
                  q = q.where((m) => m.id.in(Array.from(userMangaIds)))
                }
                return q
                  .select(
                    'id',
                    'titlePrimary',
                    'titleSecondary',
                    'titleNative',
                    'coverImage',
                    'bannerImage',
                    'format',
                    'status',
                    'startDateYear',
                    'startDateMonth',
                    'startDateDay',
                    'endDateYear',
                    'endDateMonth',
                    'endDateDay',
                    'chapterCount',
                    'volumeCount'
                  )
                  .limit(200)
                  .all()
              })()
            : Promise.resolve([]),

          // Games: releaseDate with fallback to releaseDateYear/Month/Day
          isRequested('game') && (!onlyInLists || userGameIds.size > 0)
            ? (() => {
                let q = prisma.orm.public.Game.where((g) =>
                  or(
                    and(
                      g.releaseDate.gte(validStart),
                      g.releaseDate.lte(validEnd)
                    ),
                    and(
                      g.releaseDateYear.gte(startYear),
                      g.releaseDateYear.lte(endYear)
                    )
                  )
                )
                if (onlyInLists && currentUserId) {
                  q = q.where((g) => g.id.in(Array.from(userGameIds)))
                }
                return q
                  .select(
                    'id',
                    'titlePrimary',
                    'titleSecondary',
                    'titleNative',
                    'coverImage',
                    'bannerImage',
                    'releaseDate',
                    'releaseDateYear',
                    'releaseDateMonth',
                    'releaseDateDay',
                    'platforms',
                    'status'
                  )
                  .limit(200)
                  .all()
              })()
            : Promise.resolve([]),

          // Books: releaseDate with fallback to releaseDateYear/Month/Day
          isRequested('book') && (!onlyInLists || userBookIds.size > 0)
            ? (() => {
                let q = prisma.orm.public.Book.where((b) =>
                  or(
                    and(
                      b.releaseDate.gte(validStart),
                      b.releaseDate.lte(validEnd)
                    ),
                    and(
                      b.releaseDateYear.gte(startYear),
                      b.releaseDateYear.lte(endYear)
                    )
                  )
                )
                if (onlyInLists && currentUserId) {
                  q = q.where((b) => b.id.in(Array.from(userBookIds)))
                }
                return q
                  .select(
                    'id',
                    'titlePrimary',
                    'titleSecondary',
                    'coverImage',
                    'bannerImage',
                    'releaseDate',
                    'releaseDateYear',
                    'releaseDateMonth',
                    'releaseDateDay',
                    'authors',
                    'series',
                    'format'
                  )
                  .limit(200)
                  .all()
              })()
            : Promise.resolve([]),

          // Movies: releaseDateYear / month / day
          isRequested('movie') && (!onlyInLists || userMovieIds.size > 0)
            ? (() => {
                let q = prisma.orm.public.Movie.where((m) =>
                  and(
                    m.releaseDateYear.gte(startYear),
                    m.releaseDateYear.lte(endYear)
                  )
                )
                if (onlyInLists && currentUserId) {
                  q = q.where((m) => m.id.in(Array.from(userMovieIds)))
                }
                return q
                  .select(
                    'id',
                    'titlePrimary',
                    'titleSecondary',
                    'titleNative',
                    'coverImage',
                    'bannerImage',
                    'releaseDateYear',
                    'releaseDateMonth',
                    'releaseDateDay',
                    'runtime',
                    'status'
                  )
                  .limit(200)
                  .all()
              })()
            : Promise.resolve([]),

          // TV: tvEpisode airDate with season
          isRequested('tv') && (!onlyInLists || userTvIds.size > 0)
            ? (() => {
                let q = prisma.orm.public.TvEpisode.where((e) =>
                  and(e.airDate.gte(validStart), e.airDate.lte(validEnd))
                )
                if (onlyInLists && currentUserId) {
                  q = q.where((e) => e.tvId.in(Array.from(userTvIds)))
                }
                return q
                  .include('tv', (t) =>
                    t.select(
                      'id',
                      'titlePrimary',
                      'titleSecondary',
                      'titleNative',
                      'coverImage',
                      'bannerImage',
                      'status'
                    )
                  )
                  .include('season', (s) =>
                    s.select('seasonNumber', 'titlePrimary')
                  )
                  .orderBy((e) => e.airDate.asc())
                  .limit(200)
                  .all()
              })()
            : Promise.resolve([]),

          // Music: releaseDate with fallback to releaseDateYear/Month/Day
          isRequested('music') && (!onlyInLists || userMusicIds.size > 0)
            ? (() => {
                let q = prisma.orm.public.Music.where((m) =>
                  or(
                    and(
                      m.releaseDate.gte(validStart),
                      m.releaseDate.lte(validEnd)
                    ),
                    and(
                      m.releaseDateYear.gte(startYear),
                      m.releaseDateYear.lte(endYear)
                    )
                  )
                )
                if (onlyInLists && currentUserId) {
                  q = q.where((m) => m.id.in(Array.from(userMusicIds)))
                }
                return q
                  .select(
                    'id',
                    'titlePrimary',
                    'titleSecondary',
                    'coverImage',
                    'releaseDate',
                    'releaseDateYear',
                    'releaseDateMonth',
                    'releaseDateDay',
                    'type',
                    'artistName',
                    'recordType'
                  )
                  .limit(200)
                  .all()
              })()
            : Promise.resolve([]),
        ])

        // 6. Transform Anime schedules
        for (const schedule of animeSchedules) {
          if (!schedule.anime) continue
          calendarItems.push({
            id: `anime-${schedule.id}`,
            mediaType: 'anime',
            mediaId: schedule.anime.id,
            title: schedule.anime.titlePrimary,
            titleSecondary: schedule.anime.titleSecondary,
            titleNative: schedule.anime.titleNative,
            coverImage: schedule.anime.coverImage,
            bannerImage: schedule.anime.bannerImage,
            releaseDate: toDate(schedule.airingAt).toISOString(),
            detail: `Episode ${schedule.episodeNumber}`,
            format: schedule.anime.format,
            status: schedule.anime.status,
            episodeNumber: schedule.episodeNumber,
            inUserList: userAnimeIds.has(schedule.anime.id),
          })
        }

        // 7. Transform Manga start and end dates
        for (const manga of mangaList) {
          const inUserList = userMangaIds.has(manga.id)

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
                mediaType: 'manga',
                mediaId: manga.id,
                title: manga.titlePrimary,
                titleSecondary: manga.titleSecondary,
                titleNative: manga.titleNative,
                coverImage: manga.coverImage,
                bannerImage: manga.bannerImage,
                releaseDate: startD.toISOString(),
                detail: 'Publishing Start',
                format: manga.format,
                status: manga.status,
                eventKind: 'START',
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
                mediaType: 'manga',
                mediaId: manga.id,
                title: manga.titlePrimary,
                titleSecondary: manga.titleSecondary,
                titleNative: manga.titleNative,
                coverImage: manga.coverImage,
                bannerImage: manga.bannerImage,
                releaseDate: endD.toISOString(),
                detail: 'Publishing End',
                format: manga.format,
                status: manga.status,
                eventKind: 'END',
                inUserList,
              })
            }
          }
        }

        // 8. Transform Games
        for (const game of gameList) {
          let rDate: Date | null = null
          if (game.releaseDate) {
            rDate = toDate(game.releaseDate)
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
            const platforms = game.platforms as string[] | null
            const platformText =
              platforms && platforms.length > 0
                ? platforms.slice(0, 2).join(', ')
                : 'Game Launch'

            calendarItems.push({
              id: `game-${game.id}`,
              mediaType: 'game',
              mediaId: game.id,
              title: game.titlePrimary,
              titleSecondary: game.titleSecondary,
              titleNative: game.titleNative,
              coverImage: game.coverImage,
              bannerImage: game.bannerImage,
              releaseDate: rDate.toISOString(),
              detail: platformText,
              status: game.status,
              inUserList: userGameIds.has(game.id),
            })
          }
        }

        // 9. Transform Books
        for (const book of bookList) {
          let rDate: Date | null = null
          if (book.releaseDate) {
            rDate = toDate(book.releaseDate)
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
            const authors = book.authors as string[] | null
            const authorText =
              authors && authors.length > 0
                ? authors[0]
                : book.series || 'Book Release'

            calendarItems.push({
              id: `book-${book.id}`,
              mediaType: 'book',
              mediaId: book.id,
              title: book.titlePrimary,
              titleSecondary: book.titleSecondary,
              coverImage: book.coverImage,
              bannerImage: book.bannerImage,
              releaseDate: rDate.toISOString(),
              detail: authorText,
              format: book.format,
              inUserList: userBookIds.has(book.id),
            })
          }
        }

        // 10. Transform Movies
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
                mediaType: 'movie',
                mediaId: movie.id,
                title: movie.titlePrimary,
                titleSecondary: movie.titleSecondary,
                titleNative: movie.titleNative,
                coverImage: movie.coverImage,
                bannerImage: movie.bannerImage,
                releaseDate: rDate.toISOString(),
                detail: movie.runtime ? `${movie.runtime}m` : 'Movie Premiere',
                status: movie.status,
                inUserList: userMovieIds.has(movie.id),
              })
            }
          }
        }

        // 11. Transform TV episodes
        for (const ep of tvEpisodes) {
          if (!ep.tv || !ep.airDate) continue
          const seasonNum = ep.seasonNumber ?? ep.season?.seasonNumber ?? 1
          const epNum = ep.episodeNumber
          const detailText = `Season ${seasonNum} • Ep ${epNum}`

          calendarItems.push({
            id: `tv-ep-${ep.id}`,
            mediaType: 'tv',
            mediaId: ep.tv.id,
            title: ep.tv.titlePrimary,
            titleSecondary: ep.tv.titleSecondary,
            titleNative: ep.tv.titleNative,
            coverImage: ep.thumbnail || ep.tv.coverImage,
            bannerImage: ep.tv.bannerImage,
            releaseDate: toDate(ep.airDate).toISOString(),
            detail: detailText,
            seasonNumber: seasonNum,
            episodeNumber: epNum,
            episodeTitle: ep.titlePrimary,
            status: ep.tv.status,
            inUserList: userTvIds.has(ep.tv.id),
          })
        }

        // 12. Transform Music
        for (const music of musicList) {
          let rDate: Date | null = null
          if (music.releaseDate) {
            rDate = toDate(music.releaseDate)
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
            const typeLabel = music.type === 'ALBUM' ? 'Album' : 'Track'
            const detailText = music.artistName
              ? `${music.artistName} • ${typeLabel}`
              : typeLabel

            calendarItems.push({
              id: `music-${music.id}`,
              mediaType: 'music',
              mediaId: music.id,
              title: music.titlePrimary,
              titleSecondary: music.titleSecondary,
              coverImage: music.coverImage,
              releaseDate: rDate.toISOString(),
              detail: detailText,
              format: music.recordType || typeLabel,
              inUserList: userMusicIds.has(music.id),
            })
          }
        }

        // 13. Sort items chronologically
        calendarItems.sort(
          (a, b) =>
            new Date(a.releaseDate).getTime() -
            new Date(b.releaseDate).getTime()
        )

        // 14. Aggregate counts per media type
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

        return {
          success: true,
          items: calendarItems,
          meta: {
            start: validStart.toISOString(),
            end: validEnd.toISOString(),
            total: calendarItems.length,
            counts,
          },
        }
      },
      CALENDAR_CACHE_TTL
    )
  }
}
