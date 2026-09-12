import { defineRoute, t } from "../../../../../router"
import {
  getConnectionAdapter,
  encryptConnectionData,
  verifyOAuthStateToken,
  type ConnectionProvider,
  type OAuthStatePayload,
} from "@IRIS/connections"
import type {
  ConnectionProvider as PrismaConnectionProvider,
  ConnectionAuthType as PrismaConnectionAuthType,
} from "@IRIS/database"
import { cache } from "../../../../../utils/cache"

const oauthCache = cache.withNamespace("oauth:state")

export default defineRoute({
  GET: {
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Optional(
        t.Object({
          code: t.Optional(t.String()),
          token: t.Optional(t.String()),
          state: t.Optional(t.String()),
          error: t.Optional(t.String()),
          error_description: t.Optional(t.String()),
          openid_claimed_id: t.Optional(t.String()),
        })
      ),
    },
    async handler({ params, query, request, prisma }) {
      const provider = params.id.toUpperCase() as ConnectionProvider
      const frontendBase = process.env.NEXTAUTH_URL

      const defaultErrorRedirect = (msg: string) =>
        Response.redirect(
          `${frontendBase}/settings?tab=connections&status=error&provider=${provider}&message=${encodeURIComponent(msg)}`,
          302
        )

      let rawUrlParams: URLSearchParams | null = null
      try {
        if (request?.url) {
          rawUrlParams = new URL(request.url).searchParams
        }
      } catch {}

      if (query?.error) {
        const msg =
          query.error_description || query.error || "Authorization declined"
        return defaultErrorRedirect(msg)
      }

      const state = query?.state || rawUrlParams?.get("state")
      if (!state) {
        return defaultErrorRedirect("Missing OAuth state parameter")
      }

      // 1. First try verifying HMAC-signed stateless token
      let stateData: OAuthStatePayload | null = verifyOAuthStateToken(state)

      // 2. Fall back to cache store if signed token verification wasn't matching
      if (!stateData) {
        const cached = await oauthCache.get<OAuthStatePayload>(state)
        if (cached) {
          stateData = cached
        }
      }

      if (!stateData) {
        return defaultErrorRedirect("OAuth session expired or invalid")
      }

      // Cleanup cache if it was stored
      await oauthCache.del(state)

      // Support standard OAuth2 code, Last.fm token, and Steam OpenID claimed_id
      const claimedId =
        rawUrlParams?.get("openid.claimed_id") ||
        rawUrlParams?.get("openid_claimed_id") ||
        rawUrlParams?.get("openid.identity") ||
        query?.openid_claimed_id ||
        (query as Record<string, string | undefined>)?.["openid.claimed_id"] ||
        ""
      const code =
        query?.code ||
        query?.token ||
        rawUrlParams?.get("code") ||
        rawUrlParams?.get("token") ||
        claimedId
      if (!code) {
        return defaultErrorRedirect(
          "Missing authorization code or OpenID identity from provider"
        )
      }

      let adapter
      try {
        adapter = getConnectionAdapter(provider)
      } catch {
        return defaultErrorRedirect(`Unsupported provider: ${provider}`)
      }

      try {
        const tokens = await adapter.exchangeAuthCode(
          code,
          stateData.redirectUri,
          stateData.codeVerifier,
          { hostUrl: stateData.hostUrl }
        )

        if (stateData.hostUrl && !tokens.hostUrl) {
          tokens.hostUrl = stateData.hostUrl
        }

        const profile = await adapter.getProfile(tokens)
        const encryptedData = encryptConnectionData(tokens, stateData.userId)

        const expiresAtDate = tokens.expiresAt
          ? new Date(tokens.expiresAt)
          : null

        await prisma.connection.upsert({
          where: {
            userId_provider_externalId: {
              userId: stateData.userId,
              provider: provider as PrismaConnectionProvider,
              externalId: profile.id || "default",
            },
          },
          create: {
            userId: stateData.userId,
            provider: provider as PrismaConnectionProvider,
            authType: adapter.authType as PrismaConnectionAuthType,
            externalId: profile.id || "default",
            displayName: profile.displayName || profile.username || provider,
            avatarUrl: profile.avatarUrl || null,
            profileUrl: profile.profileUrl || null,
            encryptedData,
            status: "CONNECTED",
            settings: {
              librarySync: true,
              isPrivate: false,
              ...(stateData.hostUrl ? { hostUrl: stateData.hostUrl } : {}),
            },
            expiresAt: expiresAtDate,
            lastSyncedAt: new Date(),
          },
          update: {
            authType: adapter.authType as PrismaConnectionAuthType,
            displayName: profile.displayName || profile.username || provider,
            avatarUrl: profile.avatarUrl || null,
            profileUrl: profile.profileUrl || null,
            encryptedData,
            status: "CONNECTED",
            errorMessage: null,
            expiresAt: expiresAtDate,
            lastSyncedAt: new Date(),
          },
        })

        // Determine destination redirect from returnTo
        let destinationUrl: URL
        try {
          destinationUrl = new URL(
            stateData.returnTo || `${frontendBase}/settings?tab=connections`,
            frontendBase
          )
        } catch {
          destinationUrl = new URL(`${frontendBase}/settings?tab=connections`)
        }

        destinationUrl.searchParams.set("status", "connected")
        destinationUrl.searchParams.set("provider", provider)

        return Response.redirect(destinationUrl.toString(), 302)
      } catch (err: unknown) {
        console.error(
          `[Connections] OAuth callback failed for ${provider}:`,
          err
        )
        const errorMsg = (err as Error).message || "Token exchange failed"

        let errorDestUrl: URL
        try {
          errorDestUrl = new URL(
            stateData.returnTo || `${frontendBase}/settings?tab=connections`,
            frontendBase
          )
        } catch {
          errorDestUrl = new URL(`${frontendBase}/settings?tab=connections`)
        }

        errorDestUrl.searchParams.set("status", "error")
        errorDestUrl.searchParams.set("provider", provider)
        errorDestUrl.searchParams.set("message", errorMsg)

        return Response.redirect(errorDestUrl.toString(), 302)
      }
    },
  },
})
