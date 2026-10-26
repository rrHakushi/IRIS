import { t, type UnwrapSchema } from 'elysia'

export const CarinaBackupCodesModel = {
  // --- POST /carina/auth/twofactor/backupcodes/generate ---
  generateResponse: t.Object({
    success: t.Boolean(),
    backupCodes: t.Array(t.String(), {
      description: 'Array of 10 newly generated plaintext recovery backup codes',
    }),
  }),

  // --- POST /carina/auth/twofactor/backupcodes/regenerate ---
  regenerateResponse: t.Object({
    success: t.Boolean(),
    backupCodes: t.Array(t.String(), {
      description: 'Array of 10 regenerated plaintext recovery backup codes replacing all previous codes',
    }),
  }),

  // --- POST /carina/auth/twofactor/backupcodes/verify ---
  verifyBody: t.Object({
    code: t.String({
      minLength: 8,
      maxLength: 24,
      description: 'Single-use backup recovery code (formatted or unformatted)',
    }),
    mfaTicket: t.Optional(
      t.String({
        description: 'Optional temporary MFA challenge ticket for login',
      })
    ),
  }),

  verifyResponse: t.Object({
    success: t.Boolean(),
    message: t.String({ description: 'Verification confirmation message' }),
    remainingCount: t.Number({
      description: 'Count of remaining valid single-use backup recovery codes',
    }),
    token: t.Optional(t.Nullable(t.String())),
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

  // --- Detailed RFC 9457 Error Schemas ---
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short human-readable summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable error token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Bad request or invalid backup code' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("unauthorized")' }),
    title: t.String({ description: 'Short human-readable summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized reason' }),
    code: t.String({ description: 'Machine-readable error token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short human-readable summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed explanation of missing user' }),
    code: t.String({ description: 'Machine-readable error token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'User record not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short human-readable summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable error token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaBackupCodesModel = {
  [k in keyof typeof CarinaBackupCodesModel]: UnwrapSchema<(typeof CarinaBackupCodesModel)[k]>
}
