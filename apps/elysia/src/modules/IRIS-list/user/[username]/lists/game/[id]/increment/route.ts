import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  IncrementBodySchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { GameListStatus } from "@IRIS/database"
import { recordMediaListActivity } from "@/services/activity.service.js"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Game ID" }),
    }),
    body: IncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: t.Object({
          id: t.Number(),
          gameId: t.Number(),
          status: t.String(),
          progress: t.Number(),
          completedAt: t.Nullable(t.String()),
        }),
      }),
    },
    detail: {
      summary: "Increment game progress",
      tags: ["Lists - Game"],
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

    const count = (body as any)?.count ?? 1

    const existing = await prisma.gameList.findUnique({
      where: {
        userId_gameId: {
          userId: dbUser.id,
          gameId: id,
        },
      },
    })

    const currentProgress = existing ? existing.progress : 0
    const newProgress = currentProgress + count
    let newStatus: GameListStatus =
      (existing?.status as GameListStatus) ?? "PLAYING"
    const completedAt = existing?.completedAt ?? null

    if (newStatus === "PLANNING") {
      newStatus = "PLAYING"
    }

    const result = await prisma.gameList.upsert({
      where: {
        userId_gameId: {
          userId: dbUser.id,
          gameId: id,
        },
      },
      create: {
        userId: dbUser.id,
        gameId: id,
        status: newStatus,
        progress: newProgress,
        startedAt: new Date(),
        completedAt,
      },
      update: {
        status: newStatus,
        progress: newProgress,
        completedAt,
        ...(existing?.status === "PLANNING" ? { startedAt: new Date() } : {}),
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "GAME",
      mediaId: id,
      action: "PROGRESS_CHANGED",
      title: game.titlePrimary || game.titleSecondary || "Game",
      coverImage: game.coverImage,
      bannerImage: game.bannerImage,
      status: result.status,
      progress: result.progress,
      score: existing?.score ?? null,
      prevStatus: existing?.status,
      prevProgress: currentProgress,
      prevScore: existing?.score,
      isPrivate: existing?.private ?? false,
    })

    return {
      success: true,
      message: `Game progress incremented to ${result.progress}`,
      entry: {
        id: result.id,
        gameId: result.gameId,
        status: result.status,
        progress: result.progress,
        completedAt: result.completedAt
          ? result.completedAt.toISOString()
          : null,
      },
    }
  },
})
