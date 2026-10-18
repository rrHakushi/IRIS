import { defineRoute, t } from "@/router"
import { NotFound, Forbidden } from "@/utils/errors"
import { IRISFlags } from "@IRIS/permissions"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.String({ description: "Activity log ID" }),
    }),
  },

  DELETE: {
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          id: t.String(),
        }),
      },
      detail: {
        summary: "Delete an activity log entry",
        tags: ["Users - Activity"],
      },
    },
    async handler({ params, session, prisma }) {
      const currentUserId = session.user.id
      const isAdmin = session.hasPermission(IRISFlags.ADMINISTRATOR)

      const activity = await prisma.activityLog.findUnique({
        where: { id: params.id },
      })

      if (!activity) {
        throw new NotFound(`Activity with ID '${params.id}' not found.`)
      }

      const isOwner = currentUserId === activity.userId

      if (!isOwner && !isAdmin) {
        throw new Forbidden(
          "You do not have permission to delete this activity log."
        )
      }

      await prisma.activityLog.delete({
        where: { id: params.id },
      })

      return {
        success: true,
        message: "Activity log deleted successfully",
        id: params.id,
      }
    },
  },
})
