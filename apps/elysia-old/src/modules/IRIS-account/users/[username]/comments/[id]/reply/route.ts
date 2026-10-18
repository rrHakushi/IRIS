import { defineRoute, t } from "@/router"
import { NotFound, Forbidden, BadRequest } from "@/utils/errors"
import { getProfileCustomization } from "@IRIS/shared"
import { ProfileCommentReplySchema } from "../../route.js"

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
      id: t.String(),
    }),
  },

  // 1. Post a new reply (1 reply max, profile owner only)
  POST: {
    requireAuth: true,
    schema: {
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 5000 }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          reply: t.Optional(ProfileCommentReplySchema),
          data: t.Optional(ProfileCommentReplySchema),
        }),
      },
      detail: {
        summary: "Reply to a profile comment",
        tags: ["Users - Comments"],
      },
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

      if (!comment || comment.mediaType !== "profile") {
        throw new NotFound("Comment not found.")
      }

      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden(
          "Only the profile owner can reply to comments on their profile."
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
            authorProfile.displayName || session.user.username || "Profile owner"

          await notifications.send({
            userId: comment.authorId,
            app: "IRIS Account",
            category: "Social",
            type: "INFO",
            priority: "NORMAL",
            content: {
              title: `Reply on ${ownerName}'s Profile`,
              body: `${ownerName} replied: "${trimmedContent}"`,
              icon: authorProfile.avatarUrl ?? undefined,
              link: `/IRIS-account/users/${params.username}`,
              metadata: {
                commentId: comment.id,
                replyId: rawReply.id,
                ownerUsername: session.user.username,
              },
            },
          })
        } catch (notifErr) {
          console.warn(
            `[profileReply:POST] Failed to send notification to commentator:`,
            notifErr
          )
        }
      }

      const replyObject = {
        id: rawReply.id,
        commentId: rawReply.commentId,
        content: rawReply.content,
        createdAt: rawReply.createdAt.toISOString(),
        updatedAt: rawReply.updatedAt.toISOString(),
        author: authorProfile,
      }

      return {
        success: true,
        reply: replyObject,
        data: replyObject,
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
      response: {
        200: t.Object({
          success: t.Boolean(),
          reply: t.Optional(ProfileCommentReplySchema),
          data: t.Optional(ProfileCommentReplySchema),
        }),
      },
      detail: {
        summary: "Edit reply on a profile comment",
        tags: ["Users - Comments"],
      },
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

      if (!comment || comment.mediaType !== "profile") {
        throw new NotFound("Comment not found.")
      }

      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden(
          "Only the profile owner can edit replies on this profile."
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

      const updatedObject = {
        id: updatedReply.id,
        commentId: updatedReply.commentId,
        content: updatedReply.content,
        createdAt: updatedReply.createdAt.toISOString(),
        updatedAt: updatedReply.updatedAt.toISOString(),
        author: formatAuthorProfile(updatedReply.author),
      }

      return {
        success: true,
        reply: updatedObject,
        data: updatedObject,
      }
    },
  },

  // 3. Delete existing reply (owner only)
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
        summary: "Delete reply on a profile comment",
        tags: ["Users - Comments"],
      },
    },
    async handler({ params, session, prisma }) {
      const comment = await prisma.listComment.findUnique({
        where: { id: params.id || "" },
        include: { reply: true },
      })

      if (!comment || comment.mediaType !== "profile") {
        throw new NotFound("Comment not found.")
      }

      if (comment.listOwnerId !== session.user.id) {
        throw new Forbidden(
          "Only the profile owner can delete replies on this profile."
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
