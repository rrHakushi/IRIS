import { t, type UnwrapSchema } from 'elysia'

export const AkaromiEncryptionModel = {
  // --- GET /akaromi/encryption/keys ---
  encryptionKeysResponse: t.Object({
    success: t.Boolean(),
    userId: t.String({ description: 'User ID (UUID)' }),
    publicKey: t.Nullable(t.String({ description: 'ML-KEM-768 public key (Base64)' })),
    encryptedPrivateKey: t.Nullable(
      t.String({ description: 'Post-quantum private key payload (salt:iv:authTag:cipher)' })
    ),
    salt: t.Nullable(t.String({ description: 'Cryptographic salt extracted from key or password hash' })),
    hasEncryptionKeys: t.Boolean({ description: 'Whether the user has initialized encryption keys' }),
    hasSeparateEncryptionPassword: t.Boolean({ description: 'Whether the user has a distinct encryption password' }),
  }),

  // --- POST /akaromi/encryption/password ---
  changePasswordBody: t.Object({
    currentPassword: t.String({ minLength: 1, description: 'Current password' }),
    newEncryptionPassword: t.String({ minLength: 16, maxLength: 64, description: 'New encryption vault password' }),
  }),

  changePasswordResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    publicKey: t.Nullable(t.String()),
    hasSeparateEncryptionPassword: t.Boolean(),
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

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing user explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'User not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type AkaromiEncryptionModel = {
  [k in keyof typeof AkaromiEncryptionModel]: UnwrapSchema<(typeof AkaromiEncryptionModel)[k]>
}
