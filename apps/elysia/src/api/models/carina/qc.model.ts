import { t, type UnwrapSchema } from 'elysia'

export const CarinaQcModel = {
  // --- POST /carina/auth/qc/generate ---
  generateBody: t.Optional(
    t.Object({
      deviceName: t.Optional(
        t.String({ maxLength: 64, description: 'Display name of the requesting client device' })
      ),
      userIdentifier: t.Optional(
        t.String({
          minLength: 3,
          maxLength: 255,
          description: 'Optional username or email of the user to prompt',
        })
      ),
    })
  ),

  generateResponse: t.Object({
    code: t.String({ description: 'Human-readable 8-character pairing code (XXXX-XXXX)' }),
    sessionToken: t.String({ description: 'Unguessable 256-bit polling session token' }),
    qrPayload: t.String({ description: 'URL payload for QR code generation' }),
    expiresIn: t.Number({ description: 'Session validity lifetime in seconds (300)' }),
  }),

  // --- POST /carina/auth/qc/approve ---
  approveBody: t.Object({
    code: t.String({
      minLength: 6,
      maxLength: 64,
      description: 'Device pairing code to approve (with or without hyphens)',
    }),
  }),

  approveResponse: t.Object({
    success: t.Boolean(),
    message: t.String({ description: 'Approval confirmation message' }),
  }),

  // --- GET /carina/auth/qc/status ---
  statusQuery: t.Object({
    sessionToken: t.String({ minLength: 10, description: 'Unguessable session polling token' }),
  }),

  statusResponse: t.Object({
    status: t.Union([
      t.Literal('pending'),
      t.Literal('approved'),
      t.Literal('expired'),
    ], { description: 'Current status of the quick connect pairing session' }),
    user: t.Nullable(
      t.Object({
        id: t.String(),
        username: t.String(),
        email: t.String(),
        passwordChangedAt: t.Nullable(t.Number()),
      })
    ),
    token: t.Nullable(t.String({ description: 'Signed JWT authentication token once approved' })),
  }),

  // --- Detailed RFC 9457 Error Schemas ---
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short human-readable summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable error token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Bad request or invalid pairing code' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("unauthorized")' }),
    title: t.String({ description: 'Short human-readable summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized reason' }),
    code: t.String({ description: 'Machine-readable error token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short human-readable summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable error token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaQcModel = {
  [k in keyof typeof CarinaQcModel]: UnwrapSchema<(typeof CarinaQcModel)[k]>
}
