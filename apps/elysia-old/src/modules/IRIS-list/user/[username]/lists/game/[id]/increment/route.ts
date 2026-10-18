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

const GameEntryResponseSchema = t.Object({
  id: t.Number(),
  gameId: t.Number(),
  status: t.String(),
  progress: t.Number(),
  score: t.Nullable(t.Number()),
  notes: t.Nullable(t.String()),
  replayed: t.Number(),
  private: t.Boolean(),
  startedAt: t.Nullable(t.String()),
  completedAt: t.Nullable(t.String()),
  replayHistory: t.Optional(t.Any()),
  connections: t.Optional(t.Any()),
  createdAt: t.String(),
  updatedAt: t.String(),
})

const GameIncrementBodySchema = t.Optional(
  t.Object({
    count: t.Optional(t.Number({ default: 1, minimum: 1 })),
    status: t.Optional(
      t.Union([
        t.Literal("PLANNING"),
        t.Literal("PLAYING"),
        t.Literal("COMPLETED"),
        t.Literal("ON_HOLD"),
        t.Literal("DROPPED"),
      ])
    ),
    connections: t.Optional(t.Any()),
  })
)

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Game ID" }),
    }),
    body: GameIncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: GameEntryResponseSchema,
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
      (body as any)?.status ?? (existing?.status as GameListStatus) ?? "PLAYING"
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
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus,
        progress: newProgress,
        completedAt,
        ...(existing?.status === "PLANNING" ? { startedAt: new Date() } : {}),
        ...((body as any)?.connections !== undefined
          ? { connections: (body as any).connections }
          : {}),
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
        score: result.score ?? null,
        notes: result.notes ?? null,
        replayed: result.replayed ?? 0,
        private: result.private ?? false,
        startedAt: result.startedAt ? result.startedAt.toISOString() : null,
        completedAt: result.completedAt
          ? result.completedAt.toISOString()
          : null,
        replayHistory: result.replayHistory,
        connections: result.connections,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      },
    }
  },
})
