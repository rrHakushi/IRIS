import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  ScoreSchema,
  ConnectionsSchema,
  HistoryArraySchema,
  tvSelect,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { TvListStatus } from "@IRIS/database"

const TvSeasonProgressSchema = t.Object({
  id: t.Number(),
  seasonNumber: t.Number(),
  status: t.String(),
  progress: t.Number(),
  score: t.Nullable(t.Number()),
  notes: t.Nullable(t.String()),
  rewatched: t.Number(),
})

const TvEntryResponseSchema = t.Object({
  id: t.Number(),
  tvId: t.Number(),
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
  seasons: t.Array(TvSeasonProgressSchema),
  watchedEpisodes: t.Array(
    t.Object({
      seasonNumber: t.Number(),
      episodeNumber: t.Number(),
      watchedAt: t.String(),
    })
  ),
  createdAt: t.String(),
  updatedAt: t.String(),
})

const TvMutationBodySchema = t.Object({
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
  seasons: t.Optional(
    t.Array(
      t.Object({
        seasonNumber: t.Number({ minimum: 0 }),
        status: t.Optional(t.String()),
        progress: t.Optional(t.Number({ minimum: 0 })),
        score: ScoreSchema,
        notes: t.Optional(t.Nullable(t.String())),
        rewatched: t.Optional(t.Number({ minimum: 0 })),
      })
    )
  ),
  watchedEpisodes: t.Optional(
    t.Array(
      t.Object({
        seasonNumber: t.Number({ minimum: 0 }),
        episodeNumber: t.Number({ minimum: 1 }),
        watchedAt: t.Optional(t.String()),
      })
    )
  ),
})

async function syncTvSeasonsAndEpisodes({
  prisma,
  tvListId,
  tv,
  payload,
  status,
  completedAt,
}: {
  prisma: any
  tvListId: number
  tv: any
  payload: any
  status: string
  completedAt?: Date | null
}) {
  // 1. Upsert season progress if specified in payload
  if (payload.seasons && Array.isArray(payload.seasons)) {
    for (const sp of payload.seasons) {
      const matchingSeason = tv.seasons.find(
        (s: any) => s.seasonNumber === sp.seasonNumber
      )
      if (matchingSeason) {
        await prisma.tvSeasonProgress.upsert({
          where: {
            tvListId_seasonNumber: {
              tvListId,
              seasonNumber: sp.seasonNumber,
            },
          },
          create: {
            tvListId,
            seasonId: matchingSeason.id,
            seasonNumber: sp.seasonNumber,
            status: (sp.status as TvListStatus) ?? "PLANNING",
            progress: sp.progress ?? 0,
            score: sp.score ?? null,
            notes: sp.notes ?? null,
            rewatched: sp.rewatched ?? 0,
          },
          update: {
            ...(sp.status ? { status: sp.status as TvListStatus } : {}),
            ...(sp.progress !== undefined ? { progress: sp.progress } : {}),
            ...(sp.score !== undefined ? { score: sp.score } : {}),
            ...(sp.notes !== undefined ? { notes: sp.notes } : {}),
            ...(sp.rewatched !== undefined ? { rewatched: sp.rewatched } : {}),
          },
        })
      }
    }
  }

  // 2. If status is COMPLETED, mark all seasons completed & all episodes watched in bulk
  if (status === "COMPLETED") {
    let totalEpisodes = 0
    if (tv.seasons && tv.seasons.length > 0) {
      const allEpisodesData: Array<{
        tvListId: number
        seasonNumber: number
        episodeNumber: number
        watchedAt: Date
      }> = []

      for (const season of tv.seasons) {
        const epCount = season.episodeCount || 0
        totalEpisodes += epCount

        await prisma.tvSeasonProgress.upsert({
          where: {
            tvListId_seasonNumber: {
              tvListId,
              seasonNumber: season.seasonNumber,
            },
          },
          create: {
            tvListId,
            seasonId: season.id,
            seasonNumber: season.seasonNumber,
            status: "COMPLETED",
            progress: epCount,
            score: null,
            notes: null,
            rewatched: 0,
          },
          update: {
            status: "COMPLETED",
            progress: epCount,
          },
        })

        for (let ep = 1; ep <= epCount; ep++) {
          allEpisodesData.push({
            tvListId,
            seasonNumber: season.seasonNumber,
            episodeNumber: ep,
            watchedAt: completedAt || new Date(),
          })
        }
      }

      if (allEpisodesData.length > 0) {
        await prisma.tvWatchedEpisode.createMany({
          data: allEpisodesData,
          skipDuplicates: true,
        })
      }
    } else if (tv.episodeCount && tv.episodeCount > 0) {
      totalEpisodes = tv.episodeCount
      const allEpisodesData: Array<{
        tvListId: number
        seasonNumber: number
        episodeNumber: number
        watchedAt: Date
      }> = []

      for (let ep = 1; ep <= tv.episodeCount; ep++) {
        allEpisodesData.push({
          tvListId,
          seasonNumber: 1,
          episodeNumber: ep,
          watchedAt: completedAt || new Date(),
        })
      }

      if (allEpisodesData.length > 0) {
        await prisma.tvWatchedEpisode.createMany({
          data: allEpisodesData,
          skipDuplicates: true,
        })
      }
    }

    if (totalEpisodes > 0) {
      await prisma.tvList.update({
        where: { id: tvListId },
        data: { progress: totalEpisodes },
      })
    }
  } else if (
    payload.watchedEpisodes &&
    Array.isArray(payload.watchedEpisodes)
  ) {
    // 3. Otherwise, synchronize watchedEpisodes array in batch
    const existingWatched = await prisma.tvWatchedEpisode.findMany({
      where: { tvListId },
      select: { id: true, seasonNumber: true, episodeNumber: true },
    })

    const targetKeySet = new Set(
      payload.watchedEpisodes.map(
        (e: any) => `${e.seasonNumber}_${e.episodeNumber}`
      )
    )
    const toDeleteIds = existingWatched
      .filter(
        (e: any) => !targetKeySet.has(`${e.seasonNumber}_${e.episodeNumber}`)
      )
      .map((e: any) => e.id)

    if (toDeleteIds.length > 0) {
      await prisma.tvWatchedEpisode.deleteMany({
        where: { id: { in: toDeleteIds } },
      })
    }

    const existingKeySet = new Set(
      existingWatched.map((e: any) => `${e.seasonNumber}_${e.episodeNumber}`)
    )
    const toAdd = payload.watchedEpisodes.filter(
      (e: any) => !existingKeySet.has(`${e.seasonNumber}_${e.episodeNumber}`)
    )

    if (toAdd.length > 0) {
      await prisma.tvWatchedEpisode.createMany({
        data: toAdd.map((e: any) => ({
          tvListId,
          seasonNumber: e.seasonNumber,
          episodeNumber: e.episodeNumber,
          watchedAt: e.watchedAt ? new Date(e.watchedAt) : new Date(),
        })),
        skipDuplicates: true,
      })
    }
  }
}

