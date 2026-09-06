import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  ScoreSchema,
  ConnectionsSchema,
  musicSelect,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { MusicListStatus } from "@IRIS/database"

const MusicEntryResponseSchema = t.Object({
  id: t.Number(),
  musicId: t.Number(),
  albumId: t.Optional(t.Nullable(t.Number())),
  trackId: t.Optional(t.Nullable(t.Number())),
  itemType: t.Optional(t.String()),
  status: t.String(),
  score: t.Nullable(t.Number()),
  playCount: t.Number(),
  progress: t.Optional(t.Number()),
  notes: t.Nullable(t.String()),
  private: t.Boolean(),
  startedAt: t.Nullable(t.String()),
  completedAt: t.Optional(t.Nullable(t.String())),
  connections: t.Optional(t.Any()),
  createdAt: t.String(),
  updatedAt: t.String(),
})

const MusicMutationBodySchema = t.Object({
  status: t.Optional(
    t.Union([
      t.Literal("PLANNING"),
      t.Literal("LISTENING"),
      t.Literal("COMPLETED"),
      t.Literal("ON_HOLD"),
      t.Literal("DROPPED"),
    ])
  ),
  score: ScoreSchema,
  playCount: t.Optional(t.Number({ minimum: 0 })),
  progress: t.Optional(t.Number({ minimum: 0 })),
  notes: t.Optional(t.Nullable(t.String())),
  private: t.Optional(t.Boolean()),
  startedAt: t.Optional(t.Nullable(t.String())),
  connections: ConnectionsSchema,
})

const MusicTypeQuerySchema = t.Optional(
  t.Object({
    type: t.Optional(t.Union([t.Literal("TRACK"), t.Literal("ALBUM")])),
  })
)

export default defineRoute({
  schemas: {
    GET: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Music ID" }),
      }),
      query: MusicTypeQuerySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          inList: t.Boolean(),
          entry: t.Nullable(MusicEntryResponseSchema),
          media: t.Optional(t.Nullable(t.Any())),
        }),
      },
      detail: {
        summary: "Check and get music list entry by music ID",
        tags: ["Lists - Music"],
      },
    },
    PUT: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Music ID" }),
      }),
      query: MusicTypeQuerySchema,
      body: MusicMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: MusicEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Update or create music list entry by music ID",
        tags: ["Lists - Music"],
      },
    },
    PATCH: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Music ID" }),
      }),
      query: MusicTypeQuerySchema,
      body: MusicMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: MusicEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Partially update music list entry by music ID",
        tags: ["Lists - Music"],
      },
    },
    DELETE: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Music ID" }),
      }),
      query: MusicTypeQuerySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete music from user list",
        tags: ["Lists - Music"],
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

    const entry = await prisma.musicList.findUnique({
      where: {
        userId_musicId: {
          userId: dbUser.id,
          musicId: id,
        },
      },
      include: {
        music: { select: musicSelect },
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
        musicId: entry.musicId,
        albumId: entry.music?.type === "ALBUM" ? entry.musicId : (entry.music?.albumId ?? null),
        trackId: entry.music?.type === "TRACK" ? entry.musicId : null,
        itemType: entry.music?.type ?? "TRACK",
        status: entry.status,
        score: entry.score,
        progress: entry.playCount,
        playCount: entry.playCount,
        notes: entry.notes,
        private: entry.private,
        startedAt: entry.startedAt ? entry.startedAt.toISOString() : null,
        completedAt: entry.completedAt ? entry.completedAt.toISOString() : null,
        connections: entry.connections,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      },
      media: entry.music,
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
    const music = await prisma.music.findUnique({ where: { id }, select: { id: true, type: true } })
    if (!music) {
      throw new NotFound(`Music with ID ${id} does not exist`)
    }

    const payload = (body ?? {}) as any
    const startedAt =
      payload.startedAt !== undefined
        ? payload.startedAt
          ? new Date(payload.startedAt)
          : null
        : undefined

    const plays =
      payload.playCount !== undefined ? payload.playCount : payload.progress

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as MusicListStatus } : {}),
      ...(payload.score !== undefined ? { score: payload.score } : {}),
      ...(plays !== undefined ? { playCount: plays } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.private !== undefined ? { private: payload.private } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(payload.connections !== undefined
        ? { connections: payload.connections }
        : {}),
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
        status: payload.status ?? "PLANNING",
        score: payload.score ?? null,
        playCount: plays ?? 0,
        notes: payload.notes ?? null,
        private: payload.private ?? false,
        startedAt: startedAt ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    return {
      success: true,
      message: "Music list entry updated successfully",
      entry: {
        id: result.id,
        musicId: id,
        albumId: music.type === "ALBUM" ? id : null,
        trackId: music.type === "TRACK" ? id : null,
        itemType: music.type,
        status: result.status,
        score: result.score,
        progress: result.playCount,
        playCount: result.playCount,
        notes: result.notes,
        private: result.private,
        startedAt: result.startedAt ? result.startedAt.toISOString() : null,
        completedAt: result.completedAt ? result.completedAt.toISOString() : null,
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
    const music = await prisma.music.findUnique({ where: { id }, select: { id: true, type: true } })
    if (!music) {
      throw new NotFound(`Music with ID ${id} does not exist`)
    }

    const payload = (body ?? {}) as any
    const startedAt =
      payload.startedAt !== undefined
        ? payload.startedAt
          ? new Date(payload.startedAt)
          : null
        : undefined

    const plays =
      payload.playCount !== undefined ? payload.playCount : payload.progress

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as MusicListStatus } : {}),
      ...(payload.score !== undefined ? { score: payload.score } : {}),
      ...(plays !== undefined ? { playCount: plays } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.private !== undefined ? { private: payload.private } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(payload.connections !== undefined
        ? { connections: payload.connections }
        : {}),
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
        status: payload.status ?? "PLANNING",
        score: payload.score ?? null,
        playCount: plays ?? 0,
        notes: payload.notes ?? null,
        private: payload.private ?? false,
        startedAt: startedAt ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    return {
      success: true,
      message: "Music list entry updated successfully",
      entry: {
        id: result.id,
        musicId: id,
        albumId: music.type === "ALBUM" ? id : null,
        trackId: music.type === "TRACK" ? id : null,
        itemType: music.type,
        status: result.status,
        score: result.score,
        progress: result.playCount,
        playCount: result.playCount,
        notes: result.notes,
        private: result.private,
        startedAt: result.startedAt ? result.startedAt.toISOString() : null,
        completedAt: result.completedAt ? result.completedAt.toISOString() : null,
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

    const existing = await prisma.musicList.findUnique({
      where: {
        userId_musicId: {
          userId: dbUser.id,
          musicId: id,
        },
      },
    })

    if (!existing) {
      throw new NotFound("Music is not on user's list")
    }

    await prisma.musicList.delete({
      where: { id: existing.id },
    })

    return {
      success: true,
      message: "Music removed from list successfully",
    }
  },
})
