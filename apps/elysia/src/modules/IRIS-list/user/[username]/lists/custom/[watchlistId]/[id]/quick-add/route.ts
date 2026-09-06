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

    const watchlist = await prisma.customList.findUnique({
      where: { id: params.watchlistId },
      select: { id: true, userId: true },
    })
    if (!watchlist || watchlist.userId !== dbUser.id) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    const rawMediaType = (body as any).mediaType
    const mediaId = Number(params.id)
    const resolvedMediaType = rawMediaType as MediaType

    const existing = await prisma.customListEntry.findUnique({
      where: {
        listId_mediaType_mediaId: {
          listId: watchlist.id,
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

    const isMusic =
      resolvedMediaType === "MUSIC" ||
      (resolvedMediaType as string) === "MUSIC_ALBUM" ||
      (resolvedMediaType as string) === "MUSIC_TRACK"

    const foreignKeyField: any = {
      animeId: resolvedMediaType === "ANIME" ? mediaId : null,
      mangaId: resolvedMediaType === "MANGA" ? mediaId : null,
      movieId: resolvedMediaType === "MOVIE" ? mediaId : null,
      tvId: resolvedMediaType === "TV" ? mediaId : null,
      gameId: resolvedMediaType === "GAME" ? mediaId : null,
      bookId: resolvedMediaType === "BOOK" ? mediaId : null,
      musicId: isMusic ? mediaId : null,
    }

    const created = await prisma.customListEntry.create({
      data: {
        listId: watchlist.id,
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
        watchlistId: created.listId,
        mediaType: created.mediaType,
        mediaId: created.mediaId,
        addedAt: created.addedAt.toISOString(),
      },
    }
  },
})
