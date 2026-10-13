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

const BookEntryResponseSchema = t.Object({
  id: t.Number(),
  bookId: t.Number(),
  status: t.String(),
  progressPages: t.Number(),
  progressChapters: t.Number(),
  progressVolumes: t.Number(),
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

const BookIncrementBodySchema = t.Optional(
  t.Object({
    count: t.Optional(t.Number({ default: 1, minimum: 1 })),
    type: t.Optional(
      t.Union([
        t.Literal("CHAPTER"),
        t.Literal("PAGE"),
        t.Literal("VOLUME"),
        t.Literal("chapter"),
        t.Literal("page"),
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
    connections: t.Optional(t.Any()),
  })
)

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Book ID" }),
    }),
    body: BookIncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: BookEntryResponseSchema,
      }),
    },
    detail: {
      summary: "Increment book progress with guarded completion check",
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
    const rawType = (body as any)?.type || "CHAPTER"
    const isPage = String(rawType).toUpperCase() === "PAGE"
    const isVolume = String(rawType).toUpperCase() === "VOLUME"

    const existing = await prisma.bookList.findUnique({
      where: {
        userId_bookId: {
          userId: dbUser.id,
          bookId: id,
        },
      },
    })

    const currentPages = existing ? existing.progressPages : 0
    const currentChapters = existing ? existing.progressChapters : 0
    const currentVolumes = existing ? existing.progressVolumes : 0

    let newStatus: BookListStatus =
      (body as any)?.status ?? (existing?.status as BookListStatus) ?? "READING"
    let completedAt = existing?.completedAt ?? null

    if (newStatus === "PLANNING") {
      newStatus = "READING"
    }

    let newPages = currentPages
    let newChapters = currentChapters
    let newVolumes = currentVolumes

    if (isPage) {
      newPages = currentPages + count
      if (book.pageCount && book.pageCount > 0 && newPages >= book.pageCount) {
        newPages = book.pageCount
        newStatus = "COMPLETED"
        if (!completedAt) completedAt = new Date()
      }
    } else if (isVolume) {
      newVolumes = currentVolumes + count
    } else {
      newChapters = currentChapters + count
      if (
        book.chapterCount &&
        book.chapterCount > 0 &&
        newChapters >= book.chapterCount
      ) {
        newChapters = book.chapterCount
        newStatus = "COMPLETED"
        if (!completedAt) completedAt = new Date()
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
        progressPages: newPages,
        progressChapters: newChapters,
        progressVolumes: newVolumes,
        startedAt: new Date(),
        completedAt,
        connections: (body as any)?.connections ?? null,
      },
      update: {
        status: newStatus,
        progressPages: newPages,
        progressChapters: newChapters,
        progressVolumes: newVolumes,
        completedAt,
        ...(existing?.status === "PLANNING" ? { startedAt: new Date() } : {}),
        ...((body as any)?.connections !== undefined
          ? { connections: (body as any).connections }
          : {}),
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
      progress: isPage ? result.progressPages : result.progressChapters,
      score: existing?.score ?? null,
      prevStatus: existing?.status,
      prevProgress: isPage ? currentPages : currentChapters,
      prevScore: existing?.score,
      isPrivate: existing?.private ?? false,
    })

    return {
      success: true,
      message: isPage
        ? `Pages progress incremented to ${result.progressPages}`
        : `Chapters progress incremented to ${result.progressChapters}`,
      entry: {
        id: result.id,
        bookId: result.bookId,
        status: result.status,
        progressPages: result.progressPages,
        progressChapters: result.progressChapters,
        progressVolumes: result.progressVolumes,
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
