import { t, type UnwrapSchema } from 'elysia'

export const AkaromiCiphersModel = {
  // Path params
  cipherParam: t.Object({
    cipherId: t.String({
      minLength: 1,
      description: 'Cipher unique identifier (UUID)',
    }),
  }),

  // Cipher query
  listCiphersQuery: t.Object({
    type: t.Optional(
      t.Union([t.Literal('LOGIN'), t.Literal('SSH_KEY')], {
        description: 'Filter by cipher type',
      })
    ),
    favorite: t.Optional(t.Boolean({ description: 'Filter by favorite status' })),
    trash: t.Optional(t.Boolean({ description: 'Filter by trash status' })),
  }),

  deleteCipherQuery: t.Object({
    permanent: t.Optional(
      t.Boolean({ description: 'Permanently remove cipher instead of trashing' })
    ),
  }),

  // Shared cipher item schema
  cipherItem: t.Object({
    id: t.String({ description: 'Cipher unique identifier (UUID)' }),
    type: t.Union([t.Literal('LOGIN'), t.Literal('SSH_KEY')]),
    favorite: t.Boolean({ description: 'Whether item is marked as favorite' }),
    reprompt: t.Union([
      t.Literal('NONE'),
      t.Literal('REQUIRE_MASTER_PASSWORD'),
    ]),
    encryptedTitle: t.String({ description: 'Client-encrypted item title' }),
    encryptedData: t.String({ description: 'Client-encrypted item payload' }),
    deletedAt: t.Nullable(t.String({ description: 'Trash timestamp or null' })),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
    updatedAt: t.String({ description: 'Last update ISO timestamp' }),
  }),

  // Responses
  listCiphersResponse: t.Object({
    success: t.Boolean(),
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
  }),

  createCipherBody: t.Object({
    type: t.Union([t.Literal('LOGIN'), t.Literal('SSH_KEY')], {
      default: 'LOGIN',
      description: 'Cipher entry type',
    }),
    encryptedTitle: t.String({
      minLength: 1,
      description: 'Client-encrypted item title',
    }),
    encryptedData: t.String({
      minLength: 1,
      description: 'Client-encrypted payload JSON',
    }),
    favorite: t.Optional(t.Boolean({ default: false })),
    reprompt: t.Optional(
      t.Union([t.Literal('NONE'), t.Literal('REQUIRE_MASTER_PASSWORD')], {
        default: 'NONE',
      })
    ),
  }),

  createCipherResponse: t.Object({
    success: t.Boolean(),
    cipher: t.Object({
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
    }),
    message: t.String(),
  }),

  singleCipherResponse: t.Object({
    success: t.Boolean(),
    cipher: t.Object({
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
    }),
  }),

  updateCipherBody: t.Object({
    type: t.Optional(t.Union([t.Literal('LOGIN'), t.Literal('SSH_KEY')])),
    encryptedTitle: t.Optional(t.String({ minLength: 1 })),
    encryptedData: t.Optional(t.String({ minLength: 1 })),
    favorite: t.Optional(t.Boolean()),
    reprompt: t.Optional(
      t.Union([t.Literal('NONE'), t.Literal('REQUIRE_MASTER_PASSWORD')])
    ),
  }),

  updateCipherResponse: t.Object({
    success: t.Boolean(),
    cipher: t.Object({
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
    }),
    message: t.String(),
  }),

  deleteCipherResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    permanent: t.Boolean(),
    message: t.String(),
  }),

  restoreCipherResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    message: t.String(),
  }),

  emptyTrashResponse: t.Object({
    success: t.Boolean(),
    count: t.Number({ description: 'Number of permanently deleted trash ciphers' }),
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
    detail: t.String({ description: 'Detailed missing cipher explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Cipher not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type AkaromiCiphersModel = {
  [k in keyof typeof AkaromiCiphersModel]: UnwrapSchema<(typeof AkaromiCiphersModel)[k]>
}
