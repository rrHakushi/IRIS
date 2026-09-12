import { defineRoute, t } from "../../../../router"
import { SCOPE_DEFINITIONS } from "../helpers/oauth-utils"

export default defineRoute({
  GET: {
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          authorizations: t.Array(t.Any()),
        }),
      },
    },
    async handler({ session, prisma }) {
      const user = session.requireUser()

      const consents = await prisma.oAuthConsent.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              id: true,
              clientId: true,
              name: true,
              description: true,
              logoUrl: true,
              websiteUrl: true,
              isPublic: true,
              isTrusted: true,
            },
          },
        },
      })

      // Fetch last token activity for each client
      const authorizations = await Promise.all(
        consents.map(async (consent) => {
          const lastToken = await prisma.oAuthAccessToken.findFirst({
            where: {
              clientId: consent.clientId,
              userId: user.id,
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true, expiresAt: true, revokedAt: true },
          })

          const scopeDetails = consent.scopes.map((s) => SCOPE_DEFINITIONS[s] || {
            scope: s,
            name: s,
            description: `Access to ${s}`,
          })

          return {
            id: consent.id,
            clientId: consent.clientId,
            client: consent.client,
            scopes: consent.scopes,
            scopeDetails,
            authorizedAt: consent.createdAt.toISOString(),
            updatedAt: consent.updatedAt.toISOString(),
            lastUsedAt: lastToken?.createdAt ? lastToken.createdAt.toISOString() : null,
            isActive: lastToken ? lastToken.revokedAt === null && lastToken.expiresAt.getTime() > Date.now() : true,
          }
        })
      )

      return {
        success: true,
        authorizations,
      }
    },
  },
})
