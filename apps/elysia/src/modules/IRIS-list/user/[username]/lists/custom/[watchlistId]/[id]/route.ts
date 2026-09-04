import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  animeSelect,
  mangaSelect,
  movieSelect,
  tvSelect,
  gameSelect,
  bookSelect,
  musicSelect,
} from "@/modules/IRIS-list/helpers"
import { NotFound, BadRequest } from "@/utils/errors"
import type { MediaType } from "@IRIS/database"

const WatchlistEntryResponseSchema = t.Object({
  id: t.String(),
  watchlistId: t.String(),
  mediaType: t.String(),
  mediaId: t.Number(),
  order: t.Number(),
  customNotes: t.Nullable(t.String()),
  addedAt: t.String(),
})

const WatchlistEntryMutationBodySchema = t.Object({
  mediaType: t.Union([
    t.Literal("ANIME"),
    t.Literal("MANGA"),
    t.Literal("MOVIE"),
    t.Literal("TV"),
    t.Literal("GAME"),
    t.Literal("BOOK"),
    t.Literal("MUSIC"),
  ]),
  order: t.Optional(t.Number()),
  customNotes: t.Optional(t.Nullable(t.String())),
})

export default defineRoute({
  schemas: {
    GET: {
      params: t.Object({
        username: t.String(),
        watchlistId: t.String({ description: "Watchlist UUID" }),
        id: t.Number({ minimum: 1, description: "Media ID" }),
      }),
      query: t.Object({
        mediaType: t.Optional(
          t.Union([
            t.Literal("ANIME"),
            t.Literal("MANGA"),
            t.Literal("MOVIE"),
            t.Literal("TV"),
            t.Literal("GAME"),
            t.Literal("BOOK"),
            t.Literal("MUSIC"),
          ])
        ),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          inWatchlist: t.Boolean(),
          entry: t.Nullable(WatchlistEntryResponseSchema),
          media: t.Optional(t.Nullable(t.Any())),
        }),
      },
      detail: {
        summary: "Check and get custom watchlist entry by media ID",
        tags: ["Lists - Custom Watchlist"],
      },
    },
    PUT: {
      params: t.Object({
        username: t.String(),
        watchlistId: t.String({ description: "Watchlist UUID" }),
        id: t.Number({ minimum: 1, description: "Media ID" }),
      }),
      body: WatchlistEntryMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: WatchlistEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Upsert custom watchlist entry by media ID",
        tags: ["Lists - Custom Watchlist"],
      },
    },
    PATCH: {
      params: t.Object({
        username: t.String(),
        watchlistId: t.String({ description: "Watchlist UUID" }),
        id: t.Number({ minimum: 1, description: "Media ID" }),
      }),
      body: WatchlistEntryMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: WatchlistEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Partially update custom watchlist entry by media ID",
        tags: ["Lists - Custom Watchlist"],
      },
    },
    DELETE: {
      params: t.Object({
        username: t.String(),
        watchlistId: t.String({ description: "Watchlist UUID" }),
        id: t.Number({ minimum: 1, description: "Media ID" }),
      }),
      query: t.Object({
        mediaType: t.Optional(
          t.Union([
            t.Literal("ANIME"),
            t.Literal("MANGA"),
            t.Literal("MOVIE"),
            t.Literal("TV"),
            t.Literal("GAME"),
            t.Literal("BOOK"),
            t.Literal("MUSIC"),
          ])
        ),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete media from custom watchlist",
        tags: ["Lists - Custom Watchlist"],
      },
    },
  },

  async GET({ params, query, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const watchlist = await prisma.watchlist.findUnique({
      where: { id: params.watchlistId },
      select: { id: true, userId: true, isPrivate: true },
    })
    if (!watchlist || watchlist.userId !== dbUser.id) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }
    if (watchlist.isPrivate && !isOwner) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    const whereClause: any = {
      watchlistId: watchlist.id,
      mediaId: Number(params.id),
      ...(query?.mediaType ? { mediaType: query.mediaType as MediaType } : {}),
    }

    const entry = await prisma.watchlistEntry.findFirst({
      where: whereClause,
      include: {
        anime: { select: animeSelect },
        manga: { select: mangaSelect },
        movie: { select: movieSelect },
        tv: { select: tvSelect },
        game: { select: gameSelect },
        book: { select: bookSelect },
        music: { select: musicSelect },
      },
    })

    if (!entry) {
      throw new NotFound("Media is not in this custom watchlist")
    }

    const media =
      entry.anime ||
      entry.manga ||
      entry.movie ||
      entry.tv ||
      entry.game ||
      entry.book ||
      entry.music ||
      null

    return {
      success: true,
      inWatchlist: true,
      entry: {
        id: entry.id,
        watchlistId: entry.watchlistId,
        mediaType: entry.mediaType,
        mediaId: entry.mediaId,
        order: entry.order,
        customNotes: entry.customNotes,
        addedAt: entry.addedAt.toISOString(),
      },
      media,
    }
  },

  async PUT({ params, body, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const watchlist = await prisma.watchlist.findUnique({
      where: { id: params.watchlistId },
      select: { id: true, userId: true },
    })
    if (!watchlist || watchlist.userId !== dbUser.id) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    const b = body as any
    const mediaType = b.mediaType as MediaType
    const mediaId = Number(params.id)
    const order = b.order ?? 0
    const customNotes = b.customNotes ?? null

    const foreignKeyField: any = {
      animeId: mediaType === "ANIME" ? mediaId : null,
      mangaId: mediaType === "MANGA" ? mediaId : null,
      movieId: mediaType === "MOVIE" ? mediaId : null,
      tvId: mediaType === "TV" ? mediaId : null,
      gameId: mediaType === "GAME" ? mediaId : null,
      bookId: mediaType === "BOOK" ? mediaId : null,
      musicId: mediaType === "MUSIC" ? mediaId : null,
    }

    const result = await prisma.watchlistEntry.upsert({
      where: {
        watchlistId_mediaType_mediaId: {
          watchlistId: watchlist.id,
          mediaType,
          mediaId,
        },
      },
      create: {
        watchlistId: watchlist.id,
        mediaType,
        mediaId,
        order,
        customNotes,
        ...foreignKeyField,
      },
      update: {
        ...(b.order !== undefined ? { order: b.order } : {}),
        ...(b.customNotes !== undefined ? { customNotes: b.customNotes } : {}),
        ...foreignKeyField,
      },
    })

    return {
      success: true,
      message: "Watchlist entry updated successfully",
      entry: {
        id: result.id,
        watchlistId: result.watchlistId,
        mediaType: result.mediaType,
        mediaId: result.mediaId,
        order: result.order,
        customNotes: result.customNotes,
        addedAt: result.addedAt.toISOString(),
      },
    }
  },

  async PATCH({ params, body, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const watchlist = await prisma.watchlist.findUnique({
      where: { id: params.watchlistId },
      select: { id: true, userId: true },
    })
    if (!watchlist || watchlist.userId !== dbUser.id) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    const b = body as any
    const mediaType = b.mediaType as MediaType
    const mediaId = Number(params.id)
    const order = b.order ?? 0
    const customNotes = b.customNotes ?? null

    const foreignKeyField: any = {
      animeId: mediaType === "ANIME" ? mediaId : null,
      mangaId: mediaType === "MANGA" ? mediaId : null,
      movieId: mediaType === "MOVIE" ? mediaId : null,
      tvId: mediaType === "TV" ? mediaId : null,
      gameId: mediaType === "GAME" ? mediaId : null,
      bookId: mediaType === "BOOK" ? mediaId : null,
      musicId: mediaType === "MUSIC" ? mediaId : null,
    }

    const result = await prisma.watchlistEntry.upsert({
      where: {
        watchlistId_mediaType_mediaId: {
          watchlistId: watchlist.id,
          mediaType,
          mediaId,
        },
      },
      create: {
        watchlistId: watchlist.id,
        mediaType,
        mediaId,
        order,
        customNotes,
        ...foreignKeyField,
      },
      update: {
        ...(b.order !== undefined ? { order: b.order } : {}),
        ...(b.customNotes !== undefined ? { customNotes: b.customNotes } : {}),
        ...foreignKeyField,
      },
    })

    return {
      success: true,
      message: "Watchlist entry updated successfully",
      entry: {
        id: result.id,
        watchlistId: result.watchlistId,
        mediaType: result.mediaType,
        mediaId: result.mediaId,
        order: result.order,
        customNotes: result.customNotes,
        addedAt: result.addedAt.toISOString(),
      },
    }
  },

  async DELETE({ params, query, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const watchlist = await prisma.watchlist.findUnique({
      where: { id: params.watchlistId },
      select: { id: true, userId: true },
    })
    if (!watchlist || watchlist.userId !== dbUser.id) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    const whereClause: any = {
      watchlistId: watchlist.id,
      mediaId: Number(params.id),
      ...(query?.mediaType ? { mediaType: query.mediaType as MediaType } : {}),
    }

    const existing = await prisma.watchlistEntry.findFirst({
      where: whereClause,
    })
    if (!existing) {
      throw new NotFound("Media is not in this custom watchlist")
    }

    await prisma.watchlistEntry.delete({
      where: { id: existing.id },
    })

    return {
      success: true,
      message: "Media removed from custom watchlist successfully",
    }
  },
})
