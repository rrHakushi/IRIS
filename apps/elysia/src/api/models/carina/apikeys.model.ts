import { t, type UnwrapSchema } from 'elysia'

export const CarinaApiKeysModel = {
  // Shared API Key object representation
  apiKeyItem: t.Object({
    id: t.String({ description: 'Unique API key database identifier' }),
    name: t.String({ description: 'Human-readable name or label' }),
    prefix: t.String({ description: 'Public identifier prefix (e.g. iris-key-12345678)' }),
    createdAt: t.String({ description: 'ISO 8601 creation timestamp' }),
    updatedAt: t.String({ description: 'ISO 8601 last update timestamp' }),
    lastUsedAt: t.Nullable(t.String({ description: 'ISO 8601 last usage timestamp or null if never used' })),
    expiresAt: t.Nullable(t.String({ description: 'ISO 8601 expiration timestamp or null if permanent' })),
  }, { description: 'API key metadata object' }),

  // --- GET /carina/auth/apikeys ---
  listQuery: t.Object({
    page: t.Optional(
      t.Number({ default: 1, minimum: 1, description: 'Page number (defaults to 1)' })
    ),
    limit: t.Optional(
      t.Number({ default: 10, minimum: 1, maximum: 100, description: 'Items per page (defaults to 10)' })
    ),
  }),

  listResponse: t.Object({
    success: t.Boolean(),
    total: t.Number({ description: 'Total number of API keys' }),
    page: t.Number({ description: 'Current page number' }),
    limit: t.Number({ description: 'Items per page' }),
    apiKeys: t.Array(
      t.Object({
        id: t.String(),
        name: t.String(),
        prefix: t.String(),
        createdAt: t.String(),
        updatedAt: t.String(),
        lastUsedAt: t.Nullable(t.String()),
        expiresAt: t.Nullable(t.String()),
      })
    ),
  }),

  // --- POST /carina/auth/apikeys ---
  createBody: t.Object({
    name: t.String({
      minLength: 1,
      maxLength: 64,
      description: 'Human-readable name for the new API key',
    }),
    expirationDays: t.Optional(
      t.Nullable(
        t.Number({
          minimum: 1,
          description: 'Optional validity duration in days from today',
        })
      )
    ),
  }),

  createResponse: t.Object({
    success: t.Boolean(),
    rawKey: t.String({
      description: 'Full plaintext API key token. Displayed only once upon creation.',
    }),
    apiKey: t.Object({
      id: t.String(),
      name: t.String(),
      prefix: t.String(),
      createdAt: t.String(),
      updatedAt: t.String(),
      lastUsedAt: t.Nullable(t.String()),
      expiresAt: t.Nullable(t.String()),
    }),
  }),

  // --- Parameter for keyId routes ---
  keyParams: t.Object({
    keyId: t.String({ description: 'Unique ID of the API key' }),
  }),

  // --- PATCH /carina/auth/apikeys/:keyId ---
  updateBody: t.Object({
    name: t.String({
      minLength: 1,
      maxLength: 64,
      description: 'Updated name for the API key',
    }),
  }),

  updateResponse: t.Object({
    success: t.Boolean(),
    apiKey: t.Object({
      id: t.String(),
      name: t.String(),
      prefix: t.String(),
      createdAt: t.String(),
      updatedAt: t.String(),
      lastUsedAt: t.Nullable(t.String()),
      expiresAt: t.Nullable(t.String()),
    }),
  }),

  // --- DELETE /carina/auth/apikeys/:keyId ---
  deleteResponse: t.Object({
    success: t.Boolean(),
    message: t.String({ description: 'Confirmation message of deletion' }),
  }),

  // --- POST /carina/auth/apikeys/:keyId/regenerate ---
  regenerateResponse: t.Object({
    success: t.Boolean(),
    rawKey: t.String({
      description: 'Newly generated plaintext API key token. Displayed only once.',
    }),
    apiKey: t.Object({
      id: t.String(),
      name: t.String(),
      prefix: t.String(),
      createdAt: t.String(),
      updatedAt: t.String(),
      lastUsedAt: t.Nullable(t.String()),
      expiresAt: t.Nullable(t.String()),
    }),
  }),

  // --- Detailed Error Responses (RFC 9457) ---
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("bad-request")' }),
    title: t.String({ description: 'Short human-readable summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable error token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Bad request or invalid parameters' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("unauthorized")' }),
    title: t.String({ description: 'Short human-readable summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized reason' }),
    code: t.String({ description: 'Machine-readable error token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("not-found")' }),
    title: t.String({ description: 'Short human-readable summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed explanation of missing API key' }),
    code: t.String({ description: 'Machine-readable error token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'API key not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short human-readable summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable error token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaApiKeysModel = {
  [k in keyof typeof CarinaApiKeysModel]: UnwrapSchema<(typeof CarinaApiKeysModel)[k]>
}
