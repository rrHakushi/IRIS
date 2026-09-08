import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  ScoreSchema,
  ConnectionsSchema,
  HistoryArraySchema,
  animeSelect,
  recordEntryMutationActivity,
} from "@/modules/IRIS-list/helpers"
import { NotFound, BadRequest } from "@/utils/errors"
import { AnimeListStatus } from "@IRIS/database"
import { syncConnectionMedia } from "@/services/connections/connection-media-sync.service.js"
import { recordMediaListActivity } from "@/services/activity.service.js"

const AnimeEntryResponseSchema = t.Object({
  id: t.Number(),
  animeId: t.Number(),
  status: t.String(),
  progress: t.Number(),
  score: t.Nullable(t.Number()),
  notes: t.Nullable(t.String()),
  rewatched: t.Number(),
  private: t.Boolean(),
  startedAt: t.Nullable(t.String()),
  completedAt: t.Nullable(t.String()),
  rewatchHistory: t.Optional(t.Any()),
  connections: t.Optional(t.Any()),
  createdAt: t.String(),
  updatedAt: t.String(),
})

const AnimeMutationBodySchema = t.Object({
  status: t.Optional(
    t.Union([
      t.Literal("PLANNING"),
      t.Literal("WATCHING"),
      t.Literal("COMPLETED"),
      t.Literal("ON_HOLD"),
      t.Literal("DROPPED"),
    ])
  ),
  progress: t.Optional(t.Number({ minimum: 0 })),
  score: ScoreSchema,
  notes: t.Optional(t.Nullable(t.String())),
  rewatched: t.Optional(t.Number({ minimum: 0 })),
  private: t.Optional(t.Boolean()),
  startedAt: t.Optional(t.Nullable(t.String())),
  completedAt: t.Optional(t.Nullable(t.String())),
  rewatchHistory: HistoryArraySchema,
  connections: ConnectionsSchema,
})

