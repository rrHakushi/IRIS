import { t, type UnwrapSchema } from 'elysia'

/**
 * Reusable pagination metadata schema
 */
export const PaginationMetaSchema = t.Object({
  page: t.Number({ description: 'Current page number' }),
  limit: t.Number({ description: 'Items per page limit' }),
  total: t.Number({ description: 'Total number of items' }),
  totalPages: t.Number({ description: 'Total number of pages available' }),
  hasMore: t.Boolean({ description: 'Whether additional pages exist beyond this one' }),
})

export const CarinaConnectionsModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schema (Strictly ID or Provider) ---
  connectionParam: t.Object({
    connectionId: t.String({
      minLength: 1,
      description: 'Connection unique ID (UUID) or provider identifier (e.g. MAL, ANILIST)',
    }),
  }),

  // Shared connection item representation (Tokens/Credentials encrypted & sanitized)
  connectionItem: t.Object({
    id: t.String({ description: 'Connection unique identifier (UUID)' }),
    userId: t.String({ description: 'Owner user ID (UUID)' }),
    provider: t.String({ description: 'Third-party provider identifier (e.g. ANILIST, MAL, STEAM)' }),
    authType: t.String({ description: 'Authentication type (OAUTH2, API_KEY, CREDENTIALS, OPENID)' }),
    externalId: t.Nullable(t.String({ description: 'External third-party user ID or username' })),
    displayName: t.Nullable(t.String({ description: 'External profile display name' })),
    avatarUrl: t.Nullable(t.String({ description: 'External profile avatar URL' })),
    profileUrl: t.Nullable(t.String({ description: 'External profile page URL' })),
    status: t.String({ description: 'Connection status (CONNECTED, EXPIRED, REVOKED, ERROR, DISCONNECTED)' }),
    errorMessage: t.Nullable(t.String({ description: 'Last connection error message if any' })),
    settings: t.Nullable(t.Any({ description: 'User-configured integration settings' })),
    lastSyncedAt: t.Nullable(t.String({ description: 'Last sync ISO timestamp, or null' })),
    expiresAt: t.Nullable(t.String({ description: 'OAuth token expiration ISO timestamp, or null' })),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
    updatedAt: t.String({ description: 'Last update ISO timestamp' }),
  }),

  // Shared provider capability representation
  providerCapability: t.Object({
    authType: t.String(),
    category: t.String(),
    supportsOAuth: t.Boolean(),
    supportsApiKey: t.Boolean(),
    supportsCredentials: t.Boolean(),
    supportsSearch: t.Boolean(),
    supportsLibrarySync: t.Boolean(),
    supportsScrobble: t.Boolean(),
    supportsGamingLibrary: t.Boolean(),
  }),

  // Shared provider metadata item representation
  providerMetadataItem: t.Object({
    provider: t.String({ description: 'Provider enum key' }),
    name: t.String({ description: 'Display name' }),
    category: t.String({ description: 'Category (TRACKING, GAMING, MEDIA, SERVARR, MUSIC)' }),
    description: t.String({ description: 'Provider integration description' }),
    iconUrl: t.String({ description: 'Provider icon URL' }),
    iconName: t.Optional(t.String({ description: 'Tabler icon name' })),
    accentColor: t.Optional(t.String({ description: 'Hex branding color' })),
    websiteUrl: t.String({ description: 'Provider official website URL' }),
    defaultHostUrl: t.Optional(t.Nullable(t.String({ description: 'Default host URL for self-hosted services' }))),
    capabilities: t.Object({
      authType: t.String(),
      category: t.String(),
      supportsOAuth: t.Boolean(),
      supportsApiKey: t.Boolean(),
      supportsCredentials: t.Boolean(),
      supportsSearch: t.Boolean(),
      supportsLibrarySync: t.Boolean(),
      supportsScrobble: t.Boolean(),
      supportsGamingLibrary: t.Boolean(),
    }),
    isConfigured: t.Boolean({ description: 'Whether required server environment variables are configured' }),
  }),

  // --- GET /carina/connections (Get connected accounts - 10 per page default) ---
  listConnectionsQuery: t.Object({
    page: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50, description: 'Items per page' })),
    provider: t.Optional(t.String({ description: 'Filter by provider identifier' })),
    status: t.Optional(t.String({ description: 'Filter by connection status' })),
  }),

  listConnectionsResponse: t.Object({
    success: t.Boolean(),
    total: t.Number({ description: 'Total connections matching filters' }),
    connections: t.Array(
      t.Object({
        id: t.String(),
        userId: t.String(),
        provider: t.String(),
        authType: t.String(),
        externalId: t.Nullable(t.String()),
        displayName: t.Nullable(t.String()),
        avatarUrl: t.Nullable(t.String()),
        profileUrl: t.Nullable(t.String()),
        status: t.String(),
        errorMessage: t.Nullable(t.String()),
        settings: t.Nullable(t.Any()),
        lastSyncedAt: t.Nullable(t.String()),
        expiresAt: t.Nullable(t.String()),
        createdAt: t.String(),
        updatedAt: t.String(),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- POST /carina/connections (Create manual connection with credentials) ---
  createConnectionBody: t.Object({
    provider: t.String({ minLength: 1, description: 'Provider identifier' }),
    authType: t.Optional(t.String()),
    apiKey: t.Optional(t.String()),
    hostUrl: t.Optional(t.String()),
    username: t.Optional(t.String()),
    password: t.Optional(t.String()),
    settings: t.Optional(t.Any()),
  }),

  createConnectionResponse: t.Object({
    success: t.Boolean(),
    connection: t.Object({
      id: t.String(),
      provider: t.String(),
      displayName: t.Nullable(t.String()),
      status: t.String(),
    }),
  }),

  // --- GET /carina/connections/providers (Get available third-party providers) ---
  listProvidersResponse: t.Object({
    success: t.Boolean(),
    total: t.Number({ description: 'Total available providers' }),
    providers: t.Array(
      t.Object({
        provider: t.String(),
        name: t.String(),
        category: t.String(),
        description: t.String(),
        iconUrl: t.String(),
        iconName: t.Optional(t.String()),
        accentColor: t.Optional(t.String()),
        websiteUrl: t.String(),
        defaultHostUrl: t.Optional(t.Nullable(t.String())),
        capabilities: t.Object({
          authType: t.String(),
          category: t.String(),
          supportsOAuth: t.Boolean(),
          supportsApiKey: t.Boolean(),
          supportsCredentials: t.Boolean(),
          supportsSearch: t.Boolean(),
          supportsLibrarySync: t.Boolean(),
          supportsScrobble: t.Boolean(),
          supportsGamingLibrary: t.Boolean(),
        }),
        isConfigured: t.Boolean(),
      })
    ),
  }),

  // --- GET /carina/connections/:connectionId (Get connected account info) ---
  singleConnectionResponse: t.Object({
    success: t.Boolean(),
    connection: t.Object({
      id: t.String(),
      userId: t.String(),
      provider: t.String(),
      authType: t.String(),
      externalId: t.Nullable(t.String()),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      profileUrl: t.Nullable(t.String()),
      status: t.String(),
      errorMessage: t.Nullable(t.String()),
      settings: t.Nullable(t.Any()),
      lastSyncedAt: t.Nullable(t.String()),
      expiresAt: t.Nullable(t.String()),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  }),

  // --- PATCH /carina/connections/:connectionId (Update connection settings) ---
  updateConnectionBody: t.Object({
    settings: t.Optional(t.Any({ description: 'Updated integration preferences' })),
    displayName: t.Optional(t.String({ description: 'Updated custom display name' })),
    avatarUrl: t.Optional(t.String({ description: 'Updated custom avatar URL' })),
    profileUrl: t.Optional(t.String({ description: 'Updated custom profile URL' })),
  }),

  updateConnectionResponse: t.Object({
    success: t.Boolean(),
    connection: t.Object({
      id: t.String(),
      userId: t.String(),
      provider: t.String(),
      authType: t.String(),
      externalId: t.Nullable(t.String()),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      profileUrl: t.Nullable(t.String()),
      status: t.String(),
      errorMessage: t.Nullable(t.String()),
      settings: t.Nullable(t.Any()),
      lastSyncedAt: t.Nullable(t.String()),
      expiresAt: t.Nullable(t.String()),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
    message: t.String(),
  }),

  // --- DELETE /carina/connections/:connectionId (Disconnect account) ---
  deleteConnectionResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    message: t.String(),
  }),

  // --- GET /carina/connections/:connectionId/auth (Get OAuth initiation URL) ---
  getAuthUrlQuery: t.Object({
    redirectUri: t.Optional(t.String({ description: 'Custom OAuth redirect URI' })),
    hostUrl: t.Optional(t.String({ description: 'Host URL for self-hosted instances' })),
    returnTo: t.Optional(t.String({ description: 'Optional frontend return path after auth completion' })),
  }),

  getAuthUrlResponse: t.Object({
    success: t.Boolean(),
    url: t.String({ description: 'Third-party OAuth authorization URL' }),
    state: t.String({ description: 'HMAC-signed state token to prevent CSRF' }),
    provider: t.String({ description: 'Target connection provider' }),
  }),

  // --- GET /carina/connections/:connectionId/callback (OAuth callback handler) ---
  callbackQuery: t.Object({
    code: t.Optional(t.String({ description: 'OAuth authorization code' })),
    state: t.Optional(t.String({ description: 'HMAC-signed state token' })),
    error: t.Optional(t.String({ description: 'OAuth provider error code if authorization was denied' })),
    error_description: t.Optional(t.String({ description: 'OAuth provider error details' })),
  }),

  callbackResponse: t.Object({
    success: t.Boolean(),
    connection: t.Object({
      id: t.String(),
      userId: t.String(),
      provider: t.String(),
      authType: t.String(),
      externalId: t.Nullable(t.String()),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      profileUrl: t.Nullable(t.String()),
      status: t.String(),
      errorMessage: t.Nullable(t.String()),
      settings: t.Nullable(t.Any()),
      lastSyncedAt: t.Nullable(t.String()),
      expiresAt: t.Nullable(t.String()),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
    message: t.String(),
  }),

  // --- POST /carina/connections/:connectionId/sync (Trigger manual sync) ---
  syncResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    lastSyncedAt: t.String({ description: 'Timestamp when sync completed' }),
    syncedItemsCount: t.Number({ description: 'Number of library or media items processed' }),
    message: t.String(),
  }),

  // --- POST /carina/connections/:connectionId/test (Test connection) ---
  testConnectionResponse: t.Object({
    success: t.Boolean(),
    ok: t.Boolean({ description: 'Whether connection test was successful' }),
    status: t.String({ description: 'Resulting connection status' }),
    message: t.String({ description: 'Test result description' }),
    profile: t.Optional(t.Nullable(t.Any({ description: 'Provider profile summary if authenticated' }))),
  }),

  // --- GET /carina/connections/search (Search media via provider) ---
  searchQuery: t.Object({
    provider: t.String({ description: 'Provider identifier (e.g. SIMKL, MAL, STEAM)' }),
    q: t.Optional(t.String({ description: 'Search keywords' })),
    id: t.Optional(t.String({ description: 'Specific media or external item ID' })),
    type: t.Optional(t.String({ description: 'Media category / domain filter' })),
    page: t.Optional(t.Numeric({ default: 1 })),
    perPage: t.Optional(t.Numeric({ default: 20 })),
  }),

  searchResponse: t.Object({
    success: t.Boolean(),
    provider: t.String(),
    results: t.Array(t.Any()),
  }),

  // --- Detailed Error Responses (RFC 9457) ---
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Bad request, invalid parameters, or OAuth denial' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("unauthorized")' }),
    title: t.String({ description: 'Short summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized explanation' }),
    code: t.String({ description: 'Machine-readable token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing connection explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Connection or provider not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaConnectionsModel = {
  [k in keyof typeof CarinaConnectionsModel]: UnwrapSchema<(typeof CarinaConnectionsModel)[k]>
}
