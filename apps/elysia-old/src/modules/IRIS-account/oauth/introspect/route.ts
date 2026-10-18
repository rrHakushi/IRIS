import { defineRoute, t } from "../../../../router"

export default defineRoute({
  POST: {
    schema: {
      body: t.Object({
        token: t.String(),
      }),
      response: {
        200: t.Object({
          active: t.Boolean(),
          scope: t.Optional(t.String()),
          client_id: t.Optional(t.String()),
          sub: t.Optional(t.String()),
          exp: t.Optional(t.Number()),
          token_type: t.Optional(t.String()),
        }),
      },
    },
    async handler({ body, prisma }) {
      const { token } = body

      // Check access tokens
      const accessToken = await prisma.oAuthAccessToken.findUnique({
        where: { token },
        include: { client: true },
      })

      if (
        accessToken &&
        accessToken.revokedAt === null &&
        accessToken.expiresAt.getTime() > Date.now()
      ) {
        return {
          active: true,
          scope: accessToken.scopes.join(" "),
          client_id: accessToken.client.clientId,
          sub: accessToken.userId,
          exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
          token_type: "Bearer",
        }
      }

      // Check refresh tokens
      const refreshToken = await prisma.oAuthRefreshToken.findUnique({
        where: { token },
        include: { client: true },
      })

      if (
        refreshToken &&
        refreshToken.revokedAt === null &&
        refreshToken.expiresAt.getTime() > Date.now()
      ) {
        return {
          active: true,
          scope: refreshToken.scopes.join(" "),
          client_id: refreshToken.client.clientId,
          sub: refreshToken.userId,
          exp: Math.floor(refreshToken.expiresAt.getTime() / 1000),
          token_type: "refresh_token",
        }
      }

      return {
        active: false,
      }
    },
  },
})
