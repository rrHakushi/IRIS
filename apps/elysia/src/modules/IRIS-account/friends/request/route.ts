import { defineRoute, t } from "@/router"
import {
  Unauthorized,
  BadRequest,
  NotFound,
  Forbidden,
  Conflict,
} from "@/utils/errors"
import { sendNotification } from "@/services/notification.service"
import { getProfileCustomization } from "@IRIS/shared"

export default defineRoute({
  POST: {
    schema: {
      body: t.Object({
        targetUsername: t.String({ minLength: 1 }),
        message: t.Optional(t.String({ maxLength: 50 })),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          requestId: t.String(),
        }),
      },
    },
    async handler({ session, body, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("You must be logged in to send a friend request.")
      }

      const senderId = session.user.id
      const targetUsername = body.targetUsername.trim()
      const reqMessage = body.message?.trim().slice(0, 50) || null

      const targetUser = await prisma.user.findUnique({
        where: { username: targetUsername },
        select: { id: true, username: true },
      })

      if (!targetUser) {
        throw new NotFound(`User @${targetUsername} not found.`)
      }

      if (targetUser.id === senderId) {
        throw new BadRequest("You cannot send a friend request to yourself.")
      }

      // Check if blocked by or blocking target
      const isBlocked = await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: senderId, blockedId: targetUser.id },
            { blockerId: targetUser.id, blockedId: senderId },
          ],
        },
      })

      if (isBlocked) {
        throw new Forbidden("Unable to send friend request to this user.")
      }

      // Check if already friends
      const alreadyFriends = await prisma.friend.findUnique({
        where: {
          userId_friendId: {
            userId: senderId,
            friendId: targetUser.id,
          },
        },
      })

      if (alreadyFriends) {
        throw new Conflict(`You are already friends with @${targetUser.username}.`)
      }

      // Upsert friend request
      const friendRequest = await prisma.friendRequest.upsert({
        where: {
          senderId_receiverId: {
            senderId,
            receiverId: targetUser.id,
          },
        },
        create: {
          senderId,
          receiverId: targetUser.id,
          message: reqMessage,
          status: "PENDING",
        },
        update: {
          message: reqMessage,
          status: "PENDING",
        },
      })

      // Send actionable notification with Accept/Decline/Block to recipient
      try {
        const senderRecord = await prisma.user.findUnique({
          where: { id: senderId },
          select: { customization: true, username: true },
        })
        const customization = getProfileCustomization(
          senderRecord?.customization
        )
        const senderDisplayName =
          customization.displayName || session.user.username

        await sendNotification({
          userId: targetUser.id,
          app: "IRIS-account",
          category: "friends",
          type: "ACTION_CONFIRM",
          priority: "NORMAL",
          actionHandler: "friends.request",
          actionPayload: {
            requestId: friendRequest.id,
            senderId,
            senderUsername: session.user.username,
            senderDisplayName,
            message: reqMessage,
          },
          content: {
            title: `Friend request from @${session.user.username}`,
            body: reqMessage
              ? `"${reqMessage}" — @${session.user.username} (${senderDisplayName}) sent you a friend request.`
              : `@${session.user.username} (${senderDisplayName}) sent you a friend request.`,
            icon: customization.avatarUrl ?? undefined,
            link: `/IRIS-account/users/${session.user.username}`,
            actionConfirm: {
              confirmLabel: "Accept",
              confirmVariant: "default",
              rejectLabel: "Decline",
              rejectVariant: "outline",
            },
            metadata: {
              requestId: friendRequest.id,
              senderId,
              senderUsername: session.user.username,
              senderDisplayName,
              message: reqMessage,
            },
          },
        })
      } catch (notifErr) {
        console.warn(
          "[FriendRequest] Failed to dispatch real-time notification:",
          notifErr
        )
      }

      return {
        success: true,
        message: `Friend request sent to @${targetUser.username}!`,
        requestId: friendRequest.id,
      }
    },
  },
})
