import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  IncrementBodySchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { syncConnectionMedia } from "@/services/connections/connection-media-sync.service.js"
import { recordMediaListActivity } from "@/services/activity.service.js"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Movie ID" }),
    }),
    body: IncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: t.Object({
          id: t.Number(),
          movieId: t.Number(),
          status: t.String(),
          rewatched: t.Number(),
          completedAt: t.Nullable(t.String()),
        }),
      }),
    },
    detail: {
      summary: "Mark movie as completed or increment rewatch count",
      tags: ["Lists - Movie"],
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

    const movie = await prisma.movie.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        simklId: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!movie) {
      throw new NotFound(`Movie with ID ${id} does not exist`)
    }

    const count = (body as any)?.count ?? 1

    const existing = await prisma.movieList.findUnique({
      where: {
        userId_movieId: {
          userId: dbUser.id,
          movieId: id,
        },
      },
    })

    const hasScore =
      existing?.score !== null &&
      existing?.score !== undefined &&
      existing?.score > 0

    let newStatus =
      existing?.status === "COMPLETED"
        ? "COMPLETED"
        : hasScore
          ? "COMPLETED"
          : "WATCHING"
    let newRewatched = existing ? existing.rewatched : 0
    let completedAt =
      newStatus === "COMPLETED" ? (existing?.completedAt ?? new Date()) : null

    if (existing && existing.status === "COMPLETED") {
      newRewatched += count
    }

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
        status: newStatus as any,
        rewatched: 0,
        completedAt,
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus as any,
        rewatched: newRewatched,
        completedAt,
        ...((body as any)?.connections !== undefined
          ? { connections: (body as any).connections }
          : {}),
      },
    })

    const rawConns = ((body as any)?.connections ?? result.connections) as any
    let connectionsToSync = rawConns
    const simklId = movie.simklId || connectionsToSync?.simkl?.id
    if ((!connectionsToSync || !connectionsToSync.simkl) && simklId) {
      connectionsToSync = {
        ...(connectionsToSync || {}),
        simkl: {
          id: simklId,
          autoInjected: true,
        },
      }
    }

    if (simklId && !movie.simklId) {
      await prisma.movie
        .update({
          where: { id },
          data: { simklId: Number(simklId) },
        })
        .catch(() => {})
    }

    if (
      connectionsToSync &&
      typeof connectionsToSync === "object" &&
      Object.keys(connectionsToSync).length > 0
    ) {
      await syncConnectionMedia({
        userId: dbUser.id,
        username: dbUser.username,
        mediaType: "MOVIE",
        mediaId: id,
        mediaTitle: movie.titlePrimary || movie.titleSecondary || "Movie",
        entry: {
          status: result.status,
          score: existing?.score ?? null,
          notes: existing?.notes ?? null,
          rewatched: result.rewatched,
          startedAt: existing?.startedAt ?? new Date(),
          completedAt: result.completedAt,
        },
        connections: connectionsToSync,
        prisma,
      })
    }

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "MOVIE",
      mediaId: id,
      action: newStatus === "COMPLETED" ? "COMPLETED" : "PROGRESS_CHANGED",
      title: movie.titlePrimary || movie.titleSecondary || "Movie",
      coverImage: movie.coverImage,
      bannerImage: movie.bannerImage,
      format: "MOVIE",
      status: result.status,
      score: existing?.score ?? null,
      prevStatus: existing?.status,
      prevScore: existing?.score,
      isPrivate: existing?.private ?? false,
    })

    return {
      success: true,
      message:
        existing && existing.status === "COMPLETED"
          ? `Rewatched count incremented to ${result.rewatched}`
          : "Movie marked as completed",
      entry: {
        id: result.id,
        movieId: result.movieId,
        status: result.status,
        rewatched: result.rewatched,
        completedAt: result.completedAt
          ? result.completedAt.toISOString()
          : null,
      },
    }
  },
})
