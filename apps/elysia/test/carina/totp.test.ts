import { describe, expect, it, beforeEach } from 'bun:test'
import { generateSecret, generateSync } from 'otplib'
import { Elysia } from 'elysia'
import { carinaTotp } from '../../src/api/controllers/carina/totp.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt, hashPassword, encryptSecret } from '../../src/utils/auth-crypto'
import { cache } from '../../src/utils/cache'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Users and TOTP
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string | null
  passwordHash: string
  permissions: number[]
  passwordChangedAt: Date | null
  TOTPEnabled: boolean
  TOTPSecret: string | null
  emailMfaEnabled: boolean
  backupCodes: string[]
  passkeys: Array<{ id: string }>
}

let mockUsers: MockUser[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: 'user-alice-123',
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: '',
      permissions: [1],
      passwordChangedAt: null,
      TOTPEnabled: false,
      TOTPSecret: null,
      emailMfaEnabled: false,
      backupCodes: [],
      passkeys: [],
    },
    {
      id: 'user-bob-456',
      username: 'bob',
      email: 'bob@example.com',
      passwordHash: '',
      permissions: [0],
      passwordChangedAt: null,
      TOTPEnabled: false,
      TOTPSecret: null,
      emailMfaEnabled: false,
      backupCodes: [],
      passkeys: [],
    },
  ]

  ;(prisma.user.findUnique as any) = async ({ where, include }: any) => {
    const user = mockUsers.find((u) => u.id === where.id)
    if (!user) return null
    if (include?.passkeys) {
      return { ...user }
    }
    return { ...user }
  }

  ;(prisma.user.update as any) = async ({ where, data }: any) => {
    const user = mockUsers.find((u) => u.id === where.id)
    if (!user) throw new Error('User not found')
    if (data.TOTPSecret !== undefined) user.TOTPSecret = data.TOTPSecret
    if (data.TOTPEnabled !== undefined) user.TOTPEnabled = data.TOTPEnabled
    if (data.backupCodes !== undefined) user.backupCodes = data.backupCodes
    return { ...user }
  }
}

// -----------------------------------------------------------------------------
// Test App Initialization
// -----------------------------------------------------------------------------

const app = new Elysia()
  .onError(({ error, set }) => {
    if (isHttpError(error)) {
      set.status = error.status
      return error.toResponse()
    }
  })
  .use(carinaTotp)

