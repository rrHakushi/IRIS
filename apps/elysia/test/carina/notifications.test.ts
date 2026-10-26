import { describe, expect, it, beforeEach } from 'bun:test'
import crypto from 'node:crypto'
import { Elysia, ValidationError } from 'elysia'
import { carinaNotifications } from '../../src/api/controllers/carina/notifications.ctrl'
import { CarinaNotificationsServ } from '../../src/services/carina/notifications.serv'
import { isHttpError } from '../../src/lib/errors'
import { signUserJwt } from '../../src/utils/auth-crypto'
import { prisma } from '@IRIS/database'

// -----------------------------------------------------------------------------
// In-Memory Database Mock for Notifications and Users
// -----------------------------------------------------------------------------

interface MockUser {
  id: string
  username: string
  email: string
  publicKey: string | null
  passwordChangedAt: Date | null
}

interface MockNotification {
  id: string
  userId: string
  app: string
  category: string
  type: 'INFO' | 'ACTION_CONFIRM' | 'ACTION_INPUT' | 'ACTION_SELECT'
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  isRead: boolean
  readAt: Date | null
  actionStatus: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'SUBMITTED' | 'EXPIRED' | null
  actionPayload: any | null
  actionHandler: string | null
  encryptedKey: string
  encryptedData: string
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

let mockUsers: MockUser[] = []
let mockNotifications: MockNotification[] = []

function setupPrismaMock() {
  mockUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'alice',
      email: 'alice@example.com',
      publicKey: null, // Will be set with ML-KEM-768 public key in tests
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      username: 'bob',
      email: 'bob@example.com',
      publicKey: null,
      passwordChangedAt: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      username: 'charlie',
      email: 'charlie@example.com',
      publicKey: null,
      passwordChangedAt: null,
    },
  ]

  mockNotifications = []

  // Mock User findUnique
  ;((prisma as any).user.findUnique as any) = async ({ where }: any) => {
    return mockUsers.find((u) => u.id === where.id) ?? null
  }

  // Mock Notification findUnique
  ;((prisma as any).notification.findUnique as any) = async ({ where }: any) => {
    return mockNotifications.find((n) => n.id === where.id) ?? null
  }

  // Mock Notification findMany
  ;((prisma as any).notification.findMany as any) = async ({
    where,
    orderBy,
    skip = 0,
    take = 10,
  }: any) => {
    let filtered = mockNotifications.filter((n) => {
      if (where.userId && n.userId !== where.userId) return false
      if (where.isRead !== undefined && n.isRead !== where.isRead) return false
      if (where.app && n.app !== where.app) return false
      if (where.category && n.category !== where.category) return false
      if (where.priority && n.priority !== where.priority) return false
      if (where.type && n.type !== where.type) return false
      return true
    })

    if (orderBy?.createdAt === 'desc') {
      filtered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    } else if (orderBy?.createdAt === 'asc') {
      filtered = filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }

    return filtered.slice(skip, skip + take)
  }

  // Mock Notification count
  ;((prisma as any).notification.count as any) = async ({ where }: any) => {
    return mockNotifications.filter((n) => {
      if (where.userId && n.userId !== where.userId) return false
      if (where.isRead !== undefined && n.isRead !== where.isRead) return false
      if (where.app && n.app !== where.app) return false
      if (where.category && n.category !== where.category) return false
      if (where.priority && n.priority !== where.priority) return false
      if (where.type && n.type !== where.type) return false
      return true
    }).length
  }

  // Mock Notification create
  ;((prisma as any).notification.create as any) = async ({ data }: any) => {
    const item: MockNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      userId: data.userId,
      app: data.app,
      category: data.category,
      type: data.type ?? 'INFO',
      priority: data.priority ?? 'NORMAL',
      isRead: false,
      readAt: null,
      actionStatus: null,
      actionPayload: data.actionPayload ?? null,
      actionHandler: data.actionHandler ?? null,
      encryptedKey: data.encryptedKey,
      encryptedData: data.encryptedData,
      expiresAt: data.expiresAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockNotifications.push(item)
    return item
  }

  // Mock Notification update
  ;((prisma as any).notification.update as any) = async ({ where, data }: any) => {
    const item = mockNotifications.find((n) => n.id === where.id)
    if (!item) throw new Error('Notification not found')

    if (data.isRead !== undefined) item.isRead = data.isRead
    if (data.readAt !== undefined) item.readAt = data.readAt
    if (data.actionStatus !== undefined) item.actionStatus = data.actionStatus
    if (data.actionPayload !== undefined) item.actionPayload = data.actionPayload
    item.updatedAt = new Date()

    return item
  }

  // Mock Notification updateMany
  ;((prisma as any).notification.updateMany as any) = async ({ where, data }: any) => {
    let count = 0
    for (const item of mockNotifications) {
      if (where.userId && item.userId !== where.userId) continue
      if (where.isRead !== undefined && item.isRead !== where.isRead) continue

      if (data.isRead !== undefined) item.isRead = data.isRead
      if (data.readAt !== undefined) item.readAt = data.readAt
      item.updatedAt = new Date()
      count++
    }
    return { count }
  }

  // Mock Notification delete
  ;((prisma as any).notification.delete as any) = async ({ where }: any) => {
    const idx = mockNotifications.findIndex((n) => n.id === where.id)
    if (idx === -1) throw new Error('Notification not found')
    const [deleted] = mockNotifications.splice(idx, 1)
    return deleted
  }

  // Mock Notification deleteMany
  ;((prisma as any).notification.deleteMany as any) = async ({ where }: any) => {
    let count = 0
    mockNotifications = mockNotifications.filter((n) => {
      if (where.userId && n.userId !== where.userId) return true
      if (where.isRead !== undefined && n.isRead !== where.isRead) return true
      count++
      return false
    })
    return { count }
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
  .use(carinaNotifications)

// -----------------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------------

describe('Comprehensive Carina Encrypted Notifications Test Suite', () => {
  let aliceToken: string
  let bobToken: string
  let charlieToken: string

  const ALICE_ID = '00000000-0000-0000-0000-000000000001'
  const BOB_ID = '00000000-0000-0000-0000-000000000002'
  const CHARLIE_ID = '00000000-0000-0000-0000-000000000003'

  let aliceKeyPair: { publicKey: string; privateKey: string }

  beforeEach(async () => {
    setupPrismaMock()

    // Generate RSA-OAEP keys for Alice
    aliceKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    mockUsers[0]!.publicKey = aliceKeyPair.publicKey

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
    charlieToken = await signUserJwt({
      id: CHARLIE_ID,
      username: 'charlie',
      email: 'charlie@example.com',
    })
  })

  // ===========================================================================
  // 1. Post-Quantum Cryptography & Encryption / Decryption Pipeline
  // ===========================================================================

  describe('Standard RSA-OAEP + AES-256-GCM Cryptographic Engine', () => {
    it('encrypts payload with recipient public key and decrypts successfully with secret key', () => {
      const payload = {
        title: 'Security Alert: New Sign-in',
        body: 'A new session was authenticated from Tokyo, Japan.',
        icon: 'tabler-shield-alert',
        link: '/settings/security',
        metadata: { ip: '192.168.1.1', userAgent: 'BunTest' },
      }

      const encrypted = CarinaNotificationsServ.encryptNotificationPayload(
        payload,
        mockUsers[0]!.publicKey
      )

      expect(typeof encrypted.encryptedKey).toBe('string')
      expect(encrypted.encryptedKey.length).toBeGreaterThan(0)
      expect(typeof encrypted.encryptedData).toBe('string')
      // Format iv:authTag:cipher
      const parts = encrypted.encryptedData.split(':')
      expect(parts.length).toBe(3)
      expect(parts[0]!.length).toBe(24) // 12-byte IV in hex = 24 chars
      expect(parts[1]!.length).toBe(32) // 16-byte AuthTag in hex = 32 chars

      // Decrypt using Alice's RSA private key
      const decrypted = CarinaNotificationsServ.decryptNotificationPayload(
        encrypted.encryptedKey,
        encrypted.encryptedData,
        aliceKeyPair.privateKey
      )

      expect(decrypted).toEqual(payload)
      expect(decrypted.title).toBe('Security Alert: New Sign-in')
      expect(decrypted.body).toBe('A new session was authenticated from Tokyo, Japan.')
    })

    it('encrypts payload using ephemeral key pair when recipient has no public key configured', () => {
      const payload = {
        title: 'Welcome to IRIS',
        body: 'Enjoy your secure workspace.',
      }

      // No recipient public key provided
      const encrypted = CarinaNotificationsServ.encryptNotificationPayload(payload, null)

      expect(typeof encrypted.encryptedKey).toBe('string')
      expect(typeof encrypted.encryptedData).toBe('string')
      const parts = encrypted.encryptedData.split(':')
      expect(parts.length).toBe(3)
    })

    it('fails to decrypt if secret key does not match encapsulation public key', () => {
      const payload = { title: 'Top Secret Notification' }
      const encrypted = CarinaNotificationsServ.encryptNotificationPayload(
        payload,
        mockUsers[0]!.publicKey
      )

      // Generate a different keypair (Bob's keys)
      const bobKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })

      expect(() => {
        CarinaNotificationsServ.decryptNotificationPayload(
          encrypted.encryptedKey,
          encrypted.encryptedData,
          bobKeyPair.privateKey
        )
      }).toThrow()
    })

    it('fails to decrypt if encryptedData is corrupted or has invalid format', () => {
      expect(() => {
        CarinaNotificationsServ.decryptNotificationPayload(
          'bad-key',
          'invalid-encrypted-data',
          aliceKeyPair.privateKey
        )
      }).toThrow('Invalid encrypted notification format (expected iv:authTag:cipher)')
    })

    it('creates notification via service helper and persists encrypted fields', async () => {
      const created = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'friend',
        type: 'ACTION_CONFIRM',
        priority: 'HIGH',
        content: {
          title: 'Friend Request',
          body: 'Bob sent you a friend request',
        },
        actionHandler: '/carina/friends/requests/req-123/accept',
      })

      expect(created.id).toBeDefined()
      expect(created.userId).toBe(ALICE_ID)
      expect(created.app).toBe('carina')
      expect(created.priority).toBe('HIGH')
      expect(created.type).toBe('ACTION_CONFIRM')
      expect(created.encryptedKey).toBeDefined()
      expect(created.encryptedData).toBeDefined()

      // Verify that Alice can decrypt it
      const decrypted = CarinaNotificationsServ.decryptNotificationPayload(
        created.encryptedKey,
        created.encryptedData,
        aliceKeyPair.privateKey
      )
      expect(decrypted.title).toBe('Friend Request')
      expect(decrypted.body).toBe('Bob sent you a friend request')
    })
  })

  // ===========================================================================
  // 2. GET /carina/notifications (List Notifications - 10 per page default)
  // ===========================================================================

  describe('GET /carina/notifications', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications', { method: 'GET' })
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('unauthorized')
    })

    it('returns empty list and 0 unread when user has no notifications', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.total).toBe(0)
      expect(json.unreadCount).toBe(0)
      expect(json.notifications).toEqual([])
      expect(json.pagination.page).toBe(1)
      expect(json.pagination.limit).toBe(10)
      expect(json.pagination.hasMore).toBe(false)
    })

    it('returns paginated notifications for authenticated user with strictly isolated scope', async () => {
      // Create 15 notifications for Alice
      for (let i = 1; i <= 15; i++) {
        await CarinaNotificationsServ.createNotification({
          userId: ALICE_ID,
          app: 'carina',
          category: 'system',
          content: { title: `Alice Notification #${i}` },
        })
      }

      // Create 5 notifications for Bob (must not appear in Alice's list)
      for (let i = 1; i <= 5; i++) {
        await CarinaNotificationsServ.createNotification({
          userId: BOB_ID,
          app: 'carina',
          category: 'system',
          content: { title: `Bob Notification #${i}` },
        })
      }

      // Fetch page 1 (default limit 10)
      const res1 = await app.handle(
        new Request('http://localhost/carina/notifications', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res1.status).toBe(200)
      const json1 = await res1.json()
      expect(json1.success).toBe(true)
      expect(json1.total).toBe(15)
      expect(json1.unreadCount).toBe(15)
      expect(json1.notifications.length).toBe(10)
      expect(json1.pagination.page).toBe(1)
      expect(json1.pagination.limit).toBe(10)
      expect(json1.pagination.totalPages).toBe(2)
      expect(json1.pagination.hasMore).toBe(true)

      // Fetch page 2 (custom page=2&limit=10)
      const res2 = await app.handle(
        new Request('http://localhost/carina/notifications?page=2&limit=10', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res2.status).toBe(200)
      const json2 = await res2.json()
      expect(json2.notifications.length).toBe(5)
      expect(json2.pagination.page).toBe(2)
      expect(json2.pagination.hasMore).toBe(false)

      // Verify Bob sees only his 5 notifications
      const resBob = await app.handle(
        new Request('http://localhost/carina/notifications', {
          method: 'GET',
          headers: { Authorization: `Bearer ${bobToken}` },
        })
      )
      expect(resBob.status).toBe(200)
      const jsonBob = await resBob.json()
      expect(jsonBob.total).toBe(5)
      expect(jsonBob.unreadCount).toBe(5)
      expect(jsonBob.notifications.length).toBe(5)
    })

    it('filters notifications by isRead=false and isRead=true', async () => {
      // 2 unread, 1 read
      await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'test',
        content: { title: 'Unread 1' },
      })
      const n2 = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'test',
        content: { title: 'Read 1' },
      })
      await CarinaNotificationsServ.markNotificationRead(ALICE_ID, n2.id)

      // Query isRead=false
      const unreadRes = await app.handle(
        new Request('http://localhost/carina/notifications?isRead=false', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(unreadRes.status).toBe(200)
      const unreadJson = await unreadRes.json()
      expect(unreadJson.total).toBe(1)
      expect(unreadJson.notifications[0].isRead).toBe(false)

      // Query isRead=true
      const readRes = await app.handle(
        new Request('http://localhost/carina/notifications?isRead=true', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(readRes.status).toBe(200)
      const readJson = await readRes.json()
      expect(readJson.total).toBe(1)
      expect(readJson.notifications[0].isRead).toBe(true)
    })

    it('filters notifications by app, priority, and category', async () => {
      await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'IRIS',
        category: 'security',
        priority: 'URGENT',
        content: { title: 'Urgent IRIS Security' },
      })
      await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'social',
        priority: 'LOW',
        content: { title: 'Low Carina Social' },
      })

      const res = await app.handle(
        new Request(
          'http://localhost/carina/notifications?app=IRIS&priority=URGENT&category=security',
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${aliceToken}` },
          }
        )
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.total).toBe(1)
      expect(json.notifications[0].app).toBe('IRIS')
      expect(json.notifications[0].priority).toBe('URGENT')
      expect(json.notifications[0].category).toBe('security')
    })

    it('fails (422) on invalid query parameters (e.g. limit > 50)', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications?limit=100', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(422)
    })
  })

  // ===========================================================================
  // 3. DELETE /carina/notifications (Delete all notifications)
  // ===========================================================================

  describe('DELETE /carina/notifications', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications', { method: 'DELETE' })
      )
      expect(res.status).toBe(401)
    })

    it('deletes only read notifications when ?onlyRead=true', async () => {
      // 1 read, 2 unread
      const n1 = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'sys',
        content: { title: 'Read' },
      })
      await CarinaNotificationsServ.markNotificationRead(ALICE_ID, n1.id)

      await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'sys',
        content: { title: 'Unread 1' },
      })
      await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'sys',
        content: { title: 'Unread 2' },
      })

      const res = await app.handle(
        new Request('http://localhost/carina/notifications?onlyRead=true', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.deletedCount).toBe(1)
      expect(json.unreadCount).toBe(2)

      // Verify remaining notifications
      const list = await CarinaNotificationsServ.listNotifications(ALICE_ID)
      expect(list.total).toBe(2)
      expect(list.unreadCount).toBe(2)
    })

    it('deletes all notifications when onlyRead is omitted or false', async () => {
      for (let i = 0; i < 4; i++) {
        await CarinaNotificationsServ.createNotification({
          userId: ALICE_ID,
          app: 'carina',
          category: 'sys',
          content: { title: `Notif ${i}` },
        })
      }

      // Also create 1 for Bob to verify user isolation
      await CarinaNotificationsServ.createNotification({
        userId: BOB_ID,
        app: 'carina',
        category: 'sys',
        content: { title: "Bob's notification" },
      })

      const res = await app.handle(
        new Request('http://localhost/carina/notifications', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.deletedCount).toBe(4)
      expect(json.unreadCount).toBe(0)

      // Bob's notification remains intact
      const bobList = await CarinaNotificationsServ.listNotifications(BOB_ID)
      expect(bobList.total).toBe(1)
    })
  })

  // ===========================================================================
  // 4. POST /carina/notifications/read (Mark all notifications as read)
  // ===========================================================================

  describe('POST /carina/notifications/read', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications/read', { method: 'POST' })
      )
      expect(res.status).toBe(401)
    })

    it('marks all unread notifications as read for authenticated user', async () => {
      for (let i = 0; i < 3; i++) {
        await CarinaNotificationsServ.createNotification({
          userId: ALICE_ID,
          app: 'carina',
          category: 'msg',
          content: { title: `Msg ${i}` },
        })
      }
      // Bob also has 2 unread
      for (let i = 0; i < 2; i++) {
        await CarinaNotificationsServ.createNotification({
          userId: BOB_ID,
          app: 'carina',
          category: 'msg',
          content: { title: `Bob Msg ${i}` },
        })
      }

      const res = await app.handle(
        new Request('http://localhost/carina/notifications/read', {
          method: 'POST',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.markedCount).toBe(3)
      expect(json.unreadCount).toBe(0)

      // Bob's unread count is untouched
      const bobList = await CarinaNotificationsServ.listNotifications(BOB_ID)
      expect(bobList.unreadCount).toBe(2)
    })
  })

  // ===========================================================================
  // 5. GET /carina/notifications/:notificationId (Get single notification)
  // ===========================================================================

  describe('GET /carina/notifications/:notificationId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications/notif-123', { method: 'GET' })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when notification ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications/non-existent-id', {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('fails (404) when trying to access a notification belonging to another user', async () => {
      const bobsNotif = await CarinaNotificationsServ.createNotification({
        userId: BOB_ID,
        app: 'carina',
        category: 'private',
        content: { title: 'Bob Private' },
      })

      // Alice attempts to fetch Bob's notification
      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${bobsNotif.id}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('returns single notification details strictly by notification ID', async () => {
      const notif = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'system',
        priority: 'HIGH',
        content: { title: 'System Maintenance in 10 minutes' },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${notif.id}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.notification.id).toBe(notif.id)
      expect(json.notification.userId).toBe(ALICE_ID)
      expect(json.notification.priority).toBe('HIGH')
      expect(json.notification.encryptedKey).toBeDefined()
      expect(json.notification.encryptedData).toBeDefined()
    })
  })

  // ===========================================================================
  // 6. DELETE /carina/notifications/:notificationId (Delete single notification)
  // ===========================================================================

  describe('DELETE /carina/notifications/:notificationId', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications/notif-123', {
          method: 'DELETE',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when notification ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications/non-existent-id', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (404) when trying to delete another user notification', async () => {
      const bobsNotif = await CarinaNotificationsServ.createNotification({
        userId: BOB_ID,
        app: 'carina',
        category: 'private',
        content: { title: 'Bob Private' },
      })

      // Alice tries to delete Bob's notification
      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${bobsNotif.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('successfully deletes single notification strictly by ID', async () => {
      const notif = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'test',
        content: { title: 'Delete Me' },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${notif.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(notif.id)
      expect(json.unreadCount).toBe(0)

      // Verify it is gone
      const verifyRes = await app.handle(
        new Request(`http://localhost/carina/notifications/${notif.id}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(verifyRes.status).toBe(404)
    })
  })

  // ===========================================================================
  // 7. POST /carina/notifications/:notificationId/read (Mark single as read)
  // ===========================================================================

  describe('POST /carina/notifications/:notificationId/read', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications/notif-123/read', {
          method: 'POST',
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when notification ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications/non-existent-id/read', {
          method: 'POST',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (404) when trying to mark another user notification as read', async () => {
      const bobsNotif = await CarinaNotificationsServ.createNotification({
        userId: BOB_ID,
        app: 'carina',
        category: 'private',
        content: { title: 'Bob Private' },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${bobsNotif.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(404)
    })

    it('marks single notification as read and returns updated unread count', async () => {
      const notif1 = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'test',
        content: { title: 'Notif 1' },
      })
      await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'test',
        content: { title: 'Notif 2' },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${notif1.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(notif1.id)
      expect(json.isRead).toBe(true)
      expect(json.readAt).toBeDefined()
      expect(json.unreadCount).toBe(1) // 1 remaining unread

      // Idempotency: calling again maintains read status
      const res2 = await app.handle(
        new Request(`http://localhost/carina/notifications/${notif1.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${aliceToken}` },
        })
      )
      expect(res2.status).toBe(200)
      const json2 = await res2.json()
      expect(json2.isRead).toBe(true)
      expect(json2.unreadCount).toBe(1)
    })
  })

  // ===========================================================================
  // 8. POST /carina/notifications/:notificationId/action (Execute action)
  // ===========================================================================

  describe('POST /carina/notifications/:notificationId/action', () => {
    it('fails (401) when unauthenticated', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications/notif-123/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'CONFIRM' }),
        })
      )
      expect(res.status).toBe(401)
    })

    it('fails (404) when notification ID does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/notifications/non-existent-id/action', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'CONFIRM' }),
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (404) when executing action on another user notification', async () => {
      const bobsNotif = await CarinaNotificationsServ.createNotification({
        userId: BOB_ID,
        app: 'carina',
        category: 'action',
        type: 'ACTION_CONFIRM',
        content: { title: 'Approve Action' },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${bobsNotif.id}/action`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'CONFIRM' }),
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (422) when request body is invalid or missing action', async () => {
      const notif = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'action',
        content: { title: 'Action Required' },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${notif.id}/action`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}), // missing action
        })
      )
      expect(res.status).toBe(422)
    })

    it('executes CONFIRM action successfully, sets status to CONFIRMED, and marks as read', async () => {
      const notif = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'friend',
        type: 'ACTION_CONFIRM',
        content: { title: 'Bob sent you a friend request' },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${notif.id}/action`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'CONFIRM' }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.id).toBe(notif.id)
      expect(json.actionStatus).toBe('CONFIRMED')
      expect(json.isRead).toBe(true)
      expect(json.unreadCount).toBe(0)
    })

    it('executes REJECT / DECLINE action successfully, sets status to REJECTED', async () => {
      const notif = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'invite',
        type: 'ACTION_CONFIRM',
        content: { title: 'Party Invite' },
      })

      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${notif.id}/action`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'REJECT' }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.actionStatus).toBe('REJECTED')
      expect(json.isRead).toBe(true)
    })

    it('executes SUBMIT action with custom payload, sets status to SUBMITTED', async () => {
      const notif = await CarinaNotificationsServ.createNotification({
        userId: ALICE_ID,
        app: 'carina',
        category: 'survey',
        type: 'ACTION_INPUT',
        content: { title: 'Quick Poll' },
      })

      const customPayload = { answer: 'Option B', rating: 5 }
      const res = await app.handle(
        new Request(`http://localhost/carina/notifications/${notif.id}/action`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aliceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'SUBMIT', payload: customPayload }),
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.actionStatus).toBe('SUBMITTED')
      expect(json.actionPayload).toEqual(customPayload)
      expect(json.isRead).toBe(true)
    })
  })
})
