import { t, type UnwrapSchema } from 'elysia'

export const CarinaEmail2faModel = {
  // --- POST /carina/auth/twofactor/email/setup ---
  setupResponse: t.Object({
    success: t.Boolean(),
    message: t.String({ description: 'Status confirmation message' }),
    email: t.String({ description: 'Masked email address where code was sent' }),
  }),

  // --- POST /carina/auth/twofactor/email/send ---
  sendBody: t.Optional(
    t.Object({
      mfaTicket: t.Optional(
        t.String({
          minLength: 10,
          description: 'Optional MFA session ticket for unauthenticated login verification',
        })
      ),
    })
  ),

  sendResponse: t.Object({
    success: t.Boolean(),
    message: t.String({ description: 'Status confirmation message' }),
    email: t.Optional(t.String({ description: 'Masked email address where code was sent' })),
  }),

  // --- POST /carina/auth/twofactor/email/verify ---
  verifyBody: t.Object({
    code: t.String({
      minLength: 6,
      maxLength: 32,
      description: '6-digit verification code, TOTP token, or backup recovery code',
    }),
    mfaTicket: t.Optional(
      t.String({
        minLength: 10,
        description: 'Optional MFA session ticket for unauthenticated login verification',
      })
    ),
  }),

  verifyResponse: t.Object({
    success: t.Boolean(),
    message: t.String({ description: 'Success confirmation message' }),
    backupCodes: t.Optional(
      t.Array(t.String(), {
        description: 'Initial plaintext recovery backup codes if this is the first MFA method enabled',
      })
    ),
    token: t.Optional(
      t.Nullable(t.String({ description: 'Authenticated JWT session token issued when completing login' }))
    ),
    user: t.Optional(
      t.Nullable(
        t.Object({
          id: t.String(),
          username: t.String(),
          email: t.String(),
          passwordChangedAt: t.Nullable(t.Number()),
        })
      )
    ),
  }),

  // --- DELETE /carina/auth/twofactor/email ---
  deleteBody: t.Optional(
    t.Object({
      code: t.Optional(
        t.String({
          minLength: 6,
          maxLength: 6,
          description: '6-digit verification code to confirm deactivation',
        })
      ),
      password: t.Optional(
        t.String({
          minLength: 1,
          description: 'Account password to confirm deactivation',
        })
      ),
    })
  ),

  deleteResponse: t.Object({
    success: t.Boolean(),
    message: t.String({ description: 'Success confirmation message' }),
  }),

  // --- Detailed RFC 9457 Error Schemas ---
  badRequestError: t.Object(
    {
      type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
      title: t.String({ description: 'Short human-readable summary ("Bad Request")' }),
      status: t.Literal(400, { description: 'HTTP status code' }),
      detail: t.String({ description: 'Detailed failure explanation' }),
      code: t.String({ description: 'Machine-readable error token ("bad-request")' }),
      instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
    },
    { description: 'Bad request or verification code mismatch' }
  ),

  unauthorizedError: t.Object(
    {
      type: t.String({ description: 'Slug identifying problem type ("unauthorized")' }),
      title: t.String({ description: 'Short human-readable summary ("Unauthorized")' }),
      status: t.Literal(401, { description: 'HTTP status code' }),
      detail: t.String({ description: 'Detailed unauthorized reason' }),
      code: t.String({ description: 'Machine-readable error token ("unauthorized")' }),
      instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
    },
    { description: 'Unauthorized request or invalid authentication credentials' }
  ),

  notFoundError: t.Object(
    {
      type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
      title: t.String({ description: 'Short human-readable summary ("Not Found")' }),
      status: t.Literal(404, { description: 'HTTP status code' }),
      detail: t.String({ description: 'Detailed explanation of missing user or resource' }),
      code: t.String({ description: 'Machine-readable error token ("not-found")' }),
      instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
    },
    { description: 'User or ticket record not found' }
  ),

  validationError: t.Object(
    {
      type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
      title: t.String({ description: 'Short human-readable summary ("Unprocessable Content")' }),
      status: t.Literal(422, { description: 'HTTP status code' }),
      detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
      code: t.String({ description: 'Machine-readable error token ("validation")' }),
      instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
    },
    { description: 'Request payload validation failed' }
  ),

  tooManyRequestsError: t.Object(
    {
      type: t.String({ description: 'Slug identifying rate limit ("too-many-requests")' }),
      title: t.String({ description: 'Short human-readable summary ("Too Many Requests")' }),
      status: t.Literal(429, { description: 'HTTP status code' }),
      detail: t.String({ description: 'Rate limit or cooldown active' }),
      code: t.String({ description: 'Machine-readable error token ("too-many-requests")' }),
      instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
    },
    { description: 'Rate limit or verification dispatch cooldown exceeded' }
  ),
} as const

export type CarinaEmail2faModel = {
  [k in keyof typeof CarinaEmail2faModel]: UnwrapSchema<(typeof CarinaEmail2faModel)[k]>
}
