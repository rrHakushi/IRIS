import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.String(),
    }),
  },

  DELETE: {
    requireAuth: true,
    async handler({ params, session, prisma }) {
      const user = session.requireUser()

      const consent = await prisma.oAuthConsent.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!consent) {
        return new Response(
          JSON.stringify({ error: "Authorization not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      await prisma.$transaction([
        // Revoke all access tokens for this user & client
        prisma.oAuthAccessToken.updateMany({
          where: {
            clientId: consent.clientId,
            userId: user.id,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        }),
        // Revoke all refresh tokens for this user & client
        prisma.oAuthRefreshToken.updateMany({
          where: {
            clientId: consent.clientId,
            userId: user.id,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        }),
        // Delete the consent grant
        prisma.oAuthConsent.delete({
          where: { id: consent.id },
        }),
      ])

      return {
        success: true,
        message: "Application authorization and tokens successfully revoked",
      }
    },
  },
})
