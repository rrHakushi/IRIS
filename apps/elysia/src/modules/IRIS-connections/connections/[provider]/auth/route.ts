import { randomBytes } from "node:crypto";
import { defineRoute, t } from "../../../../../router";
import {
  getConnectionAdapter,
  createOAuthStateToken,
  type ConnectionProvider,
} from "@IRIS/connections";
import { cache } from "../../../../../utils/cache";

const oauthCache = cache.withNamespace("oauth:state");

export default defineRoute({
  GET: {
    schema: {
      params: t.Object({
        provider: t.String(),
      }),
      query: t.Optional(
        t.Object({
          redirectUri: t.Optional(t.String()),
          returnTo: t.Optional(t.String()),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          url: t.String(),
          state: t.String(),
        }),
      },
    },
    async handler({ params, query, session }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const provider = params.provider.toUpperCase() as ConnectionProvider;
      let adapter;
      try {
        adapter = getConnectionAdapter(provider);
      } catch {
        return new Response(
          JSON.stringify({ error: "Bad Request", message: `Unsupported provider: ${params.provider}` }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      if (!adapter.isConfigured()) {
        return new Response(
          JSON.stringify({
            error: "Provider Unavailable",
            message: `Connection provider ${provider} is not available on this server.`,
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      const apiUrl =
        process.env.API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        `http://localhost:${process.env.ELYSIA_PORT || 4000}`;
      const defaultCallback = `${apiUrl}/connections/${provider.toLowerCase()}/callback`;
      const redirectUri = query?.redirectUri || defaultCallback;

      // Generate a crypto random PKCE verifier for providers that use it (43-128 chars)
      const codeVerifier = randomBytes(48).toString("base64url").slice(0, 64);

      // Generate signed, stateless OAuth state token
      const state = createOAuthStateToken({
        userId: session.user.id,
        provider,
        redirectUri,
        codeVerifier,
        returnTo: query?.returnTo,
      });

      // Construct auth URL once with signed state token and deterministic codeVerifier
      const authRes = await adapter.getAuthUrl({
        state,
        redirectUri,
        codeVerifier,
      });

      // Also persist in cache for 15 minutes as fallback
      await oauthCache.set(
        state,
        {
          userId: session.user.id,
          provider,
          redirectUri,
          codeVerifier: authRes.codeVerifier || codeVerifier,
          returnTo: query?.returnTo,
        },
        900
      );

      return {
        success: true,
        url: authRes.url,
        state,
      };
    },
  },
});
