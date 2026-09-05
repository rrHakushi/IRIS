import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  IncrementBodySchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"

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
      select: { id: true },
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
      },
      update: {
        status: newStatus as any,
        rewatched: newRewatched,
        completedAt,
      },
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
