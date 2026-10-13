import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { akaromiVault } from '../../src/api/controllers/akaromi/vault.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma, type PassCipherType, type PassRepromptType } from '@IRIS/database'

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

interface MockFolder {
  id: string
  userId: string
  encryptedName: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
}

interface MockCipher {
  id: string
  userId: string
  type: PassCipherType
  favorite: boolean
  reprompt: PassRepromptType
  folderId: string | null
  encryptedTitle: string
  encryptedData: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

let mockUsers: MockUser[] = []
let mockFolders: MockFolder[] = []
let mockCiphers: MockCipher[] = []

function setupPrismaMock() {
  mockFolders = []
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
    ; (prisma.user.findUnique as any) = async ({ where }: any) => {
      return mockUsers.find((u) => u.id === where.id) ?? null
    }

    // Mock PassFolder findMany
    ; (prisma.passFolder.findMany as any) = async ({ where, select, orderBy }: any) => {
      let result = mockFolders.filter((f) => {
        if (where.userId && f.userId !== where.userId) return false
        if (where.updatedAt?.gte && f.updatedAt.getTime() < where.updatedAt.gte.getTime()) {
          return false
        }
        return true
      })

      if (orderBy?.updatedAt === 'desc') {
        result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      }

      if (select) {
        return result.map((f) => {
          const sel: any = {}
          if (select.id) sel.id = f.id
          if (select.encryptedName) sel.encryptedName = f.encryptedName
          return sel
        })
      }

      return result
    }

    // Mock PassCipher findMany
    ; (prisma.passCipher.findMany as any) = async ({ where, select, orderBy }: any) => {
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
          if (select.folderId !== undefined) sel.folderId = c.folderId
          if (select.encryptedTitle) sel.encryptedTitle = c.encryptedTitle
          if (select.encryptedData) sel.encryptedData = c.encryptedData
          if (select.createdAt) sel.createdAt = c.createdAt
          if (select.updatedAt) sel.updatedAt = c.updatedAt
          return sel
        })
      }

      return result
    }

    // Mock PassFolder create
    ; (prisma.passFolder.create as any) = async ({ data }: any) => {
      const created: MockFolder = {
        id: `folder-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        userId: data.userId,
        encryptedName: data.encryptedName,
        parentId: data.parentId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockFolders.push(created)
      return created
    }

    // Mock PassCipher create
    ; (prisma.passCipher.create as any) = async ({ data }: any) => {
      const created: MockCipher = {
        id: `cipher-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        userId: data.userId,
        type: data.type,
        favorite: data.favorite ?? false,
        reprompt: data.reprompt ?? 'NONE',
        folderId: data.folderId ?? null,
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
  .error(({ error, set }) => {
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
    process.env.NEXTAUTH_SECRET = 'test-iris-secret-key-at-least-32-chars!'
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
      mockFolders.push({
        id: 'f_sync_1',
        userId: ALICE_ID,
        encryptedName: 'folder_sync',
        parentId: null,
        createdAt: past,
        updatedAt: past,
      })

      mockCiphers.push(
        {
          id: 'c_active_1',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: true,
          reprompt: 'NONE',
          folderId: 'f_sync_1',
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
          folderId: null,
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
      expect(data.folders.length).toBe(1)
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
          folderId: null,
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
          folderId: null,
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

    it('exports all non-deleted vault folders and ciphers', async () => {
      mockFolders.push({
        id: 'f_exp',
        userId: ALICE_ID,
        encryptedName: 'enc_export_folder',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockCiphers.push(
        {
          id: 'c_exp_active',
          userId: ALICE_ID,
          type: 'LOGIN',
          favorite: true,
          reprompt: 'NONE',
          folderId: 'f_exp',
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
          folderId: 'f_exp',
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
      expect(data.folders.length).toBe(1)
      expect(data.folders[0].encryptedName).toBe('enc_export_folder')

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
          body: JSON.stringify({ folders: [], ciphers: [] }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('imports folders and ciphers with tempId remapping to database IDs', async () => {
      const importPayload = {
        folders: [
          {
            tempId: 'temp_f_1',
            encryptedName: 'enc_imported_folder',
          },
        ],
        ciphers: [
          {
            type: 'LOGIN',
            encryptedTitle: 'enc_imported_login',
            encryptedData: 'enc_imported_payload',
            folderTempId: 'temp_f_1',
            favorite: true,
          },
          {
            type: 'SSH_KEY',
            encryptedTitle: 'enc_imported_ssh',
            encryptedData: 'enc_ssh_key_payload',
            folderTempId: null,
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
      expect(data.importedFoldersCount).toBe(1)
      expect(data.importedCiphersCount).toBe(2)

      // Verify that database records were created and linked correctly
      expect(mockFolders.length).toBe(1)
      const dbFolderId = mockFolders[0]!.id
      expect(mockFolders[0]!.encryptedName).toBe('enc_imported_folder')

      const loginCipher = mockCiphers.find((c) => c.encryptedTitle === 'enc_imported_login')
      expect(loginCipher).toBeDefined()
      expect(loginCipher?.folderId).toBe(dbFolderId) // Remapped from temp_f_1
      expect(loginCipher?.favorite).toBe(true)

      const sshCipher = mockCiphers.find((c) => c.encryptedTitle === 'enc_imported_ssh')
      expect(sshCipher).toBeDefined()
      expect(sshCipher?.folderId).toBeNull()
    })
  })
})
