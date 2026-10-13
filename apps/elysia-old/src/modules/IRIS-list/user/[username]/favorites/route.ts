import { defineRoute, t } from "@/router"
import type { FavoriteType } from "@IRIS/database"
import { NotFound } from "@/utils/errors"
import { FavoriteTypeSchema } from "./[targetId]/route"

export const EnrichedFavoriteEntitySchema = t.Object({
  id: t.Number(),
  title: t.String(),
  subtitle: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  link: t.String(),
  format: t.Optional(t.Nullable(t.String())),
  score: t.Optional(t.Nullable(t.Number())),
})

export const EnrichedFavoriteItemSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  type: t.String(),
  targetId: t.Number(),
  createdAt: t.Union([t.Date(), t.String()]),
  entity: t.Optional(t.Nullable(EnrichedFavoriteEntitySchema)),
})

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String({ description: "Username or '@me'" }),
    }),
    query: t.Object({
      type: t.Optional(FavoriteTypeSchema),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        data: t.Array(EnrichedFavoriteItemSchema),
        total: t.Number(),
      }),
    },
    detail: {
      summary: "List all favorites for user with populated entity details",
      description:
        "Retrieves all favorites saved by the specified user with titles, cover images, and redirection links.",
      tags: ["Favorites"],
    },
  },

  async GET({ params, query, prisma }) {
    const dbUser = await prisma.user.findFirst({
      where: { username: { equals: params.username, mode: "insensitive" } },
      select: { id: true },
    })
    if (!dbUser) {
      throw new NotFound(`User "${params.username}" not found`)
    }
    const targetUserId = dbUser.id

    const typeFilter = query?.type as FavoriteType | undefined

    const whereClause = {
      userId: targetUserId,
      ...(typeFilter ? { type: typeFilter } : {}),
    }

    const items = await prisma.favorite.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    })

    // Group targetIds by type for batch lookup
    const animeIds: number[] = []
    const mangaIds: number[] = []
    const movieIds: number[] = []
    const tvIds: number[] = []
    const gameIds: number[] = []
    const bookIds: number[] = []
    const musicIds: number[] = []
    const characterIds: number[] = []
    const personIds: number[] = []
    const studioIds: number[] = []

    for (const item of items) {
      if (item.type === "ANIME") animeIds.push(item.targetId)
      else if (item.type === "MANGA") mangaIds.push(item.targetId)
      else if (item.type === "MOVIE") movieIds.push(item.targetId)
      else if (item.type === "TV") tvIds.push(item.targetId)
      else if (item.type === "GAME") gameIds.push(item.targetId)
      else if (item.type === "BOOK") bookIds.push(item.targetId)
      else if (
        item.type === "MUSIC" ||
        item.type === "MUSIC_ALBUM" ||
        item.type === "MUSIC_TRACK"
      )
        musicIds.push(item.targetId)
      else if (item.type === "CHARACTER") characterIds.push(item.targetId)
      else if (item.type === "PERSON") personIds.push(item.targetId)
      else if (item.type === "STUDIO") studioIds.push(item.targetId)
    }

    const [
      animeList,
      mangaList,
      movieList,
      tvList,
      gameList,
      bookList,
      musicList,
      characterList,
      personList,
      studioList,
      userAnimeEntries,
      userMangaEntries,
      userMovieEntries,
      userTvEntries,
      userGameEntries,
      userBookEntries,
      userMusicEntries,
    ] = await Promise.all([
      animeIds.length
        ? prisma.anime.findMany({
            where: { id: { in: animeIds } },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              format: true,
            },
          })
        : [],
      mangaIds.length
        ? prisma.manga.findMany({
            where: { id: { in: mangaIds } },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
              format: true,
            },
          })
        : [],
      movieIds.length
        ? prisma.movie.findMany({
            where: { id: { in: movieIds } },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
            },
          })
        : [],
      tvIds.length
        ? prisma.tv.findMany({
            where: { id: { in: tvIds } },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              titleNative: true,
              coverImage: true,
            },
          })
        : [],
      gameIds.length
        ? prisma.game.findMany({
            where: { id: { in: gameIds } },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
            },
          })
        : [],
      bookIds.length
        ? prisma.book.findMany({
            where: { id: { in: bookIds } },
            select: {
              id: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
            },
          })
        : [],
      musicIds.length
        ? prisma.music.findMany({
            where: { id: { in: musicIds } },
            select: {
              id: true,
              type: true,
              titlePrimary: true,
              titleSecondary: true,
              coverImage: true,
            },
          })
        : [],
      characterIds.length
        ? prisma.character.findMany({
            where: { id: { in: characterIds } },
            select: {
              id: true,
              namePrimary: true,
              nameNative: true,
              image: true,
            },
          })
        : [],
      personIds.length
        ? prisma.person.findMany({
            where: { id: { in: personIds } },
            select: {
              id: true,
              namePrimary: true,
              nameNative: true,
              image: true,
            },
          })
        : [],
      studioIds.length
        ? prisma.studio.findMany({
            where: { id: { in: studioIds } },
            select: {
              id: true,
              name: true,
            },
          })
        : [],
      animeIds.length
        ? prisma.animeList.findMany({
            where: { userId: targetUserId, animeId: { in: animeIds } },
            select: { animeId: true, score: true },
          })
        : [],
      mangaIds.length
        ? prisma.mangaList.findMany({
            where: { userId: targetUserId, mangaId: { in: mangaIds } },
            select: { mangaId: true, score: true },
          })
        : [],
      movieIds.length
        ? prisma.movieList.findMany({
            where: { userId: targetUserId, movieId: { in: movieIds } },
            select: { movieId: true, score: true },
          })
        : [],
      tvIds.length
        ? prisma.tvList.findMany({
            where: { userId: targetUserId, tvId: { in: tvIds } },
            select: { tvId: true, score: true },
          })
        : [],
      gameIds.length
        ? prisma.gameList.findMany({
            where: { userId: targetUserId, gameId: { in: gameIds } },
            select: { gameId: true, score: true },
          })
        : [],
      bookIds.length
        ? prisma.bookList.findMany({
            where: { userId: targetUserId, bookId: { in: bookIds } },
            select: { bookId: true, score: true },
          })
        : [],
      musicIds.length
        ? prisma.musicList.findMany({
            where: { userId: targetUserId, musicId: { in: musicIds } },
            select: { musicId: true, score: true },
          })
        : [],
    ])

    const animeMap = new Map((animeList as any[]).map((a) => [a.id, a]))
    const mangaMap = new Map((mangaList as any[]).map((m) => [m.id, m]))
    const movieMap = new Map((movieList as any[]).map((m) => [m.id, m]))
    const tvMap = new Map((tvList as any[]).map((t) => [t.id, t]))
    const gameMap = new Map((gameList as any[]).map((g) => [g.id, g]))
    const bookMap = new Map((bookList as any[]).map((b) => [b.id, b]))
    const musicMap = new Map((musicList as any[]).map((m) => [m.id, m]))
    const characterMap = new Map((characterList as any[]).map((c) => [c.id, c]))
    const personMap = new Map((personList as any[]).map((p) => [p.id, p]))
    const studioMap = new Map((studioList as any[]).map((s) => [s.id, s]))

    const userAnimeScoreMap = new Map(
      (userAnimeEntries as any[])
        .filter((e) => typeof e.score === "number" && e.score > 0)
        .map((e) => [e.animeId, e.score!])
    )
    const userMangaScoreMap = new Map(
      (userMangaEntries as any[])
        .filter((e) => typeof e.score === "number" && e.score > 0)
        .map((e) => [e.mangaId, e.score!])
    )
    const userMovieScoreMap = new Map(
      (userMovieEntries as any[])
        .filter((e) => typeof e.score === "number" && e.score > 0)
        .map((e) => [e.movieId, e.score!])
    )
    const userTvScoreMap = new Map(
      (userTvEntries as any[])
        .filter((e) => typeof e.score === "number" && e.score > 0)
        .map((e) => [e.tvId, e.score!])
    )
    const userGameScoreMap = new Map(
      (userGameEntries as any[])
        .filter((e) => typeof e.score === "number" && e.score > 0)
        .map((e) => [e.gameId, e.score!])
    )
    const userBookScoreMap = new Map(
      (userBookEntries as any[])
        .filter((e) => typeof e.score === "number" && e.score > 0)
        .map((e) => [e.bookId, e.score!])
    )
    const userMusicScoreMap = new Map(
      (userMusicEntries as any[])
        .filter((e) => typeof e.score === "number" && e.score > 0)
        .map((e) => [e.musicId, e.score!])
    )

    const normalizeUserScore = (score?: number | null): number | null => {
      if (score === null || score === undefined || score <= 0) return null
      const normalized = score > 10 ? score / 10 : score
      return Math.round(normalized * 10) / 10
    }

    const enrichedItems = items.map((item) => {
      let entity: {
        id: number
        title: string
        subtitle: string | null
        coverImage: string | null
        link: string
        format?: string | null
        score?: number | null
      } | null = null

      if (item.type === "ANIME") {
        const a = animeMap.get(item.targetId)
        if (a) {
          entity = {
            id: a.id,
            title: a.titlePrimary,
            subtitle: a.titleSecondary || a.titleNative || null,
            coverImage: a.coverImage || null,
            link: `/IRIS-list/anime/${a.id}`,
            format: a.format || "ANIME",
            score: normalizeUserScore(userAnimeScoreMap.get(a.id)),
          }
        }
      } else if (item.type === "MANGA") {
        const m = mangaMap.get(item.targetId)
        if (m) {
          entity = {
            id: m.id,
            title: m.titlePrimary,
            subtitle: m.titleSecondary || m.titleNative || null,
            coverImage: m.coverImage || null,
            link: `/IRIS-list/manga/${m.id}`,
            format: m.format || "MANGA",
            score: normalizeUserScore(userMangaScoreMap.get(m.id)),
          }
        }
      } else if (item.type === "MOVIE") {
        const m = movieMap.get(item.targetId)
        if (m) {
          entity = {
            id: m.id,
            title: m.titlePrimary,
            subtitle: m.titleSecondary || m.titleNative || null,
            coverImage: m.coverImage || null,
            link: `/IRIS-list/movies/${m.id}`,
            format: "MOVIE",
            score: normalizeUserScore(userMovieScoreMap.get(m.id)),
          }
        }
      } else if (item.type === "TV") {
        const t = tvMap.get(item.targetId)
        if (t) {
          entity = {
            id: t.id,
            title: t.titlePrimary,
            subtitle: t.titleSecondary || t.titleNative || null,
            coverImage: t.coverImage || null,
            link: `/IRIS-list/tv/${t.id}`,
            format: "TV",
            score: normalizeUserScore(userTvScoreMap.get(t.id)),
          }
        }
      } else if (item.type === "GAME") {
        const g = gameMap.get(item.targetId)
        if (g) {
          entity = {
            id: g.id,
            title: g.titlePrimary,
            subtitle: g.titleSecondary || null,
            coverImage: g.coverImage || null,
            link: `/IRIS-list/games/${g.id}`,
            format: "GAME",
            score: normalizeUserScore(userGameScoreMap.get(g.id)),
          }
        }
      } else if (item.type === "BOOK") {
        const b = bookMap.get(item.targetId)
        if (b) {
          entity = {
            id: b.id,
            title: b.titlePrimary,
            subtitle: b.titleSecondary || null,
            coverImage: b.coverImage || null,
            link: `/IRIS-list/books/${b.id}`,
            format: "BOOK",
            score: normalizeUserScore(userBookScoreMap.get(b.id)),
          }
        }
      } else if (
        item.type === "MUSIC" ||
        item.type === "MUSIC_ALBUM" ||
        item.type === "MUSIC_TRACK"
      ) {
        const m = musicMap.get(item.targetId)
        if (m) {
          entity = {
            id: m.id,
            title: m.titlePrimary,
            subtitle: m.titleSecondary || null,
            coverImage: m.coverImage || null,
            link: `/IRIS-list/music/${m.id}`,
            format: m.type || "MUSIC",
            score: normalizeUserScore(userMusicScoreMap.get(m.id)),
          }
        }
      } else if (item.type === "CHARACTER") {
        const c = characterMap.get(item.targetId)
        if (c) {
          entity = {
            id: c.id,
            title: c.namePrimary,
            subtitle: c.nameNative || null,
            coverImage: c.image || null,
            link: `/IRIS-list/characters/${c.id}`,
            format: "CHARACTER",
            score: null,
          }
        }
      } else if (item.type === "PERSON") {
        const p = personMap.get(item.targetId)
        if (p) {
          entity = {
            id: p.id,
            title: p.namePrimary,
            subtitle: p.nameNative || null,
            coverImage: p.image || null,
            link: `/IRIS-list/people/${p.id}`,
            format: "PERSON",
            score: null,
          }
        }
      } else if (item.type === "STUDIO") {
        const s = studioMap.get(item.targetId)
        if (s) {
          entity = {
            id: s.id,
            title: s.name,
            subtitle: null,
            coverImage: null,
            link: `/IRIS-list/studios/${s.id}`,
            format: "STUDIO",
            score: null,
          }
        }
      }

      // Default fallback if entity was not in db
      if (!entity) {
        const fallbackType =
          item.type === "MOVIE"
            ? "movies"
            : item.type === "TV"
              ? "tv"
              : item.type === "GAME"
                ? "games"
                : item.type === "BOOK"
                  ? "books"
                  : item.type === "PERSON"
                    ? "people"
                    : item.type === "CHARACTER"
                      ? "characters"
                      : item.type === "STUDIO"
                        ? "studios"
                        : item.type.toLowerCase()
        entity = {
          id: item.targetId,
          title: `${item.type} #${item.targetId}`,
          subtitle: null,
          coverImage: null,
          link: `/IRIS-list/${fallbackType}/${item.targetId}`,
          format: item.type,
        }
      }

      return {
        id: item.id,
        userId: item.userId,
        type: item.type,
        targetId: item.targetId,
        createdAt: item.createdAt.toISOString(),
        entity,
      }
    })

    return {
      success: true,
      data: enrichedItems,
      total: items.length,
    }
  },
})
