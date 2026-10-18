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
      id: t.Number({ minimum: 1, description: "Game ID" }),
    }),
    response: {
      200: QuickAddResponseSchema,
    },
    detail: {
      summary: "Quick add game to list with status PLANNING",
      tags: ["Lists - Game"],
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

    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!game) {
      throw new NotFound(`Game with ID ${id} does not exist`)
    }

    const existing = await prisma.gameList.findUnique({
      where: {
        userId_gameId: {
          userId: dbUser.id,
          gameId: id,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        message: "Game is already in list",
      }
    }

    const created = await prisma.gameList.create({
      data: {
        userId: dbUser.id,
        gameId: id,
        status: "PLANNING",
        progress: 0,
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "GAME",
      mediaId: id,
      action: "ADDED",
      title: game.titlePrimary || game.titleSecondary || "Game",
      coverImage: game.coverImage,
      bannerImage: game.bannerImage,
      status: created.status,
      progress: created.progress,
      isPrivate: false,
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added game to list with status PLANNING",
      entry: {
        id: created.id,
        gameId: created.gameId,
        status: created.status,
        progress: created.progress,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },
})
