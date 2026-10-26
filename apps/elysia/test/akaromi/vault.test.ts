import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { akaromiVault } from '../../src/api/controllers/akaromi/vault.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma, type PassCipherType, type PassRepromptType } from '@Iris/db'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Vault Synchronization & Backup
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  permissions: number[]
  customization: any
  passwordChangedAt: Date | null
}

interface MockCipher {
  id: string
  userId: string
  type: PassCipherType
  favorite: boolean
  reprompt: PassRepromptType
  encryptedTitle: string
  encryptedData: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

let mockUsers: MockUser[] = []
let mockCiphers: MockCipher[] = []

function setupPrismaMock() {
  mockCiphers = []
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      permissions: [],
      customization: {},
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      permissions: [],
      customization: {},
      passwordChangedAt: null,
    },
  ]

  // Mock User findUnique
  ;((prisma as any).user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Mock PassCipher findMany
  ;((prisma as any).passCipher.findMany as any) = async ({ where, select, orderBy }: any) => {
    let result = mockCiphers.filter((c) => {
      if (where.userId && c.userId !== where.userId) return false
      if (where.deletedAt === null && c.deletedAt !== null) return false
      if (where.updatedAt?.gte && c.updatedAt.getTime() < where.updatedAt.gte.getTime()) {
        return false
      }
      return true
    })

    if (orderBy?.updatedAt === 'desc') {
      result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    }

    if (select) {
      return result.map((c) => {
        const sel: any = {}
        if (select.id) sel.id = c.id
        if (select.type) sel.type = c.type
        if (select.favorite !== undefined) sel.favorite = c.favorite
        if (select.encryptedTitle) sel.encryptedTitle = c.encryptedTitle
        if (select.encryptedData) sel.encryptedData = c.encryptedData
        if (select.createdAt) sel.createdAt = c.createdAt
        if (select.updatedAt) sel.updatedAt = c.updatedAt
        return sel
      })
    }

    return result
  }

  // Mock PassCipher create
  ;((prisma as any).passCipher.create as any) = async ({ data }: any) => {
    const created: MockCipher = {
      id: `cipher-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      userId: data.userId,
      type: data.type,
      favorite: data.favorite ?? false,
      reprompt: data.reprompt ?? 'NONE',
      encryptedTitle: data.encryptedTitle,
      encryptedData: data.encryptedData,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockCiphers.push(created)
    return created
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
  .use(akaromiVault)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Akaromi Vault Test Suite', () => {
  let aliceToken: string
  const ALICE_ID = '00000000-0000-0000-0000-000000000001'

  beforeEach(async () => {
    Bun.env.JWT_SECRET = 'test-iris-secret-key-at-least-32-chars!'
    setupPrismaMock()

    aliceToken = await signUserJwt({
      id: ALICE_ID,
      username: 'alice',
      email: 'alice@example.com',
    })
  })

  // ===========================================================================
  // 1. GET /akaromi/sync
  // ===========================================================================

  describe('GET /akaromi/sync', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/sync', { method: 'GET' })
      )
      expect(res.status).toBe(401)
    })

    it('returns full synchronization payload including deletedCipherIds and serverTime', async () => {
      const past = new Date(Date.now() - 60000)

      mockCiphers.push(
        {
          id: 'c_active_1',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: true,
          reprompt: 'NONE',
          encryptedTitle: 'title_1',
          encryptedData: 'data_1',
          deletedAt: null,
          createdAt: past,
          updatedAt: past,
        },
        {
          id: 'c_trashed_1',
          userId: ALICE_ID,
          type: 'SSH_KEY',
          favorite: false,
          reprompt: 'NONE',
          encryptedTitle: 'title_2',
          encryptedData: 'data_2',
          deletedAt: past,
          createdAt: past,
          updatedAt: past,
        }
      )

      const res = await app.handle(
        new Request('http://localhost/akaromi/sync', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.serverTime).toBeDefined()
      expect(data.ciphers.length).toBe(2)
      expect(data.deletedCipherIds).toEqual(['c_trashed_1'])
    })

    it('filters synchronization state by `since` timestamp for incremental sync', async () => {
      const t0 = new Date(Date.now() - 10000)
      const t1 = new Date(Date.now() - 5000)
      const t2 = new Date()

      mockCiphers.push(
        {
          id: 'old_cipher',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: false,
          reprompt: 'NONE',
          encryptedTitle: 'old',
          encryptedData: 'old',
          deletedAt: null,
          createdAt: t0,
          updatedAt: t0,
        },
        {
          id: 'new_cipher',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: false,
          reprompt: 'NONE',
          encryptedTitle: 'new',
          encryptedData: 'new',
          deletedAt: null,
          createdAt: t2,
          updatedAt: t2,
        }
      )

      const sinceUrl = `http://localhost/akaromi/sync?since=${encodeURIComponent(t1.toISOString())}`
      const res = await app.handle(
        new Request(sinceUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ciphers.length).toBe(1)
      expect(data.ciphers[0].id).toBe('new_cipher')
    })
  })

  // ===========================================================================
  // 2. GET /akaromi/export
  // ===========================================================================

  describe('GET /akaromi/export', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/export', { method: 'GET' })
      )
      expect(res.status).toBe(401)
    })

    it('exports all non-deleted vault ciphers', async () => {
      mockCiphers.push(
        {
          id: 'c_exp_active',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: true,
          reprompt: 'NONE',
          encryptedTitle: 'active_login',
          encryptedData: 'payload',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'c_exp_deleted',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: false,
          reprompt: 'NONE',
          encryptedTitle: 'deleted_login',
          encryptedData: 'payload',
          deletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      )

      const res = await app.handle(
        new Request('http://localhost/akaromi/export', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.exportedAt).toBeDefined()

      // Only active ciphers included
      expect(data.ciphers.length).toBe(1)
      expect(data.ciphers[0].id).toBe('c_exp_active')
    })
  })

  // ===========================================================================
  // 3. POST /akaromi/import
  // ===========================================================================

  describe('POST /akaromi/import', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ciphers: [] }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('imports ciphers to database', async () => {
      const importPayload = {
        ciphers: [
          {
            type: 'LOGIN',
            encryptedTitle: 'enc_imported_login',
            encryptedData: 'enc_imported_payload',
            favorite: true,
          },
          {
            type: 'SSH_KEY',
            encryptedTitle: 'enc_imported_ssh',
            encryptedData: 'enc_ssh_key_payload',
            favorite: false,
          },
        ],
      }

      const res = await app.handle(
        new Request('http://localhost/akaromi/import', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(importPayload),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.importedCiphersCount).toBe(2)

      const loginCipher = mockCiphers.find((c) => c.encryptedTitle === 'enc_imported_login')
      expect(loginCipher).toBeDefined()
      expect(loginCipher?.favorite).toBe(true)

      const sshCipher = mockCiphers.find((c) => c.encryptedTitle === 'enc_imported_ssh')
      expect(sshCipher).toBeDefined()
      expect(sshCipher?.favorite).toBe(false)
    })
  })
})
