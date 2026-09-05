import {
  BadRequest,
  Conflict,
  Forbidden,
  NotFound,
  ErrorResponseSchema,
} from "@/utils/errors"
import { defineRoute, t } from "@/router"
import { IRISFlags } from "@IRIS/permissions"
import { queueMusicFetch } from "@/services"

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
      summary: "Refresh music track metadata",
      description:
        "Queues a background refresh job to sync music metadata from external providers. Requires Administrator permission.",
      tags: ["Media - Music"],
    },
  },

  POST: {
    requirePermissions: [IRISFlags.ADMINISTRATOR],
    async handler({ params, body, prisma }) {
      const music = await prisma.music.findUnique({ where: { id: params.id } })
      if (!music) {
        throw new NotFound("Music track not found")
      }

      if (!music.musicBrainzId) {
        throw new BadRequest("Music track is missing musicBrainzId")
      }

      const queued = await queueMusicFetch(music.musicBrainzId, {
        forceRefresh: body?.force,
        maxDepth: body?.maxDepth,
        priority: body?.priority,
        maxRetries: body?.maxRetries,
      })

      if (queued?.metadata?.skipped) {
        throw new Conflict(
          `${queued.metadata.reason || "Music track is already fresh in database"}`
        )
      }

      if (queued.status === "PROCESSING" || queued.status === "PENDING") {
        return {
          success: true,
          message: "Music track queued for refresh",
          timestamp: new Date().toISOString(),
        }
      }

      return {
        success: false,
        message: "Failed to queue music track for refresh",
        timestamp: new Date().toISOString(),
      }
    },
  },
})
