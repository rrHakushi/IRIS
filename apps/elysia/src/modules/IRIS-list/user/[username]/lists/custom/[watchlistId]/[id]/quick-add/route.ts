import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  QuickAddResponseSchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import type { MediaType } from "@IRIS/database"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      watchlistId: t.String({ description: "Watchlist UUID" }),
      id: t.Number({ minimum: 1, description: "Media ID" }),
    }),
    body: t.Object({
      mediaType: t.Union([
        t.Literal("ANIME"),
        t.Literal("MANGA"),
        t.Literal("MOVIE"),
        t.Literal("TV"),
        t.Literal("GAME"),
        t.Literal("BOOK"),
        t.Literal("MUSIC"),
        t.Literal("MUSIC_ALBUM"),
        t.Literal("MUSIC_TRACK"),
      ]),
    }),
    response: {
      200: QuickAddResponseSchema,
    },
    detail: {
      summary: "Quick add media to custom watchlist",
      tags: ["Lists - Custom Watchlist"],
    },
  },

  async POST({ params, body, prisma, session }) {
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

    const rawMediaType = (body as any).mediaType
    const mediaId = Number(params.id)
    let resolvedMediaType = rawMediaType as MediaType

    if (rawMediaType === "MUSIC") {
      const isAlbum = await prisma.musicAlbum.findUnique({
        where: { id: mediaId },
        select: { id: true },
      })
      resolvedMediaType = isAlbum
        ? ("MUSIC_ALBUM" as MediaType)
        : ("MUSIC_TRACK" as MediaType)
    }

    const existing = await prisma.watchlistEntry.findUnique({
      where: {
        watchlistId_mediaType_mediaId: {
          watchlistId: watchlist.id,
          mediaType: resolvedMediaType,
          mediaId,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        message: "Media is already in this custom watchlist",
      }
    }

    const foreignKeyField: any = {
      animeId: resolvedMediaType === "ANIME" ? mediaId : null,
      mangaId: resolvedMediaType === "MANGA" ? mediaId : null,
      movieId: resolvedMediaType === "MOVIE" ? mediaId : null,
      tvId: resolvedMediaType === "TV" ? mediaId : null,
      gameId: resolvedMediaType === "GAME" ? mediaId : null,
      bookId: resolvedMediaType === "BOOK" ? mediaId : null,
      albumId: resolvedMediaType === "MUSIC_ALBUM" ? mediaId : null,
      trackId: resolvedMediaType === "MUSIC_TRACK" ? mediaId : null,
    }

    const created = await prisma.watchlistEntry.create({
      data: {
        watchlistId: watchlist.id,
        mediaType: resolvedMediaType,
        mediaId,
        ...foreignKeyField,
      },
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added media to custom watchlist",
      entry: {
        id: created.id,
        watchlistId: created.watchlistId,
        mediaType: created.mediaType,
        mediaId: created.mediaId,
        addedAt: created.addedAt.toISOString(),
      },
    }
  },
})
