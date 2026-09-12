import { defineRoute, t } from "../../../../router"
import {
  parseScopes,
  validateScopes,
  generateSecureToken,
  SCOPE_DEFINITIONS,
  type ScopeMetadata,
} from "../helpers/oauth-utils"

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        client_id: t.String(),
        redirect_uri: t.String(),
        response_type: t.Optional(t.String()),
        scope: t.Optional(t.String()),
        state: t.Optional(t.String()),
        code_challenge: t.Optional(t.String()),
        code_challenge_method: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          client: t.Object({
            clientId: t.String(),
            name: t.String(),
            description: t.Nullable(t.String()),
            logoUrl: t.Nullable(t.String()),
            websiteUrl: t.Nullable(t.String()),
            isPublic: t.Boolean(),
            isTrusted: t.Boolean(),
          }),
          requestedScopes: t.Array(t.String()),
          scopeDetails: t.Array(
            t.Object({
              scope: t.String(),
              name: t.String(),
              description: t.String(),
              isDangerous: t.Optional(t.Boolean()),
            })
          ),
          redirectUri: t.String(),
          state: t.Nullable(t.String()),
          hasExistingConsent: t.Boolean(),
          currentUser: t.Nullable(
            t.Object({
              id: t.String(),
              username: t.String(),
              email: t.Nullable(t.String()),
            })
          ),
        }),
      },
    },
    async handler({ query, prisma, session }) {
      const { client_id, redirect_uri, scope, state } = query

      const client = await prisma.oAuthClient.findUnique({
        where: { clientId: client_id },
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
        },
      })

      if (!client) {
        return new Response(
          JSON.stringify({
            error: "invalid_client",
            error_description: "Unknown client_id",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      // Validate redirect_uri matches one of the registered URIs
      const isRedirectValid = client.redirectUris.some((registered) => {
        try {
          const registeredUrl = new URL(registered)
          const providedUrl = new URL(redirect_uri)
          return (
            registeredUrl.origin === providedUrl.origin &&
            registeredUrl.pathname === providedUrl.pathname
          )
        } catch {
          return registered === redirect_uri
        }
      })

      if (!isRedirectValid) {
        return new Response(
          JSON.stringify({
            error: "invalid_request",
            error_description: "The redirect_uri does not match client registration.",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const requestedScopes = parseScopes(scope)
      const scopeCheck = validateScopes(requestedScopes, client.allowedScopes)
      if (!scopeCheck.valid) {
        return new Response(
          JSON.stringify({
            error: "invalid_scope",
            error_description: `Unsupported scope(s): ${scopeCheck.invalidScopes.join(", ")}`,
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const scopeDetails: ScopeMetadata[] = requestedScopes.map(
        (s) =>
          SCOPE_DEFINITIONS[s] || {
            scope: s,
            name: s,
            description: `Access to ${s} resource.`,
          }
      )

      let hasExistingConsent = false
      if (session.isAuthenticated && session.user) {
        const consent = await prisma.oAuthConsent.findUnique({
          where: {
            userId_clientId: {
              userId: session.user.id,
              clientId: client.id,
            },
          },
        })
        if (consent) {
          hasExistingConsent = requestedScopes.every((s) =>
            consent.scopes.includes(s)
          )
        }
      }

      return {
        success: true,
        client: {
          clientId: client.clientId,
          name: client.name,
          description: client.description,
          logoUrl: client.logoUrl,
          websiteUrl: client.websiteUrl,
          isPublic: client.isPublic,
          isTrusted: client.isTrusted,
        },
        requestedScopes,
        scopes: requestedScopes,
        scopeDetails,
        redirectUri: redirect_uri,
        state: state || null,
        hasExistingConsent,
        currentUser: session.user
          ? {
              id: session.user.id,
              username: session.user.username,
              email: session.user.email,
            }
          : null,
      }
    },
  },

  POST: {
    schema: {
      body: t.Object({
        client_id: t.String(),
        redirect_uri: t.String(),
        scope: t.Optional(t.String()),
        state: t.Optional(t.String()),
        code_challenge: t.Optional(t.String()),
        code_challenge_method: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          code: t.String(),
          redirectUrl: t.String(),
        }),
      },
    },
    async handler({ body, prisma, session }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({
            error: "unauthorized",
            error_description: "User authentication required to grant authorization.",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = body

      const client = await prisma.oAuthClient.findUnique({
        where: { clientId: client_id },
      })

      if (!client) {
        return new Response(
          JSON.stringify({
            error: "invalid_client",
            error_description: "Unknown client_id",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const isRedirectValid = client.redirectUris.some((registered) => {
        try {
          const registeredUrl = new URL(registered)
          const providedUrl = new URL(redirect_uri)
          return (
            registeredUrl.origin === providedUrl.origin &&
            registeredUrl.pathname === providedUrl.pathname
          )
        } catch {
          return registered === redirect_uri
        }
      })

      if (!isRedirectValid) {
        return new Response(
          JSON.stringify({
            error: "invalid_request",
            error_description: "The redirect_uri does not match client registration.",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const requestedScopes = parseScopes(scope)
      const scopeCheck = validateScopes(requestedScopes, client.allowedScopes)
      if (!scopeCheck.valid) {
        return new Response(
          JSON.stringify({
            error: "invalid_scope",
            error_description: `Unsupported scope(s): ${scopeCheck.invalidScopes.join(", ")}`,
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      // Generate single-use authorization code expiring in 10 minutes
      const code = generateSecureToken("iris_code_", 32)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

      await prisma.$transaction([
        prisma.oAuthAuthorizationCode.create({
          data: {
            code,
            clientId: client.id,
            userId: session.user.id,
            redirectUri: redirect_uri,
            scopes: requestedScopes,
            codeChallenge: code_challenge || null,
            codeChallengeMethod: code_challenge_method || (code_challenge ? "S256" : null),
            expiresAt,
          },
        }),
        prisma.oAuthConsent.upsert({
          where: {
            userId_clientId: {
              userId: session.user.id,
              clientId: client.id,
            },
          },
          update: {
            scopes: Array.from(new Set([...requestedScopes])),
          },
          create: {
            userId: session.user.id,
            clientId: client.id,
            scopes: requestedScopes,
          },
        }),
      ])

      const redirectUrl = new URL(redirect_uri)
      redirectUrl.searchParams.set("code", code)
      if (state) {
        redirectUrl.searchParams.set("state", state)
      }

      return {
        success: true,
        redirectUrl: redirectUrl.toString(),
        code,
        state: state || null,
      }
    },
  },
})
