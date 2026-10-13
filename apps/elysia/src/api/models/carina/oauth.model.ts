import { t, type UnwrapSchema } from 'elysia'

export const CarinaOAuthModel = {
  // --- Discovery Metadata ---
  openidConfigResponse: t.Object({
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

  oauthServerConfigResponse: t.Object({
    issuer: t.String(),
    authorization_endpoint: t.String(),
    token_endpoint: t.String(),
    revocation_endpoint: t.String(),
    introspection_endpoint: t.String(),
    registration_endpoint: t.String(),
    scopes_supported: t.Array(t.String()),
    response_types_supported: t.Array(t.String()),
    grant_types_supported: t.Array(t.String()),
    code_challenge_methods_supported: t.Array(t.String()),
  }),

  // --- /carina/oauth/authorize ---
  authorizeQuery: t.Object({
    client_id: t.String({ description: 'Public Client ID of the OAuth application' }),
    redirect_uri: t.String({ description: 'Registered redirect callback URI' }),
    response_type: t.Optional(t.String({ default: 'code' })),
    scope: t.Optional(t.String()),
    state: t.Optional(t.String()),
    code_challenge: t.Optional(t.String()),
    code_challenge_method: t.Optional(t.String()),
  }),

  authorizeGetResponse: t.Object({
    success: t.Boolean(),
    client: t.Object({
      id: t.String(),
      clientId: t.String(),
      name: t.String(),
      description: t.Nullable(t.String()),
      logoUrl: t.Nullable(t.String()),
      websiteUrl: t.Nullable(t.String()),
      isPublic: t.Boolean(),
      isTrusted: t.Boolean(),
    }),
    requestedScopes: t.Array(t.String()),
    redirectUri: t.String(),
    state: t.Nullable(t.String()),
    currentUser: t.Nullable(
      t.Object({
        id: t.String(),
        username: t.String(),
        email: t.Nullable(t.String()),
      })
    ),
  }),

  authorizeBody: t.Object({
    client_id: t.String(),
    redirect_uri: t.String(),
    scope: t.Optional(t.String()),
    state: t.Optional(t.String()),
    code_challenge: t.Optional(t.String()),
    code_challenge_method: t.Optional(t.String()),
  }),

  authorizePostResponse: t.Object({
    success: t.Boolean(),
    code: t.String({ description: 'Single-use authorization code' }),
    redirectUrl: t.String({ description: 'Redirect URL with attached code and state' }),
    state: t.Nullable(t.String()),
  }),

  // --- /carina/oauth/token ---
  tokenBody: t.Object({
    grant_type: t.String({ description: 'authorization_code, refresh_token, or client_credentials' }),
    code: t.Optional(t.String()),
    redirect_uri: t.Optional(t.String()),
    client_id: t.Optional(t.String()),
    client_secret: t.Optional(t.String()),
    code_verifier: t.Optional(t.String()),
    refresh_token: t.Optional(t.String()),
    scope: t.Optional(t.String()),
  }),

  tokenResponse: t.Object({
    access_token: t.String(),
    token_type: t.Literal('Bearer'),
    expires_in: t.Number({ description: 'Lifespan in seconds' }),
    refresh_token: t.Optional(t.String()),
    scope: t.String(),
  }),

  // --- /carina/oauth/userinfo ---
  userinfoResponse: t.Object({
    sub: t.String(),
    id: t.String(),
    username: t.String(),
    name: t.String(),
    email: t.Nullable(t.String()),
    email_verified: t.Boolean(),
    permissions: t.Array(t.Number()),
  }),

  // --- /carina/oauth/revoke ---
  revokeBody: t.Object({
    token: t.String({ description: 'Access token or refresh token to revoke' }),
    token_type_hint: t.Optional(t.String()),
    client_id: t.Optional(t.String()),
    client_secret: t.Optional(t.String()),
  }),

  revokeResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- /carina/oauth/introspect ---
  introspectBody: t.Object({
    token: t.String({ description: 'Token to inspect' }),
    token_type_hint: t.Optional(t.String()),
    client_id: t.Optional(t.String()),
    client_secret: t.Optional(t.String()),
  }),

  introspectResponse: t.Object({
    active: t.Boolean(),
    client_id: t.Optional(t.String()),
    sub: t.Optional(t.String()),
    scope: t.Optional(t.String()),
    exp: t.Optional(t.Number()),
  }),

  // --- /carina/oauth/register ---
  registerClientBody: t.Object({
    client_name: t.String({ minLength: 1 }),
    redirect_uris: t.Array(t.String({ minLength: 1 })),
    logo_uri: t.Optional(t.String()),
    client_uri: t.Optional(t.String()),
    scope: t.Optional(t.String()),
    is_public: t.Optional(t.Boolean()),
  }),

  registerClientResponse: t.Object({
    client_id: t.String(),
    client_secret: t.Optional(t.String()),
    client_name: t.String(),
    redirect_uris: t.Array(t.String()),
    scopes: t.Array(t.String()),
  }),

  // --- Apps Management ---
  createAppBody: t.Object({
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
    redirectUris: t.Array(t.String({ minLength: 1 })),
    logoUrl: t.Optional(t.String()),
    websiteUrl: t.Optional(t.String()),
    isPublic: t.Optional(t.Boolean()),
  }),

  createAppResponse: t.Object({
    success: t.Boolean(),
    client: t.Object({
      id: t.String(),
      clientId: t.String(),
      clientSecret: t.Optional(t.String({ description: 'Plaintext secret - save now, will not be shown again' })),
      name: t.String(),
      description: t.Nullable(t.String()),
      logoUrl: t.Nullable(t.String()),
      websiteUrl: t.Nullable(t.String()),
      redirectUris: t.Array(t.String()),
      isPublic: t.Boolean(),
      isTrusted: t.Boolean(),
      createdAt: t.String(),
    }),
  }),

  updateAppBody: t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    description: t.Optional(t.String()),
    redirectUris: t.Optional(t.Array(t.String({ minLength: 1 }))),
    logoUrl: t.Optional(t.String()),
    websiteUrl: t.Optional(t.String()),
    isPublic: t.Optional(t.Boolean()),
  }),

  appDetailsResponse: t.Object({
    success: t.Boolean(),
    client: t.Object({
      id: t.String(),
      clientId: t.String(),
      name: t.String(),
      description: t.Nullable(t.String()),
      logoUrl: t.Nullable(t.String()),
      websiteUrl: t.Nullable(t.String()),
      redirectUris: t.Array(t.String()),
      isPublic: t.Boolean(),
      isTrusted: t.Boolean(),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  }),

  listAppsResponse: t.Object({
    success: t.Boolean(),
    clients: t.Array(
      t.Object({
        id: t.String(),
        clientId: t.String(),
        name: t.String(),
        description: t.Nullable(t.String()),
        logoUrl: t.Nullable(t.String()),
        websiteUrl: t.Nullable(t.String()),
        redirectUris: t.Array(t.String()),
        isPublic: t.Boolean(),
        isTrusted: t.Boolean(),
        createdAt: t.String(),
      })
    ),
  }),

  regenerateSecretResponse: t.Object({
    success: t.Boolean(),
    clientSecret: t.String({ description: 'Fresh plaintext client secret' }),
  }),

  deleteAppResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- User Grants Management ---
  listAuthorizationsResponse: t.Object({
    success: t.Boolean(),
    authorizations: t.Array(
      t.Object({
        id: t.String(),
        clientId: t.String(),
        appName: t.String(),
        appLogo: t.Nullable(t.String()),
        websiteUrl: t.Nullable(t.String()),
        scopes: t.Array(t.String()),
        authorizedAt: t.String(),
      })
    ),
  }),

  revokeAuthorizationResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- RFC 9457 Problem Details Error Schemas ---
  badRequestError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(400),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),

  unauthorizedError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(401),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),

  forbiddenError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(403),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),

  notFoundError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(404),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),

  validationError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(422),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),
} as const

export type CarinaOAuthModel = {
  [k in keyof typeof CarinaOAuthModel]: UnwrapSchema<(typeof CarinaOAuthModel)[k]>
}
