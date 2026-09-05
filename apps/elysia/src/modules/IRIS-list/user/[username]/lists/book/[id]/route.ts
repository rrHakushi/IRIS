import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  ScoreSchema,
  ConnectionsSchema,
  HistoryArraySchema,
  bookSelect,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { BookListStatus } from "@IRIS/database"

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

const BookMutationBodySchema = t.Object({
  status: t.Optional(
    t.Union([
      t.Literal("PLANNING"),
      t.Literal("READING"),
      t.Literal("COMPLETED"),
      t.Literal("ON_HOLD"),
      t.Literal("DROPPED"),
    ])
  ),
  progressPages: t.Optional(t.Number({ minimum: 0 })),
  progressChapters: t.Optional(t.Number({ minimum: 0 })),
  progressVolumes: t.Optional(t.Number({ minimum: 0 })),
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
        id: t.Number({ minimum: 1, description: "Book ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          inList: t.Boolean(),
          entry: t.Nullable(BookEntryResponseSchema),
          media: t.Optional(t.Nullable(t.Any())),
        }),
      },
      detail: {
        summary: "Check and get book list entry by book ID",
        tags: ["Lists - Book"],
      },
    },
    PUT: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Book ID" }),
      }),
      body: BookMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: BookEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Upsert book list entry by book ID",
        tags: ["Lists - Book"],
      },
    },
    PATCH: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Book ID" }),
      }),
      body: BookMutationBodySchema,
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          entry: BookEntryResponseSchema,
        }),
      },
      detail: {
        summary: "Partially update book list entry by book ID",
        tags: ["Lists - Book"],
      },
    },
    DELETE: {
      params: t.Object({
        username: t.String(),
        id: t.Number({ minimum: 1, description: "Book ID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete book from user list",
        tags: ["Lists - Book"],
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

    const entry = await prisma.bookList.findUnique({
      where: {
        userId_bookId: {
          userId: dbUser.id,
          bookId: id,
        },
      },
      include: {
        book: { select: bookSelect },
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
        bookId: entry.bookId,
        status: entry.status,
        progressPages: entry.progressPages,
        progressChapters: entry.progressChapters,
        progressVolumes: entry.progressVolumes,
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
      media: entry.book,
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

    const bookExists = await prisma.book.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!bookExists) {
      throw new NotFound(`Book with ID ${id} does not exist`)
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

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as BookListStatus } : {}),
      ...(payload.progressPages !== undefined
        ? { progressPages: payload.progressPages }
        : {}),
      ...(payload.progressChapters !== undefined
        ? { progressChapters: payload.progressChapters }
        : {}),
      ...(payload.progressVolumes !== undefined
        ? { progressVolumes: payload.progressVolumes }
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
        status: payload.status ?? "PLANNING",
        progressPages: payload.progressPages ?? 0,
        progressChapters: payload.progressChapters ?? 0,
        progressVolumes: payload.progressVolumes ?? 0,
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

    return {
      success: true,
      message: "Book list entry updated successfully",
      entry: {
        id: result.id,
        bookId: result.bookId,
        status: result.status,
        progressPages: result.progressPages,
        progressChapters: result.progressChapters,
        progressVolumes: result.progressVolumes,
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

    const bookExists = await prisma.book.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!bookExists) {
      throw new NotFound(`Book with ID ${id} does not exist`)
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

    const upsertData: any = {
      ...(payload.status ? { status: payload.status as BookListStatus } : {}),
      ...(payload.progressPages !== undefined
        ? { progressPages: payload.progressPages }
        : {}),
      ...(payload.progressChapters !== undefined
        ? { progressChapters: payload.progressChapters }
        : {}),
      ...(payload.progressVolumes !== undefined
        ? { progressVolumes: payload.progressVolumes }
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
        status: payload.status ?? "PLANNING",
        progressPages: payload.progressPages ?? 0,
        progressChapters: payload.progressChapters ?? 0,
        progressVolumes: payload.progressVolumes ?? 0,
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

    return {
      success: true,
      message: "Book list entry updated successfully",
      entry: {
        id: result.id,
        bookId: result.bookId,
        status: result.status,
        progressPages: result.progressPages,
        progressChapters: result.progressChapters,
        progressVolumes: result.progressVolumes,
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

    const existing = await prisma.bookList.findUnique({
      where: {
        userId_bookId: {
          userId: dbUser.id,
          bookId: id,
        },
      },
    })

    if (!existing) {
      throw new NotFound("Book is not on user's list")
    }

    await prisma.bookList.delete({
      where: { id: existing.id },
    })

    return {
      success: true,
      message: "Book removed from list successfully",
    }
  },
})
