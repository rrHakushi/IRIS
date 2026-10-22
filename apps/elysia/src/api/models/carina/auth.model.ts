import { t, type UnwrapSchema } from 'elysia'

export const CarinaAuthModel = {
  // --- Login ---
  loginBody: t.Object({
    identifier: t.String({
      minLength: 3,
      maxLength: 255,
      description: 'Account username or email address',
    }),
    password: t.String({
      minLength: 1,
      maxLength: 128,
      description: 'Account plaintext password',
    }),
  }),

  loginResponse: t.Object({
    success: t.Boolean(),
    mfaRequired: t.Boolean(),
    mfaTicket: t.Nullable(t.String()),
    allowedMfaTypes: t.Nullable(
      t.Array(
        t.Union([
          t.Literal('totp'),
          t.Literal('email'),
          t.Literal('passkey'),
        ])
      )
    ),
    user: t.Nullable(
      t.Object({
        id: t.String(),
        username: t.String(),
        email: t.String(),
        passwordChangedAt: t.Nullable(t.Number()),
      })
    ),
    token: t.Nullable(t.String()),
  }),

  // --- Register ---
  registerBody: t.Object({
    username: t.String({
      minLength: 3,
      maxLength: 32,
      description: 'Desired unique username',
    }),
    email: t.String({
      format: 'email',
      description: 'Valid email address',
    }),
    password: t.String({
      minLength: 12,
      maxLength: 64,
      description: 'Account password (minimum 12 characters)',
    }),
  }),

  registerResponse: t.Object({
    success: t.Boolean(),
    user: t.Object({
      id: t.String(),
      username: t.String(),
      email: t.String(),
      passwordChangedAt: t.Nullable(t.Number()),
      publicKey: t.Nullable(t.String()),
    }),
  }),

  // --- Password Change ---
  changePasswordBody: t.Object({
    currentPassword: t.String({
      minLength: 1,
      description: 'Current active password',
    }),
    newPassword: t.String({
      minLength: 12,
      maxLength: 64,
      description: 'New password (minimum 12 characters)',
    }),
  }),

  changePasswordResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- Forgot Password ---
  forgotPasswordBody: t.Object({
    email: t.String({
      format: 'email',
      description: 'Registered user email address',
    }),
  }),

  forgotPasswordResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- Reset Password ---
  resetPasswordBody: t.Object({
    token: t.String({
      minLength: 10,
      description: 'Valid password reset token',
    }),
    newPassword: t.String({
      minLength: 12,
      maxLength: 64,
      description: 'New password (minimum 12 characters)',
    }),
  }),

  resetPasswordResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- Logout ---
  logoutResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
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
    detail: t.String({ description: 'Detailed unauthorized reason (e.g. invalid credentials or expired session)' }),
    code: t.String({ description: 'Machine-readable error token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("not-found")' }),
    title: t.String({ description: 'Short human-readable summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed explanation of missing user or resource' }),
    code: t.String({ description: 'Machine-readable error token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Target user account or resource not found' }),

  conflictError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("conflict")' }),
    title: t.String({ description: 'Short human-readable summary ("Conflict")' }),
    status: t.Literal(409, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed conflict message (e.g. duplicate username or email)' }),
    code: t.String({ description: 'Machine-readable error token ("conflict")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Conflict with existing username or email registration' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short human-readable summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable error token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaAuthModel = {
  [k in keyof typeof CarinaAuthModel]: UnwrapSchema<(typeof CarinaAuthModel)[k]>
}
