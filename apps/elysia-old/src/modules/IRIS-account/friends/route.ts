import { defineRoute, t } from "@/router"
import { Unauthorized } from "@/utils/errors"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          friends: t.Array(
            t.Object({
              id: t.String(),
              friendId: t.String(),
              nickname: t.Nullable(t.String()),
              isPrivate: t.Boolean(),
              createdAt: t.String(),
              user: t.Object({
                id: t.String(),
                username: t.String(),
                customization: t.Any(),
                createdAt: t.String(),
              }),
            })
          ),
          incomingRequests: t.Array(
            t.Object({
              id: t.String(),
              senderId: t.String(),
              message: t.Nullable(t.String()),
              createdAt: t.String(),
              sender: t.Object({
                id: t.String(),
                username: t.String(),
                customization: t.Any(),
                createdAt: t.String(),
              }),
            })
          ),
          outgoingRequests: t.Array(
            t.Object({
              id: t.String(),
              receiverId: t.String(),
              message: t.Nullable(t.String()),
              createdAt: t.String(),
              receiver: t.Object({
                id: t.String(),
                username: t.String(),
                customization: t.Any(),
                createdAt: t.String(),
              }),
            })
          ),
          blockedUsers: t.Array(
            t.Object({
              id: t.String(),
              blockedId: t.String(),
              createdAt: t.String(),
              blocked: t.Object({
                id: t.String(),
                username: t.String(),
                customization: t.Any(),
                createdAt: t.String(),
              }),
            })
          ),
        }),
      },
    },
    async handler({ session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("You must be logged in to view friends.")
      }

      const userId = session.user.id

      const [friends, incomingRequests, outgoingRequests, blockedUsers] =
        await Promise.all([
          prisma.friend.findMany({
            where: { userId },
            include: {
              friend: {
                select: {
                  id: true,
                  username: true,
                  customization: true,
                  createdAt: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.friendRequest.findMany({
            where: { receiverId: userId, status: "PENDING" },
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  customization: true,
                  createdAt: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.friendRequest.findMany({
            where: { senderId: userId, status: "PENDING" },
            include: {
              receiver: {
                select: {
                  id: true,
                  username: true,
                  customization: true,
                  createdAt: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.userBlock.findMany({
            where: { blockerId: userId },
            include: {
              blocked: {
                select: {
                  id: true,
                  username: true,
                  customization: true,
                  createdAt: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
        ])

      return {
        success: true,
        friends: friends.map((f) => ({
          id: f.id,
          friendId: f.friendId,
          nickname: f.nickname,
          isPrivate: f.isPrivate,
          createdAt: f.createdAt.toISOString(),
          user: {
            id: f.friend.id,
            username: f.friend.username,
            customization: f.friend.customization,
            createdAt: f.friend.createdAt.toISOString(),
          },
        })),
        incomingRequests: incomingRequests.map((r) => ({
          id: r.id,
          senderId: r.senderId,
          message: r.message,
          createdAt: r.createdAt.toISOString(),
          sender: {
            id: r.sender.id,
            username: r.sender.username,
            customization: r.sender.customization,
            createdAt: r.sender.createdAt.toISOString(),
          },
        })),
        outgoingRequests: outgoingRequests.map((r) => ({
          id: r.id,
          receiverId: r.receiverId,
          message: r.message,
          createdAt: r.createdAt.toISOString(),
          receiver: {
            id: r.receiver.id,
            username: r.receiver.username,
            customization: r.receiver.customization,
            createdAt: r.receiver.createdAt.toISOString(),
          },
        })),
        blockedUsers: blockedUsers.map((b) => ({
          id: b.id,
          blockedId: b.blockedId,
          createdAt: b.createdAt.toISOString(),
          blocked: {
            id: b.blocked.id,
            username: b.blocked.username,
            customization: b.blocked.customization,
            createdAt: b.blocked.createdAt.toISOString(),
          },
        })),
      }
    },
  },
})
