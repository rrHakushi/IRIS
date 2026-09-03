import {
  BadRequest,
  Conflict,
  Forbidden,
  NotFound,
  ErrorResponseSchema,
} from "@/utils/errors"
import { defineRoute, t } from "@/router"
import { IRISFlags } from "@IRIS/permissions"
import { queueMovieFetch } from "@/services"

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
      summary: "Refresh movie metadata",
      description:
        "Queues a background refresh job to sync movie metadata from external providers. Requires Administrator permission.",
      tags: ["Media - Movies"],
    },
  },

  async POST({ params, body, session, prisma }) {
    if (!session.hasPermission(IRISFlags.ADMINISTRATOR)) {
      return new Forbidden("Forbidden: Admin required")
    }

    const movie = await prisma.movie.findUnique({ where: { id: params.id } })
    if (!movie) {
      return new NotFound("Movie not found")
    }

    if (!movie.tvDBId) {
      return new BadRequest("Movie is missing tvDBId")
    }

    const queued = await queueMovieFetch(movie.tvDBId, {
      forceRefresh: body?.force,
      maxDepth: body?.maxDepth,
      priority: body?.priority,
      maxRetries: body?.maxRetries,
    })

    if (queued?.metadata?.skipped) {
      return new Conflict(
        `${queued.metadata.reason || "Movie is already fresh in database"}`
      )
    }

    if (queued.status === "PROCESSING" || queued.status === "PENDING") {
      return {
        success: true,
        message: "Movie queued for refresh",
        timestamp: new Date().toISOString(),
      }
    }

    return {
      success: false,
      message: "Failed to queue movie for refresh",
      timestamp: new Date().toISOString(),
    }
  },
})
