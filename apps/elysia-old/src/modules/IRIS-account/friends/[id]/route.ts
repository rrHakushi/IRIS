import { defineRoute, t } from "@/router"
import { Unauthorized, NotFound } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.String(),
    }),
  },
  PATCH: {
    schema: {
      body: t.Object({
        nickname: t.Optional(t.Nullable(t.String())),
        isPrivate: t.Optional(t.Boolean()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          friend: t.Object({
            id: t.String(),
            friendId: t.String(),
            nickname: t.Nullable(t.String()),
            isPrivate: t.Boolean(),
          }),
        }),
      },
    },
    async handler({ session, params, body, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("You must be logged in.")
      }

      const userId = session.user.id
      const idOrFriendId = params.id

      // Find friend record belonging to current user
      const friendRecord = await prisma.friend.findFirst({
        where: {
          userId,
          OR: [{ id: idOrFriendId }, { friendId: idOrFriendId }],
        },
      })

      if (!friendRecord) {
        throw new NotFound("Friend not found.")
      }

      const updateData: {
        nickname?: string | null
        isPrivate?: boolean
      } = {}

      if (body.nickname !== undefined) {
        updateData.nickname = body.nickname?.trim() || null
      }
      if (body.isPrivate !== undefined) {
        updateData.isPrivate = body.isPrivate
      }

      const updated = await prisma.friend.update({
        where: { id: friendRecord.id },
        data: updateData,
      })

      return {
        success: true,
        friend: {
          id: updated.id,
          friendId: updated.friendId,
          nickname: updated.nickname,
          isPrivate: updated.isPrivate,
        },
      }
    },
  },
  DELETE: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    },
    async handler({ session, params, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("You must be logged in.")
      }

      const userId = session.user.id
      const idOrFriendId = params.id

      const friendRecord = await prisma.friend.findFirst({
        where: {
          userId,
          OR: [{ id: idOrFriendId }, { friendId: idOrFriendId }],
        },
      })

      if (!friendRecord) {
        throw new NotFound("Friend not found.")
      }

      const targetFriendId = friendRecord.friendId

      // Remove bilateral friendship
      await prisma.friend.deleteMany({
        where: {
          OR: [
            { userId, friendId: targetFriendId },
            { userId: targetFriendId, friendId: userId },
          ],
        },
      })

      return {
        success: true,
        message: "Friend removed.",
      }
    },
  },
})
