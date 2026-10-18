import { defineRoute, t } from "@/router"
import { NotFound, Forbidden, Unauthorized } from "@/utils/errors"
import { IRISFlags } from "@IRIS/permissions"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      mediaType: t.String(),
      id: t.String({ description: "Activity log ID" }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
    detail: {
      summary: "Delete an activity log entry",
      tags: ["Lists - Activity"],
    },
  },

  async DELETE({ params, prisma, session }) {
    if (!session?.isAuthenticated) {
      throw new Unauthorized("Authentication required")
    }

    const currentUserId = session.user?.id
    if (!currentUserId) {
      throw new Unauthorized("Authentication required")
    }

    const activity = await prisma.activityLog.findUnique({
      where: { id: params.id },
    })

    if (!activity) {
      throw new NotFound(`Activity with ID '${params.id}' not found.`)
    }

    const isOwner = currentUserId === activity.userId
    const isAdmin = session.hasPermission(IRISFlags.ADMINISTRATOR)

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
    }
  },
})
