import { defineRoute, t } from "@/router"
import { NotFound, Unauthorized, Forbidden, BadRequest } from "@/utils/errors"
import { sendNotification } from "@/services/notification.service"
import { getProfileCustomization } from "@IRIS/shared"

function formatAuthorProfile(user: {
  id: string
  username: string
  customization?: unknown
}) {
  const profile = getProfileCustomization(user.customization)
  const trimmedDisplayName =
    typeof profile.displayName === "string" ? profile.displayName.trim() : ""

  return {
    id: user.id,
    username: user.username,
    displayName: trimmedDisplayName !== "" ? trimmedDisplayName : null,
    avatarUrl: profile.avatarUrl ?? null,
    avatarFrame: profile.avatarFrame ?? null,
    bannerUrl: profile.bannerUrl ?? null,
    nameplateUrl: profile.nameplateUrl ?? null,
    bio: profile.bio ?? null,
    statusText: profile.statusText ?? null,
    pronouns: profile.pronouns ?? null,
    displayNameStyle: profile.displayNameStyle ?? null,
  }
}

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      mediaType: t.String(),
      id: t.String(),
    }),
  },

  // 1. Post a new reply (1 reply max, owner only)
  POST: {
    schema: {
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
      }),
    },
    async handler({ params, body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("Authentication required to reply.")
      }

      const trimmedContent = body.content.trim()
      if (!trimmedContent) {
        throw new BadRequest("Reply content cannot be empty.")
      }

      const commentDelegate = (prisma as any).listComment
      const replyDelegate = (prisma as any).listCommentReply

      const comment = await commentDelegate.findUnique({
        where: { id: params.id || "" },
        include: { reply: true },
      })

      if (!comment) {
        throw new NotFound("Comment not found.")
      }

      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden("Only the list owner can reply to comments on their list.")
      }

      // Enforce 1 reply max per comment
      if (comment.reply) {
        throw new BadRequest(
          "This comment already has an owner reply. You can edit the existing reply instead."
        )
      }

      const rawReply = await replyDelegate.create({
        data: {
          commentId: comment.id,
          authorId: session.user.id,
          content: trimmedContent,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              customization: true,
            },
          },
        },
      })

      const authorProfile = formatAuthorProfile(rawReply.author)

      // Send notification to commentator (if commentator is someone else)
      if (comment.authorId !== session.user.id) {
        try {
          const ownerName = authorProfile.displayName || session.user.username || "List owner"
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
              title: `Reply on ${ownerName}'s ${formattedMediaType} List`,
              body: `${ownerName} replied: "${trimmedContent}"`,
              icon: authorProfile.avatarUrl ?? undefined,
              link: `/IRIS-list/lists/${params.username}/${params.mediaType}?tab=comments`,
              metadata: {
                commentId: comment.id,
                replyId: rawReply.id,
                mediaType: params.mediaType,
                ownerUsername: session.user.username,
              },
            },
          })
        } catch (notifErr) {
          console.warn(`[reply:POST] Failed to send notification to commentator:`, notifErr)
        }
      }

      return {
        success: true,
        reply: {
          id: rawReply.id,
          commentId: rawReply.commentId,
          authorId: rawReply.authorId,
          content: rawReply.content,
          createdAt:
            rawReply.createdAt instanceof Date
              ? rawReply.createdAt.toISOString()
              : rawReply.createdAt,
          updatedAt:
            rawReply.updatedAt instanceof Date
              ? rawReply.updatedAt.toISOString()
              : rawReply.updatedAt,
          author: authorProfile,
        },
      }
    },
  },

  // 2. Edit existing reply (owner only)
  PUT: {
    schema: {
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
      }),
    },
    async handler({ params, body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("Authentication required to edit reply.")
      }

      const trimmedContent = body.content.trim()
      if (!trimmedContent) {
        throw new BadRequest("Reply content cannot be empty.")
      }

      const commentDelegate = (prisma as any).listComment
      const replyDelegate = (prisma as any).listCommentReply

      const comment = await commentDelegate.findUnique({
        where: { id: params.id || "" },
        include: { reply: true },
      })

      if (!comment) {
        throw new NotFound("Comment not found.")
      }

      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden("Only the list owner can edit replies on this list.")
      }

      if (!comment.reply) {
        throw new NotFound("No reply exists to edit.")
      }

      const updatedReply = await replyDelegate.update({
        where: { commentId: comment.id },
        data: {
          content: trimmedContent,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              customization: true,
            },
          },
        },
      })

      return {
        success: true,
        reply: {
          id: updatedReply.id,
          commentId: updatedReply.commentId,
          authorId: updatedReply.authorId,
          content: updatedReply.content,
          createdAt:
            updatedReply.createdAt instanceof Date
              ? updatedReply.createdAt.toISOString()
              : updatedReply.createdAt,
          updatedAt:
            updatedReply.updatedAt instanceof Date
              ? updatedReply.updatedAt.toISOString()
              : updatedReply.updatedAt,
          author: formatAuthorProfile(updatedReply.author),
        },
      }
    },
  },

  // 3. Delete reply completely (owner only)
  DELETE: {
    async handler({ params, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("Authentication required to delete reply.")
      }

      const commentDelegate = (prisma as any).listComment
      const replyDelegate = (prisma as any).listCommentReply

      const comment = await commentDelegate.findUnique({
        where: { id: params.id || "" },
        include: { reply: true },
      })

      if (!comment) {
        throw new NotFound("Comment not found.")
      }

      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden("Only the list owner can delete replies on this list.")
      }

      if (!comment.reply) {
        throw new NotFound("No reply exists to delete.")
      }

      await replyDelegate.delete({
        where: { commentId: comment.id },
      })

      return {
        success: true,
        message: "Reply deleted successfully.",
        commentId: comment.id,
      }
    },
  },
})
