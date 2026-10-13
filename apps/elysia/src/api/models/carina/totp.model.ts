import { t, type UnwrapSchema } from 'elysia'

export const CarinaTotpModel = {
  // --- POST /carina/auth/twofactor/totp/setup ---
  setupResponse: t.Object({
    secret: t.String({ description: 'Base32 encoded TOTP shared secret' }),
    otpauthUrl: t.String({ description: 'Full otpauth:// URI for authenticator applications' }),
    qrCodeDataUrl: t.String({ description: 'Base64 PNG data URL of the QR code' }),
  }),

  // --- POST /carina/auth/twofactor/totp/verify ---
  verifyBody: t.Object({
    code: t.String({
      minLength: 6,
      maxLength: 6,
      pattern: '^[0-9]{6}$',
      description: '6-digit numeric TOTP token from authenticator app',
    }),
    secret: t.Optional(
      t.String({
        description: 'Optional manual Base32 secret if setup session cache expired',
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
  }),

  // --- DELETE /carina/auth/twofactor/totp ---
  deleteBody: t.Optional(
    t.Object({
      code: t.Optional(
        t.String({
          minLength: 6,
          maxLength: 6,
          description: '6-digit TOTP token to confirm deactivation',
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
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short human-readable summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable error token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Bad request or verification code mismatch' }),

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

export type CarinaTotpModel = {
  [k in keyof typeof CarinaTotpModel]: UnwrapSchema<(typeof CarinaTotpModel)[k]>
}
