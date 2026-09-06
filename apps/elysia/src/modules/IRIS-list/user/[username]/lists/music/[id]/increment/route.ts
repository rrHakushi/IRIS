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

  async POST({ params, body, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)
    const music = await prisma.music.findUnique({
      where: { id },
      select: { id: true, type: true },
    })

    if (!music) {
      throw new NotFound(`Music with ID ${id} does not exist`)
    }

    const count = (body as any)?.count ?? 1

    const existing = await prisma.musicList.findUnique({
      where: {
        userId_musicId: {
          userId: dbUser.id,
          musicId: id,
        },
      },
    })

    const currentPlayCount = existing ? existing.playCount : 0
    const newPlayCount = currentPlayCount + count
    let newStatus: MusicListStatus =
      (existing?.status as MusicListStatus) ?? "LISTENING"

    if (newStatus === "PLANNING") {
      newStatus = "LISTENING"
    }

    const result = await prisma.musicList.upsert({
      where: {
        userId_musicId: {
          userId: dbUser.id,
          musicId: id,
        },
      },
      create: {
        userId: dbUser.id,
        musicId: id,
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
        itemType: music.type,
        status: result.status,
        playCount: result.playCount,
      },
    }
  },
})
