import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  QuickAddResponseSchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { recordMediaListActivity } from "@/services/activity.service.js"

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

  async POST({ params, prisma, session }) {
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
      select: {
        id: true,
        type: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
      },
    })

    if (!music) {
      throw new NotFound(`Music with ID ${id} does not exist`)
    }

    const existing = await prisma.musicList.findUnique({
      where: {
        userId_musicId: {
          userId: dbUser.id,
          musicId: id,
        },
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
        musicId: id,
        status: "LISTENING",
        playCount: 0,
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "MUSIC",
      mediaId: id,
      action: "ADDED",
      title: music.titlePrimary || music.titleSecondary || "Music",
      coverImage: music.coverImage,
      format: music.type,
      status: created.status,
      progress: created.playCount,
      score: null,
      isPrivate: false,
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added music to list with status LISTENING",
      entry: {
        id: created.id,
        musicId: id,
        itemType: music.type,
        status: created.status,
        playCount: created.playCount,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },
})
