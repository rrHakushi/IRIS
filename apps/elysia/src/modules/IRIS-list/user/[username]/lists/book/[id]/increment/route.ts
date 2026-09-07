import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  IncrementBodySchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { BookListStatus } from "@IRIS/database"
import { recordMediaListActivity } from "@/services/activity.service.js"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Book ID" }),
    }),
    body: IncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: t.Object({
          id: t.Number(),
          bookId: t.Number(),
          status: t.String(),
          progressChapters: t.Number(),
          completedAt: t.Nullable(t.String()),
        }),
      }),
    },
    detail: {
      summary: "Increment book chapter progress with guarded completion check",
      tags: ["Lists - Book"],
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

    const book = await prisma.book.findUnique({
      where: { id },
      select: {
        id: true,
        pageCount: true,
        chapterCount: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!book) {
      throw new NotFound(`Book with ID ${id} does not exist`)
    }

    const count = (body as any)?.count ?? 1

    const existing = await prisma.bookList.findUnique({
      where: {
        userId_bookId: {
          userId: dbUser.id,
          bookId: id,
        },
      },
    })

    const currentProgress = existing ? existing.progressChapters : 0
    let newProgress = currentProgress + count
    let newStatus: BookListStatus =
      (existing?.status as BookListStatus) ?? "READING"
    let completedAt = existing?.completedAt ?? null

    if (newStatus === "PLANNING") {
      newStatus = "READING"
    }

    const hasScore =
      existing?.score !== null &&
      existing?.score !== undefined &&
      existing?.score > 0

    if (book.chapterCount && book.chapterCount > 0) {
      if (newProgress >= book.chapterCount) {
        newProgress = book.chapterCount
        if (hasScore) {
          newStatus = "COMPLETED"
          completedAt = new Date()
        }
      }
    }

    const result = await prisma.bookList.upsert({
      where: {
        userId_bookId: {
          userId: dbUser.id,
          bookId: id,
        },
      },
      create: {
        userId: dbUser.id,
        bookId: id,
        status: newStatus,
        progressPages: 0,
        progressChapters: newProgress,
        progressVolumes: 0,
        startedAt: new Date(),
        completedAt,
      },
      update: {
        status: newStatus,
        progressChapters: newProgress,
        completedAt,
        ...(existing?.status === "PLANNING" ? { startedAt: new Date() } : {}),
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "BOOK",
      mediaId: id,
      action: newStatus === "COMPLETED" ? "COMPLETED" : "PROGRESS_CHANGED",
      title: book.titlePrimary || book.titleSecondary || "Book",
      coverImage: book.coverImage,
      bannerImage: book.bannerImage,
      status: result.status,
      progress: result.progressChapters,
      score: existing?.score ?? null,
      prevStatus: existing?.status,
      prevProgress: currentProgress,
      prevScore: existing?.score,
      isPrivate: existing?.private ?? false,
    })

    return {
      success: true,
      message: `Chapters progress incremented to ${result.progressChapters}`,
      entry: {
        id: result.id,
        bookId: result.bookId,
        status: result.status,
        progressChapters: result.progressChapters,
        completedAt: result.completedAt
          ? result.completedAt.toISOString()
          : null,
      },
    }
  },
})
