import { defineRoute, t } from "../../../../router"

export default defineRoute({
  POST: {
    schema: {
      body: t.Object({
        token: t.String(),
        token_type_hint: t.Optional(t.String()),
      }),
    },
    async handler({ body, prisma }) {
      const { token } = body

      // Try revoking as access token
      const accessUpdated = await prisma.oAuthAccessToken.updateMany({
        where: { token, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      // Try revoking as refresh token
      const refreshUpdated = await prisma.oAuthRefreshToken.updateMany({
        where: { token, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      // RFC 7009 specifies 200 OK regardless of whether the token previously existed
      return {
        success: true,
        revoked: accessUpdated.count > 0 || refreshUpdated.count > 0,
      }
    },
  },
})