describe('Comprehensive Carina TOTP Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  const testPassword = 'AliceSuperPassword123!'

  beforeEach(async () => {
    setupPrismaMock()
    const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
    aliceUser.passwordHash = await hashPassword(testPassword)

    const bobUser = mockUsers.find((u) => u.id === 'user-bob-456')!
    bobUser.passwordHash = await hashPassword('BobPassword123!')

    aliceToken = await signUserJwt({
      id: 'user-alice-123',
      username: 'alice',
      email: 'alice@example.com',
    })
    bobToken = await signUserJwt({
      id: 'user-bob-456',
      username: 'bob',
      email: 'bob@example.com',
    })
  })

  // ===========================================================================
  // 1. POST /carina/auth/twofactor/totp/setup Scenarios
  // ===========================================================================
  describe('POST /carina/auth/twofactor/totp/setup', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp/setup', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
    })

    it('generates Base32 secret, otpauth URL, and QR Code Data URL', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp/setup', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.secret).toBeDefined()
      expect(data.secret.length).toBeGreaterThanOrEqual(16)
      expect(data.otpauthUrl).toContain('otpauth://totp/')
      expect(data.otpauthUrl).toContain('Carina')
      expect(data.otpauthUrl).toContain('secret=' + data.secret)
      expect(data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/)

      // Verify cached in Redis / in-memory LRU
      const cached = await cache.get<string>('auth:totp:pending:user-alice-123')
      expect(cached).toBe(data.secret)
    })
  })

  // ===========================================================================
  // 2. POST /carina/auth/twofactor/totp/verify Scenarios
  // ===========================================================================
  describe('POST /carina/auth/twofactor/totp/verify', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: '123456' }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (422) on invalid code format (not 6 digits)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: 'abc' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when setup session has expired or was not initiated', async () => {
      await cache.del('auth:totp:pending:user-alice-123')

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: '123456' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('session expired or was not initiated')
    })

    it('fails (400) when token verification code is wrong', async () => {
      const testSecret = generateSecret()
      await cache.set('auth:totp:pending:user-alice-123', testSecret, 600)

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: '000000' }), // Incorrect token
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('Invalid verification code')
    })

    it('successfully activates TOTP and issues initial backup codes', async () => {
      const testSecret = generateSecret()
      await cache.set('auth:totp:pending:user-alice-123', testSecret, 600)
      const validCode = generateSync({ secret: testSecret })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: validCode }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('TOTP has been enabled')
      // First MFA setup: returns initial 10 recovery codes
      expect(data.backupCodes).toBeDefined()
      expect(data.backupCodes.length).toBe(10)

      // Verified in DB
      const user = mockUsers.find((u) => u.id === 'user-alice-123')!
      expect(user.TOTPEnabled).toBe(true)
      expect(user.TOTPSecret).toBeDefined()
      expect(user.backupCodes.length).toBe(10)

      // Pending cache cleaned up
      const pending = await cache.get('auth:totp:pending:user-alice-123')
      expect(pending).toBeNull()
    })

    it('does not re-issue backup codes if user already had backup codes configured', async () => {
      const bobUser = mockUsers.find((u) => u.id === 'user-bob-456')!
      bobUser.backupCodes = ['existing-backup-hash-1', 'existing-backup-hash-2']

      const testSecret = generateSecret()
      await cache.set('auth:totp:pending:user-bob-456', testSecret, 600)
      const validCode = generateSync({ secret: testSecret })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({ code: validCode }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.backupCodes).toBeUndefined()
      expect(bobUser.backupCodes.length).toBe(2) // Retained
    })
  })

  // ===========================================================================
  // 3. DELETE /carina/auth/twofactor/totp Scenarios
  // ===========================================================================
  describe('DELETE /carina/auth/twofactor/totp', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (400) when TOTP is not currently enabled', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('not currently enabled')
    })

    it('fails (401) when entered TOTP verification code is incorrect', async () => {
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.TOTPEnabled = true
      aliceUser.TOTPSecret = encryptSecret(generateSecret())

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp', {
          method: 'DELETE',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: '000000' }),
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.detail).toContain('Invalid authenticator verification code')
    })

    it('fails (401) when entered confirmation password is wrong', async () => {
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.TOTPEnabled = true
      aliceUser.TOTPSecret = encryptSecret(generateSecret())

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp', {
          method: 'DELETE',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ password: 'WrongPassword!' }),
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.detail).toContain('Incorrect password confirmation')
    })

    it('successfully deactivates TOTP using valid authenticator code and cleans up backup codes', async () => {
      const testSecret = generateSecret()
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.TOTPEnabled = true
      aliceUser.TOTPSecret = encryptSecret(testSecret)
      aliceUser.backupCodes = ['code-1', 'code-2']

      const validCode = generateSync({ secret: testSecret })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp', {
          method: 'DELETE',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: validCode }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('TOTP has been disabled')

      expect(aliceUser.TOTPEnabled).toBe(false)
      expect(aliceUser.TOTPSecret).toBeNull()
      // No remaining MFA methods -> backup codes wiped
      expect(aliceUser.backupCodes).toEqual([])
    })

    it('successfully deactivates TOTP using account password and preserves backup codes if other MFA is active', async () => {
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.TOTPEnabled = true
      aliceUser.TOTPSecret = encryptSecret('JBSWY3DPEHPK3PXP')
      aliceUser.backupCodes = ['code-1', 'code-2']
      // Alice also has passkeys registered
      aliceUser.passkeys = [{ id: 'pk-active' }]

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/totp', {
          method: 'DELETE',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ password: testPassword }),
        })
      )
      expect(res.status).toBe(200)
      expect(aliceUser.TOTPEnabled).toBe(false)
      // Passkey is still active, so backup codes preserved
      expect(aliceUser.backupCodes.length).toBe(2)
    })
  })
})
