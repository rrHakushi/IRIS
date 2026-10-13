import { t, type UnwrapSchema } from 'elysia'

export const CarinaPasskeysModel = {
  // Shared Passkey representation
  passkeyItem: t.Object({
    id: t.String({ description: 'Unique WebAuthn credential ID' }),
    name: t.Nullable(t.String({ description: 'Optional user-friendly label' })),
    createdAt: t.String({ description: 'ISO 8601 creation timestamp' }),
    transports: t.Array(t.String(), { description: 'Allowed or registered authenticator transports' }),
  }, { description: 'Passkey metadata object' }),

  // --- GET /carina/auth/twofactor/passkeys ---
  listQuery: t.Object({
    page: t.Optional(
      t.Numeric({ default: 1, minimum: 1, description: 'Page number (defaults to 1)' })
    ),
    limit: t.Optional(
      t.Numeric({ default: 10, minimum: 1, maximum: 100, description: 'Items per page (defaults to 10)' })
    ),
  }),

  listResponse: t.Object({
    success: t.Boolean(),
    total: t.Number({ description: 'Total number of registered passkeys' }),
    page: t.Number({ description: 'Current page number' }),
    limit: t.Number({ description: 'Items per page' }),
    passkeys: t.Array(
      t.Object({
        id: t.String(),
        name: t.Nullable(t.String()),
        createdAt: t.String(),
        transports: t.Array(t.String()),
      })
    ),
  }),

  // --- POST /carina/auth/twofactor/passkeys (challenge) ---
  createChallengeResponse: t.Object({
    challenge: t.String({ description: 'WebAuthn base64url challenge string' }),
    rp: t.Object({
      name: t.String({ description: 'Relying party name' }),
      id: t.Optional(t.String({ description: 'Relying party identifier (domain/hostname)' })),
    }),
    user: t.Object({
      id: t.String(),
      name: t.String(),
      displayName: t.String(),
    }),
    pubKeyCredParams: t.Array(
      t.Object({
        alg: t.Number(),
        type: t.Literal('public-key'),
      })
    ),
    authenticatorSelection: t.Optional(
      t.Object({
        authenticatorAttachment: t.Optional(t.String()),
        requireResidentKey: t.Optional(t.Boolean()),
        residentKey: t.Optional(t.String()),
        userVerification: t.Optional(t.String()),
      })
    ),
    timeout: t.Optional(t.Number({ description: 'Registration timeout in milliseconds' })),
    attestation: t.Optional(t.String()),
    excludeCredentials: t.Optional(t.Array(t.Any())),
    extensions: t.Optional(t.Any()),
    hints: t.Optional(t.Array(t.String())),
  }),

  // --- POST /carina/auth/twofactor/passkeys/login (challenge) ---
  loginBody: t.Optional(
    t.Object({
      identifier: t.Optional(t.String({ description: 'Optional username or email' })),
    })
  ),

  loginResponse: t.Object({
    challenge: t.String({ description: 'Authentication challenge' }),
    rpId: t.Optional(t.String({ description: 'Relying party ID' })),
    allowCredentials: t.Optional(t.Array(t.Any())),
    timeout: t.Optional(t.Number()),
    userVerification: t.Optional(t.String()),
  }),

  // --- POST /carina/auth/twofactor/passkeys/verify ---
  verifyBody: t.Object({
    passkeyResponse: t.Object({
      id: t.String({ description: 'Credential ID (base64url)' }),
      rawId: t.String({ description: 'Raw credential ID' }),
      response: t.Any({ description: 'Authenticator attestation response payload' }),
      type: t.Optional(t.String()),
      clientExtensionResults: t.Optional(t.Any()),
      authenticatorAttachment: t.Optional(t.String()),
    }),
    name: t.Optional(
      t.String({
        maxLength: 64,
        description: 'Optional friendly name/label for the passkey',
      })
    ),
  }),

  verifyResponse: t.Object({
    success: t.Boolean(),
    message: t.String({ description: 'Verification result message' }),
    backupCodes: t.Optional(
      t.Array(t.String(), {
        description: 'Generated plaintext backup codes if this is the first 2FA setup',
      })
    ),
  }),

  // --- DELETE /carina/auth/twofactor/passkeys/:passkeyId ---
  passkeyParams: t.Object({
    passkeyId: t.String({ description: 'Unique ID of the passkey to delete' }),
  }),

  deleteResponse: t.Object({
    success: t.Boolean(),
    message: t.String({ description: 'Confirmation message of passkey deletion' }),
  }),

  // --- Detailed RFC 9457 Error Schemas ---
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short human-readable summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable error token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Bad request or verification challenge failure' }),

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
    detail: t.String({ description: 'Detailed explanation of missing passkey' }),
    code: t.String({ description: 'Machine-readable error token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Passkey not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short human-readable summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable error token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaPasskeysModel = {
  [k in keyof typeof CarinaPasskeysModel]: UnwrapSchema<(typeof CarinaPasskeysModel)[k]>
}
