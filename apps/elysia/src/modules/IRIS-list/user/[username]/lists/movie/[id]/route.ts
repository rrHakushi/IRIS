import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  ScoreSchema,
  ConnectionsSchema,
  HistoryArraySchema,
  movieSelect,
  recordEntryMutationActivity,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { MovieListStatus } from "@IRIS/database"
import { recordMediaListActivity } from "@/services/activity.service.js"
import { syncConnectionMedia } from "@/services/connections/connection-media-sync.service.js"

const MovieEntryResponseSchema = t.Object({
  id: t.Number(),
  movieId: t.Number(),
  status: t.String(),
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

const MovieMutationBodySchema = t.Object({
  status: t.Optional(
    t.Union([
      t.Literal("PLANNING"),
      t.Literal("WATCHING"),
      t.Literal("COMPLETED"),
      t.Literal("DROPPED"),
    ])
  ),
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
        id: t.Number({ minimum: 1, description: "Movie ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          inList: t.Boolean(),
          entry: t.Nullable(MovieEntryResponseSchema),
          media: t.Optional(t.Nullable(t.Any())),
        }),
      },
      detail: {
        summary: "Check and get movie list entry by movie ID",
        tags: ["Lists - Movie"],
      },
    },
    PUT: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Movie ID" }),
      }),
      body: MovieMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: MovieEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Upsert movie list entry by movie ID",
        tags: ["Lists - Movie"],
      },
    },
    PATCH: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Movie ID" }),
      }),
      body: MovieMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: MovieEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Partially update movie list entry by movie ID",
        tags: ["Lists - Movie"],
      },
    },
    DELETE: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Movie ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete movie from user list",
        tags: ["Lists - Movie"],
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

    const entry = await prisma.movieList.findUnique({
      where: {
        userId_movieId: {
          userId: dbUser.id,
          movieId: id,
        },
      },
      include: {
        movie: { select: movieSelect },
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
        movieId: entry.movieId,
        status: entry.status,
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
      media: entry.movie,
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

    const movieExists = await prisma.movie.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        simklId: true,
      },
    })
    if (!movieExists) {
      throw new NotFound(`Movie with ID ${id} does not exist`)
    }

    const existing = await prisma.movieList.findUnique({
      where: {
        userId_movieId: {
          userId: dbUser.id,
          movieId: id,
        },
      },
      select: {
        id: true,
        status: true,
        score: true,
        private: true,
      },
    })

    const payload = (body ?? {}) as any
    const rawStartedAt =
      payload.startedAt !== undefined
        ? payload.startedAt
          ? new Date(payload.startedAt)
          : null
        : undefined
    const rawCompletedAt =
      payload.completedAt !== undefined
        ? payload.completedAt
          ? new Date(payload.completedAt)
          : null
        : undefined

    // For movies, startDate should be the same as finish date
    const movieDate =
      rawCompletedAt !== undefined ? rawCompletedAt : rawStartedAt
    const startedAt = movieDate !== undefined ? movieDate : undefined
    const completedAt = movieDate !== undefined ? movieDate : undefined

    const normalizedScore =
      payload.score !== undefined
        ? payload.score !== null
          ? payload.score > 10
            ? Math.round((payload.score / 10) * 10) / 10
            : Math.round(payload.score * 10) / 10
          : null
        : undefined

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as MovieListStatus } : {}),
      ...(normalizedScore !== undefined ? { score: normalizedScore } : {}),
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

    const initialMovieDate = rawCompletedAt ?? rawStartedAt ?? null

    const result = await prisma.movieList.upsert({
      where: {
        userId_movieId: {
          userId: dbUser.id,
          movieId: id,
        },
      },
      create: {
        userId: dbUser.id,
        movieId: id,
        status: payload.status ?? "PLANNING",
        score: normalizedScore ?? null,
        notes: payload.notes ?? null,
        rewatched: payload.rewatched ?? 0,
        private: payload.private ?? false,
        startedAt: initialMovieDate,
        completedAt: initialMovieDate,
        rewatchHistory: payload.rewatchHistory ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    recordEntryMutationActivity({
      userId: dbUser.id,
      mediaType: "MOVIE",
      mediaId: id,
      media: movieExists,
      existing,
      result,
      payload,
    })

    const rawPutConns = (payload.connections ?? result.connections) as any
    let putConnectionsToSync = rawPutConns
    const simklId = movieExists.simklId || putConnectionsToSync?.simkl?.id
    if ((!putConnectionsToSync || !putConnectionsToSync.simkl) && simklId) {
      putConnectionsToSync = {
        ...(putConnectionsToSync || {}),
        simkl: {
          id: simklId,
          autoInjected: true,
        },
      }
    }

    if (simklId && !movieExists.simklId) {
      await prisma.movie
        .update({
          where: { id },
          data: { simklId: Number(simklId) },
        })
        .catch(() => {})
    }

    if (
      putConnectionsToSync &&
      typeof putConnectionsToSync === "object" &&
      Object.keys(putConnectionsToSync).length > 0
    ) {
      await syncConnectionMedia({
        userId: dbUser.id,
        username: dbUser.username,
        mediaType: "MOVIE",
        mediaId: id,
        mediaTitle:
          movieExists.titlePrimary || movieExists.titleSecondary || "Movie",
        entry: {
          status: result.status,
          score: result.score,
          notes: result.notes,
          rewatched: result.rewatched,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
        },
        connections: putConnectionsToSync,
        prisma,
      })
    }

    return {
      success: true,
      message: "Movie list entry updated successfully",
      entry: {
        id: result.id,
        movieId: result.movieId,
        status: result.status,
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

    const movieExists = await prisma.movie.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        simklId: true,
      },
    })
    if (!movieExists) {
      throw new NotFound(`Movie with ID ${id} does not exist`)
    }

    const existing = await prisma.movieList.findUnique({
      where: {
        userId_movieId: {
          userId: dbUser.id,
          movieId: id,
        },
      },
      select: {
        id: true,
        status: true,
        score: true,
        private: true,
      },
    })

    const payload = (body ?? {}) as any
    const rawStartedAt =
      payload.startedAt !== undefined
        ? payload.startedAt
          ? new Date(payload.startedAt)
          : null
        : undefined
    const rawCompletedAt =
      payload.completedAt !== undefined
        ? payload.completedAt
          ? new Date(payload.completedAt)
          : null
        : undefined

    const movieDate =
      rawCompletedAt !== undefined
        ? rawCompletedAt
        : rawStartedAt !== undefined
          ? rawStartedAt
          : undefined

    const startedAt = movieDate !== undefined ? movieDate : undefined
    const completedAt = movieDate !== undefined ? movieDate : undefined

    const normalizedScore =
      payload.score !== undefined
        ? payload.score !== null
          ? payload.score > 10
            ? Math.round((payload.score / 10) * 10) / 10
            : Math.round(payload.score * 10) / 10
          : null
        : undefined

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as MovieListStatus } : {}),
      ...(normalizedScore !== undefined ? { score: normalizedScore } : {}),
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

    const initialMovieDate = rawCompletedAt ?? rawStartedAt ?? null

    const result = await prisma.movieList.upsert({
      where: {
        userId_movieId: {
          userId: dbUser.id,
          movieId: id,
        },
      },
      create: {
        userId: dbUser.id,
        movieId: id,
        status: payload.status ?? "PLANNING",
        score: normalizedScore ?? null,
        notes: payload.notes ?? null,
        rewatched: payload.rewatched ?? 0,
        private: payload.private ?? false,
        startedAt: initialMovieDate,
        completedAt: initialMovieDate,
        rewatchHistory: payload.rewatchHistory ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    recordEntryMutationActivity({
      userId: dbUser.id,
      mediaType: "MOVIE",
      mediaId: id,
      media: movieExists,
      existing,
      result,
      payload,
    })

    const rawPatchConns = (payload.connections ?? result.connections) as any
    let patchConnectionsToSync = rawPatchConns
    const patchSimklId =
      movieExists.simklId || patchConnectionsToSync?.simkl?.id
    if (
      (!patchConnectionsToSync || !patchConnectionsToSync.simkl) &&
      patchSimklId
    ) {
      patchConnectionsToSync = {
        ...(patchConnectionsToSync || {}),
        simkl: {
          id: patchSimklId,
          autoInjected: true,
        },
      }
    }

    if (patchSimklId && !movieExists.simklId) {
      await prisma.movie
        .update({
          where: { id },
          data: { simklId: Number(patchSimklId) },
        })
        .catch(() => {})
    }

    if (
      patchConnectionsToSync &&
      typeof patchConnectionsToSync === "object" &&
      Object.keys(patchConnectionsToSync).length > 0
    ) {
      await syncConnectionMedia({
        userId: dbUser.id,
        username: dbUser.username,
        mediaType: "MOVIE",
        mediaId: id,
        mediaTitle:
          movieExists.titlePrimary || movieExists.titleSecondary || "Movie",
        entry: {
          status: result.status,
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

    return {
      success: true,
      message: "Movie list entry updated successfully",
      entry: {
        id: result.id,
        movieId: result.movieId,
        status: result.status,
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

    const existing = await prisma.movieList.findUnique({
      where: {
        userId_movieId: {
          userId: dbUser.id,
          movieId: id,
        },
      },
    })

    if (!existing) {
      throw new NotFound("Movie is not on user's list")
    }

    await prisma.movieList.delete({
      where: { id: existing.id },
    })

    const movie = await prisma.movie.findUnique({
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
      mediaType: "MOVIE",
      mediaId: id,
      action: "REMOVED",
      title: movie?.titlePrimary || movie?.titleSecondary || "Movie",
      coverImage: movie?.coverImage,
      bannerImage: movie?.bannerImage,
      status: existing.status,
      score: existing.score,
      isPrivate: existing.private,
    })

    return {
      success: true,
      message: "Movie removed from list successfully",
    }
  },
})
