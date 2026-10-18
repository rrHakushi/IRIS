import { t, type UnwrapSchema } from 'elysia'

export const AkaromiVaultModel = {
  // --- GET /akaromi/sync ---
  syncQuery: t.Object({
    since: t.Optional(
      t.String({
        description: 'ISO 8601 timestamp to only return changes since this date',
      })
    ),
  }),

  syncResponse: t.Object({
    success: t.Boolean(),
    serverTime: t.String({ description: 'Server synchronization timestamp' }),
    ciphers: t.Array(
      t.Object({
        id: t.String(),
        type: t.Union([t.Literal('LOGIN'), t.Literal('SSH_KEY')]),
        favorite: t.Boolean(),
        reprompt: t.Union([
          t.Literal('NONE'),
          t.Literal('REQUIRE_MASTER_PASSWORD'),
        ]),
        encryptedTitle: t.String(),
        encryptedData: t.String(),
        deletedAt: t.Nullable(t.String()),
        createdAt: t.String(),
        updatedAt: t.String(),
      })
    ),
    deletedCipherIds: t.Array(t.String({ description: 'IDs of deleted/trashed ciphers' })),
  }),

  // --- GET /akaromi/export ---
  exportResponse: t.Object({
    success: t.Boolean(),
    exportedAt: t.String({ description: 'Export generation ISO timestamp' }),
    ciphers: t.Array(
      t.Object({
        id: t.String(),
        type: t.Union([t.Literal('LOGIN'), t.Literal('SSH_KEY')]),
        favorite: t.Boolean(),
        encryptedTitle: t.String(),
        encryptedData: t.String(),
        createdAt: t.String(),
        updatedAt: t.String(),
      })
    ),
  }),

  // --- POST /akaromi/import ---
  importBody: t.Object({
    ciphers: t.Array(
      t.Object({
        type: t.Union([t.Literal('LOGIN'), t.Literal('SSH_KEY')], { default: 'LOGIN' }),
        encryptedTitle: t.String({ minLength: 1 }),
        encryptedData: t.String({ minLength: 1 }),
        favorite: t.Optional(t.Boolean({ default: false })),
      }),
      { default: [] }
    ),
  }),

  importResponse: t.Object({
    success: t.Boolean(),
    importedCiphersCount: t.Number(),
    message: t.String(),
  }),

  // Detailed RFC 9457 Error Schemas
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Bad request or invalid parameters' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("unauthorized")' }),
    title: t.String({ description: 'Short summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized explanation' }),
    code: t.String({ description: 'Machine-readable token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  forbiddenError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("forbidden")' }),
    title: t.String({ description: 'Short summary ("Forbidden")' }),
    status: t.Literal(403, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed forbidden explanation' }),
    code: t.String({ description: 'Machine-readable token ("forbidden")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Insufficient permissions' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing entity explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Resource not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type AkaromiVaultModel = {
  [k in keyof typeof AkaromiVaultModel]: UnwrapSchema<(typeof AkaromiVaultModel)[k]>
}
