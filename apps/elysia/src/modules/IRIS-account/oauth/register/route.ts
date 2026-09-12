import { defineRoute, t } from "../../../../router"
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  parseScopes,
  SUPPORTED_SCOPES,
} from "../helpers/oauth-utils"

export default defineRoute({
  POST: {
    schema: {
      body: t.Object({
        client_name: t.String({ minLength: 1, maxLength: 100 }),
        redirect_uris: t.Array(t.String({ minLength: 1 })),
        client_uri: t.Optional(t.String()),
        logo_uri: t.Optional(t.String()),
        scope: t.Optional(t.String()),
        is_public: t.Optional(t.Boolean()),
      }),
    },
    async handler({ body, prisma, session }) {
      // If user is authenticated, link to their account; otherwise, assign to a system administrator account or first user
      let ownerId = session.user?.id
      if (!ownerId) {
        const adminUser = await prisma.user.findFirst({
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
        ownerId = adminUser?.id
      }

      if (!ownerId) {
        return new Response(
          JSON.stringify({
            error: "server_error",
            error_description: "Cannot dynamically register application: no user account available",
          }),
          { status: 500, headers: { "content-type": "application/json" } }
        )
      }

      const clientId = generateClientId()
      const isPublic = body.is_public ?? false
      const rawSecret = isPublic ? null : generateClientSecret()
      const hashedSecret = rawSecret ? hashClientSecret(rawSecret) : null

      const requestedScopes = body.scope ? parseScopes(body.scope) : [...SUPPORTED_SCOPES]

      const client = await prisma.oAuthClient.create({
        data: {
          clientId,
          clientSecret: hashedSecret,
          name: body.client_name,
          websiteUrl: body.client_uri || null,
          logoUrl: body.logo_uri || null,
          redirectUris: body.redirect_uris,
          allowedScopes: requestedScopes,
          isPublic,
          isTrusted: false,
          userId: ownerId,
        },
      })

      return {
        client_id: client.clientId,
        client_secret: rawSecret,
        client_name: client.name,
        client_uri: client.websiteUrl,
        logo_uri: client.logoUrl,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: client.allowedScopes.join(" "),
      }
    },
  },
})
