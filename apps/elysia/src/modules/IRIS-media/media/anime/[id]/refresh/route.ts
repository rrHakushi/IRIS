import {
  BadRequest,
  Conflict,
  NotFound,
  ErrorResponseSchema,
} from "@/utils/errors"
import { defineRoute, t } from "@/router"
import { IRISFlags } from "@IRIS/permissions"
import { queueAnimeFetch } from "@/services"

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
      summary: "Refresh anime metadata",
      description:
        "Queues a background refresh job to sync anime metadata from external providers. Requires Administrator permission.",
      tags: ["Media - Anime"],
    },
  },

  POST: {
    requirePermissions: [IRISFlags.ADMINISTRATOR],
    async handler({ params, body, prisma }) {
      const anime = await prisma.anime.findUnique({ where: { id: params.id } })
      if (!anime) {
        throw new NotFound("Anime not found")
      }

      if (!anime.anilistId) {
        throw new BadRequest("Anime is missing anilistId")
      }

      const queued = await queueAnimeFetch(anime.anilistId, {
        forceRefresh: body?.force,
        maxDepth: body?.maxDepth,
        priority: body?.priority,
        maxRetries: body?.maxRetries,
      })

      if (queued?.metadata?.skipped) {
        throw new Conflict(`${queued.metadata.reason}`)
      }

      if (queued.status === "PROCESSING" || queued.status === "PENDING") {
        return {
          success: true,
          message: "Anime queued for refresh",
          timestamp: new Date().toISOString(),
        }
      }

      return {
        success: false,
        message: "Failed to queue anime for refresh",
        timestamp: new Date().toISOString(),
      }
    },
  },
})
