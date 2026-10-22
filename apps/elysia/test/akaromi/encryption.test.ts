import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { akaromiEncryption } from '../../src/api/controllers/akaromi/encryption.ctrl'
import { isHttpError, NotFound } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { AkaromiEncryptionServ } from '../../src/services/akaromi/encryption.serv'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Master Encryption Keys
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  publicKey: string | null
  encryptedPrivateKey: string | null
  passwordHash: string
  permissions: number[]
  customization: any
  passwordChangedAt: Date | null
}

let mockUsers: MockUser[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA',
      encryptedPrivateKey: 'a1b2c3d4e5f6:0123456789ab:abcdef123456:7890abcdef',
      passwordHash: 'f0e1d2c3b4a5:1234567890abcdef',
      permissions: [],
      customization: {},
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      publicKey: null,
      encryptedPrivateKey: null,
      passwordHash: 'deadbeefcafe:fedcba0987654321',
      permissions: [],
      customization: {},
      passwordChangedAt: null,
    },
  ]

  // Mock User findUnique
  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
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
    if (error instanceof ValidationError) {
      set.status = 422
      return {
        type: 'validation',
        title: 'Unprocessable Content',
        status: 422,
        code: 'validation',
        detail: error.message,
      }
    }
  })
  .use(akaromiEncryption)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Akaromi Encryption Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-iris-secret-key-at-least-32-chars!'
    setupPrismaMock()

    aliceToken = await signUserJwt({
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
    })

    bobToken = await signUserJwt({
      id: BOB_ID,
      username: 'bob',
      email: 'bob@example.com',
    })
  })

  describe('GET /akaromi/encryption/keys', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/encryption/keys', { method: 'GET' })
      )
      expect(res.status).toBe(401)
    })

    it('returns public key, encrypted private key, salt, and hasEncryptionKeys: true for initialized user', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/encryption/keys', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.userId).toBe(ALICE_ID)
      expect(data.publicKey).toBe('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA')
      expect(data.encryptedPrivateKey).toBe(
        'a1b2c3d4e5f6:0123456789ab:abcdef123456:7890abcdef'
      )
      expect(data.salt).toBe('a1b2c3d4e5f6') // Extracted from encryptedPrivateKey
      expect(data.hasEncryptionKeys).toBe(true)
    })

    it('returns null keys and fallback salt from password hash when keys are uninitialized', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/encryption/keys', {
          method: 'GET',
          headers: { Authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.userId).toBe(BOB_ID)
      expect(data.publicKey).toBeNull()
      expect(data.encryptedPrivateKey).toBeNull()
      expect(data.salt).toBe('deadbeefcafe') // Derived from passwordHash
      expect(data.hasEncryptionKeys).toBe(false)
    })

    it('fails (401) when user has an invalid or unknown session token', async () => {
      const ghostToken = await signUserJwt({
        id: '00000000-0000-0000-0000-999999999999',
        username: 'ghost',
        email: 'ghost@example.com',
      })

      const res = await app.handle(
        new Request('http://localhost/akaromi/encryption/keys', {
          method: 'GET',
          headers: { Authorization: `Bearer ${ghostToken}` },
        })
      )
      expect(res.status).toBe(401)
    })

    it('throws NotFound (404) in service when user ID is not found in database', async () => {
      expect(
        AkaromiEncryptionServ.getEncryptionKeys('00000000-0000-0000-0000-999999999999')
      ).rejects.toThrow(NotFound)
    })
  })
})
