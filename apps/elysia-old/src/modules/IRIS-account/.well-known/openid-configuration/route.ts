import { defineRoute, t } from "../../../../router"
import { getIssuerUrl, SUPPORTED_SCOPES } from "../../oauth/helpers/oauth-utils"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          issuer: t.String(),
          authorization_endpoint: t.String(),
          token_endpoint: t.String(),
          userinfo_endpoint: t.String(),
          revocation_endpoint: t.String(),
          introspection_endpoint: t.String(),
          registration_endpoint: t.String(),
          scopes_supported: t.Array(t.String()),
          response_types_supported: t.Array(t.String()),
          grant_types_supported: t.Array(t.String()),
          token_endpoint_auth_methods_supported: t.Array(t.String()),
          code_challenge_methods_supported: t.Array(t.String()),
        }),
      },
    },
    async handler() {
      const issuer = getIssuerUrl()
      return {
        issuer,
        authorization_endpoint: `${issuer}/oauth/authorize`,
        token_endpoint: `${issuer}/oauth/token`,
        userinfo_endpoint: `${issuer}/oauth/userinfo`,
        revocation_endpoint: `${issuer}/oauth/revoke`,
        introspection_endpoint: `${issuer}/oauth/introspect`,
        registration_endpoint: `${issuer}/oauth/register`,
        scopes_supported: [...SUPPORTED_SCOPES],
        response_types_supported: ["code"],
        grant_types_supported: [
          "authorization_code",
          "refresh_token",
          "client_credentials",
        ],
        token_endpoint_auth_methods_supported: [
          "client_secret_basic",
          "client_secret_post",
          "none",
        ],
        code_challenge_methods_supported: ["S256", "plain"],
      }
    },
  },
})
