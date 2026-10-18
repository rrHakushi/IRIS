import type { NotificationActionHandler } from "./types"
import { sendNotification } from "@/services/notification.service"
import { getProfileCustomization } from "@IRIS/shared"

/**
 * Action Handler: "lists.comment.reply"
 * Allows list owner to reply to a list comment directly from an interactive notification.
 * Enforces 1 reply max per comment.
 */
const listsCommentReplyAction: NotificationActionHandler = async ({
  notification,
  payload,
  resolvedStatus,
  sessionUser,
  prisma,
}) => {
  if (resolvedStatus === "REJECTED") {
    return { success: true, message: "Reply dismissed." }
  }

  const payloadObj =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {}

  const replyText = String(
    payloadObj.replyContent ||
      payloadObj.reply ||
      payloadObj.content ||
      (typeof payload === "string" ? payload : "")
  ).trim()

  if (!replyText) {
    return {
      success: false,
      error: "Reply content cannot be empty.",
    }
  }

  // Extract comment ID from notification actionPayload or user payload
  const notifActionPayload =
    typeof notification.actionPayload === "object" &&
    notification.actionPayload !== null
      ? (notification.actionPayload as Record<string, unknown>)
      : {}

  const commentId = String(
    notifActionPayload.commentId || payloadObj.commentId || ""
  )

  if (!commentId) {
    return {
      success: false,
      error: "Missing comment identifier in notification payload.",
    }
  }

  const commentDelegate = (prisma as any).listComment
  const replyDelegate = (prisma as any).listCommentReply

  // 1. Fetch comment with existing reply
  const comment = await commentDelegate.findUnique({
    where: { id: commentId },
    include: {
      reply: true,
      author: {
        select: {
          id: true,
          username: true,
          publicKey: true,
        },
      },
    },
  })

  if (!comment) {
    return {
      success: false,
      error: "The comment was removed or no longer exists.",
    }
  }

  // 2. Only list owner can reply
  if (comment.listOwnerId !== sessionUser.id) {
    return {
      success: false,
      error: "Only the list owner can reply to comments on this list.",
    }
  }

  // 3. 1 reply max
  if (comment.reply) {
    return {
      success: false,
      error:
        "This comment already has an owner reply. You can edit the existing reply in the comments tab.",
    }
  }

  // 4. Create reply
  const reply = await replyDelegate.create({
    data: {
      commentId: comment.id,
      authorId: sessionUser.id,
      content: replyText,
    },
  })

  // 5. Send notification to the commentator (if different from owner)
  if (comment.authorId !== sessionUser.id) {
    try {
      const ownerRecord = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { customization: true },
      })
      const ownerCustomization = getProfileCustomization(
        ownerRecord?.customization
      )
      const ownerName =
        ownerCustomization.displayName || sessionUser.username || "List owner"
      const rawMediaType = comment.mediaType || "media"
      const formattedMediaType =
        rawMediaType.charAt(0).toUpperCase() +
        rawMediaType.slice(1).toLowerCase()

      await sendNotification({
        userId: comment.authorId,
        app: "IRIS List",
        category: "Social",
        type: "INFO",
        priority: "NORMAL",
        content: {
          title: `Reply on ${ownerName}'s ${formattedMediaType} List`,
          body: `${ownerName} replied: "${replyText}"`,
          icon: ownerCustomization.avatarUrl ?? undefined,
          link: `/IRIS-list/lists/${sessionUser.username}/${comment.mediaType}?tab=comments`,
          metadata: {
            commentId: comment.id,
            replyId: reply.id,
            mediaType: comment.mediaType,
            ownerUsername: sessionUser.username,
          },
        },
      })
    } catch (notifErr) {
      console.warn(
        `[listsCommentReplyAction] Failed to send notification to commentator:`,
        notifErr
      )
    }
  }

  return {
    success: true,
    message: "Reply posted successfully.",
    resultPayload: {
      replyId: reply.id,
      commentId: comment.id,
      content: replyText,
      repliedAt: new Date().toISOString(),
    },
  }
}

export default listsCommentReplyAction
