import { describe, expect, it, beforeEach } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { akaromiFolders } from '../../src/api/controllers/akaromi/folders.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for PassFolder, PassCipher, and User
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
  folderId: string | null
  deletedAt: Date | null
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
  ;(prisma.user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Mock PassFolder findFirst
  ;(prisma.passFolder.findFirst as any) = async ({ where }: any) => {
    return (
      mockFolders.find(
        (f) =>
          f.id === where.id &&
          (where.userId ? f.userId === where.userId : true)
      ) ?? null
    )
  }

  // Mock PassFolder findMany
  ;(prisma.passFolder.findMany as any) = async ({ where, include, orderBy }: any) => {
    const result = mockFolders
      .filter((f) => !where.userId || f.userId === where.userId)
      .map((f) => {
        let cipherCount = 0
        if (include?._count?.select?.ciphers) {
          cipherCount = mockCiphers.filter(
            (c) => c.folderId === f.id && c.deletedAt === null
          ).length
        }
        return {
          ...f,
          _count: { ciphers: cipherCount },
        }
      })

    if (orderBy?.createdAt === 'asc') {
      result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }

    return result
  }

  // Mock PassFolder create
  ;(prisma.passFolder.create as any) = async ({ data }: any) => {
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

  // Mock PassFolder update
  ;(prisma.passFolder.update as any) = async ({ where, data }: any) => {
    const folder = mockFolders.find((f) => f.id === where.id)
    if (!folder) throw new Error('Folder not found')

    if (data.encryptedName !== undefined) folder.encryptedName = data.encryptedName
    if (data.parentId !== undefined) folder.parentId = data.parentId
    folder.updatedAt = new Date()

    return folder
  }

  // Mock PassFolder updateMany (e.g. reparenting children on delete)
  ;(prisma.passFolder.updateMany as any) = async ({ where, data }: any) => {
    let count = 0
    for (const f of mockFolders) {
      if (where.parentId && f.parentId === where.parentId) {
        if (data.parentId !== undefined) f.parentId = data.parentId
        count++
      }
    }
    return { count }
  }

  // Mock PassFolder delete
  ;(prisma.passFolder.delete as any) = async ({ where }: any) => {
    const idx = mockFolders.findIndex((f) => f.id === where.id)
    if (idx === -1) throw new Error('Folder not found')
    const [deleted] = mockFolders.splice(idx, 1)
    return deleted
  }

  // Mock PassCipher updateMany (unlinking ciphers)
  ;(prisma.passCipher.updateMany as any) = async ({ where, data }: any) => {
    let count = 0
    for (const c of mockCiphers) {
      if (where.folderId && c.folderId === where.folderId) {
        if (data.folderId !== undefined) c.folderId = data.folderId
        count++
      }
    }
    return { count }
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
  .use(akaromiFolders)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Akaromi Folders Test Suite', () => {
  let aliceToken: string
  let bobToken: string

  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'

  beforeEach(async () => {
    process.env.NEXTAUTH_SECRET = 'test-iris-secret-key-at-least-32-chars!'
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
  // 1. GET /akaromi/folders
  // ===========================================================================

  describe('GET /akaromi/folders', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/folders', { method: 'GET' })
      )
      expect(res.status).toBe(401)
    })

    it('returns empty list when user has no folders', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/folders', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.folders).toBeArray()
      expect(data.folders.length).toBe(0)
    })

    it('returns user folders with accurate active cipher counts', async () => {
      mockFolders.push(
        {
          id: 'f1',
          userId: ALICE_ID,
          encryptedName: 'enc_work',
          parentId: null,
          createdAt: new Date(Date.now() - 5000),
          updatedAt: new Date(),
        },
        {
          id: 'f2',
          userId: ALICE_ID,
          encryptedName: 'enc_personal',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'f_bob',
          userId: BOB_ID,
          encryptedName: 'enc_bob_secret',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      )

      // Ciphers in f1: 2 active, 1 trashed
      mockCiphers.push(
        { id: 'c1', userId: ALICE_ID, folderId: 'f1', deletedAt: null },
        { id: 'c2', userId: ALICE_ID, folderId: 'f1', deletedAt: null },
        { id: 'c3', userId: ALICE_ID, folderId: 'f1', deletedAt: new Date() },
        { id: 'c4', userId: ALICE_ID, folderId: 'f2', deletedAt: null }
      )

      const res = await app.handle(
        new Request('http://localhost/akaromi/folders', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.folders.length).toBe(2)

      const f1 = data.folders.find((f: any) => f.id === 'f1')
      expect(f1).toBeDefined()
      expect(f1.cipherCount).toBe(2) // Only active ciphers counted

      const f2 = data.folders.find((f: any) => f.id === 'f2')
      expect(f2).toBeDefined()
      expect(f2.cipherCount).toBe(1)

      // Bob's folder is excluded
      expect(data.folders.find((f: any) => f.id === 'f_bob')).toBeUndefined()
    })
  })

  // ===========================================================================
  // 2. POST /akaromi/folders
  // ===========================================================================

  describe('POST /akaromi/folders', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedName: 'test' }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (422) when encryptedName is missing', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/folders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
      )
      expect(res.status).toBe(422)
    })

    it('fails (400) when encryptedName is empty string or whitespace', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/folders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ encryptedName: '   ' }),
        })
      )
      expect(res.status).toBe(400)
    })

    it('fails (404) when parentId does not exist or belongs to another user', async () => {
      mockFolders.push({
        id: 'f_bob_parent',
        userId: BOB_ID,
        encryptedName: 'bob_folder',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/akaromi/folders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            encryptedName: 'enc_subfolder',
            parentId: 'f_bob_parent',
          }),
        })
      )
      expect(res.status).toBe(404)
    })

    it('successfully creates root folder and nested subfolder', async () => {
      // 1. Create root folder
      const resRoot = await app.handle(
        new Request('http://localhost/akaromi/folders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ encryptedName: 'enc_root_folder' }),
        })
      )
      expect(resRoot.status).toBe(200)
      const dataRoot = await resRoot.json()
      expect(dataRoot.success).toBe(true)
      expect(dataRoot.folder.encryptedName).toBe('enc_root_folder')
      expect(dataRoot.folder.parentId).toBeNull()
      expect(dataRoot.folder.cipherCount).toBe(0)

      const rootId = dataRoot.folder.id

      // 2. Create child folder
      const resChild = await app.handle(
        new Request('http://localhost/akaromi/folders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            encryptedName: 'enc_subfolder',
            parentId: rootId,
          }),
        })
      )
      expect(resChild.status).toBe(200)
      const dataChild = await resChild.json()
      expect(dataChild.success).toBe(true)
      expect(dataChild.folder.encryptedName).toBe('enc_subfolder')
      expect(dataChild.folder.parentId).toBe(rootId)
    })
  })

  // ===========================================================================
  // 3. PATCH & PUT /akaromi/folders/:folderId
  // ===========================================================================

  describe('PATCH & PUT /akaromi/folders/:folderId', () => {
    beforeEach(() => {
      mockFolders.push({
        id: 'f_alice_to_edit',
        userId: ALICE_ID,
        encryptedName: 'old_name',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    it('fails (404) when folder does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/folders/nonexistent', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ encryptedName: 'new_name' }),
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (400) when folder is set as its own parent', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/folders/f_alice_to_edit', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ parentId: 'f_alice_to_edit' }),
        })
      )
      expect(res.status).toBe(400)
    })

    it('successfully updates folder name and hierarchy via PATCH', async () => {
      mockFolders.push({
        id: 'f_parent_new',
        userId: ALICE_ID,
        encryptedName: 'parent_folder',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await app.handle(
        new Request('http://localhost/akaromi/folders/f_alice_to_edit', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            encryptedName: 'updated_encrypted_name',
            parentId: 'f_parent_new',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.folder.encryptedName).toBe('updated_encrypted_name')
      expect(data.folder.parentId).toBe('f_parent_new')
    })

    it('supports PUT alias for updating folder', async () => {
      const res = await app.handle(
        new Request('http://localhost/akaromi/folders/f_alice_to_edit', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            encryptedName: 'put_name',
          }),
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.folder.encryptedName).toBe('put_name')
    })
  })

  // ===========================================================================
  // 4. DELETE /akaromi/folders/:folderId
  // ===========================================================================

  describe('DELETE /akaromi/folders/:folderId', () => {
    it('deletes folder and unlinks all contained ciphers (folderId becomes null)', async () => {
      mockFolders.push({
        id: 'f_to_delete',
        userId: ALICE_ID,
        encryptedName: 'folder_to_delete',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Link ciphers to this folder
      mockCiphers.push(
        { id: 'c_linked_1', userId: ALICE_ID, folderId: 'f_to_delete', deletedAt: null },
        { id: 'c_linked_2', userId: ALICE_ID, folderId: 'f_to_delete', deletedAt: null }
      )

      const res = await app.handle(
        new Request('http://localhost/akaromi/folders/f_to_delete', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.id).toBe('f_to_delete')

      // Folder removed from store
      expect(mockFolders.find((f) => f.id === 'f_to_delete')).toBeUndefined()

      // Contained ciphers are now unassigned (folderId === null), NOT deleted
      const c1 = mockCiphers.find((c) => c.id === 'c_linked_1')
      const c2 = mockCiphers.find((c) => c.id === 'c_linked_2')
      expect(c1).toBeDefined()
      expect(c1?.folderId).toBeNull()
      expect(c2).toBeDefined()
      expect(c2?.folderId).toBeNull()
    })
  })
})
