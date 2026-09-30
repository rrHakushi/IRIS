import { defineRoute, t } from "@/router"
import { Unauthorized, NotFound, BadRequest } from "@/utils/errors"
import { sendNotification } from "@/services/notification.service"
import { getProfileCustomization } from "@IRIS/shared"

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.String(),
    }),
  },
  POST: {
    schema: {
      body: t.Object({
        action: t.Union([
          t.Literal("ACCEPT"),
          t.Literal("DECLINE"),
          t.Literal("BLOCK"),
        ]),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    },
    async handler({ session, params, body, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("You must be logged in.")
      }

      const receiverId = session.user.id
      const requestId = params.id
      const action = body.action

      const friendRequest = await prisma.friendRequest.findUnique({
        where: { id: requestId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              customization: true,
            },
          },
        },
      })

      if (!friendRequest || friendRequest.receiverId !== receiverId) {
        throw new NotFound("Friend request not found.")
      }

      const sender = friendRequest.sender

      if (action === "BLOCK") {
        await prisma.$transaction([
          prisma.friendRequest.deleteMany({
            where: {
              OR: [
                { senderId: sender.id, receiverId },
                { senderId: receiverId, receiverId: sender.id },
              ],
            },
          }),
          prisma.friend.deleteMany({
            where: {
              OR: [
                { userId: receiverId, friendId: sender.id },
                { userId: sender.id, friendId: receiverId },
              ],
            },
          }),
          prisma.userBlock.upsert({
            where: {
              blockerId_blockedId: {
                blockerId: receiverId,
                blockedId: sender.id,
              },
            },
            create: {
              blockerId: receiverId,
              blockedId: sender.id,
            },
            update: {},
          }),
        ])

        return {
          success: true,
          message: `Blocked @${sender.username}.`,
        }
      }

      if (action === "DECLINE") {
        await prisma.friendRequest.delete({
          where: { id: requestId },
        })

        return {
          success: true,
          message: "Friend request declined.",
        }
      }

      // ACCEPT
      await prisma.$transaction([
        prisma.friend.upsert({
          where: {
            userId_friendId: {
              userId: receiverId,
              friendId: sender.id,
            },
          },
          create: {
            userId: receiverId,
            friendId: sender.id,
            isPrivate: false,
          },
          update: {},
        }),
        prisma.friend.upsert({
          where: {
            userId_friendId: {
              userId: sender.id,
              friendId: receiverId,
            },
          },
          create: {
            userId: sender.id,
            friendId: receiverId,
            isPrivate: false,
          },
          update: {},
        }),
        prisma.friendRequest.deleteMany({
          where: {
            OR: [
              { senderId: sender.id, receiverId },
              { senderId: receiverId, receiverId: sender.id },
            ],
          },
        }),
        prisma.activityLog.create({
          data: {
            userId: receiverId,
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
            title: `Became friends with @${session.user.username}`,
            metadata: {
              friendId: receiverId,
              friendUsername: session.user.username,
            },
            isPrivate: false,
          },
        }),
      ])

      // Send acceptance notification to sender
      try {
        const userRecord = await prisma.user.findUnique({
          where: { id: receiverId },
          select: { customization: true },
        })
        const customization = getProfileCustomization(userRecord?.customization)
        const displayName = customization.displayName || session.user.username

        await sendNotification({
          userId: sender.id,
          app: "IRIS-account",
          category: "friends",
          type: "INFO",
          priority: "NORMAL",
          content: {
            title: "Friend Request Accepted",
            body: `@${session.user.username} (${displayName}) accepted your friend request!`,
            icon: customization.avatarUrl ?? undefined,
            link: `/IRIS-account/users/${session.user.username}`,
            metadata: {
              friendId: receiverId,
              friendUsername: session.user.username,
            },
          },
        })
      } catch (err) {
        console.warn(
          "[FriendRespond] Failed to send acceptance notification:",
          err
        )
      }

      return {
        success: true,
        message: `You are now friends with @${sender.username}!`,
      }
    },
  },
})
