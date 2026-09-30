import { defineRoute, t } from "@/router"
import { NotFound } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
  },
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          isFriend: t.Boolean(),
          isPendingIncoming: t.Boolean(),
          isPendingOutgoing: t.Boolean(),
          isBlocked: t.Boolean(),
          isBlockedBy: t.Boolean(),
          friendId: t.Optional(t.Nullable(t.String())),
          nickname: t.Optional(t.Nullable(t.String())),
          requestId: t.Optional(t.Nullable(t.String())),
        }),
      },
    },
    async handler({ session, params, prisma }) {
      const targetUsername = params.username.trim()

      const targetUser = await prisma.user.findUnique({
        where: { username: targetUsername },
        select: { id: true, username: true },
      })

      if (!targetUser) {
        throw new NotFound(`User @${targetUsername} not found.`)
      }

      if (!session.isAuthenticated || !session.user) {
        return {
          success: true,
          isFriend: false,
          isPendingIncoming: false,
          isPendingOutgoing: false,
          isBlocked: false,
          isBlockedBy: false,
        }
      }

      const currentUserId = session.user.id
      const targetUserId = targetUser.id

      if (currentUserId === targetUserId) {
        return {
          success: true,
          isFriend: false,
          isPendingIncoming: false,
          isPendingOutgoing: false,
          isBlocked: false,
          isBlockedBy: false,
        }
      }

      const [
        friendRecord,
        incomingRequest,
        outgoingRequest,
        iBlocked,
        theyBlocked,
      ] = await Promise.all([
        prisma.friend.findUnique({
          where: {
            userId_friendId: {
              userId: currentUserId,
              friendId: targetUserId,
            },
          },
        }),
        prisma.friendRequest.findUnique({
          where: {
            senderId_receiverId: {
              senderId: targetUserId,
              receiverId: currentUserId,
            },
          },
        }),
        prisma.friendRequest.findUnique({
          where: {
            senderId_receiverId: {
              senderId: currentUserId,
              receiverId: targetUserId,
            },
          },
        }),
        prisma.userBlock.findUnique({
          where: {
            blockerId_blockedId: {
              blockerId: currentUserId,
              blockedId: targetUserId,
            },
          },
        }),
        prisma.userBlock.findUnique({
          where: {
            blockerId_blockedId: {
              blockerId: targetUserId,
              blockedId: currentUserId,
            },
          },
        }),
      ])

      return {
        success: true,
        isFriend: Boolean(friendRecord),
        isPendingIncoming: Boolean(
          incomingRequest && incomingRequest.status === "PENDING"
        ),
        isPendingOutgoing: Boolean(
          outgoingRequest && outgoingRequest.status === "PENDING"
        ),
        isBlocked: Boolean(iBlocked),
        isBlockedBy: Boolean(theyBlocked),
        friendId: friendRecord?.id ?? null,
        nickname: friendRecord?.nickname ?? null,
        requestId: incomingRequest?.id ?? outgoingRequest?.id ?? null,
      }
    },
  },
})
