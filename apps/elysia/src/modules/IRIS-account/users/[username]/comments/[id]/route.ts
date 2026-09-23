import { defineRoute, t } from "@/router"
import { NotFound, Forbidden } from "@/utils/errors"
import { getProfileCustomization } from "@IRIS/shared"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.String(),
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
        summary: "Delete a profile comment",
        tags: ["Users - Comments"],
      },
    },
    async handler({ params, session, prisma, notifications }) {
      const comment = await prisma.listComment.findUnique({
        where: { id: params.id || "" },
      })

      if (!comment || comment.mediaType !== "profile") {
        throw new NotFound("Comment not found.")
      }

      // Allowed if user is list/profile owner OR comment author
      const isOwner = comment.listOwnerId === session.user.id
      const isAuthor = comment.authorId === session.user.id

      if (!isOwner && !isAuthor) {
        throw new Forbidden(
          "You do not have permission to delete this comment."
        )
      }

      // Send notification to commentator if deleted by profile owner
      if (isOwner && comment.authorId !== session.user.id) {
        try {
          const ownerRecord = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { customization: true },
          })
          const ownerProfile = getProfileCustomization(
            ownerRecord?.customization
          )
          const ownerName =
            ownerProfile.displayName || session.user.username || "Profile owner"

          await notifications.send({
            userId: comment.authorId,
            app: "IRIS Account",
            category: "Social",
            type: "INFO",
            priority: "NORMAL",
            content: {
              title: `Comment Deleted`,
              body: `Your comment on ${ownerName}'s profile was removed by the owner.`,
              icon: ownerProfile.avatarUrl ?? undefined,
              link: `/IRIS-account/users/${params.username}`,
              metadata: {
                commentId: comment.id,
                ownerUsername: session.user.username,
              },
            },
          })
        } catch (notifErr) {
          console.warn(
            `[profileComments:DELETE] Failed to send notification to commentator:`,
            notifErr
          )
        }
      }

      // Delete comment
      await prisma.listComment.delete({
        where: { id: comment.id },
      })

      return {
        success: true,
        message: "Comment deleted successfully.",
        id: comment.id,
      }
    },
  },
})
