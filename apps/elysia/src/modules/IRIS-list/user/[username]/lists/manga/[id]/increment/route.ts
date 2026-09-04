import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  IncrementBodySchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { MangaListStatus } from "@IRIS/database"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Manga ID" }),
    }),
    body: IncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: t.Object({
          id: t.Number(),
          mangaId: t.Number(),
          status: t.String(),
          chaptersProgress: t.Number(),
          completedAt: t.Nullable(t.String()),
        }),
      }),
    },
    detail: {
      summary: "Increment manga chapters progress with guarded completion check",
      tags: ["Lists - Manga"],
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

    const manga = await prisma.manga.findUnique({
      where: { id },
      select: { id: true, chapterCount: true },
    })
    if (!manga) {
      throw new NotFound(`Manga with ID ${id} does not exist`)
    }

    const count = (body as any)?.count ?? 1

    const existing = await prisma.mangaList.findUnique({
      where: {
        userId_mangaId: {
          userId: dbUser.id,
          mangaId: id,
        },
      },
    })

    const currentProgress = existing ? existing.chaptersProgress : 0
    const newProgress = currentProgress + count
    let newStatus: MangaListStatus = (existing?.status as MangaListStatus) ?? "READING"
    let completedAt = existing?.completedAt ?? null

    // If status was PLANNING, transition to READING
    if (newStatus === "PLANNING") {
      newStatus = "READING"
    }

    // Completion guard: only mark COMPLETED if chapterCount exists and is known
    if (
      manga.chapterCount &&
      manga.chapterCount > 0 &&
      newProgress >= manga.chapterCount
    ) {
      newStatus = "COMPLETED"
      completedAt = new Date()
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
        chaptersProgress: newProgress,
        volumesProgress: 0,
        startedAt: new Date(),
        completedAt,
      },
      update: {
        status: newStatus,
        chaptersProgress: newProgress,
        completedAt,
        ...(existing?.status === "PLANNING" ? { startedAt: new Date() } : {}),
      },
    })

    return {
      success: true,
      message: `Chapters progress incremented to ${result.chaptersProgress}`,
      entry: {
        id: result.id,
        mangaId: result.mangaId,
        status: result.status,
        chaptersProgress: result.chaptersProgress,
        completedAt: result.completedAt ? result.completedAt.toISOString() : null,
      },
    }
  },
})
