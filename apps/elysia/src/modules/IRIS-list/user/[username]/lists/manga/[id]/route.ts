import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  ScoreSchema,
  ConnectionsSchema,
  HistoryArraySchema,
  mangaSelect,
  recordEntryMutationActivity,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { MangaListStatus } from "@IRIS/database"
import { recordMediaListActivity } from "@/services/activity.service.js"

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

const MangaMutationBodySchema = t.Object({
  status: t.Optional(
    t.Union([
      t.Literal("PLANNING"),
      t.Literal("READING"),
      t.Literal("COMPLETED"),
      t.Literal("ON_HOLD"),
      t.Literal("DROPPED"),
    ])
  ),
  chaptersProgress: t.Optional(t.Number({ minimum: 0 })),
  volumesProgress: t.Optional(t.Number({ minimum: 0 })),
  score: ScoreSchema,
  notes: t.Optional(t.Nullable(t.String())),
  reread: t.Optional(t.Number({ minimum: 0 })),
  private: t.Optional(t.Boolean()),
  startedAt: t.Optional(t.Nullable(t.String())),
  completedAt: t.Optional(t.Nullable(t.String())),
  rereadHistory: HistoryArraySchema,
  connections: ConnectionsSchema,
})

export default defineRoute({
  schemas: {
    GET: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Manga ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          inList: t.Boolean(),
          entry: t.Nullable(MangaEntryResponseSchema),
          media: t.Optional(t.Nullable(t.Any())),
        }),
      },
      detail: {
        summary: "Check and get manga list entry by manga ID",
        tags: ["Lists - Manga"],
      },
    },
    PUT: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Manga ID" }),
      }),
      body: MangaMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: MangaEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Upsert manga list entry by manga ID",
        tags: ["Lists - Manga"],
      },
    },
    PATCH: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Manga ID" }),
      }),
      body: MangaMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: MangaEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Partially update manga list entry by manga ID",
        tags: ["Lists - Manga"],
      },
    },
    DELETE: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Manga ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete manga from user list",
        tags: ["Lists - Manga"],
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

    const entry = await prisma.mangaList.findUnique({
      where: {
        userId_mangaId: {
          userId: dbUser.id,
          mangaId: id,
        },
      },
      include: {
        manga: { select: mangaSelect },
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
        mangaId: entry.mangaId,
        status: entry.status,
        chaptersProgress: entry.chaptersProgress,
        volumesProgress: entry.volumesProgress,
        score: entry.score,
        notes: entry.notes,
        reread: entry.reread,
        private: entry.private,
        startedAt: entry.startedAt ? entry.startedAt.toISOString() : null,
        completedAt: entry.completedAt ? entry.completedAt.toISOString() : null,
        rereadHistory: entry.rereadHistory,
        connections: entry.connections,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      },
      media: entry.manga,
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

    const mangaExists = await prisma.manga.findUnique({
      where: { id },
      select: {
        id: true,
        chapterCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!mangaExists) {
      throw new NotFound(`Manga with ID ${id} does not exist`)
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

    const existing = await prisma.mangaList.findUnique({
      where: {
        userId_mangaId: {
          userId: dbUser.id,
          mangaId: id,
        },
      },
      select: { id: true, chaptersProgress: true, score: true, status: true },
    })

    let targetChaptersProgress =
      payload.chaptersProgress !== undefined
        ? payload.chaptersProgress
        : existing?.chaptersProgress
    if (
      mangaExists.chapterCount &&
      mangaExists.chapterCount > 0 &&
      targetChaptersProgress !== undefined &&
      targetChaptersProgress > mangaExists.chapterCount
    ) {
      targetChaptersProgress = mangaExists.chapterCount
    }

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as MangaListStatus } : {}),
      ...(targetChaptersProgress !== undefined
        ? { chaptersProgress: targetChaptersProgress }
        : {}),
      ...(payload.volumesProgress !== undefined
        ? { volumesProgress: payload.volumesProgress }
        : {}),
      ...(payload.score !== undefined ? { score: payload.score } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.reread !== undefined ? { reread: payload.reread } : {}),
      ...(payload.private !== undefined ? { private: payload.private } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(payload.rereadHistory !== undefined
        ? { rereadHistory: payload.rereadHistory }
        : {}),
      ...(payload.connections !== undefined
        ? { connections: payload.connections }
        : {}),
    }

    const createChaptersProgress =
      payload.chaptersProgress !== undefined
        ? mangaExists.chapterCount && mangaExists.chapterCount > 0
          ? Math.min(payload.chaptersProgress, mangaExists.chapterCount)
          : payload.chaptersProgress
        : 0

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
        status: payload.status ?? "PLANNING",
        chaptersProgress: createChaptersProgress,
        volumesProgress: payload.volumesProgress ?? 0,
        score: payload.score ?? null,
        notes: payload.notes ?? null,
        reread: payload.reread ?? 0,
        private: payload.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        rereadHistory: payload.rereadHistory ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    recordEntryMutationActivity({
      userId: dbUser.id,
      mediaType: "MANGA",
      mediaId: id,
      media: mangaExists,
      existing,
      result,
      payload,
    })

    return {
      success: true,
      message: "Manga list entry updated successfully",
      entry: {
        id: result.id,
        mangaId: result.mangaId,
        status: result.status,
        chaptersProgress: result.chaptersProgress,
        volumesProgress: result.volumesProgress,
        score: result.score,
        notes: result.notes,
        reread: result.reread,
        private: result.private,
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

  async PATCH({ params, body, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)

    const mangaExists = await prisma.manga.findUnique({
      where: { id },
      select: {
        id: true,
        chapterCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!mangaExists) {
      throw new NotFound(`Manga with ID ${id} does not exist`)
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

    const existing = await prisma.mangaList.findUnique({
      where: {
        userId_mangaId: {
          userId: dbUser.id,
          mangaId: id,
        },
      },
      select: { id: true, chaptersProgress: true, score: true, status: true },
    })

    let targetChaptersProgress =
      payload.chaptersProgress !== undefined
        ? payload.chaptersProgress
        : existing?.chaptersProgress
    if (
      mangaExists.chapterCount &&
      mangaExists.chapterCount > 0 &&
      targetChaptersProgress !== undefined &&
      targetChaptersProgress > mangaExists.chapterCount
    ) {
      targetChaptersProgress = mangaExists.chapterCount
    }

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as MangaListStatus } : {}),
      ...(targetChaptersProgress !== undefined
        ? { chaptersProgress: targetChaptersProgress }
        : {}),
      ...(payload.volumesProgress !== undefined
        ? { volumesProgress: payload.volumesProgress }
        : {}),
      ...(payload.score !== undefined ? { score: payload.score } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      ...(payload.reread !== undefined ? { reread: payload.reread } : {}),
      ...(payload.private !== undefined ? { private: payload.private } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(payload.rereadHistory !== undefined
        ? { rereadHistory: payload.rereadHistory }
        : {}),
      ...(payload.connections !== undefined
        ? { connections: payload.connections }
        : {}),
    }

    const createChaptersProgress =
      payload.chaptersProgress !== undefined
        ? mangaExists.chapterCount && mangaExists.chapterCount > 0
          ? Math.min(payload.chaptersProgress, mangaExists.chapterCount)
          : payload.chaptersProgress
        : 0

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
        status: payload.status ?? "PLANNING",
        chaptersProgress: createChaptersProgress,
        volumesProgress: payload.volumesProgress ?? 0,
        score: payload.score ?? null,
        notes: payload.notes ?? null,
        reread: payload.reread ?? 0,
        private: payload.private ?? false,
        startedAt: startedAt ?? null,
        completedAt: completedAt ?? null,
        rereadHistory: payload.rereadHistory ?? null,
        connections: payload.connections ?? null,
      },
      update: upsertData,
    })

    recordEntryMutationActivity({
      userId: dbUser.id,
      mediaType: "MANGA",
      mediaId: id,
      media: mangaExists,
      existing,
      result,
      payload,
    })

    return {
      success: true,
      message: "Manga list entry updated successfully",
      entry: {
        id: result.id,
        mangaId: result.mangaId,
        status: result.status,
        chaptersProgress: result.chaptersProgress,
        volumesProgress: result.volumesProgress,
        score: result.score,
        notes: result.notes,
        reread: result.reread,
        private: result.private,
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

  async DELETE({ params, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)

    const existing = await prisma.mangaList.findUnique({
      where: {
        userId_mangaId: {
          userId: dbUser.id,
          mangaId: id,
        },
      },
    })

    if (!existing) {
      throw new NotFound("Manga is not on user's list")
    }

    await prisma.mangaList.delete({
      where: { id: existing.id },
    })

    const manga = await prisma.manga.findUnique({
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
      mediaType: "MANGA",
      mediaId: id,
      action: "REMOVED",
      title: manga?.titlePrimary || manga?.titleSecondary || "Manga",
      coverImage: manga?.coverImage,
      bannerImage: manga?.bannerImage,
      format: manga?.format,
      status: existing.status,
      progress: existing.chaptersProgress,
      score: existing.score,
      isPrivate: existing.private,
    })

    return {
      success: true,
      message: "Manga removed from list successfully",
    }
  },
})
