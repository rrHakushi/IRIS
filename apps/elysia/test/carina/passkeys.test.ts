import { describe, expect, it, beforeEach, mock } from 'bun:test'
import * as realWebAuthn from '@simplewebauthn/server'
import { Elysia } from 'elysia'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { cache } from '../../src/utils/cache'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// Configurable WebAuthn Verification Mock
// -----------------------------------------------------------------------------

let mockVerifyResult: any = {
  verified: true,
  registrationInfo: {
    credential: {
      id: 'cred-mock-id-123',
      publicKey: Buffer.from('mock-public-key'),
      counter: 1,
      transports: ['internal'],
    },
  },
}

mock.module('@simplewebauthn/server', () => ({
  ...realWebAuthn,
  verifyRegistrationResponse: async (args: any) => {
    if (mockVerifyResult instanceof Error) {
      throw mockVerifyResult
    }
    return mockVerifyResult
  },
}))

// Import controller after module mock is set up
const { carinaPasskeys } = await import('../../src/api/controllers/carina/passkeys.ctrl')

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Passkeys and Users
// -----------------------------------------------------------------------------

interface MockPasskey {
  id: string
  publicKey: string
  counter: number
  transports: string[]
  name: string | null
  createdAt: Date
  userId: string
}

interface MockUser {
  id: string
  username: string
  email: string | null
  permissions: number[]
  passwordChangedAt: Date | null
  TOTPEnabled: boolean
  emailMfaEnabled: boolean
  backupCodes: string[]
}

