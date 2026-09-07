import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  ScoreSchema,
  ConnectionsSchema,
  HistoryArraySchema,
  gameSelect,
  recordEntryMutationActivity,
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

const GameMutationBodySchema = t.Object({
  status: t.Optional(
    t.Union([
      t.Literal("PLANNING"),
      t.Literal("PLAYING"),
      t.Literal("COMPLETED"),
      t.Literal("ON_HOLD"),
      t.Literal("DROPPED"),
    ])
  ),
  progress: t.Optional(t.Number({ minimum: 0 })),
  score: ScoreSchema,
  notes: t.Optional(t.Nullable(t.String())),
  replayed: t.Optional(t.Number({ minimum: 0 })),
  private: t.Optional(t.Boolean()),
  startedAt: t.Optional(t.Nullable(t.String())),
  completedAt: t.Optional(t.Nullable(t.String())),
  replayHistory: HistoryArraySchema,
  connections: ConnectionsSchema,
})

export default defineRoute({
  schemas: {
    GET: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Game ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          inList: t.Boolean(),
          entry: t.Nullable(GameEntryResponseSchema),
          media: t.Optional(t.Nullable(t.Any())),
        }),
      },
      detail: {
        summary: "Check and get game list entry by game ID",
        tags: ["Lists - Game"],
      },
    },
    PUT: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Game ID" }),
      }),
      body: GameMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: GameEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Upsert game list entry by game ID",
        tags: ["Lists - Game"],
      },
    },
    PATCH: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Game ID" }),
      }),
      body: GameMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: GameEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Partially update game list entry by game ID",
        tags: ["Lists - Game"],
      },
    },
    DELETE: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Game ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete game from user list",
        tags: ["Lists - Game"],
      },
    },
  },

  async GET({ params, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const id = Number(params.id)

    const entry = await prisma.gameList.findUnique({
      where: {
        userId_gameId: {
          userId: dbUser.id,
          gameId: id,
        },
      },
      include: {
        game: { select: gameSelect },
      },
    })

    if (!entry || (entry.private && !isOwner)) {
      return {
        success: true,
        inList: false,
        entry: null,
      }
    }

    return {
      success: true,
      inList: true,
      entry: {
        id: entry.id,
        gameId: entry.gameId,
        status: entry.status,
        progress: entry.progress,
        score: entry.score,
        notes: entry.notes,
        replayed: entry.replayed,
        private: entry.private,
        startedAt: entry.startedAt ? entry.startedAt.toISOString() : null,
        completedAt: entry.completedAt ? entry.completedAt.toISOString() : null,
        replayHistory: entry.replayHistory,
        connections: entry.connections,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      },
      media: entry.game,
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

    const id = Number(params.id)

    const gameExists = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!gameExists) {
      throw new NotFound(`Game with ID ${id} does not exist`)
    }

    const existing = await prisma.gameList.findUnique({
      where: {
        userId_gameId: {
          userId: dbUser.id,
          gameId: id,
        },
      },
      select: {
        id: true,
        status: true,
        progress: true,
        score: true,
        private: true,
      },
    })

    const payload = (body ?? {}) as any
    const startedAt =
      payload.startedAt !== undefined
        ? payload.startedAt
          ? new Date(payload.startedAt)
          : null
        : undefined
    const completedAt =
      payload.completedAt !== undefined
        ? payload.completedAt
          ? new Date(payload.completedAt)
          : null
        : undefined

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as GameListStatus } : {}),
      ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
      ...(payload.score !== undefined ? { score: payload.score } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.replayed !== undefined ? { replayed: payload.replayed } : {}),
      ...(payload.private !== undefined ? { private: payload.private } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(payload.replayHistory !== undefined
        ? { replayHistory: payload.replayHistory }
        : {}),
      ...(payload.connections !== undefined
        ? { connections: payload.connections }
        : {}),
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
        status: payload.status ?? "PLANNING",
        progress: payload.progress ?? 0,
        score: payload.score ?? null,
        notes: payload.notes ?? null,
        replayed: payload.replayed ?? 0,
        private: payload.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        replayHistory: payload.replayHistory ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    recordEntryMutationActivity({
      userId: dbUser.id,
      mediaType: "GAME",
      mediaId: id,
      media: gameExists,
      existing,
      result,
      payload,
    })

    return {
      success: true,
      message: "Game list entry updated successfully",
      entry: {
        id: result.id,
        gameId: result.gameId,
        status: result.status,
        progress: result.progress,
        score: result.score,
        notes: result.notes,
        replayed: result.replayed,
        private: result.private,
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

  async PATCH({ params, body, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)

    const gameExists = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!gameExists) {
      throw new NotFound(`Game with ID ${id} does not exist`)
    }

    const existing = await prisma.gameList.findUnique({
      where: {
        userId_gameId: {
          userId: dbUser.id,
          gameId: id,
        },
      },
      select: {
        id: true,
        status: true,
        progress: true,
        score: true,
        private: true,
      },
    })

    const payload = (body ?? {}) as any
    const startedAt =
      payload.startedAt !== undefined
        ? payload.startedAt
          ? new Date(payload.startedAt)
          : null
        : undefined
    const completedAt =
      payload.completedAt !== undefined
        ? payload.completedAt
          ? new Date(payload.completedAt)
          : null
        : undefined

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as GameListStatus } : {}),
      ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
      ...(payload.score !== undefined ? { score: payload.score } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.replayed !== undefined ? { replayed: payload.replayed } : {}),
      ...(payload.private !== undefined ? { private: payload.private } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(payload.replayHistory !== undefined
        ? { replayHistory: payload.replayHistory }
        : {}),
      ...(payload.connections !== undefined
        ? { connections: payload.connections }
        : {}),
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
        status: payload.status ?? "PLANNING",
        progress: payload.progress ?? 0,
        score: payload.score ?? null,
        notes: payload.notes ?? null,
        replayed: payload.replayed ?? 0,
        private: payload.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        replayHistory: payload.replayHistory ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    recordEntryMutationActivity({
      userId: dbUser.id,
      mediaType: "GAME",
      mediaId: id,
      media: gameExists,
      existing,
      result,
      payload,
    })

    return {
      success: true,
      message: "Game list entry updated successfully",
      entry: {
        id: result.id,
        gameId: result.gameId,
        status: result.status,
        progress: result.progress,
        score: result.score,
        notes: result.notes,
        replayed: result.replayed,
        private: result.private,
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

  async DELETE({ params, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)

    const existing = await prisma.gameList.findUnique({
      where: {
        userId_gameId: {
          userId: dbUser.id,
          gameId: id,
        },
      },
    })

    if (!existing) {
      throw new NotFound("Game is not on user's list")
    }

    await prisma.gameList.delete({
      where: { id: existing.id },
    })

    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "GAME",
      mediaId: id,
      action: "REMOVED",
      title: game?.titlePrimary || game?.titleSecondary || "Game",
      coverImage: game?.coverImage,
      bannerImage: game?.bannerImage,
      status: existing.status,
      progress: existing.progress,
      score: existing.score,
      isPrivate: existing.private,
    })

    return {
      success: true,
      message: "Game removed from list successfully",
    }
  },
})
