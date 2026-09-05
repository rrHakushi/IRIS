import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  IncrementBodySchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { MusicListStatus } from "@IRIS/database"

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
    body: IncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: t.Object({
          id: t.Number(),
          musicId: t.Number(),
          itemType: t.String(),
          status: t.String(),
          playCount: t.Number(),
        }),
      }),
    },
    detail: {
      summary: "Increment music play count",
      tags: ["Lists - Music"],
    },
  },

  async POST({ params, query, body, prisma, session }) {
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
    const count = (body as any)?.count ?? 1

    const existing = await prisma.musicList.findFirst({
      where: {
        userId: dbUser.id,
        ...(isAlbum ? { albumId: (album || { id }).id } : { trackId: (track || { id }).id }),
      },
    })

    const currentPlayCount = existing ? existing.playCount : 0
    const newPlayCount = currentPlayCount + count
    let newStatus: MusicListStatus =
      (existing?.status as MusicListStatus) ?? "LISTENING"

    if (newStatus === "PLANNING") {
      newStatus = "LISTENING"
    }

    const whereUnique = isAlbum
      ? { userId_albumId: { userId: dbUser.id, albumId: (album || { id }).id } }
      : { userId_trackId: { userId: dbUser.id, trackId: (track || { id }).id } }

    const result = await prisma.musicList.upsert({
      where: whereUnique,
      create: {
        userId: dbUser.id,
        itemType: isAlbum ? "ALBUM" : "TRACK",
        ...(isAlbum ? { albumId: (album || { id }).id } : { trackId: (track || { id }).id }),
        status: newStatus,
        playCount: newPlayCount,
      },
      update: {
        playCount: newPlayCount,
        status: newStatus,
      },
    })

    return {
      success: true,
      message: `Play count incremented to ${newPlayCount}`,
      entry: {
        id: result.id,
        musicId: id,
        itemType: result.itemType,
        status: result.status,
        playCount: result.playCount,
      },
    }
  },
})
