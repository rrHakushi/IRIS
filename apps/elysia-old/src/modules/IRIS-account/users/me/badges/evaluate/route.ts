import { defineRoute, t } from "@/router"
import { badgeEvaluatorService } from "@/services/badge-evaluator.service"
import { IRISFlags } from "@IRIS/permissions"

export default defineRoute({
  POST: {
    rateLimit: {
      capacity: 1,
      duration: 24 * 60 * 60 * 1000, // 24 hours (86_400_000 ms)
      cost: 1,
      errorMessage:
        "You can only manually sync badge achievements once every 24 hours.",
    },
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          newlyAwardedCount: t.Number(),
          newlyAwardedBadgeIds: t.Array(t.Number()),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Evaluate and award all eligible badges for the current user",
        tags: ["Account - Badges"],
      },
    },
    async handler({ session }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Session expired" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          }
        )
      }

      const userId = session.user.id
      const isAdmin = session.hasPermission(IRISFlags.ADMINISTRATOR)

      const newlyAwarded: number[] = []

      // Evaluate role badges if admin
      if (isAdmin) {
        const roleAwarded = await badgeEvaluatorService.evaluateRoleBadges(userId, true)
        newlyAwarded.push(...roleAwarded)
      }

      // Evaluate all media consumption and custom list curation badges
      const progressionAwarded = await badgeEvaluatorService.evaluateAllBadges(userId)
      newlyAwarded.push(...progressionAwarded)

      return {
        success: true,
        newlyAwardedCount: newlyAwarded.length,
        newlyAwardedBadgeIds: newlyAwarded,
        message:
          newlyAwarded.length > 0
            ? `Successfully unlocked ${newlyAwarded.length} new badge(s)!`
            : "All badge achievements are up to date.",
      }
    },
  },
})
