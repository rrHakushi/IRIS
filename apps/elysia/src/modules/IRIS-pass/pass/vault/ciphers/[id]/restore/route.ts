import { defineRoute, t } from "../../../../../../../router"

export default defineRoute({
  POST: {
    requireAuth: true,
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
        }),
      },
    },
    async handler({ session, prisma, params, set }: any) {
      const user = session.getUser()!

      const existing = await prisma.passCipher.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        set.status = 404
        throw new Error("Cipher not found")
      }

      await prisma.passCipher.update({
        where: { id: params.id },
        data: { deletedAt: null },
      })

      return { success: true }
    },
  },
})
