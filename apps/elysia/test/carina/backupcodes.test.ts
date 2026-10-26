import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { carinaBackupCodes } from '../../src/api/controllers/carina/backupcodes.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt, generateBackupCodes } from '../../src/utils/auth-crypto'
import { prisma } from '@Iris/db'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Backup Codes
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string | null
  permissions: number[]
  TOTPEnabled: boolean
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
      permissions: [1],
      TOTPEnabled: true, // Alice has TOTP enabled
      emailMfaEnabled: false,
      backupCodes: [],
      passkeys: [],
    },
    {
      id: 'user-bob-456',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [0],
      TOTPEnabled: false, // Bob has NO MFA
      emailMfaEnabled: false,
      backupCodes: [],
      passkeys: [],
    },
  ]

  ;((prisma as any).user.findUnique as any) = async ({ where, include }: any) => {
    const user = mockUsers.find((u) => u.id === where.id)
    if (!user) return null
    if (include?.passkeys) {
      return { ...user }
    }
    return { ...user }
  }

  ;((prisma as any).user.update as any) = async ({ where, data }: any) => {
    const user = mockUsers.find((u) => u.id === where.id)
    if (!user) throw new Error('User not found')
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
  .use(carinaBackupCodes)

describe('Comprehensive Carina Backup Codes Test Suite', () => {
  let aliceToken: string
  let bobToken: string

  beforeEach(async () => {
    setupPrismaMock()
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
  // 1. POST /carina/auth/twofactor/backupcodes/generate Scenarios
  // ===========================================================================
  describe('POST /carina/auth/twofactor/backupcodes/generate', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/generate', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
    })

    it('fails (400) when user has NO multi-factor authentication active', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/generate', {
          method: 'POST',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('Multi-factor authentication must be enabled')
    })

    it('successfully generates 10 initial recovery backup codes', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/generate', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.backupCodes.length).toBe(10)
      expect(data.backupCodes[0]!).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

      // Verify stored in DB
      const user = mockUsers.find((u) => u.id === 'user-alice-123')!
      expect(user.backupCodes.length).toBe(10)
    })

    it('fails (400) when backup codes have already been generated for this user', async () => {
      // First generation succeeds
      await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/generate', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )

      // Second generation fails (must use regenerate)
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/generate', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('already been generated')
    })
  })

  // ===========================================================================
  // 2. POST /carina/auth/twofactor/backupcodes/regenerate Scenarios
  // ===========================================================================
  describe('POST /carina/auth/twofactor/backupcodes/regenerate', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/regenerate', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (400) when user has NO active MFA', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/regenerate', {
          method: 'POST',
          headers: { authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.detail).toContain('Multi-factor authentication must be enabled')
    })

    it('successfully regenerates 10 new codes, replacing all prior codes', async () => {
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.backupCodes = ['old-hash-1', 'old-hash-2']

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/regenerate', {
          method: 'POST',
          headers: { authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.backupCodes.length).toBe(10)
      expect(aliceUser.backupCodes.length).toBe(10)
      expect(aliceUser.backupCodes[0]!).not.toBe('old-hash-1')
    })
  })

  // ===========================================================================
  // 3. POST /carina/auth/twofactor/backupcodes/verify Scenarios
  // ===========================================================================
  describe('POST /carina/auth/twofactor/backupcodes/verify', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: 'ABCD-EFGH-IJKL-MNOP' }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (422) when code length is invalid', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: 'short' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when account has no backup codes generated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: 'AAAA-BBBB-CCCC-DDDD' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('No backup codes exist')
    })

    it('fails (400) when code is incorrect', async () => {
      const { hashed } = await generateBackupCodes()
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.backupCodes = hashed

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: 'XXXX-YYYY-ZZZZ-WWWW' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('Invalid or previously used')
    })

    it('successfully verifies and consumes a single-use backup code', async () => {
      const { plain, hashed } = await generateBackupCodes()
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.backupCodes = [...hashed]

      const codeToUse = plain[0]!
      expect(aliceUser.backupCodes.length).toBe(10)

      // First verification succeeds
      const res1 = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: codeToUse }),
        })
      )
      expect(res1.status).toBe(200)
      const data1 = await res1.json()
      expect(data1.success).toBe(true)
      expect(data1.remainingCount).toBe(9)
      expect(aliceUser.backupCodes.length).toBe(9)

      // Second verification of the SAME code fails (single-use consumption)
      const res2 = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: codeToUse }),
        })
      )
      expect(res2.status).toBe(400)
      const data2 = await res2.json()
      expect(data2.detail).toContain('Invalid or previously used')
    })

    it('verifies unformatted code without hyphens', async () => {
      const { plain, hashed } = await generateBackupCodes()
      const aliceUser = mockUsers.find((u) => u.id === 'user-alice-123')!
      aliceUser.backupCodes = [...hashed]

      const unformattedCode = plain[1]!.replaceAll('-', '')

      const res = await app.handle(
        new Request('http://localhost/carina/auth/twofactor/backupcodes/verify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: unformattedCode }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.remainingCount).toBe(9)
    })
  })
})
