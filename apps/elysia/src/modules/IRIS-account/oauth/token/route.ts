import { defineRoute, t } from "../../../../router"
import {
  verifyClientSecret,
  verifyPkceChallenge,
  generateSecureToken,
} from "../helpers/oauth-utils"

export default defineRoute({
  POST: {
    schema: {
      body: t.Object({
        grant_type: t.String(),
        code: t.Optional(t.String()),
        redirect_uri: t.Optional(t.String()),
        client_id: t.Optional(t.String()),
        client_secret: t.Optional(t.String()),
        code_verifier: t.Optional(t.String()),
        refresh_token: t.Optional(t.String()),
        scope: t.Optional(t.String()),
      }),
    },
    async handler({ body, request, prisma }) {
      // Parse Basic Auth header if client credentials are sent in Authorization header
      let effectiveClientId = body.client_id
      let effectiveClientSecret = body.client_secret

      const authHeader = request.headers.get("authorization")
      if (authHeader && authHeader.startsWith("Basic ")) {
        try {
          const base64 = authHeader.slice(6).trim()
          const decoded = Buffer.from(base64, "base64").toString("utf-8")
          const [u, p] = decoded.split(":")
          if (u && !effectiveClientId) effectiveClientId = u
          if (p && !effectiveClientSecret) effectiveClientSecret = p
        } catch {
          // ignore basic auth parse failure
        }
      }

      const { grant_type } = body

      // -------------------------------------------------------------
      // 1. Authorization Code Grant
      // -------------------------------------------------------------
      if (grant_type === "authorization_code") {
        const { code, redirect_uri, code_verifier } = body

        if (!code) {
          return new Response(
            JSON.stringify({
              error: "invalid_request",
              error_description: "Missing 'code' parameter",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        }

        const authCode = await prisma.oAuthAuthorizationCode.findUnique({
          where: { code },
          include: { client: true, user: true },
        })

        if (!authCode) {
          return new Response(
            JSON.stringify({
              error: "invalid_grant",
              error_description: "Authorization code not found or invalid",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        }

        // Detect code reuse / replay attacks
        if (authCode.usedAt !== null) {
          // Security violation: Revoke all tokens associated with this authorization
          await prisma.oAuthAccessToken.updateMany({
            where: { clientId: authCode.clientId, userId: authCode.userId },
            data: { revokedAt: new Date() },
          })
          return new Response(
            JSON.stringify({
              error: "invalid_grant",
              error_description: "Authorization code has already been redeemed. Tokens revoked for security.",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        }

        // Verify expiration
        if (authCode.expiresAt.getTime() < Date.now()) {
          return new Response(
            JSON.stringify({
              error: "invalid_grant",
              error_description: "Authorization code has expired",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        }

        // Verify client matching
        if (effectiveClientId && authCode.client.clientId !== effectiveClientId) {
          return new Response(
            JSON.stringify({
              error: "invalid_client",
              error_description: "Client mismatch",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        }

        // Verify client secret if client is confidential (not public)
        if (!authCode.client.isPublic && authCode.client.clientSecret) {
          if (!effectiveClientSecret || !verifyClientSecret(effectiveClientSecret, authCode.client.clientSecret)) {
            return new Response(
              JSON.stringify({
                error: "invalid_client",
                error_description: "Invalid client credentials",
              }),
              { status: 401, headers: { "content-type": "application/json" } }
            )
          }
        }

        // Verify redirect_uri
        if (redirect_uri && authCode.redirectUri !== redirect_uri) {
          return new Response(
            JSON.stringify({
              error: "invalid_grant",
              error_description: "redirect_uri mismatch",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        }

        // Verify PKCE if challenge was set
        if (authCode.codeChallenge) {
          if (!code_verifier) {
            return new Response(
              JSON.stringify({
                error: "invalid_request",
                error_description: "Missing PKCE code_verifier",
              }),
              { status: 400, headers: { "content-type": "application/json" } }
            )
          }
          const method = (authCode.codeChallengeMethod as "S256" | "plain") || "S256"
          const pkceValid = verifyPkceChallenge(code_verifier, authCode.codeChallenge, method)
          if (!pkceValid) {
            return new Response(
              JSON.stringify({
                error: "invalid_grant",
                error_description: "PKCE verification failed",
              }),
              { status: 400, headers: { "content-type": "application/json" } }
            )
          }
        }

        // Mark code as used
        await prisma.oAuthAuthorizationCode.update({
          where: { id: authCode.id },
          data: { usedAt: new Date() },
        })

        // Generate tokens
        const accessToken = generateSecureToken("iris_at_", 36)
        const refreshToken = generateSecureToken("iris_rt_", 36)

        const accessExpiresIn = 30 * 24 * 3600 // 30 days in seconds
        const accessExpiresAt = new Date(Date.now() + accessExpiresIn * 1000)
        const refreshExpiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000) // 90 days

        await prisma.$transaction([
          prisma.oAuthAccessToken.create({
            data: {
              token: accessToken,
              clientId: authCode.client.id,
              userId: authCode.user.id,
              scopes: authCode.scopes,
              expiresAt: accessExpiresAt,
            },
          }),
          prisma.oAuthRefreshToken.create({
            data: {
              token: refreshToken,
              clientId: authCode.client.id,
              userId: authCode.user.id,
              scopes: authCode.scopes,
              expiresAt: refreshExpiresAt,
            },
          }),
        ])

        return {
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: accessExpiresIn,
          refresh_token: refreshToken,
          scope: authCode.scopes.join(" "),
        }
      }

      // -------------------------------------------------------------
      // 2. Refresh Token Grant
      // -------------------------------------------------------------
      if (grant_type === "refresh_token") {
        const { refresh_token } = body

        if (!refresh_token) {
          return new Response(
            JSON.stringify({
              error: "invalid_request",
              error_description: "Missing 'refresh_token' parameter",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        }

        const tokenRecord = await prisma.oAuthRefreshToken.findUnique({
          where: { token: refresh_token },
          include: { client: true, user: true },
        })

        if (!tokenRecord || tokenRecord.revokedAt !== null || tokenRecord.expiresAt.getTime() < Date.now()) {
          return new Response(
            JSON.stringify({
              error: "invalid_grant",
              error_description: "Refresh token is invalid, expired, or revoked",
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        }

        // Validate client credentials if confidential
        if (!tokenRecord.client.isPublic && tokenRecord.client.clientSecret) {
          if (!effectiveClientSecret || !verifyClientSecret(effectiveClientSecret, tokenRecord.client.clientSecret)) {
            return new Response(
              JSON.stringify({
                error: "invalid_client",
                error_description: "Invalid client credentials",
              }),
              { status: 401, headers: { "content-type": "application/json" } }
            )
          }
        }

        // Rotate tokens
        const newAccessToken = generateSecureToken("iris_at_", 36)
        const newRefreshToken = generateSecureToken("iris_rt_", 36)

        const accessExpiresIn = 30 * 24 * 3600
        const accessExpiresAt = new Date(Date.now() + accessExpiresIn * 1000)
        const refreshExpiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000)

        await prisma.$transaction([
          // Revoke old refresh token
          prisma.oAuthRefreshToken.update({
            where: { id: tokenRecord.id },
            data: { revokedAt: new Date() },
          }),
          // Issue new access token
          prisma.oAuthAccessToken.create({
            data: {
              token: newAccessToken,
              clientId: tokenRecord.clientId,
              userId: tokenRecord.userId,
              scopes: tokenRecord.scopes,
              expiresAt: accessExpiresAt,
            },
          }),
          // Issue rotated refresh token
          prisma.oAuthRefreshToken.create({
            data: {
              token: newRefreshToken,
              clientId: tokenRecord.clientId,
              userId: tokenRecord.userId,
              scopes: tokenRecord.scopes,
              expiresAt: refreshExpiresAt,
            },
          }),
        ])

        return {
          access_token: newAccessToken,
          token_type: "Bearer",
          expires_in: accessExpiresIn,
          refresh_token: newRefreshToken,
          scope: tokenRecord.scopes.join(" "),
        }
      }

      // -------------------------------------------------------------
      // 3. Client Credentials Grant
      // -------------------------------------------------------------
      if (grant_type === "client_credentials") {
        if (!effectiveClientId || !effectiveClientSecret) {
          return new Response(
            JSON.stringify({
              error: "invalid_client",
              error_description: "Client ID and client secret are required for client_credentials grant",
            }),
            { status: 401, headers: { "content-type": "application/json" } }
          )
        }

        const client = await prisma.oAuthClient.findUnique({
          where: { clientId: effectiveClientId },
          include: { user: true },
        })

        if (!client || !client.clientSecret || !verifyClientSecret(effectiveClientSecret, client.clientSecret)) {
          return new Response(
            JSON.stringify({
              error: "invalid_client",
              error_description: "Invalid client credentials",
            }),
            { status: 401, headers: { "content-type": "application/json" } }
          )
        }

        const accessToken = generateSecureToken("iris_at_", 36)
        const accessExpiresIn = 30 * 24 * 3600
        const accessExpiresAt = new Date(Date.now() + accessExpiresIn * 1000)

        await prisma.oAuthAccessToken.create({
          data: {
            token: accessToken,
            clientId: client.id,
            userId: client.userId,
            scopes: client.allowedScopes,
            expiresAt: accessExpiresAt,
          },
        })

        return {
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: accessExpiresIn,
          scope: client.allowedScopes.join(" "),
        }
      }

      return new Response(
        JSON.stringify({
          error: "unsupported_grant_type",
          error_description: `Grant type '${grant_type}' is not supported`,
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    },
  },
})
