import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { akaromiCiphers } from '../../src/api/controllers/akaromi/ciphers.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma, type PassCipherType, type PassRepromptType } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for PassCipher and User
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
  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Mock PassCipher findFirst
  ;(prisma.passCipher.findFirst as any) = async ({ where }: any) => {
    return (
      mockCiphers.find(
        (c) =>
          c.id === where.id &&
          (where.userId ? c.userId === where.userId : true)
      ) ?? null
    )
  }

  // Mock PassCipher findMany
  ;(prisma.passCipher.findMany as any) = async ({ where, orderBy }: any) => {
    let result = mockCiphers.filter((c) => {
      if (where.userId && c.userId !== where.userId) return false
      if (where.type && c.type !== where.type) return false
      if (typeof where.favorite === 'boolean' && c.favorite !== where.favorite)
        return false
      if (where.deletedAt) {
        if (where.deletedAt.not !== undefined && c.deletedAt === null)
          return false
      } else if (where.deletedAt === null && c.deletedAt !== null) {
        return false
      }
      return true
    })

    if (Array.isArray(orderBy)) {
      result.sort((a, b) => {
        if (a.favorite !== b.favorite) {
          return a.favorite ? -1 : 1
        }
        return b.updatedAt.getTime() - a.updatedAt.getTime()
      })
    }

    return result
  }

  // Mock PassCipher create
  ;(prisma.passCipher.create as any) = async ({ data }: any) => {
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

  // Mock PassCipher update
  ;(prisma.passCipher.update as any) = async ({ where, data }: any) => {
    const cipher = mockCiphers.find((c) => c.id === where.id)
    if (!cipher) throw new Error('Cipher not found')

    if (data.type !== undefined) cipher.type = data.type
    if (data.encryptedTitle !== undefined) cipher.encryptedTitle = data.encryptedTitle
    if (data.encryptedData !== undefined) cipher.encryptedData = data.encryptedData
    if (data.favorite !== undefined) cipher.favorite = data.favorite
    if (data.reprompt !== undefined) cipher.reprompt = data.reprompt
    if (data.deletedAt !== undefined) cipher.deletedAt = data.deletedAt
    cipher.updatedAt = new Date()

    return cipher
  }

  // Mock PassCipher delete
  ;(prisma.passCipher.delete as any) = async ({ where }: any) => {
    const index = mockCiphers.findIndex((c) => c.id === where.id)
    if (index === -1) throw new Error('Cipher not found')
    const deleted = mockCiphers.splice(index, 1)[0]
    return deleted
  }

  // Mock PassCipher deleteMany
  ;(prisma.passCipher.deleteMany as any) = async ({ where }: any) => {
    const initialCount = mockCiphers.length
    mockCiphers = mockCiphers.filter((c) => {
      if (where.userId && c.userId !== where.userId) return true
      if (where.deletedAt && where.deletedAt.not !== undefined && c.deletedAt === null) {
        return true
      }
      return false
    })
    return { count: initialCount - mockCiphers.length }
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
  .use(akaromiCiphers)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Akaromi Ciphers Test Suite', () => {
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
  // 1. GET /akaromi/ciphers
  // ===========================================================================

  describe('GET /akaromi/ciphers', () => {
    it('fails (401) when Authorization header is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers', { method: 'GET' })
      )
      expect(res.status).toBe(401)
    })

    it('returns empty array when user has no ciphers', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.ciphers).toBeArray()
      expect(data.ciphers.length).toBe(0)
    })

    it('lists user ciphers and filters by type, favorite, and trash', async () => {
      // Create test ciphers
      mockCiphers.push(
        {
          id: 'c1',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: true,
          reprompt: 'NONE',
          encryptedTitle: 'enc_google',
          encryptedData: 'enc_data_1',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(Date.now() + 1000),
        },
        {
          id: 'c2',
          userId: ALICE_ID,
          type: 'SSH_KEY',
          favorite: false,
          reprompt: 'REQUIRE_MASTER_PASSWORD',
          encryptedTitle: 'enc_github_ssh',
          encryptedData: 'enc_data_2',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'c3',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: false,
          reprompt: 'NONE',
          encryptedTitle: 'enc_trashed_login',
          encryptedData: 'enc_data_3',
          deletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'c_bob',
          userId: BOB_ID,
          type: 'LOGIN',
          favorite: true,
          reprompt: 'NONE',
          encryptedTitle: 'enc_bob_secret',
          encryptedData: 'enc_bob_data',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      )

      // 1. List active only (trash=false)
      const resActive = await app.handle(
        new Request('http://localhost/akaromi/ciphers?trash=false', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(resActive.status).toBe(200)
      const dataActive = await resActive.json()
      expect(dataActive.ciphers.length).toBe(2)
      expect(dataActive.ciphers.find((c: any) => c.id === 'c3')).toBeUndefined()
      // Bob's cipher is never returned
      expect(dataActive.ciphers.find((c: any) => c.id === 'c_bob')).toBeUndefined()

      // 2. Filter by type
      const resType = await app.handle(
        new Request('http://localhost/akaromi/ciphers?type=SSH_KEY', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(resType.status).toBe(200)
      const dataType = await resType.json()
      expect(dataType.ciphers.length).toBe(1)
      expect(dataType.ciphers[0].id).toBe('c2')

      // 3. Filter by favorite
      const resFav = await app.handle(
        new Request('http://localhost/akaromi/ciphers?favorite=true', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(resFav.status).toBe(200)
      const dataFav = await resFav.json()
      expect(dataFav.ciphers.length).toBe(1)
      expect(dataFav.ciphers[0].id).toBe('c1')

      // 4. List trash only
      const resTrash = await app.handle(
        new Request('http://localhost/akaromi/ciphers?trash=true', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(resTrash.status).toBe(200)
      const dataTrash = await resTrash.json()
      expect(dataTrash.ciphers.length).toBe(1)
      expect(dataTrash.ciphers[0].id).toBe('c3')
    })
  })

  // ===========================================================================
  // 2. POST /akaromi/ciphers
  // ===========================================================================

  describe('POST /akaromi/ciphers', () => {
    it('fails (401) when Authorization header is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'LOGIN',
            encryptedTitle: 'title',
            encryptedData: 'data',
          }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (422) on missing required fields', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Missing encryptedTitle and encryptedData
            type: 'LOGIN',
          }),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when title is whitespace only', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'LOGIN',
            encryptedTitle: '   ',
            encryptedData: 'valid_data',
          }),
        })
      )
      expect(res.status).toBe(400)
    })

    it('successfully creates a LOGIN cipher with favorite flags', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'LOGIN',
            encryptedTitle: 'enc_proton_login',
            encryptedData: 'enc_proton_payload',
            favorite: true,
            reprompt: 'REQUIRE_MASTER_PASSWORD',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.cipher.type).toBe('LOGIN')
      expect(data.cipher.encryptedTitle).toBe('enc_proton_login')
      expect(data.cipher.encryptedData).toBe('enc_proton_payload')
      expect(data.cipher.favorite).toBe(true)
      expect(data.cipher.reprompt).toBe('REQUIRE_MASTER_PASSWORD')
      expect(data.cipher.deletedAt).toBeNull()
    })
  })

  // ===========================================================================
  // 3. GET /akaromi/ciphers/:cipherId
  // ===========================================================================

  describe('GET /akaromi/ciphers/:cipherId', () => {
    it('fails (404) when cipher does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/nonexistent', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (404) when attempting to access another user cipher', async () => {
      mockCiphers.push({
        id: 'c_bob_private',
        userId: BOB_ID,
        type: 'LOGIN',
        favorite: false,
        reprompt: 'NONE',
        encryptedTitle: 'bob_title',
        encryptedData: 'bob_data',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/c_bob_private', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('returns single cipher details for the owner', async () => {
      mockCiphers.push({
        id: 'c_alice_single',
        userId: ALICE_ID,
        type: 'SSH_KEY',
        favorite: true,
        reprompt: 'NONE',
        encryptedTitle: 'enc_id_ed25519',
        encryptedData: 'enc_key_payload',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/c_alice_single', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.cipher.id).toBe('c_alice_single')
      expect(data.cipher.type).toBe('SSH_KEY')
      expect(data.cipher.encryptedTitle).toBe('enc_id_ed25519')
    })
  })

  // ===========================================================================
  // 4. PATCH & PUT /akaromi/ciphers/:cipherId
  // ===========================================================================

  describe('PATCH & PUT /akaromi/ciphers/:cipherId', () => {
    beforeEach(() => {
      mockCiphers.push({
        id: 'c_to_update',
        userId: ALICE_ID,
        type: 'LOGIN',
        favorite: false,
        reprompt: 'NONE',
        encryptedTitle: 'old_title',
        encryptedData: 'old_data',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    it('fails (404) when cipher does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/nonexistent', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ encryptedTitle: 'new_title' }),
        })
      )
      expect(res.status).toBe(404)
    })

    it('successfully updates cipher fields via PATCH (overwrites ciphertext)', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/c_to_update', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            encryptedTitle: 'new_title',
            encryptedData: 'new_overwritten_ciphertext',
            favorite: true,
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.cipher.encryptedTitle).toBe('new_title')
      expect(data.cipher.encryptedData).toBe('new_overwritten_ciphertext')
      expect(data.cipher.favorite).toBe(true)
    })

    it('supports PUT alias for updating cipher', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/c_to_update', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            encryptedTitle: 'put_updated_title',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.cipher.encryptedTitle).toBe('put_updated_title')
    })
  })

  // ===========================================================================
  // 5. POST /akaromi/ciphers/:cipherId/trash & restore
  // ===========================================================================

  describe('Trash and Restore Ciphers', () => {
    beforeEach(() => {
      mockCiphers.push({
        id: 'c_trash_target',
        userId: ALICE_ID,
        type: 'LOGIN',
        favorite: false,
        reprompt: 'NONE',
        encryptedTitle: 'enc_note',
        encryptedData: 'enc_note_data',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    it('soft deletes a cipher via DELETE /:cipherId', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/c_trash_target', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.permanent).toBe(false)

      const inDb = mockCiphers.find((c) => c.id === 'c_trash_target')
      expect(inDb?.deletedAt).not.toBeNull()
    })

    it('restores a soft-deleted cipher via /restore', async () => {
      // First soft delete
      mockCiphers.find((c) => c.id === 'c_trash_target')!.deletedAt = new Date()

      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/c_trash_target/restore', {
          method: 'POST',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)

      const inDb = mockCiphers.find((c) => c.id === 'c_trash_target')
      expect(inDb?.deletedAt).toBeNull()
    })
  })

  // ===========================================================================
  // 6. DELETE /akaromi/ciphers/:cipherId (Permanent Delete)
  // ===========================================================================

  describe('DELETE /akaromi/ciphers/:cipherId', () => {
    it('permanently deletes a single cipher with permanent=true', async () => {
      mockCiphers.push({
        id: 'c_perm_delete',
        userId: ALICE_ID,
        type: 'LOGIN',
        favorite: false,
        reprompt: 'NONE',
        encryptedTitle: 'card_title',
        encryptedData: 'card_data',
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/c_perm_delete?permanent=true', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.permanent).toBe(true)

      expect(mockCiphers.find((c) => c.id === 'c_perm_delete')).toBeUndefined()
    })
  })

  // ===========================================================================
  // 7. DELETE /akaromi/ciphers/trash (Purge All Trash)
  // ===========================================================================

  describe('DELETE /akaromi/ciphers/trash', () => {
    it('permanently purges all trashed ciphers while keeping active ciphers intact', async () => {
      mockCiphers.push(
        {
          id: 'active_1',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: false,
          reprompt: 'NONE',
          encryptedTitle: 'active',
          encryptedData: 'data',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'trashed_1',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: false,
          reprompt: 'NONE',
          encryptedTitle: 'trashed1',
          encryptedData: 'data',
          deletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'trashed_2',
          userId: ALICE_ID,
          type: 'SSH_KEY',
          favorite: false,
          reprompt: 'NONE',
          encryptedTitle: 'trashed2',
          encryptedData: 'data',
          deletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'bob_trashed',
          userId: BOB_ID,
          type: 'LOGIN',
          favorite: false,
          reprompt: 'NONE',
          encryptedTitle: 'bob_trashed',
          encryptedData: 'data',
          deletedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      )

      const res = await app.handle(
        new Request('http://localhost/akaromi/ciphers/trash', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.count).toBe(2)

      // Active cipher for Alice is still there
      expect(mockCiphers.find((c) => c.id === 'active_1')).toBeDefined()
      // Alice's trashed ciphers are deleted
      expect(mockCiphers.find((c) => c.id === 'trashed_1')).toBeUndefined()
      expect(mockCiphers.find((c) => c.id === 'trashed_2')).toBeUndefined()
      // Bob's trashed cipher is NOT deleted
      expect(mockCiphers.find((c) => c.id === 'bob_trashed')).toBeDefined()
    })
  })
})