let mockUsers: MockUser[] = []
let mockPasskeys: MockPasskey[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: 'user-alice-123',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [1],
      passwordChangedAt: null,
      TOTPEnabled: false,
      emailMfaEnabled: false,
      backupCodes: [],
    },
    {
      id: 'user-bob-456',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [0],
      passwordChangedAt: null,
      TOTPEnabled: false,
      emailMfaEnabled: false,
      backupCodes: [],
    },
  ]

  mockPasskeys = []

  ;(prisma.user.findUnique as any) = async ({ where, include }: any) => {
    const user = mockUsers.find((u) => u.id === where.id)
    if (!user) return null
    if (include?.passkeys) {
      return {
        ...user,
        passkeys: mockPasskeys.filter((pk) => pk.userId === user.id),
      }
    }
    return { ...user }
  }

  ;(prisma.user.update as any) = async ({ where, data }: any) => {
    const user = mockUsers.find((u) => u.id === where.id)
    if (!user) throw new Error('User not found')
    if (data.backupCodes !== undefined) user.backupCodes = data.backupCodes
    return { ...user }
  }

  ;(prisma.passkey.count as any) = async ({ where }: any) => {
    return mockPasskeys.filter((pk) => pk.userId === where.userId).length
  }

  ;(prisma.passkey.findMany as any) = async ({ where, skip = 0, take = 10 }: any) => {
    return mockPasskeys
      .filter((pk) => pk.userId === where.userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(skip, skip + take)
  }

  ;(prisma.passkey.findFirst as any) = async ({ where }: any) => {
    return (
      mockPasskeys.find((pk) => {
        if (where.id && pk.id !== where.id) return false
        if (where.userId && pk.userId !== where.userId) return false
        return true
      }) ?? null
    )
  }

  ;(prisma.passkey.create as any) = async ({ data }: any) => {
    const newPk: MockPasskey = {
      id: data.id,
      publicKey: data.publicKey,
      counter: data.counter,
      transports: data.transports ?? [],
      name: data.name ?? null,
      createdAt: new Date(),
      userId: data.userId,
    }
    mockPasskeys.push(newPk)
    return newPk
  }

  ;(prisma.passkey.delete as any) = async ({ where }: any) => {
    const idx = mockPasskeys.findIndex((pk) => pk.id === where.id)
    if (idx === -1) throw new Error('Passkey not found')
    const [deleted] = mockPasskeys.splice(idx, 1)
    return deleted
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
  .use(carinaPasskeys)

describe('Comprehensive Carina Passkeys Test Suite', () => {
  let aliceToken: string
  let bobToken: string

  beforeEach(async () => {
    setupPrismaMock()
    mockVerifyResult = {
      verified: true,
      registrationInfo: {
        credential: {
          id: 'cred-mock-id-123',
          publicKey: Buffer.from('mock-public-key'),
          counter: 1,
          transports: ['internal'],
        },
      },
    }

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
  // 1. GET /carina/auth/twofactor/passkeys Scenarios
  // ===========================================================================
  describe('GET /carina/auth/twofactor/passkeys', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
      expect(data.title).toBe('Unauthorized')
    })

    it('returns empty list for user with no passkeys', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.total).toBe(0)
      expect(data.page).toBe(1)
      expect(data.limit).toBe(10)
      expect(data.passkeys).toEqual([])
    })

    it('returns paginated passkeys (10 per page default, newest first)', async () => {
      for (let i = 1; i <= 15; i++) {
        mockPasskeys.push({
          id: `pk-alice-${i}`,
          publicKey: `pub-${i}`,
          counter: i,
          transports: ['internal', 'usb'],
          name: `Alice Key ${i}`,
          createdAt: new Date(Date.now() + i * 1000),
          userId: 'user-alice-123',
        })
      }

      // Page 1: 10 items
      const res1 = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res1.status).toBe(200)
      const data1 = await res1.json()
      expect(data1.total).toBe(15)
      expect(data1.page).toBe(1)
      expect(data1.limit).toBe(10)
      expect(data1.passkeys.length).toBe(10)
      expect(data1.passkeys[0]!.name).toBe('Alice Key 15')

      // Page 2: 5 items
      const res2 = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys?page=2&limit=10', {
          method: 'GET',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res2.status).toBe(200)
      const data2 = await res2.json()
      expect(data2.total).toBe(15)
      expect(data2.page).toBe(2)
      expect(data2.passkeys.length).toBe(5)
      expect(data2.passkeys[4]!.name).toBe('Alice Key 1')
    })

    it('isolates passkeys across distinct user accounts', async () => {
      mockPasskeys.push(
        {
          id: 'pk-alice-1',
          publicKey: 'pub-alice',
          counter: 0,
          transports: ['internal'],
          name: 'Alice MacBook',
          createdAt: new Date(),
          userId: 'user-alice-123',
        },
        {
          id: 'pk-bob-1',
          publicKey: 'pub-bob',
          counter: 0,
          transports: ['usb'],
          name: 'Bob YubiKey',
          createdAt: new Date(),
          userId: 'user-bob-456',
        }
      )

      const aliceRes = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      const aliceData = await aliceRes.json()
      expect(aliceData.total).toBe(1)
      expect(aliceData.passkeys[0]!.name).toBe('Alice MacBook')

      const bobRes = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys', {
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      const bobData = await bobRes.json()
      expect(bobData.total).toBe(1)
      expect(bobData.passkeys[0]!.name).toBe('Bob YubiKey')
    })

    it('fails (422) on invalid pagination query parameters', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys?page=0', {
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 2. POST /carina/auth/twofactor/passkeys (Registration Challenge) Scenarios
  // ===========================================================================
  describe('POST /carina/auth/twofactor/passkeys (Challenge)', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
    })

    it('generates WebAuthn registration options and caches challenge', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
            origin: 'http://localhost:3000',
          },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.challenge).toBeDefined()
      expect(typeof data.challenge).toBe('string')
      expect(data.rp.name).toBe('IRIS')
      expect(data.rp.id).toBe('localhost')
      expect(data.user.name).toBe('alice')
      expect(data.pubKeyCredParams.length).toBeGreaterThan(0)

      // Verify challenge cached in Redis/LRU for Alice
      const cached = await cache.get<string>('auth:passkey-reg:user-alice-123')
      expect(cached).toBe(data.challenge)
    })

    it('excludes existing passkey credentials from options', async () => {
      mockPasskeys.push({
        id: 'existing-cred-id-abc',
        publicKey: 'pub-abc',
        counter: 0,
        transports: ['internal'],
        name: 'Existing Key',
        createdAt: new Date(),
        userId: 'user-alice-123',
      })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${aliceToken}`,
          },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.excludeCredentials).toBeDefined()
      expect(data.excludeCredentials.some((c: any) => c.id === 'existing-cred-id-abc')).toBe(true)
    })
  })

  // ===========================================================================
  // 3. POST /carina/auth/twofactor/passkeys/verify Scenarios
  // ===========================================================================
  describe('POST /carina/auth/twofactor/passkeys/verify', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            passkeyResponse: { id: 'x', rawId: 'x', response: {} },
          }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (422) on malformed request body', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ name: 'Incomplete' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when challenge expired or was not initiated', async () => {
      // Ensure no challenge exists in cache
      await cache.del('auth:passkey-reg:user-alice-123')

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            passkeyResponse: {
              id: 'cred-123',
              rawId: 'cred-123',
              response: { attestationObject: 'x', clientDataJSON: 'y' },
            },
            name: 'My New Key',
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('challenge expired or not initiated')
    })

    it('fails (400) when WebAuthn verification fails or throws error', async () => {
      await cache.set('auth:passkey-reg:user-alice-123', 'saved-challenge', 300)
      mockVerifyResult = new Error('Attestation verification failed: signature invalid')

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            passkeyResponse: {
              id: 'cred-123',
              rawId: 'cred-123',
              response: { attestationObject: 'x', clientDataJSON: 'y' },
            },
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('Attestation verification failed')
    })

    it('fails (400) when verification result is not verified', async () => {
      await cache.set('auth:passkey-reg:user-alice-123', 'saved-challenge', 300)
      mockVerifyResult = { verified: false }

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            passkeyResponse: {
              id: 'cred-123',
              rawId: 'cred-123',
              response: { attestationObject: 'x', clientDataJSON: 'y' },
            },
          }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.detail).toContain('verification failed')
    })

    it('successfully registers first passkey and issues initial backup codes', async () => {
      await cache.set('auth:passkey-reg:user-alice-123', 'active-challenge', 300)
      mockVerifyResult = {
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-alice-touchid',
            publicKey: Buffer.from('alice-public-key-bytes'),
            counter: 5,
            transports: ['internal'],
          },
        },
      }

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({
            passkeyResponse: {
              id: 'cred-alice-touchid',
              rawId: 'cred-alice-touchid',
              response: { attestationObject: 'x', clientDataJSON: 'y' },
            },
            name: 'MacBook TouchID',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('registered successfully')
      // First MFA setup: returns 10 backup codes
      expect(data.backupCodes).toBeDefined()
      expect(data.backupCodes.length).toBe(10)

      // Verified stored in DB
      expect(mockPasskeys.length).toBe(1)
      expect(mockPasskeys[0]!.id).toBe('cred-alice-touchid')
      expect(mockPasskeys[0]!.name).toBe('MacBook TouchID')
      expect(mockPasskeys[0]!.userId).toBe('user-alice-123')

      // Check cached challenge was removed
      const cachedAfter = await cache.get('auth:passkey-reg:user-alice-123')
      expect(cachedAfter).toBeNull()

      // User has backup codes hashed in DB
      const user = mockUsers.find((u) => u.id === 'user-alice-123')
      expect(user!.backupCodes.length).toBe(10)
    })

    it('does not re-issue backup codes if user already had backup codes configured', async () => {
      // User Bob already has backup codes
      const bobUser = mockUsers.find((u) => u.id === 'user-bob-456')!
      bobUser.backupCodes = ['existing-hash-1', 'existing-hash-2']

      await cache.set('auth:passkey-reg:user-bob-456', 'active-challenge-bob', 300)
      mockVerifyResult = {
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-bob-yubikey',
            publicKey: Buffer.from('bob-public-key-bytes'),
            counter: 0,
            transports: ['usb'],
          },
        },
      }

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bobToken}`,
          },
          body: JSON.stringify({
            passkeyResponse: {
              id: 'cred-bob-yubikey',
              rawId: 'cred-bob-yubikey',
              response: { attestationObject: 'x', clientDataJSON: 'y' },
            },
            name: 'YubiKey 5C',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.backupCodes).toBeUndefined()
      expect(bobUser.backupCodes.length).toBe(2) // Kept original
    })
  })

  // ===========================================================================
  // 4. DELETE /carina/auth/twofactor/passkeys/:passkeyId Scenarios
  // ===========================================================================
  describe('DELETE /carina/auth/twofactor/passkeys/:passkeyId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/pk-123', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when passkey does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/nonexistent-pk', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.code).toBe('not-found')
    })

    it('fails (404) when attempting to delete another user’s passkey (cross-user protection)', async () => {
      mockPasskeys.push({
        id: 'pk-bob-private',
        publicKey: 'pub-bob',
        counter: 0,
        transports: ['internal'],
        name: 'Bob Secure Key',
        createdAt: new Date(),
        userId: 'user-bob-456',
      })

      // Alice attempts to delete Bob's key
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/pk-bob-private', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      expect(mockPasskeys.length).toBe(1) // Still present
    })

    it('successfully deletes passkey and resets backup codes if no remaining MFA', async () => {
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.backupCodes = ['hash-1', 'hash-2']

      mockPasskeys.push({
        id: 'pk-alice-only',
        publicKey: 'pub-alice',
        counter: 0,
        transports: ['internal'],
        name: 'Alice Sole Key',
        createdAt: new Date(),
        userId: 'user-alice-123',
      })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/pk-alice-only', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('deleted successfully')
      expect(mockPasskeys.length).toBe(0)

      // No remaining MFA methods: backup codes cleared
      expect(aliceUser.backupCodes).toEqual([])
    })

    it('successfully deletes passkey but preserves backup codes if other MFA (e.g. TOTP) is active', async () => {
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.TOTPEnabled = true
      aliceUser.backupCodes = ['hash-1', 'hash-2']

      mockPasskeys.push({
        id: 'pk-alice-totp-active',
        publicKey: 'pub-alice',
        counter: 0,
        transports: ['internal'],
        name: 'Alice Key',
        createdAt: new Date(),
        userId: 'user-alice-123',
      })

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/passkeys/pk-alice-totp-active', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      expect(mockPasskeys.length).toBe(0)
      // TOTP is active, backup codes preserved
      expect(aliceUser.backupCodes.length).toBe(2)
    })
  })
})
