import {
  BadRequest,
  Conflict,
  Forbidden,
  NotFound,
  ErrorResponseSchema,
} from "@/utils/errors"
import { defineRoute, t } from "@/router"
import { IRISFlags } from "@IRIS/permissions"
import { queueBookFetch } from "@/services"

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    body: t.Optional(
      t.Object({
        force: t.Optional(t.Boolean({ default: false })),
        maxDepth: t.Optional(t.Number({ minimum: 0, maximum: 99, default: 0 })),
        priority: t.Optional(t.Number({ minimum: 0, maximum: 10, default: 1 })),
        maxRetries: t.Optional(
          t.Number({ minimum: 0, maximum: 99, default: 3 })
        ),
      })
    ),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        timestamp: t.String(),
      }),
      400: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
      409: ErrorResponseSchema,
    },
    detail: {
      summary: "Refresh book metadata",
      description:
        "Queues a background refresh job to sync book metadata from external providers. Requires Administrator permission.",
      tags: ["Media - Books"],
    },
  },

  async POST({ params, body, session, prisma }) {
    if (!session.hasPermission(IRISFlags.ADMINISTRATOR)) {
      return new Forbidden("Forbidden: Admin required")
    }

    const book = await prisma.book.findUnique({ where: { id: params.id } })
    if (!book) {
      return new NotFound("Book not found")
    }

    if (!book.googleBookId) {
      return new BadRequest("Book is missing googleBookId")
    }

    const queued = await queueBookFetch(book.googleBookId, {
      forceRefresh: body?.force,
      maxDepth: body?.maxDepth,
      priority: body?.priority,
      maxRetries: body?.maxRetries,
    })

    if (queued?.metadata?.skipped) {
      return new Conflict(
        `${queued.metadata.reason || "Book is already fresh in database"}`
      )
    }

    if (queued.status === "PROCESSING" || queued.status === "PENDING") {
      return {
        success: true,
        message: "Book queued for refresh",
        timestamp: new Date().toISOString(),
      }
    }

    return {
      success: false,
      message: "Failed to queue book for refresh",
      timestamp: new Date().toISOString(),
    }
  },
})
