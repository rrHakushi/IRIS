import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  ConnectionsSchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { MangaListStatus } from "@IRIS/database"
import { recordMediaListActivity } from "@/services/activity.service.js"
import { syncConnectionMedia } from "@/services/connections/connection-media-sync.service.js"

const MangaEntryResponseSchema = t.Object({
  id: t.Number(),
  mangaId: t.Number(),
  status: t.String(),
  chaptersProgress: t.Number(),
  volumesProgress: t.Number(),
  score: t.Nullable(t.Number()),
  notes: t.Nullable(t.String()),
  reread: t.Number(),
  private: t.Boolean(),
  startedAt: t.Nullable(t.String()),
  completedAt: t.Nullable(t.String()),
  rereadHistory: t.Optional(t.Any()),
  connections: t.Optional(t.Any()),
  createdAt: t.String(),
  updatedAt: t.String(),
})

const MangaIncrementBodySchema = t.Optional(
  t.Object({
    count: t.Optional(t.Number({ default: 1, minimum: 1 })),
    type: t.Optional(
      t.Union([
        t.Literal("CHAPTER"),
        t.Literal("VOLUME"),
        t.Literal("chapter"),
        t.Literal("volume"),
      ])
    ),
    status: t.Optional(
      t.Union([
        t.Literal("PLANNING"),
        t.Literal("READING"),
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
      id: t.Number({ minimum: 1, description: "Manga ID" }),
    }),
    query: t.Optional(
      t.Object({
        type: t.Optional(
          t.Union([
            t.Literal("CHAPTER"),
            t.Literal("VOLUME"),
            t.Literal("chapter"),
            t.Literal("volume"),
          ])
        ),
      })
    ),
    body: MangaIncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: MangaEntryResponseSchema,
      }),
    },
    detail: {
      summary:
        "Increment manga chapters or volumes progress with guarded completion check",
      tags: ["Lists - Manga"],
    },
  },

  async POST({ params, query, body, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)

    const manga = await prisma.manga.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        chapterCount: true,
        volumeCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!manga) {
      throw new NotFound(`Manga with ID ${id} does not exist`)
    }

    const count = (body as any)?.count ?? 1
    const rawType = (body as any)?.type || (query as any)?.type || "CHAPTER"
    const isVolume = String(rawType).toUpperCase() === "VOLUME"

    const existing = await prisma.mangaList.findUnique({
      where: {
        userId_mangaId: {
          userId: dbUser.id,
          mangaId: id,
        },
      },
    })

    const isOngoing =
      String((manga as any).status).toUpperCase() === "RELEASING" ||
      String((manga as any).status).toUpperCase() === "PUBLISHING" ||
      !manga.chapterCount ||
      manga.chapterCount <= 0

    const currentChapters = existing ? existing.chaptersProgress : 0
    const currentVolumes = existing ? existing.volumesProgress : 0
    let newStatus: MangaListStatus =
      (body as any)?.status ??
      (existing?.status as MangaListStatus) ??
      "READING"
    let completedAt = existing?.completedAt ?? null

    if (newStatus === "PLANNING") {
      newStatus = "READING"
    }

    let newChapters = currentChapters
    let newVolumes = currentVolumes

    if (isVolume) {
      const maxVolumes =
        manga.volumeCount && manga.volumeCount > 0 ? manga.volumeCount : null

      if (maxVolumes !== null && currentVolumes >= maxVolumes) {
        let clamped = existing
        if (existing && existing.volumesProgress > maxVolumes) {
          clamped = await prisma.mangaList.update({
            where: { id: existing.id },
            data: { volumesProgress: maxVolumes },
          })
        }
        return {
          success: true,
          message: `Already at maximum volumes (${maxVolumes}/${maxVolumes})`,
          entry: {
            id: clamped!.id,
            mangaId: clamped!.mangaId,
            status: clamped!.status,
            chaptersProgress: clamped!.chaptersProgress,
            volumesProgress: clamped!.volumesProgress,
            score: clamped!.score ?? null,
            notes: clamped!.notes ?? null,
            reread: clamped!.reread ?? 0,
            private: clamped!.private ?? false,
            startedAt: clamped!.startedAt
              ? clamped!.startedAt.toISOString()
              : null,
            completedAt: clamped!.completedAt
              ? clamped!.completedAt.toISOString()
              : null,
            rereadHistory: (clamped as any)!.rereadHistory ?? null,
            connections: clamped!.connections,
            createdAt: clamped!.createdAt.toISOString(),
            updatedAt: clamped!.updatedAt.toISOString(),
          },
        }
      }

      newVolumes =
        maxVolumes !== null
          ? Math.min(currentVolumes + count, maxVolumes)
          : currentVolumes + count

      if (maxVolumes !== null && newVolumes >= maxVolumes) {
        if (!manga.chapterCount || newChapters >= manga.chapterCount) {
          newStatus = "COMPLETED"
          if (!completedAt) completedAt = new Date()
        }
      }
    } else {
      const maxChapters =
        !isOngoing && manga.chapterCount && manga.chapterCount > 0
          ? manga.chapterCount
          : null

      if (maxChapters !== null && currentChapters >= maxChapters) {
        let clamped = existing
        if (existing && existing.chaptersProgress > maxChapters) {
          clamped = await prisma.mangaList.update({
            where: { id: existing.id },
            data: { chaptersProgress: maxChapters },
          })
        }
        return {
          success: true,
          message: `Already at maximum chapters (${maxChapters}/${maxChapters})`,
          entry: {
            id: clamped!.id,
            mangaId: clamped!.mangaId,
            status: clamped!.status,
            chaptersProgress: clamped!.chaptersProgress,
            volumesProgress: clamped!.volumesProgress,
            score: clamped!.score ?? null,
            notes: clamped!.notes ?? null,
            reread: clamped!.reread ?? 0,
            private: clamped!.private ?? false,
            startedAt: clamped!.startedAt
              ? clamped!.startedAt.toISOString()
              : null,
            completedAt: clamped!.completedAt
              ? clamped!.completedAt.toISOString()
              : null,
            rereadHistory: (clamped as any)!.rereadHistory ?? null,
            connections: clamped!.connections,
            createdAt: clamped!.createdAt.toISOString(),
            updatedAt: clamped!.updatedAt.toISOString(),
          },
        }
      }

      newChapters =
        maxChapters !== null
          ? Math.min(currentChapters + count, maxChapters)
          : currentChapters + count

      if (maxChapters !== null && newChapters >= maxChapters) {
        newStatus = "COMPLETED"
        if (!completedAt) completedAt = new Date()
      }
    }

    const result = await prisma.mangaList.upsert({
      where: {
        userId_mangaId: {
          userId: dbUser.id,
          mangaId: id,
        },
      },
      create: {
        userId: dbUser.id,
        mangaId: id,
        status: newStatus,
        chaptersProgress: newChapters,
        volumesProgress: newVolumes,
        startedAt: new Date(),
        completedAt,
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus,
        chaptersProgress: newChapters,
        volumesProgress: newVolumes,
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
        mediaId: id,
        mediaTitle: manga.titlePrimary || manga.titleSecondary || "Manga",
        entry: {
          status: result.status,
          progress: result.chaptersProgress,
          score: existing?.score ?? null,
          notes: existing?.notes ?? null,
          rewatched: existing?.reread ?? 0,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
        },
        connections: connectionsToSync,
        prisma,
      })
    }

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "MANGA",
      mediaId: id,
      action: newStatus === "COMPLETED" ? "COMPLETED" : "PROGRESS_CHANGED",
      title: manga.titlePrimary || manga.titleSecondary || "Manga",
      coverImage: manga.coverImage,
      bannerImage: manga.bannerImage,
      format: manga.format,
      status: result.status,
      progress: result.chaptersProgress,
      progressVolumes: result.volumesProgress,
      score: existing?.score ?? null,
      prevStatus: existing?.status,
      prevProgress: currentChapters,
      prevScore: existing?.score,
      isPrivate: existing?.private ?? false,
    })

    return {
      success: true,
      message: isVolume
        ? `Volumes progress incremented to ${result.volumesProgress}`
        : `Chapters progress incremented to ${result.chaptersProgress}`,
      entry: {
        id: result.id,
        mangaId: result.mangaId,
        status: result.status,
        chaptersProgress: result.chaptersProgress,
        volumesProgress: result.volumesProgress,
        score: result.score ?? null,
        notes: result.notes ?? null,
        reread: result.reread ?? 0,
        private: result.private ?? false,
        startedAt: result.startedAt ? result.startedAt.toISOString() : null,
        completedAt: result.completedAt
          ? result.completedAt.toISOString()
          : null,
        rereadHistory: result.rereadHistory,
        connections: result.connections,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      },
    }
  },
})
