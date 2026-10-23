import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { kiroshiSettings } from '../../src/api/controllers/kiroshi/settings.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma } from '@IRIS/database'

interface MockUser {
  id: string
  username: string
  email: string
  settings: any
  permissions: number[]
  passwordChangedAt: Date | null
}

let mockUsers: MockUser[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      settings: { theme: 'dark', search: { historyEnabled: true } },
      permissions: [],
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      settings: null, // Unset settings
      permissions: [],
      passwordChangedAt: null,
    },
  ]

  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  ;(prisma.user.update as any) = async ({ where, data }: any) => {
    const user = mockUsers.find((u) => u.id === where.id)
    if (!user) throw new Error('User not found')
    if (data.settings !== undefined) {
      user.settings = data.settings
    }
    return user
  }
}

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
  .use(kiroshiSettings)

describe('Comprehensive Kiroshi Search Settings Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'

  beforeEach(async () => {
    Bun.env.JWT_SECRET = 'test-iris-secret-key-at-least-32-chars!'
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

  // ===========================================================================
  // 1. GET /kiroshi/settings
  // ===========================================================================

  describe('GET /kiroshi/settings', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/settings', { method: 'GET' })
      )
      expect(res.status).toBe(401)
    })

    it('returns historyEnabled: true when user settings explicitly enable it', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/settings', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.settings.historyEnabled).toBe(true)
    })

    it('defaults historyEnabled to true when settings are null/unset', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/settings', {
          method: 'GET',
          headers: { Authorization: `Bearer ${bobToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.settings.historyEnabled).toBe(true)
    })
  })

  // ===========================================================================
  // 2. PATCH /kiroshi/settings
  // ===========================================================================

  describe('PATCH /kiroshi/settings', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ historyEnabled: false }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (422) when body is invalid', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/settings', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ historyEnabled: 'not-a-boolean' }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('updates historyEnabled and preserves other existing settings in JSON', async () => {
      const res = await app.handle(
        new Request('http://localhost/kiroshi/settings', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ historyEnabled: false }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.settings.historyEnabled).toBe(false)

      // Verify database record has preserved other settings (e.g. theme: 'dark')
      const alice = mockUsers.find((u) => u.id === ALICE_ID)
      expect(alice?.settings.theme).toBe('dark')
      expect(alice?.settings.search.historyEnabled).toBe(false)
    })
  })
})
