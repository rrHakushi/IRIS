import { defineRoute, t } from "@/router"
import { NotFound, Forbidden } from "@/utils/errors"
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
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          id: t.String(),
        }),
      },
    },
    async handler({ params, session, prisma, notifications }) {
      const comment = await prisma.listComment.findUnique({
        where: { id: params.id || "" },
      })

      if (!comment) {
        throw new NotFound("Comment not found.")
      }

      // Only the list owner can delete comments on their list
      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden(
          "Only the list owner can delete comments on this list."
        )
      }

      // Send notification to commentator (if commentator is someone else)
      if (comment.authorId !== session.user.id) {
        try {
          const ownerRecord = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { customization: true },
          })
          const ownerProfile = getProfileCustomization(
            ownerRecord?.customization
          )
          const ownerName =
            ownerProfile.displayName || session.user.username || "List owner"
          const formattedMediaType =
            params.mediaType.charAt(0).toUpperCase() +
            params.mediaType.slice(1).toLowerCase()

          await notifications.send({
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
          console.warn(
            `[comments:DELETE] Failed to send notification to commentator:`,
            notifErr
          )
        }
      }

      // Cascade deletion: ListCommentReply is deleted automatically via onDelete: Cascade
      await prisma.listComment.delete({
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