export default defineRoute({
  schemas: {
    GET: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Anime ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          inList: t.Boolean(),
          entry: t.Nullable(AnimeEntryResponseSchema),
          media: t.Optional(t.Nullable(t.Any())),
        }),
      },
      detail: {
        summary: "Check and get anime list entry by anime ID",
        tags: ["Lists - Anime"],
      },
    },
    PUT: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Anime ID" }),
      }),
      body: AnimeMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: AnimeEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Upsert anime list entry by anime ID",
        tags: ["Lists - Anime"],
      },
    },
    PATCH: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Anime ID" }),
      }),
      body: AnimeMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: AnimeEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Partially update anime list entry by anime ID",
        tags: ["Lists - Anime"],
      },
    },
    DELETE: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Anime ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete anime from user list",
        tags: ["Lists - Anime"],
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

    const entry = await prisma.animeList.findUnique({
      where: {
        userId_animeId: {
          userId: dbUser.id,
          animeId: id,
        },
      },
      include: {
        anime: { select: animeSelect },
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
        animeId: entry.animeId,
        status: entry.status,
        progress: entry.progress,
        score: entry.score,
        notes: entry.notes,
        rewatched: entry.rewatched,
        private: entry.private,
        startedAt: entry.startedAt ? entry.startedAt.toISOString() : null,
        completedAt: entry.completedAt ? entry.completedAt.toISOString() : null,
        rewatchHistory: entry.rewatchHistory,
        connections: entry.connections,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      },
      media: entry.anime,
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

    const animeExists = await prisma.anime.findUnique({
      where: { id },
      select: {
        id: true,
        episodeCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!animeExists) {
      throw new NotFound(`Anime with ID ${id} does not exist`)
    }

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

    const existing = await prisma.animeList.findUnique({
      where: {
        userId_animeId: {
          userId: dbUser.id,
          animeId: id,
        },
      },
      select: { id: true, progress: true, score: true, status: true },
    })

    let targetProgress =
      payload.progress !== undefined ? payload.progress : existing?.progress
    if (
      animeExists.episodeCount &&
      animeExists.episodeCount > 0 &&
      targetProgress !== undefined &&
      targetProgress > animeExists.episodeCount
    ) {
      targetProgress = animeExists.episodeCount
    }

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as AnimeListStatus } : {}),
      ...(targetProgress !== undefined ? { progress: targetProgress } : {}),
      ...(payload.score !== undefined ? { score: payload.score } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.rewatched !== undefined
        ? { rewatched: payload.rewatched }
        : {}),
      ...(payload.private !== undefined ? { private: payload.private } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(payload.rewatchHistory !== undefined
        ? { rewatchHistory: payload.rewatchHistory }
        : {}),
      ...(payload.connections !== undefined
        ? { connections: payload.connections }
        : {}),
    }

    const createProgress =
      payload.progress !== undefined
        ? animeExists.episodeCount && animeExists.episodeCount > 0
          ? Math.min(payload.progress, animeExists.episodeCount)
          : payload.progress
        : 0

    const result = await prisma.animeList.upsert({
      where: {
        userId_animeId: {
          userId: dbUser.id,
          animeId: id,
        },
      },
      create: {
        userId: dbUser.id,
        animeId: id,
        status: payload.status ?? "PLANNING",
        progress: createProgress,
        score: payload.score ?? null,
        notes: payload.notes ?? null,
        rewatched: payload.rewatched ?? 0,
        private: payload.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        rewatchHistory: payload.rewatchHistory ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    const connectionsToSync = payload.connections ?? result.connections
    if (
      connectionsToSync &&
      typeof connectionsToSync === "object" &&
      Object.keys(connectionsToSync).length > 0
    ) {
      await syncConnectionMedia({
        userId: dbUser.id,
        username: dbUser.username,
        animeId: id,
        animeTitle:
          animeExists.titlePrimary || animeExists.titleSecondary || "Anime",
        entry: {
          status: result.status,
          progress: result.progress,
          score: result.score,
          notes: result.notes,
          rewatched: result.rewatched,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
        },
        connections: connectionsToSync,
        prisma,
      })
    }

    recordEntryMutationActivity({
      userId: dbUser.id,
      mediaType: "ANIME",
      mediaId: id,
      media: animeExists,
      existing,
      result,
      payload,
    })

    return {
      success: true,
      message: "Anime list entry updated successfully",
      entry: {
        id: result.id,
        animeId: result.animeId,
        status: result.status,
        progress: result.progress,
        score: result.score,
        notes: result.notes,
        rewatched: result.rewatched,
        private: result.private,
        startedAt: result.startedAt ? result.startedAt.toISOString() : null,
        completedAt: result.completedAt
          ? result.completedAt.toISOString()
          : null,
        rewatchHistory: result.rewatchHistory,
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

    const animeExists = await prisma.anime.findUnique({
      where: { id },
      select: {
        id: true,
        episodeCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!animeExists) {
      throw new NotFound(`Anime with ID ${id} does not exist`)
    }

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

    const existing = await prisma.animeList.findUnique({
      where: {
        userId_animeId: {
          userId: dbUser.id,
          animeId: id,
        },
      },
      select: { id: true, progress: true, score: true, status: true },
    })

    let targetProgress =
      payload.progress !== undefined ? payload.progress : existing?.progress
    if (
      animeExists.episodeCount &&
      animeExists.episodeCount > 0 &&
      targetProgress !== undefined &&
      targetProgress > animeExists.episodeCount
    ) {
      targetProgress = animeExists.episodeCount
    }

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as AnimeListStatus } : {}),
      ...(targetProgress !== undefined ? { progress: targetProgress } : {}),
      ...(payload.score !== undefined ? { score: payload.score } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.rewatched !== undefined
        ? { rewatched: payload.rewatched }
        : {}),
      ...(payload.private !== undefined ? { private: payload.private } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(payload.rewatchHistory !== undefined
        ? { rewatchHistory: payload.rewatchHistory }
        : {}),
      ...(payload.connections !== undefined
        ? { connections: payload.connections }
        : {}),
    }

    const createProgress =
      payload.progress !== undefined
        ? animeExists.episodeCount && animeExists.episodeCount > 0
          ? Math.min(payload.progress, animeExists.episodeCount)
          : payload.progress
        : 0

    const result = await prisma.animeList.upsert({
      where: {
        userId_animeId: {
          userId: dbUser.id,
          animeId: id,
        },
      },
      create: {
        userId: dbUser.id,
        animeId: id,
        status: payload.status ?? "PLANNING",
        progress: createProgress,
        score: payload.score ?? null,
        notes: payload.notes ?? null,
        rewatched: payload.rewatched ?? 0,
        private: payload.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        rewatchHistory: payload.rewatchHistory ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    const patchConnectionsToSync = payload.connections ?? result.connections
    if (
      patchConnectionsToSync &&
      typeof patchConnectionsToSync === "object" &&
      Object.keys(patchConnectionsToSync).length > 0
    ) {
      await syncConnectionMedia({
        userId: dbUser.id,
        username: dbUser.username,
        animeId: id,
        animeTitle:
          animeExists.titlePrimary || animeExists.titleSecondary || "Anime",
        entry: {
          status: result.status,
          progress: result.progress,
          score: result.score,
          notes: result.notes,
          rewatched: result.rewatched,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
        },
        connections: patchConnectionsToSync,
        prisma,
      })
    }

    recordEntryMutationActivity({
      userId: dbUser.id,
      mediaType: "ANIME",
      mediaId: id,
      media: animeExists,
      existing,
      result,
      payload,
    })

    return {
      success: true,
      message: "Anime list entry updated successfully",
      entry: {
        id: result.id,
        animeId: result.animeId,
        status: result.status,
        progress: result.progress,
        score: result.score,
        notes: result.notes,
        rewatched: result.rewatched,
        private: result.private,
        startedAt: result.startedAt ? result.startedAt.toISOString() : null,
        completedAt: result.completedAt
          ? result.completedAt.toISOString()
          : null,
        rewatchHistory: result.rewatchHistory,
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

    const existing = await prisma.animeList.findUnique({
      where: {
        userId_animeId: {
          userId: dbUser.id,
          animeId: id,
        },
      },
    })

    if (!existing) {
      throw new NotFound("Anime is not on user's list")
    }

    await prisma.animeList.delete({
      where: { id: existing.id },
    })

    const anime = await prisma.anime.findUnique({
      where: { id },
      select: {
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "ANIME",
      mediaId: id,
      action: "REMOVED",
      title: anime?.titlePrimary || anime?.titleSecondary || "Anime",
      coverImage: anime?.coverImage,
      bannerImage: anime?.bannerImage,
      format: anime?.format,
      status: existing.status,
      progress: existing.progress,
      score: existing.score,
      isPrivate: existing.private,
    })

    return {
      success: true,
      message: "Anime removed from list successfully",
    }
  },
})
