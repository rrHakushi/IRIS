import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  ConnectionsSchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
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

const AnimeIncrementBodySchema = t.Optional(
  t.Object({
    count: t.Optional(t.Number({ default: 1, minimum: 1 })),
    status: t.Optional(
      t.Union([
        t.Literal("PLANNING"),
        t.Literal("WATCHING"),
        t.Literal("COMPLETED"),
        t.Literal("ON_HOLD"),
        t.Literal("DROPPED"),
      ])
    ),
    connections: ConnectionsSchema,
  })
)

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Anime ID" }),
    }),
    body: AnimeIncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: AnimeEntryResponseSchema,
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
      select: {
        id: true,
        episodeCount: true,
        status: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
        _count: { select: { episodes: true } },
      },
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

    const isOngoing =
      String(anime.status).toUpperCase() === "RELEASING" ||
      !anime.episodeCount ||
      anime.episodeCount <= 0

    const maxEpisodes =
      !isOngoing && anime.episodeCount && anime.episodeCount > 0
        ? anime.episodeCount
        : null

    const currentProgress = existing ? existing.progress : 0

    // Overflow guard: if already at or beyond maximum episodes, clamp and prevent further increment
    if (maxEpisodes !== null && currentProgress >= maxEpisodes) {
      let clampedEntry = existing
      if (
        existing &&
        (existing.progress > maxEpisodes || existing.status !== "COMPLETED")
      ) {
        clampedEntry = await prisma.animeList.update({
          where: { id: existing.id },
          data: {
            progress: maxEpisodes,
            status: "COMPLETED",
            completedAt: existing.completedAt || new Date(),
          },
        })
      }

      return {
        success: true,
        message: `Already at maximum episodes (${maxEpisodes}/${maxEpisodes})`,
        entry: {
          id: clampedEntry!.id,
          animeId: clampedEntry!.animeId,
          status: clampedEntry!.status,
          progress: clampedEntry!.progress,
          score: clampedEntry!.score ?? null,
          notes: clampedEntry!.notes ?? null,
          rewatched: clampedEntry!.rewatched ?? 0,
          private: clampedEntry!.private ?? false,
          startedAt: clampedEntry!.startedAt
            ? clampedEntry!.startedAt.toISOString()
            : null,
          completedAt: clampedEntry!.completedAt
            ? clampedEntry!.completedAt.toISOString()
            : null,
          rewatchHistory: clampedEntry!.rewatchHistory,
          connections: clampedEntry!.connections,
          createdAt: clampedEntry!.createdAt
            ? clampedEntry!.createdAt.toISOString()
            : new Date().toISOString(),
          updatedAt: clampedEntry!.updatedAt
            ? clampedEntry!.updatedAt.toISOString()
            : new Date().toISOString(),
        },
      }
    }

    let newProgress = currentProgress + count
    let newStatus: AnimeListStatus =
      (body as any)?.status ??
      (existing?.status as AnimeListStatus) ??
      "WATCHING"
    let completedAt = existing?.completedAt ?? null

    // If status was PLANNING, transition to WATCHING
    if (newStatus === "PLANNING") {
      newStatus = "WATCHING"
    }

    // Overflow guard & completion check: clamp at maxEpisodes and set COMPLETED
    if (maxEpisodes !== null) {
      if (newProgress >= maxEpisodes) {
        newProgress = maxEpisodes
        newStatus = "COMPLETED"
        if (!completedAt) {
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

    const connectionsToSync = (body as any)?.connections ?? result.connections
    if (
      connectionsToSync &&
      typeof connectionsToSync === "object" &&
      Object.keys(connectionsToSync).length > 0
    ) {
      await syncConnectionMedia({
        userId: dbUser.id,
        username: dbUser.username,
        animeId: id,
        animeTitle: anime.titlePrimary || anime.titleSecondary || "Anime",
        entry: {
          status: result.status,
          progress: result.progress,
          score: existing?.score ?? null,
          notes: existing?.notes ?? null,
          rewatched: existing?.rewatched ?? 0,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
        },
        connections: connectionsToSync,
        prisma,
      })
    }

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "ANIME",
      mediaId: id,
      action: newStatus === "COMPLETED" ? "COMPLETED" : "PROGRESS_CHANGED",
      title: anime.titlePrimary || anime.titleSecondary || "Anime",
      coverImage: anime.coverImage,
      bannerImage: anime.bannerImage,
      format: anime.format,
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
      message: `Progress incremented to ${result.progress}`,
      entry: {
        id: result.id,
        animeId: result.animeId,
        status: result.status,
        progress: result.progress,
        score: result.score ?? null,
        notes: result.notes ?? null,
        rewatched: result.rewatched ?? 0,
        private: result.private ?? false,
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
})
