import { defineRoute, t } from "../../../../../../../router"

export default defineRoute({
  DELETE: {
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          count: t.Number(),
        }),
      },
    },
    async handler({ session, prisma }: any) {
      const user = session.getUser()!

      const result = await prisma.passCipher.deleteMany({
        where: {
          userId: user.id,
          deletedAt: { not: null },
        },
      })

      return {
        success: true,
        count: result.count,
      }
    },
  },
})
