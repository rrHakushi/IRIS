import { defineRoute, t } from "@/router"
import { Unauthorized, NotFound, BadRequest } from "@/utils/errors"

export default defineRoute({
  POST: {
    schema: {
      body: t.Object({
        targetUsername: t.String({ minLength: 1 }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    },
    async handler({ session, body, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        throw new Unauthorized("You must be logged in.")
      }

      const blockerId = session.user.id
      const targetUsername = body.targetUsername.trim()

      const targetUser = await prisma.user.findUnique({
        where: { username: targetUsername },
        select: { id: true, username: true },
      })

      if (!targetUser) {
        throw new NotFound(`User @${targetUsername} not found.`)
      }

      if (targetUser.id === blockerId) {
        throw new BadRequest("You cannot block yourself.")
      }

      const blockedId = targetUser.id

      await prisma.$transaction([
        prisma.friendRequest.deleteMany({
          where: {
            OR: [
              { senderId: blockerId, receiverId: blockedId },
              { senderId: blockedId, receiverId: blockerId },
            ],
          },
        }),
        prisma.friend.deleteMany({
          where: {
            OR: [
              { userId: blockerId, friendId: blockedId },
              { userId: blockedId, friendId: blockerId },
            ],
          },
        }),
        prisma.userBlock.upsert({
          where: {
            blockerId_blockedId: {
              blockerId,
              blockedId,
            },
          },
          create: {
            blockerId,
            blockedId,
          },
          update: {},
        }),
      ])

      return {
        success: true,
        message: `Blocked @${targetUser.username}.`,
      }
    },
  },
})
