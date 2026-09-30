import { defineRoute, t } from "@/router"
import { Unauthorized, NotFound } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.String(),
    }),
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
      const requestId = params.id

      const request = await prisma.friendRequest.findUnique({
        where: { id: requestId },
      })

      if (
        !request ||
        (request.senderId !== userId && request.receiverId !== userId)
      ) {
        throw new NotFound("Friend request not found.")
      }

      await prisma.friendRequest.delete({
        where: { id: requestId },
      })

      return {
        success: true,
        message: "Friend request cancelled.",
      }
    },
  },
})
