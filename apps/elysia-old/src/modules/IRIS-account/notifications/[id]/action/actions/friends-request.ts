import type { NotificationActionHandler } from "./types"
import { sendNotification } from "@/services/notification.service"
import { getProfileCustomization } from "@IRIS/shared"

/**
 * Action Handler: "friends.request"
 * Handles interactive friend request notifications: Accept, Decline, or Block.
 */
const friendsRequestAction: NotificationActionHandler = async ({
  notification,
  action,
  sessionUser,
  prisma,
}) => {
  const notifPayload =
    typeof notification.actionPayload === "object" &&
    notification.actionPayload !== null
      ? (notification.actionPayload as Record<string, unknown>)
      : {}

  const senderId = String(notifPayload.senderId || "")
  const requestId = String(notifPayload.requestId || "")

  const actionUpper = action.toUpperCase()

  if (actionUpper === "BLOCK") {
    // 1. Block user
    if (senderId) {
      await prisma.$transaction([
        prisma.friendRequest.deleteMany({
          where: {
            OR: [
              { senderId, receiverId: sessionUser.id },
              { senderId: sessionUser.id, receiverId: senderId },
            ],
          },
        }),
        prisma.friend.deleteMany({
          where: {
            OR: [
              { userId: sessionUser.id, friendId: senderId },
              { userId: senderId, friendId: sessionUser.id },
            ],
          },
        }),
        prisma.userBlock.upsert({
          where: {
            blockerId_blockedId: {
              blockerId: sessionUser.id,
              blockedId: senderId,
            },
          },
          create: {
            blockerId: sessionUser.id,
            blockedId: senderId,
          },
          update: {},
        }),
      ])
    }

    return {
      success: true,
      message: "User blocked.",
      resultPayload: { status: "BLOCKED" },
    }
  }

  if (
    actionUpper === "REJECT" ||
    actionUpper === "DECLINE" ||
    actionUpper === "DENY"
  ) {
    if (requestId) {
      await prisma.friendRequest.deleteMany({
        where: { id: requestId },
      })
    } else if (senderId) {
      await prisma.friendRequest.deleteMany({
        where: { senderId, receiverId: sessionUser.id },
      })
    }

    return {
      success: true,
      message: "Friend request declined.",
      resultPayload: { status: "DECLINED" },
    }
  }

  // ACCEPT / CONFIRM
  if (!senderId) {
    return {
      success: false,
      error: "Sender information missing from notification payload.",
    }
  }

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, username: true, customization: true },
  })

  if (!sender) {
    return {
      success: false,
      error: "User no longer exists.",
    }
  }

  // Check if already friends
  const existingFriend = await prisma.friend.findUnique({
    where: {
      userId_friendId: {
        userId: sessionUser.id,
        friendId: sender.id,
      },
    },
  })

  if (!existingFriend) {
    // Bilateral friendship creation + delete request + activity logs
    await prisma.$transaction([
      prisma.friend.create({
        data: {
          userId: sessionUser.id,
          friendId: sender.id,
          isPrivate: false,
        },
      }),
      prisma.friend.create({
        data: {
          userId: sender.id,
          friendId: sessionUser.id,
          isPrivate: false,
        },
      }),
      prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: sender.id, receiverId: sessionUser.id },
            { senderId: sessionUser.id, receiverId: sender.id },
          ],
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: sessionUser.id,
          type: "FRIEND_ADDED",
          title: `Became friends with @${sender.username}`,
          metadata: {
            friendId: sender.id,
            friendUsername: sender.username,
          },
          isPrivate: false,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: sender.id,
          type: "FRIEND_ADDED",
          title: `Became friends with @${sessionUser.username}`,
          metadata: {
            friendId: sessionUser.id,
            friendUsername: sessionUser.username,
          },
          isPrivate: false,
        },
      }),
    ])

    // Send confirmation notification to sender
    try {
      const userRecord = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { customization: true },
      })
      const customization = getProfileCustomization(userRecord?.customization)
      const senderDisplayName =
        customization.displayName || sessionUser.username

      await sendNotification({
        userId: sender.id,
        app: "IRIS-account",
        category: "friends",
        type: "INFO",
        priority: "NORMAL",
        content: {
          title: "Friend Request Accepted",
          body: `@${sessionUser.username} (${senderDisplayName}) accepted your friend request!`,
          icon: customization.avatarUrl ?? undefined,
          link: `/IRIS-account/users/${sessionUser.username}`,
          metadata: {
            friendId: sessionUser.id,
            friendUsername: sessionUser.username,
          },
        },
      })
    } catch (err) {
      console.warn(
        "[friendsRequestAction] Failed to send acceptance notification:",
        err
      )
    }
  }

  return {
    success: true,
    message: `You are now friends with @${sender.username}!`,
    resultPayload: {
      status: "ACCEPTED",
      friendId: sender.id,
      friendUsername: sender.username,
    },
  }
}

export default friendsRequestAction