export default defineRoute({
  schemas: {
    GET: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "TV ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          inList: t.Boolean(),
          entry: t.Nullable(TvEntryResponseSchema),
          media: t.Optional(t.Nullable(t.Any())),
        }),
      },
      detail: {
        summary:
          "Check and get TV list entry with seasons and watched episodes",
        tags: ["Lists - TV"],
      },
    },
    PUT: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "TV ID" }),
      }),
      body: TvMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: TvEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Upsert TV list entry by TV ID",
        tags: ["Lists - TV"],
      },
    },
    PATCH: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "TV ID" }),
      }),
      body: TvMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: TvEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Partially update TV list entry by TV ID",
        tags: ["Lists - TV"],
      },
    },
    DELETE: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "TV ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete TV show from user list",
        tags: ["Lists - TV"],
      },
    },
  },

  async GET({ params, prisma, session }) {
    const id = Number(params.id)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const entry = await prisma.tvList.findUnique({
      where: {
        userId_tvId: {
          userId: dbUser.id,
          tvId: id,
        },
      },
      include: {
        tv: { select: tvSelect },
        seasons: { orderBy: { seasonNumber: "asc" } },
        watchedEpisodes: {
          select: {
            seasonNumber: true,
            episodeNumber: true,
            watchedAt: true,
          },
          orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
        },
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
        tvId: entry.tvId,
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
        seasons: entry.seasons.map((s) => ({
          id: s.id,
          seasonNumber: s.seasonNumber,
          status: s.status,
          progress: s.progress,
          score: s.score,
          notes: s.notes,
          rewatched: s.rewatched,
        })),
        watchedEpisodes: entry.watchedEpisodes.map((we) => ({
          seasonNumber: we.seasonNumber,
          episodeNumber: we.episodeNumber,
          watchedAt: we.watchedAt.toISOString(),
        })),
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      },
      media: entry.tv,
    }
  },

  async PUT({ params, body, prisma, session }) {
    requireAuth(session)
    const id = Number(params.id)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const tv = await prisma.tv.findUnique({
      where: { id },
      include: { seasons: true },
    })
    if (!tv) {
      throw new NotFound(`TV with ID ${id} does not exist`)
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

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as TvListStatus } : {}),
      ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
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

    const result = await prisma.tvList.upsert({
      where: {
        userId_tvId: {
          userId: dbUser.id,
          tvId: id,
        },
      },
      create: {
        userId: dbUser.id,
        tvId: id,
        status: payload.status ?? "PLANNING",
        progress: payload.progress ?? 0,
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

    await syncTvSeasonsAndEpisodes({
      prisma,
      tvListId: result.id,
      tv,
      payload,
      status: result.status,
      completedAt,
    })

    const updated = await prisma.tvList.findUnique({
      where: { id: result.id },
      include: {
        seasons: { orderBy: { seasonNumber: "asc" } },
        watchedEpisodes: {
          select: {
            seasonNumber: true,
            episodeNumber: true,
            watchedAt: true,
          },
          orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
        },
      },
    })

    return {
      success: true,
      message: "TV list entry updated successfully",
      entry: {
        id: updated!.id,
        tvId: updated!.tvId,
        status: updated!.status,
        progress: updated!.progress,
        score: updated!.score,
        notes: updated!.notes,
        rewatched: updated!.rewatched,
        private: updated!.private,
        startedAt: updated!.startedAt ? updated!.startedAt.toISOString() : null,
        completedAt: updated!.completedAt
          ? updated!.completedAt.toISOString()
          : null,
        rewatchHistory: updated!.rewatchHistory,
        connections: updated!.connections,
        seasons: updated!.seasons.map((s) => ({
          id: s.id,
          seasonNumber: s.seasonNumber,
          status: s.status,
          progress: s.progress,
          score: s.score,
          notes: s.notes,
          rewatched: s.rewatched,
        })),
        watchedEpisodes: updated!.watchedEpisodes.map((we) => ({
          seasonNumber: we.seasonNumber,
          episodeNumber: we.episodeNumber,
          watchedAt: we.watchedAt.toISOString(),
        })),
        createdAt: updated!.createdAt.toISOString(),
        updatedAt: updated!.updatedAt.toISOString(),
      },
    }
  },

  async PATCH({ params, body, prisma, session }) {
    requireAuth(session)
    const id = Number(params.id)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const tv = await prisma.tv.findUnique({
      where: { id },
      include: { seasons: true },
    })
    if (!tv) {
      throw new NotFound(`TV with ID ${id} does not exist`)
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

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as TvListStatus } : {}),
      ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
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

    const result = await prisma.tvList.upsert({
      where: {
        userId_tvId: {
          userId: dbUser.id,
          tvId: id,
        },
      },
      create: {
        userId: dbUser.id,
        tvId: id,
        status: payload.status ?? "PLANNING",
        progress: payload.progress ?? 0,
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

    await syncTvSeasonsAndEpisodes({
      prisma,
      tvListId: result.id,
      tv,
      payload,
      status: result.status,
      completedAt,
    })

    const updated = await prisma.tvList.findUnique({
      where: { id: result.id },
      include: {
        seasons: { orderBy: { seasonNumber: "asc" } },
        watchedEpisodes: {
          select: {
            seasonNumber: true,
            episodeNumber: true,
            watchedAt: true,
          },
          orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
        },
      },
    })

    return {
      success: true,
      message: "TV list entry updated successfully",
      entry: {
        id: updated!.id,
        tvId: updated!.tvId,
        status: updated!.status,
        progress: updated!.progress,
        score: updated!.score,
        notes: updated!.notes,
        rewatched: updated!.rewatched,
        private: updated!.private,
        startedAt: updated!.startedAt ? updated!.startedAt.toISOString() : null,
        completedAt: updated!.completedAt
          ? updated!.completedAt.toISOString()
          : null,
        rewatchHistory: updated!.rewatchHistory,
        connections: updated!.connections,
        seasons: updated!.seasons.map((s) => ({
          id: s.id,
          seasonNumber: s.seasonNumber,
          status: s.status,
          progress: s.progress,
          score: s.score,
          notes: s.notes,
          rewatched: s.rewatched,
        })),
        watchedEpisodes: updated!.watchedEpisodes.map((we) => ({
          seasonNumber: we.seasonNumber,
          episodeNumber: we.episodeNumber,
          watchedAt: we.watchedAt.toISOString(),
        })),
        createdAt: updated!.createdAt.toISOString(),
        updatedAt: updated!.updatedAt.toISOString(),
      },
    }
  },

  async DELETE({ params, prisma, session }) {
    requireAuth(session)
    const id = Number(params.id)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const existing = await prisma.tvList.findUnique({
      where: {
        userId_tvId: {
          userId: dbUser.id,
          tvId: id,
        },
      },
    })

    if (!existing) {
      throw new NotFound("TV show is not on user's list")
    }

    await prisma.tvList.delete({
      where: { id: existing.id },
    })

    return {
      success: true,
      message: "TV show removed from list successfully",
    }
  },
})
