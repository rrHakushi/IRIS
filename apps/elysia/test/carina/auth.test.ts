import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { carinaAuth } from '../../src/api/controllers/carina/auth.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { cache } from '../../src/utils/cache'
import {
  hashPassword,
  verifyPassword,
  signUserJwt,
  generateUserKeypair,
} from '../../src/utils/auth-crypto'
import { prisma } from '@IRIS/database'
import { IRISFlags } from '@IRIS/permissions'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for prisma.user
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  passwordHash: string
  permissions: number[]
  publicKey: string | null
  encryptedPrivateKey: string | null
  encryptionPasswordHash: string | null
  passwordChangedAt: Date | null
  TOTPEnabled: boolean
  TOTPSecret: string | null
  emailMfaEnabled: boolean
  passkeys: Array<{ id: string }>
}

let mockUsers: MockUser[] = []

function setupPrismaMock() {
  mockUsers = []

  ;(prisma.user.findFirst as any) = async ({ where, include }: any) => {
    return (
      mockUsers.find((u) => {
        if (where.OR) {
          return where.OR.some((condition: any) => {
            if (condition.email !== undefined && u.email.toLowerCase() === condition.email.toLowerCase()) return true
            if (condition.username !== undefined && u.username.toLowerCase() === condition.username.toLowerCase()) return true
            return false
          })
        }
        return false
      }) ?? null
    )
  }

  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return (
      mockUsers.find((u) => {
        if (where.id && u.id === where.id) return true
        if (where.email && u.email.toLowerCase() === where.email.toLowerCase()) return true
        return false
      }) ?? null
    )
  }

  ;(prisma.user.findMany as any) = async ({ where, select }: any) => {
    return mockUsers
      .filter((u) => {
        if (where.OR) {
          return where.OR.some((c: any) => {
            if (c.email !== undefined && u.email.toLowerCase() === c.email.toLowerCase()) return true
            if (c.username !== undefined && u.username.toLowerCase() === c.username.toLowerCase()) return true
            return false
          })
        }
        return false
      })
      .map((u) => {
        if (select) {
          const res: any = {}
          for (const key of Object.keys(select)) {
            res[key] = (u as any)[key]
          }
          return res
        }
        return u
      })
  }

  ;(prisma.user.count as any) = async () => {
    return mockUsers.length
  }

  ;(prisma.user.create as any) = async ({ data }: any) => {
    const newUser: MockUser = {
      id: `usr_${Math.random().toString(36).slice(2, 10)}`,
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      permissions: data.permissions ?? [],
      publicKey: data.publicKey ?? null,
      encryptedPrivateKey: data.encryptedPrivateKey ?? null,
      encryptionPasswordHash: data.encryptionPasswordHash ?? null,
      passwordChangedAt: null,
      TOTPEnabled: false,
      TOTPSecret: null,
      emailMfaEnabled: false,
      passkeys: [],
    }
    mockUsers.push(newUser)
    return newUser
  }

  ;(prisma.user.update as any) = async ({ where, data }: any) => {
    const user = mockUsers.find((u) => u.id === where.id)
    if (!user) throw new Error('User not found in mock')
    Object.assign(user, data)
    return user
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
  .use(carinaAuth)

describe('Comprehensive Carina Auth Test Suite', () => {
  beforeEach(() => {
    setupPrismaMock()
  })

  // ===========================================================================
  // 1. POST /carina/auth/register Scenarios
  // ===========================================================================
  describe('POST /carina/auth/register', () => {
    it('fails (422) when email has invalid format', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'alice_smith',
            email: 'not-an-email',
            password: 'ValidPassword123!@#',
          }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (422) when password is too short (< 12 characters)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'alice_smith',
            email: 'alice@example.com',
            password: 'short',
          }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when sanitized username is less than 3 characters', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: '$$__@@', // only 2 valid alphanumeric characters: __
            email: 'alice@example.com',
            password: 'ValidPassword123!@#',
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('at least 3 characters')
    })

    it('fails (409) when username is a reserved system keyword', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'admin',
            email: 'admin@example.com',
            password: 'ValidPassword123!@#',
          }),
        })
      )
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.code).toBe('conflict')
      expect(data.detail).toContain('reserved system or language keyword')
    })

    it('successfully registers the first user with ADMINISTRATOR permissions', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'first_admin',
            email: 'admin@iris.app',
            password: 'SuperAdminPass123!@#',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.user.username).toBe('first_admin')
      expect(data.user.email).toBe('admin@iris.app')
      expect(data.user.publicKey).toBeDefined()

      // Verify in DB mock
      const created = mockUsers.find((u) => u.username === 'first_admin')
      expect(created).toBeDefined()
      expect(created?.permissions).toContain(Number(IRISFlags.ADMINISTRATOR))
      expect(created?.passwordHash).not.toBe('SuperAdminPass123!@#')
    })

    it('fails (409) when attempting to register a duplicate username', async () => {
      // First user
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'unique_user',
            email: 'user1@example.com',
            password: 'Password123!@#',
          }),
        })
      )

      // Duplicate username, different email
      const res = await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'unique_user',
            email: 'user2@example.com',
            password: 'Password123!@#',
          }),
        })
      )
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.code).toBe('conflict')
      expect(data.detail).toContain('already taken')
    })

    it('fails (409) when attempting to register a duplicate email', async () => {
      // First user
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'user_one',
            email: 'shared@example.com',
            password: 'Password123!@#',
          }),
        })
      )

      // Duplicate email, different username
      const res = await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'user_two',
            email: 'shared@example.com',
            password: 'Password123!@#',
          }),
        })
      )
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.code).toBe('conflict')
      expect(data.detail).toContain('already exists')
    })

    it('fails (409) when both username and email already exist', async () => {
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'bob_ross',
            email: 'bob@example.com',
            password: 'Password123!@#',
          }),
        })
      )

      const res = await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'bob_ross',
            email: 'bob@example.com',
            password: 'Password123!@#',
          }),
        })
      )
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.detail).toContain('already registered')
    })
  })

  // ===========================================================================
  // 2. POST /carina/auth/login Scenarios
  // ===========================================================================
  describe('POST /carina/auth/login', () => {
    it('fails (422) on missing credentials', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ identifier: '' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (401) when user identifier does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'ghost_user',
            password: 'SomePassword123!',
          }),
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
      expect(data.detail).toContain('No account was found')
    })

    it('fails (401) when password is wrong', async () => {
      // Register user
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'charlie',
            email: 'charlie@example.com',
            password: 'CorrectPassword123!',
          }),
        })
      )

      // Login with wrong password
      const res = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'charlie',
            password: 'WrongPassword999!',
          }),
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
      expect(data.detail).toContain('password provided is incorrect')
    })

    it('successfully logs in with username and returns a signed JWT', async () => {
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'david_clark',
            email: 'david@example.com',
            password: 'MyPassword123!',
          }),
        })
      )

      const res = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'david_clark',
            password: 'MyPassword123!',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.mfaRequired).toBe(false)
      expect(data.token).toBeDefined()
      expect(typeof data.token).toBe('string')
      expect(data.user.username).toBe('david_clark')
    })

    it('successfully logs in using email as identifier', async () => {
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'emma_watson',
            email: 'emma@example.com',
            password: 'MyPassword123!',
          }),
        })
      )

      const res = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'emma@example.com',
            password: 'MyPassword123!',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.user.email).toBe('emma@example.com')
      expect(data.token).toBeDefined()
    })

    it('requires MFA and issues mfaTicket when TOTP is enabled', async () => {
      // Register
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'mfa_user',
            email: 'mfa@example.com',
            password: 'MyPassword123!',
          }),
        })
      )

      // Enable TOTP on mock
      const user = mockUsers.find((u) => u.username === 'mfa_user')!
      user.TOTPEnabled = true
      user.TOTPSecret = 'encrypted_totp_secret'

      const res = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'mfa_user',
            password: 'MyPassword123!',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.mfaRequired).toBe(true)
      expect(data.mfaTicket).toStartWith('mfa_')
      expect(data.allowedMfaTypes).toContain('totp')
      expect(data.token).toBeNull()
      expect(data.user).toBeNull()

      // Check ticket was cached in cache
      const cached = await cache.get<any>(`auth:mfa-ticket:${data.mfaTicket}`)
      expect(cached?.userId).toBe(user.id)
    })
  })

  // ===========================================================================
  // 3. POST /carina/auth/password/change Scenarios
  // ===========================================================================
  describe('POST /carina/auth/password/change', () => {
    it('fails (401) without authentication credentials', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/password/change', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            currentPassword: 'OldPassword123!',
            newPassword: 'BrandNewPassword123!',
          }),
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
      expect(data.detail).toContain('Authentication required')
    })

    it('fails (401) when current password is wrong', async () => {
      // Register and login to obtain token
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'frank_ocean',
            email: 'frank@example.com',
            password: 'OldPassword123!',
          }),
        })
      )

      const loginRes = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'frank_ocean',
            password: 'OldPassword123!',
          }),
        })
      )
      const { token } = await loginRes.json()

      // Change password with wrong current password
      const res = await app.handle(
        new Request('http://localhost/carina/auth/password/change', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword: 'WrongOldPassword!',
            newPassword: 'BrandNewPassword123!',
          }),
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.detail).toContain('current password entered is incorrect')
    })

    it('fails (400) when new password is identical to current password', async () => {
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'george_h',
            email: 'george@example.com',
            password: 'SamePassword123!',
          }),
        })
      )

      const loginRes = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'george_h',
            password: 'SamePassword123!',
          }),
        })
      )
      const { token } = await loginRes.json()

      const res = await app.handle(
        new Request('http://localhost/carina/auth/password/change', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword: 'SamePassword123!',
            newPassword: 'SamePassword123!',
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.detail).toContain('cannot be identical')
    })

    it('successfully changes password and allows logging in with the new password', async () => {
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'helen_mirren',
            email: 'helen@example.com',
            password: 'InitialPassword123!',
          }),
        })
      )

      const loginRes = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'helen_mirren',
            password: 'InitialPassword123!',
          }),
        })
      )
      const { token } = await loginRes.json()

      // Change password
      const changeRes = await app.handle(
        new Request('http://localhost/carina/auth/password/change', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword: 'InitialPassword123!',
            newPassword: 'SuperNewPassword456!',
          }),
        })
      )
      expect(changeRes.status).toBe(200)
      const changeData = await changeRes.json()
      expect(changeData.success).toBe(true)
      expect(changeData.message).toContain('Password changed successfully')

      // Old password should fail now
      const failLogin = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'helen_mirren',
            password: 'InitialPassword123!',
          }),
        })
      )
      expect(failLogin.status).toBe(401)

      // New password should succeed
      const successLogin = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'helen_mirren',
            password: 'SuperNewPassword456!',
          }),
        })
      )
      expect(successLogin.status).toBe(200)
      const successData = await successLogin.json()
      expect(successData.token).toBeDefined()
    })
  })

  // ===========================================================================
  // 4. POST /carina/auth/password/forgot Scenarios
  // ===========================================================================
  describe('POST /carina/auth/password/forgot', () => {
    it('fails (422) on invalid email format', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/password/forgot', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'bad-email' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('returns 200 without leaking when user email does not exist (anti-enumeration)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/password/forgot', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'nobody@nowhere.com' }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Password recovery instructions sent to email')
    })

    it('generates and caches a 256-bit reset token for an existing user', async () => {
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'isla_fisher',
            email: 'isla@example.com',
            password: 'OriginalPassword123!',
          }),
        })
      )

      const res = await app.handle(
        new Request('http://localhost/carina/auth/password/forgot', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'isla@example.com' }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  // ===========================================================================
  // 5. POST /carina/auth/password/reset Scenarios
  // ===========================================================================
  describe('POST /carina/auth/password/reset', () => {
    it('fails (422) when new password is too short (< 12 chars)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/password/reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: 'validlookingtoken12345',
            newPassword: 'short',
          }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when reset token is invalid or expired', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/password/reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: 'non_existent_token_hex_value',
            newPassword: 'MyNewPassword123!Safe',
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('either invalid, has expired')
    })

    it('successfully resets password with cached token and invalidates the token', async () => {
      // Register user
      await app.handle(
        new Request('http://localhost/carina/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: 'jack_reacher',
            email: 'jack@example.com',
            password: 'OldPassword123!@#',
          }),
        })
      )
      const user = mockUsers.find((u) => u.username === 'jack_reacher')!

      // Manually simulate a cached reset token
      const resetToken = 'abc123def456ghi789jkl012mno345pqr'
      await cache.set(`auth:pwd-reset:${resetToken}`, user.id, 900)

      // Reset password using token
      const res = await app.handle(
        new Request('http://localhost/carina/auth/password/reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: resetToken,
            newPassword: 'ResetPasswordSuccess123!',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('Password reset successfully')

      // Token should now be deleted from cache
      const cachedAfter = await cache.get(`auth:pwd-reset:${resetToken}`)
      expect(cachedAfter).toBeNull()

      // Subsequent attempt with consumed token must fail (400)
      const reuseRes = await app.handle(
        new Request('http://localhost/carina/auth/password/reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: resetToken,
            newPassword: 'AnotherPassword123!',
          }),
        })
      )
      expect(reuseRes.status).toBe(400)

      // User can now log in with the reset password
      const loginRes = await app.handle(
        new Request('http://localhost/carina/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            identifier: 'jack_reacher',
            password: 'ResetPasswordSuccess123!',
          }),
        })
      )
      expect(loginRes.status).toBe(200)
      const loginData = await loginRes.json()
      expect(loginData.token).toBeDefined()
    })
  })
})
