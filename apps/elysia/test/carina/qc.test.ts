import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia } from 'elysia'
import { carinaQc } from '../../src/api/controllers/carina/qc.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { cache } from '../../src/utils/cache'
import { prisma } from '@IRIS/database'
import { decode } from 'next-auth/jwt'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Users
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  permissions: number[]
  passwordChangedAt: Date | null
}

let mockUsers: MockUser[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: 'user-alice-123',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [1],
      passwordChangedAt: null,
    },
    {
      id: 'user-bob-456',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [0],
      passwordChangedAt: null,
    },
  ]

  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
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
  .use(carinaQc)

describe('Comprehensive Carina Quick Connect (QC) Test Suite', () => {
  let aliceToken: string

  beforeEach(async () => {
    setupPrismaMock()
    aliceToken = await signUserJwt({
      id: 'user-alice-123',
      username: 'alice',
      email: 'alice@example.com',
    })
  })

  // ===========================================================================
  // 1. POST /carina/auth/qc/generate Scenarios
  // ===========================================================================
  describe('POST /carina/auth/qc/generate', () => {
    it('generates pairing code, sessionToken, and qrPayload', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/qc/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceName: 'Living Room TV' }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      expect(data.sessionToken).toMatch(/^[a-f0-9]{64}$/)
      expect(data.qrPayload).toContain(`/qc?code=${data.code}`)
      expect(data.expiresIn).toBe(300)

      // Verify records cached
      const cachedToken = await cache.get<string>(`auth:quickconnect:code:${data.code}`)
      expect(cachedToken).toBe(data.sessionToken)

      const session = await cache.get<any>(`auth:quickconnect:session:${data.sessionToken}`)
      expect(session).toBeDefined()
      expect(session.status).toBe('pending')
      expect(session.deviceName).toBe('Living Room TV')
      expect(session.userId).toBeNull()
    })

    it('works without request body (defaults to Device)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/qc/generate', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.code).toBeDefined()
      expect(data.sessionToken).toBeDefined()
    })
  })

  // ===========================================================================
  // 2. GET /carina/auth/qc/status Scenarios
  // ===========================================================================
  describe('GET /carina/auth/qc/status', () => {
    it('returns status "expired" when session does not exist or expired', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/qc/status?sessionToken=nonexistent000000000000000000000000000000000000000000000000000000', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('expired')
      expect(data.user).toBeNull()
      expect(data.token).toBeNull()
    })

    it('returns status "pending" for active unapproved session', async () => {
      // 1. Generate session
      const genRes = await app.handle(
        new Request('http://localhost/carina/auth/qc/generate', { method: 'POST' })
      )
      const { sessionToken } = await genRes.json()

      // 2. Check status
      const res = await app.handle(
        new Request(`http://localhost/carina/auth/qc/status?sessionToken=${sessionToken}`, {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('pending')
      expect(data.user).toBeNull()
      expect(data.token).toBeNull()
    })

    it('fails (422) when sessionToken query param is too short (< 10 chars)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/qc/status?sessionToken=short', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 3. POST /carina/auth/qc/approve Scenarios
  // ===========================================================================
  describe('POST /carina/auth/qc/approve', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/qc/approve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: 'ABCD-1234' }),
        })
      )
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.code).toBe('unauthorized')
    })

    it('fails (400) when code is invalid or expired', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/qc/approve', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: 'ZZZZ-9999' }),
        })
      )
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.code).toBe('bad-request')
      expect(data.detail).toContain('Invalid or expired')
    })

    it('fails (422) when code format is missing or invalid', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/auth/qc/approve', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: '12' }),
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 4. Complete End-to-End Quick Connect Login Flow
  // ===========================================================================
  describe('Complete Quick Connect Login Lifecycle', () => {
    it('successfully generates, approves, and retrieves JWT session', async () => {
      // 1. Client device initiates Quick Connect
      const genRes = await app.handle(
        new Request('http://localhost/carina/auth/qc/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deviceName: 'PlayStation 5 App' }),
        })
      )
      const { code, sessionToken } = await genRes.json()

      // 2. Client device polls status -> pending
      const poll1 = await app.handle(
        new Request(`http://localhost/carina/auth/qc/status?sessionToken=${sessionToken}`)
      )
      expect((await poll1.json()).status).toBe('pending')

      // 3. User on mobile device approves the code
      const approveRes = await app.handle(
        new Request('http://localhost/carina/auth/qc/approve', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code }),
        })
      )
      expect(approveRes.status).toBe(200)
      expect((await approveRes.json()).success).toBe(true)

      // 4. Client device polls status -> approved + signed JWT
      const poll2 = await app.handle(
        new Request(`http://localhost/carina/auth/qc/status?sessionToken=${sessionToken}`)
      )
      expect(poll2.status).toBe(200)
      const approvedData = await poll2.json()
      expect(approvedData.status).toBe('approved')
      expect(approvedData.user).toBeDefined()
      expect(approvedData.user.id).toBe('user-alice-123')
      expect(approvedData.user.username).toBe('alice')
      expect(approvedData.token).toBeDefined()

      // 5. Verify issued JWT token
      const secret = process.env.NEXTAUTH_SECRET || 'iris-default-secret-key-32-chars!!'
      const decoded = await decode({ token: approvedData.token, secret })
      expect(decoded).toBeDefined()
      expect(decoded?.id).toBe('user-alice-123')
      expect(decoded?.username).toBe('alice')

      // 6. Attempting to approve the code a second time fails (single-use code)
      const approveAgain = await app.handle(
        new Request('http://localhost/carina/auth/qc/approve', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code }),
        })
      )
      expect(approveAgain.status).toBe(400)
    })

    it('successfully approves pairing code without hyphens', async () => {
      const genRes = await app.handle(
        new Request('http://localhost/carina/auth/qc/generate', { method: 'POST' })
      )
      const { code, sessionToken } = await genRes.json()
      const codeWithoutHyphen = code.replace('-', '')

      // Approve with unhyphenated code
      const approveRes = await app.handle(
        new Request('http://localhost/carina/auth/qc/approve', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${aliceToken}`,
          },
          body: JSON.stringify({ code: codeWithoutHyphen }),
        })
      )
      expect(approveRes.status).toBe(200)

      // Polling reflects approval
      const poll = await app.handle(
        new Request(`http://localhost/carina/auth/qc/status?sessionToken=${sessionToken}`)
      )
      const data = await poll.json()
      expect(data.status).toBe('approved')
      expect(data.user.id).toBe('user-alice-123')
    })
  })
})
