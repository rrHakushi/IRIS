import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  IncrementBodySchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { AnimeListStatus } from "@IRIS/database"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Anime ID" }),
    }),
    body: IncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: t.Object({
          id: t.Number(),
          animeId: t.Number(),
          status: t.String(),
          progress: t.Number(),
          completedAt: t.Nullable(t.String()),
        }),
      }),
    },
    detail: {
      summary: "Increment anime episode progress with guarded completion check",
      tags: ["Lists - Anime"],
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

    const anime = await prisma.anime.findUnique({
      where: { id },
      select: { id: true, episodeCount: true },
    })
    if (!anime) {
      throw new NotFound(`Anime with ID ${id} does not exist`)
    }

    const count = (body as any)?.count ?? 1

    const existing = await prisma.animeList.findUnique({
      where: {
        userId_animeId: {
          userId: dbUser.id,
          animeId: id,
        },
      },
    })

    const currentProgress = existing ? existing.progress : 0
    let newProgress = currentProgress + count
    let newStatus: AnimeListStatus = (existing?.status as AnimeListStatus) ?? "WATCHING"
    let completedAt = existing?.completedAt ?? null

    // If status was PLANNING, transition to WATCHING
    if (newStatus === "PLANNING") {
      newStatus = "WATCHING"
    }

    const hasScore =
      existing?.score !== null &&
      existing?.score !== undefined &&
      existing?.score > 0

    // Completion guard: if episodeCount is known, cap at max and require score for COMPLETED
    if (anime.episodeCount && anime.episodeCount > 0) {
      if (newProgress >= anime.episodeCount) {
        newProgress = anime.episodeCount
        if (hasScore) {
          newStatus = "COMPLETED"
          completedAt = new Date()
        }
      }
    }

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

    return {
      success: true,
      message: `Progress incremented to ${result.progress}`,
      entry: {
        id: result.id,
        animeId: result.animeId,
        status: result.status,
        progress: result.progress,
        completedAt: result.completedAt ? result.completedAt.toISOString() : null,
      },
    }
  },
})
