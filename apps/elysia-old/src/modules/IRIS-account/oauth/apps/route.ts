import { defineRoute, t } from "../../../../router"
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  parseScopes,
  SUPPORTED_SCOPES,
} from "../helpers/oauth-utils"

export default defineRoute({
  GET: {
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          apps: t.Array(t.Any()),
        }),
      },
    },
    async handler({ session, prisma }) {
      const user = session.requireUser()

      const apps = await prisma.oAuthClient.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          clientId: true,
          name: true,
          description: true,
          logoUrl: true,
          websiteUrl: true,
          redirectUris: true,
          allowedScopes: true,
          isPublic: true,
          isTrusted: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              consents: true,
              accessTokens: true,
            },
          },
        },
      })

      return {
        success: true,
        apps: apps.map((app) => ({
          ...app,
          createdAt: app.createdAt.toISOString(),
          updatedAt: app.updatedAt.toISOString(),
          authorizedUsersCount: app._count.consents,
          activeTokensCount: app._count.accessTokens,
        })),
      }
    },
  },

  POST: {
    requireAuth: true,
    schema: {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String({ maxLength: 500 })),
        websiteUrl: t.Optional(t.String()),
        logoUrl: t.Optional(t.String()),
        redirectUris: t.Array(t.String({ minLength: 1 })),
        allowedScopes: t.Optional(t.Array(t.String())),
        isPublic: t.Optional(t.Boolean()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          app: t.Any(),
        }),
      },
    },
    async handler({ body, session, prisma }) {
      const user = session.requireUser()

      const clientId = generateClientId()
      const isPublic = body.isPublic ?? false
      const rawSecret = isPublic ? null : generateClientSecret()
      const hashedSecret = rawSecret ? hashClientSecret(rawSecret) : null

      const scopes = body.allowedScopes?.length
        ? body.allowedScopes
        : [...SUPPORTED_SCOPES]

      const app = await prisma.oAuthClient.create({
        data: {
          clientId,
          clientSecret: hashedSecret,
          name: body.name,
          description: body.description || null,
          websiteUrl: body.websiteUrl || null,
          logoUrl: body.logoUrl || null,
          redirectUris: body.redirectUris,
          allowedScopes: scopes,
          isPublic,
          isTrusted: false,
          userId: user.id,
        },
      })

      return {
        success: true,
        app: {
          id: app.id,
          clientId: app.clientId,
          clientSecret: rawSecret, // Returned once upon creation
          name: app.name,
          description: app.description,
          websiteUrl: app.websiteUrl,
          logoUrl: app.logoUrl,
          redirectUris: app.redirectUris,
          allowedScopes: app.allowedScopes,
          isPublic: app.isPublic,
          createdAt: app.createdAt.toISOString(),
        },
      }
    },
  },
})
