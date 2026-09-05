import { defineRoute, t } from "@/router"
import { NotFound, Forbidden, BadRequest } from "@/utils/errors"
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
    requireAuth: true,
    schema: {
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
      }),
    },
    async handler({ params, body, session, prisma, notifications }) {
      const trimmedContent = body.content.trim()
      if (!trimmedContent) {
        throw new BadRequest("Reply content cannot be empty.")
      }

      const comment = await prisma.listComment.findUnique({
        where: { id: params.id || "" },
        include: { reply: true },
      })

      if (!comment) {
        throw new NotFound("Comment not found.")
      }

      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden(
          "Only the list owner can reply to comments on their list."
        )
      }

      if (comment.reply) {
        throw new BadRequest(
          "A reply already exists for this comment. Use PUT to edit it."
        )
      }

      const rawReply = await prisma.listCommentReply.create({
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
          const ownerName =
            authorProfile.displayName || session.user.username || "List owner"
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
          console.warn(
            `[reply:POST] Failed to send notification to commentator:`,
            notifErr
          )
        }
      }

      return {
        success: true,
        data: {
          id: rawReply.id,
          commentId: rawReply.commentId,
          content: rawReply.content,
          createdAt: rawReply.createdAt.toISOString(),
          updatedAt: rawReply.updatedAt.toISOString(),
          author: authorProfile,
        },
      }
    },
  },

  // 2. Edit existing reply (owner only)
  PUT: {
    requireAuth: true,
    schema: {
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
      }),
    },
    async handler({ params, body, session, prisma }) {
      const trimmedContent = body.content.trim()
      if (!trimmedContent) {
        throw new BadRequest("Reply content cannot be empty.")
      }

      const comment = await prisma.listComment.findUnique({
        where: { id: params.id || "" },
        include: { reply: true },
      })

      if (!comment) {
        throw new NotFound("Comment not found.")
      }

      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden(
          "Only the list owner can edit replies on this list."
        )
      }

      if (!comment.reply) {
        throw new NotFound("No reply exists to edit. Use POST to create one.")
      }

      const updatedReply = await prisma.listCommentReply.update({
        where: { id: comment.reply.id },
        data: { content: trimmedContent },
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
        data: {
          id: updatedReply.id,
          commentId: updatedReply.commentId,
          content: updatedReply.content,
          createdAt: updatedReply.createdAt.toISOString(),
          updatedAt: updatedReply.updatedAt.toISOString(),
          author: formatAuthorProfile(updatedReply.author),
        },
      }
    },
  },

  // 3. Delete existing reply (owner only)
  DELETE: {
    requireAuth: true,
    async handler({ params, session, prisma }) {
      const comment = await prisma.listComment.findUnique({
        where: { id: params.id || "" },
        include: { reply: true },
      })

      if (!comment) {
        throw new NotFound("Comment not found.")
      }

      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden(
          "Only the list owner can delete replies on this list."
        )
      }

      if (!comment.reply) {
        throw new NotFound("No reply exists to delete.")
      }

      await prisma.listCommentReply.delete({
        where: { id: comment.reply.id },
      })

      return {
        success: true,
        message: "Reply deleted successfully.",
        id: comment.reply.id,
      }
    },
  },
})
