import { defineRoute, t } from "../../../../../../../router"

export default defineRoute({
  PATCH: {
    requireAuth: true,
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        favorite: t.Boolean(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          favorite: t.Boolean(),
        }),
      },
    },
    async handler({ session, prisma, params, body, set }: any) {
      const user = session.getUser()!

      const existing = await prisma.passCipher.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        set.status = 404
        throw new Error("Cipher not found")
      }

      const updated = await prisma.passCipher.update({
        where: { id: params.id },
        data: { favorite: body.favorite },
      })

      return {
        success: true,
        favorite: updated.favorite,
      }
    },
  },
})
