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

      const blockerId = session.user.id
      const idOrBlockedId = params.id

      const blockRecord = await prisma.userBlock.findFirst({
        where: {
          blockerId,
          OR: [{ id: idOrBlockedId }, { blockedId: idOrBlockedId }],
        },
      })

      if (!blockRecord) {
        throw new NotFound("Blocked user entry not found.")
      }

      await prisma.userBlock.delete({
        where: { id: blockRecord.id },
      })

      return {
        success: true,
        message: "User unblocked.",
      }
    },
  },
})
