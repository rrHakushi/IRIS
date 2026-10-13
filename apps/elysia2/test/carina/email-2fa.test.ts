import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { carinaEmail2fa } from '../../src/api/controllers/carina/email-2fa.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt, hashPassword } from '../../src/utils/auth-crypto'
import { cache } from '../../src/utils/cache'
import { EmailService } from '../../src/services/email/email.serv'
import { maskEmail } from '../../src/services/carina/email-2fa.serv'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Users and Email 2FA
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
    {
      id: 'user-noemail-789',
      username: 'noemail',
      email: null,
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
    if (data.emailMfaEnabled !== undefined) user.emailMfaEnabled = data.emailMfaEnabled
    if (data.backupCodes !== undefined) user.backupCodes = data.backupCodes
    return { ...user }
  }
}

// -----------------------------------------------------------------------------
// Test App Initialization
// -----------------------------------------------------------------------------

const app = new Elysia()
  .error(({ error, set }) => {
    if (isHttpError(error)) {
      set.status = error.status
      return error.toResponse()
    }
  })
  .use(carinaEmail2fa)

describe('Comprehensive Carina Email 2FA & Email Service Suite', () => {
  let aliceToken: string
  let bobToken: string
  let noEmailToken: string
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

    noEmailToken = await signUserJwt({
      id: 'user-noemail-789',
      username: 'noemail',
      email: null as any,
    })

    // Clear caches for test isolation
    await cache.del('auth:email-2fa:setup:user-alice-123')
    await cache.del('auth:email-2fa:setup:user-bob-456')
    await cache.del('auth:email-2fa:cooldown:user-alice-123')
    await cache.del('auth:email-2fa:cooldown:user-bob-456')
  })

  // ===========================================================================
  // 1. maskEmail Helper Tests
  // ===========================================================================
  describe('maskEmail Helper', () => {
    it('correctly obfuscates emails of various lengths', () => {
      expect(maskEmail('alice@example.com')).toBe('a***e@example.com')
      expect(maskEmail('me@domain.com')).toBe('m***@domain.com')
      expect(maskEmail('user123@sub.domain.org')).toBe('u***3@sub.domain.org')
      expect(maskEmail('invalid')).toBe('***@***')
    })
  })

  // ===========================================================================
  // 2. POST /carina/auth/twofactor/email/setup
  // ===========================================================================
  describe('POST /carina/auth/twofactor/email/setup', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/setup', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
    })

    it('fails (400) when user has no email address associated with account', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/setup', {
          method: 'POST',
          headers: { authorization: `Bearer ${noEmailToken}` },
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('An email address must be associated')
    })

    it('fails (400) when Email 2FA is already enabled on account', async () => {
      const alice = mockUsers.find((u) => u.id === 'user-alice-123')!
      alice.emailMfaEnabled = true

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/setup', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('already enabled')
    })

    it('successfully initiates setup, caches verification code and enforces cooldown', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/setup', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Verification code sent to registered email')
      expect(data.email).toBe('a***e@example.com')

      // Verify code cached in cache
      const cached = await cache.get<{ code: string; email: string }>(
        'auth:email-2fa:setup:user-alice-123'
      )
      expect(cached).toBeDefined()
      expect(cached?.code).toMatch(/^[0-9]{6}$/)
      expect(cached?.email).toBe('alice@example.com')

      // Try triggering immediately again -> Expect 429 Too Many Requests
      const rateRes = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/setup', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(rateRes.status).toBe(429)
      const rateData = await rateRes.json()
      expect(rateData.code).toBe('too-many-requests')
    })
  })

  // ===========================================================================
  // 3. POST /carina/auth/twofactor/email/send
  // ===========================================================================
  describe('POST /carina/auth/twofactor/email/send', () => {
    it('fails (401) when neither session nor mfaTicket is provided', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (400) with invalid or expired mfaTicket', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mfaTicket: 'mfa_nonexistent_ticket_12345' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.detail).toContain('Invalid or expired MFA session ticket')
    })

    it('fails (400) with mfaTicket when email MFA is not enabled on account', async () => {
      const testTicket = 'mfa_ticket_bob_not_enabled'
      await cache.set(`auth:mfa-ticket:${testTicket}`, { userId: 'user-bob-456' }, 300)

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mfaTicket: testTicket }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.detail).toContain('Email MFA is not enabled')
    })

    it('successfully sends code for valid mfaTicket during login challenge', async () => {
      const alice = mockUsers.find((u) => u.id === 'user-alice-123')!
      alice.emailMfaEnabled = true

      const testTicket = 'mfa_ticket_alice_active'
      await cache.set(`auth:mfa-ticket:${testTicket}`, { userId: 'user-alice-123' }, 300)

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mfaTicket: testTicket }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.email).toBe('a***e@example.com')

      const loginCode = await cache.get<string>('auth:mfa-email-code:user-alice-123')
      expect(loginCode).toMatch(/^[0-9]{6}$/)
    })

    it('successfully resends setup code when authenticated via session', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/send', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({}),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.email).toBe('b***b@example.com')

      const setupCode = await cache.get<{ code: string }>('auth:email-2fa:setup:user-bob-456')
      expect(setupCode?.code).toMatch(/^[0-9]{6}$/)
    })
  })

  // ===========================================================================
  // 4. POST /carina/auth/twofactor/email/verify
  // ===========================================================================
  describe('POST /carina/auth/twofactor/email/verify', () => {
    it('fails (422) on invalid code format (not 6 digits)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: '123' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) during setup verification if setup was not initiated or expired', async () => {
      await cache.del('auth:email-2fa:setup:user-alice-123')

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/verify', {
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
      expect(data.detail).toContain('session expired or was not initiated')
    })

    it('fails (400) during setup verification if code is wrong', async () => {
      await cache.set(
        'auth:email-2fa:setup:user-alice-123',
        { code: '987654', email: 'alice@example.com' },
        600
      )

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: '111111' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.detail).toContain('Invalid verification code')
    })

    it('successfully completes setup, enables Email 2FA, and issues initial backup codes', async () => {
      await cache.set(
        'auth:email-2fa:setup:user-alice-123',
        { code: '654321', email: 'alice@example.com' },
        600
      )

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: '654321' }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Email two-factor authentication has been enabled')
      expect(data.backupCodes).toBeDefined()
      expect(data.backupCodes.length).toBe(10)

      const alice = mockUsers.find((u) => u.id === 'user-alice-123')!
      expect(alice.emailMfaEnabled).toBe(true)
      expect(alice.backupCodes.length).toBe(10)

      // Setup cache cleared
      const setupCache = await cache.get('auth:email-2fa:setup:user-alice-123')
      expect(setupCache).toBeNull()
    })

    it('successfully verifies login challenge via mfaTicket and issues session JWT', async () => {
      const alice = mockUsers.find((u) => u.id === 'user-alice-123')!
      alice.emailMfaEnabled = true

      const testTicket = 'mfa_ticket_login_flow_123'
      await cache.set(`auth:mfa-ticket:${testTicket}`, { userId: 'user-alice-123' }, 300)
      await cache.set('auth:mfa-email-code:user-alice-123', '555666', 300)

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mfaTicket: testTicket, code: '555666' }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.token).toBeDefined()
      expect(data.user.id).toBe('user-alice-123')
      expect(data.user.username).toBe('alice')

      // Ticket and login code burned
      expect(await cache.get(`auth:mfa-ticket:${testTicket}`)).toBeNull()
      expect(await cache.get('auth:mfa-email-code:user-alice-123')).toBeNull()
    })
  })

  // ===========================================================================
  // 5. DELETE /carina/auth/twofactor/email
  // ===========================================================================
  describe('DELETE /carina/auth/twofactor/email', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (400) when Email 2FA is not enabled on account', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.detail).toContain('not currently enabled')
    })

    it('fails (401) when incorrect password confirmation is passed', async () => {
      const alice = mockUsers.find((u) => u.id === 'user-alice-123')!
      alice.emailMfaEnabled = true

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email', {
          method: 'DELETE',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ password: 'WrongPassword999!' }),
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.detail).toContain('Incorrect password confirmation')
    })

    it('successfully disables Email 2FA and wipes backup codes if no other MFA remains', async () => {
      const alice = mockUsers.find((u) => u.id === 'user-alice-123')!
      alice.emailMfaEnabled = true
      alice.backupCodes = ['hash1', 'hash2']

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email', {
          method: 'DELETE',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ password: testPassword }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Email two-factor authentication has been disabled')

      expect(alice.emailMfaEnabled).toBe(false)
      expect(alice.backupCodes).toEqual([])
    })

    it('preserves backup codes when another MFA method (passkey or TOTP) is still active', async () => {
      const alice = mockUsers.find((u) => u.id === 'user-alice-123')!
      alice.emailMfaEnabled = true
      alice.TOTPEnabled = true // TOTP remains active
      alice.backupCodes = ['hash1', 'hash2']

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/email', {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${aliceToken}`,
          },
        })
      )
      expect(res.status).toBe(200)
      expect(alice.emailMfaEnabled).toBe(false)
      expect(alice.backupCodes.length).toBe(2) // Kept because TOTP is still enabled
    })
  })

  // ===========================================================================
  // 6. EmailService Dispatch & Queue Status Tests
  // ===========================================================================
  describe('EmailService Dispatching & Operations', () => {
    it('dispatches MFA verification emails gracefully', async () => {
      const success = await EmailService.sendMfaVerificationEmail('test@iris.local', '123456', 5)
      expect(success).toBe(true)
    })

    it('dispatches password reset emails gracefully', async () => {
      const success = await EmailService.sendPasswordResetEmail(
        'test@iris.local',
        'http://localhost:3000/auth/reset-password?token=test123',
        15
      )
      expect(success).toBe(true)
    })

    it('dispatches custom emails gracefully', async () => {
      const success = await EmailService.sendEmail({
        to: 'test@iris.local',
        subject: 'Custom Notification',
        html: '<p>Custom HTML Body</p>',
        text: 'Custom Text Body',
      })
      expect(success).toBe(true)
    })

    it('returns queue status representation without throwing', async () => {
      const status = await EmailService.getQueueStatus()
      expect(status).toBeDefined()
      expect(typeof status.online).toBe('boolean')
    })
  })
})
