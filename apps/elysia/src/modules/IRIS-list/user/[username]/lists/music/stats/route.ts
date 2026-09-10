import { defineRoute, t } from "@/router"
import { resolveTargetUserAndAccess } from "@/modules/IRIS-list/helpers"
import { mediaStatsService } from "@/services"
import {
  StatsQuerySchema,
  MediaStatsResponseSchema,
} from "@/modules/IRIS-list/stats-schemas"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
    query: StatsQuerySchema,
    response: {
      200: MediaStatsResponseSchema,
    },
    detail: {
      summary: "Fetch detailed statistics for user music list with optional rewind filters",
      tags: ["Lists - Music - Stats"],
    },
  },

  async GET({ params, query, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const stats = await mediaStatsService.getMusicStats(dbUser.id, isOwner, {
      year: query?.year !== undefined ? Number(query.year) : undefined,
      quarter: query?.quarter !== undefined ? Number(query.quarter) : undefined,
      month: query?.month !== undefined ? Number(query.month) : undefined,
    })

    return {
      success: true,
      data: stats,
    }
  },
})
