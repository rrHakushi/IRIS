import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  QuickAddResponseSchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Music ID" }),
    }),
    query: t.Optional(
      t.Object({
        type: t.Optional(t.Union([t.Literal("TRACK"), t.Literal("ALBUM")])),
      })
    ),
    response: {
      200: QuickAddResponseSchema,
    },
    detail: {
      summary: "Quick add music to list with status LISTENING",
      tags: ["Lists - Music"],
    },
  },

  async POST({ params, query, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)
    const targetType = (query as any)?.type as "TRACK" | "ALBUM" | undefined

    let track: { id: number } | null = null
    let album: { id: number } | null = null

    if (targetType === "ALBUM") {
      album = await prisma.musicAlbum.findUnique({ where: { id }, select: { id: true } })
    } else if (targetType === "TRACK") {
      track = await prisma.musicTrack.findUnique({ where: { id }, select: { id: true } })
    } else {
      ;[track, album] = await Promise.all([
        prisma.musicTrack.findUnique({ where: { id }, select: { id: true } }),
        prisma.musicAlbum.findUnique({ where: { id }, select: { id: true } }),
      ])
    }

    if (!track && !album) {
      throw new NotFound(`Music with ID ${id} does not exist`)
    }

    const isAlbum = targetType ? targetType === "ALBUM" : album && !track ? true : false
    const existing = await prisma.musicList.findFirst({
      where: {
        userId: dbUser.id,
        ...(isAlbum ? { albumId: (album || { id }).id } : { trackId: (track || { id }).id }),
      },
    })

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        message: "Music is already in list",
      }
    }

    const created = await prisma.musicList.create({
      data: {
        userId: dbUser.id,
        itemType: isAlbum ? "ALBUM" : "TRACK",
        ...(isAlbum ? { albumId: (album || { id }).id } : { trackId: (track || { id }).id }),
        status: "LISTENING",
        playCount: 0,
      },
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added music to list with status LISTENING",
      entry: {
        id: created.id,
        musicId: id,
        itemType: created.itemType,
        status: created.status,
        playCount: created.playCount,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },
})
