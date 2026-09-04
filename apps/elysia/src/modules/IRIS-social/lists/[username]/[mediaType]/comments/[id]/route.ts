import { defineRoute, t } from "@/router"
import { NotFound, Unauthorized, Forbidden } from "@/utils/errors"
import { sendNotification } from "@/services/notification.service"
import { getProfileCustomization } from "@IRIS/shared"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      mediaType: t.String(),
      id: t.String(),
    }),
  },

  DELETE: {
    async handler({ params, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("Authentication required to delete comments.")
      }

      const commentDelegate = (prisma as any).listComment

      const comment = await commentDelegate.findUnique({
        where: { id: params.id || "" },
      })

      if (!comment) {
        throw new NotFound("Comment not found.")
      }

      // Only the list owner can delete comments on their list
      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden("Only the list owner can delete comments on this list.")
      }

      // Send notification to commentator (if commentator is someone else)
      if (comment.authorId !== session.user.id) {
        try {
          const ownerRecord = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { customization: true },
          })
          const ownerProfile = getProfileCustomization(ownerRecord?.customization)
          const ownerName = ownerProfile.displayName || session.user.username || "List owner"
          const formattedMediaType =
            params.mediaType.charAt(0).toUpperCase() +
            params.mediaType.slice(1).toLowerCase()

          await sendNotification({
            userId: comment.authorId,
            app: "IRIS List",
            category: "Social",
            type: "INFO",
            priority: "NORMAL",
            content: {
              title: `Comment Deleted`,
              body: `Your comment on ${ownerName}'s ${formattedMediaType} List was removed by the owner.`,
              icon: ownerProfile.avatarUrl ?? undefined,
              link: `/IRIS-list/lists/${params.username}/${params.mediaType}?tab=comments`,
              metadata: {
                commentId: comment.id,
                mediaType: params.mediaType,
                ownerUsername: session.user.username,
              },
            },
          })
        } catch (notifErr) {
          console.warn(`[comments:DELETE] Failed to send notification to commentator:`, notifErr)
        }
      }

      // Cascade deletion: ListCommentReply is deleted automatically via onDelete: Cascade
      await commentDelegate.delete({
        where: { id: comment.id },
      })

      return {
        success: true,
        message: "Comment and any replies deleted successfully.",
        id: comment.id,
      }
    },
  },
})
