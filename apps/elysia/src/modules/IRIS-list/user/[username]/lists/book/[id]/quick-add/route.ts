import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  QuickAddResponseSchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Book ID" }),
    }),
    response: {
      200: QuickAddResponseSchema,
    },
    detail: {
      summary: "Quick add book to list with status PLANNING",
      tags: ["Lists - Book"],
    },
  },

  async POST({ params, prisma, session }) {
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
      select: { id: true },
    })
    if (!book) {
      throw new NotFound(`Book with ID ${id} does not exist`)
    }

    const existing = await prisma.bookList.findUnique({
      where: {
        userId_bookId: {
          userId: dbUser.id,
          bookId: id,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        message: "Book is already in list",
      }
    }

    const created = await prisma.bookList.create({
      data: {
        userId: dbUser.id,
        bookId: id,
        status: "PLANNING",
        progressPages: 0,
        progressChapters: 0,
        progressVolumes: 0,
      },
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added book to list with status PLANNING",
      entry: {
        id: created.id,
        bookId: created.bookId,
        status: created.status,
        progressPages: created.progressPages,
        progressChapters: created.progressChapters,
        progressVolumes: created.progressVolumes,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },
})
