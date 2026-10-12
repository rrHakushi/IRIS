import crypto from 'node:crypto'
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js'
import {
  prisma,
  Prisma,
  type NotificationType,
  type NotificationPriority,
  type NotificationActionStatus,
} from '@IRIS/database'
import { NotFound } from '../../lib/errors'

export interface NotificationContent {
  title: string
  body?: string
  icon?: string
  link?: string
  actionData?: Record<string, unknown>
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface EncryptedNotificationPayload {
  kemCiphertext: string
  encryptedData: string
}

export class CarinaNotificationsServ {
  /**
   * Encrypts arbitrary notification content using Post-Quantum ML-KEM-768 and AES-256-GCM.
   * If recipientPublicKeyBase64 is provided, encapsulates against the recipient public key.
   * Otherwise, generates an ephemeral ML-KEM-768 key pair to ensure payload is always post-quantum encrypted.
   */
  public static encryptNotificationPayload(
    content: NotificationContent | Record<string, unknown>,
    recipientPublicKeyBase64?: string | null
  ): EncryptedNotificationPayload {
    let targetPublicKey: Uint8Array
    if (recipientPublicKeyBase64?.trim()) {
      targetPublicKey = new Uint8Array(
        Buffer.from(recipientPublicKeyBase64.trim(), 'base64')
      )
    } else {
      const ephemeral = ml_kem768.keygen()
      targetPublicKey = ephemeral.publicKey
    }

    // 1. Post-Quantum KEM Encapsulation
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(targetPublicKey)

    // 2. Symmetric AES-256-GCM Encryption with 12-byte IV
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret, iv)
    const plaintext = JSON.stringify(content)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    const encryptedData = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
    const kemCiphertext = Buffer.from(cipherText).toString('base64')

    return {
      kemCiphertext,
      encryptedData,
    }
  }

  /**
   * Decrypts a post-quantum encrypted notification payload using an ML-KEM-768 secret key.
   */
  public static decryptNotificationPayload(
    kemCiphertextBase64: string,
    encryptedData: string,
    secretKey: Uint8Array
  ): NotificationContent {
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted notification format (expected iv:authTag:cipher)')
    }

    const [ivHex, authTagHex, cipherHex] = parts
    const iv = Buffer.from(ivHex!, 'hex')
    const authTag = Buffer.from(authTagHex!, 'hex')
    const cipherBytes = Buffer.from(cipherHex!, 'hex')

    const rawKemCiphertext = new Uint8Array(Buffer.from(kemCiphertextBase64, 'base64'))

    // 1. Post-Quantum KEM Decapsulation
    const sharedSecret = ml_kem768.decapsulate(rawKemCiphertext, secretKey)

    // 2. Symmetric AES-256-GCM Decryption
    const decipher = crypto.createDecipheriv('aes-256-gcm', sharedSecret, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(cipherBytes), decipher.final()])

    return JSON.parse(decrypted.toString('utf8'))
  }

  /**
   * Helper to create and post a new post-quantum encrypted notification.
   */
  public static async createNotification(params: {
    userId: string
    app: string
    category: string
    type?: NotificationType
    priority?: NotificationPriority
    content: NotificationContent
    actionHandler?: string
    actionPayload?: Prisma.InputJsonValue | null
    expiresAt?: Date | null
  }) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { publicKey: true },
    })

    const { kemCiphertext, encryptedData } = this.encryptNotificationPayload(
      params.content,
      user?.publicKey
    )

    return await prisma.notification.create({
      data: {
        userId: params.userId,
        app: params.app,
        category: params.category,
        type: params.type ?? 'INFO',
        priority: params.priority ?? 'NORMAL',
        actionHandler: params.actionHandler ?? null,
        actionPayload: params.actionPayload === null ? Prisma.JsonNull : (params.actionPayload ?? undefined),
        kemCiphertext,
        encryptedData,
        expiresAt: params.expiresAt ?? null,
      },
    })
  }

  /**
   * Get notifications for authenticated user (10 per page default).
   */
  public static async listNotifications(
    userId: string,
    query?: {
      page?: number
      limit?: number
      isRead?: boolean
      app?: string
      category?: string
      priority?: string
      type?: string
    }
  ) {
    const page = Math.max(1, query?.page ?? 1)
    const limit = Math.max(1, Math.min(50, query?.limit ?? 10))
    const skip = (page - 1) * limit

    const where: Prisma.NotificationWhereInput = { userId }

    if (query?.isRead !== undefined) {
      where.isRead = typeof query.isRead === 'string' ? query.isRead === 'true' : Boolean(query.isRead)
    }
    if (query?.app) {
      where.app = query.app
    }
    if (query?.category) {
      where.category = query.category
    }
    if (query?.priority) {
      where.priority = query.priority as NotificationPriority
    }
    if (query?.type) {
      where.type = query.type as NotificationType
    }

    const [total, unreadCount, rawNotifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))
    const hasMore = page < totalPages

    const notifications = rawNotifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      app: n.app,
      category: n.category,
      type: n.type,
      priority: n.priority,
      isRead: n.isRead,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      actionStatus: n.actionStatus,
      actionPayload: n.actionPayload,
      actionHandler: n.actionHandler,
      kemCiphertext: n.kemCiphertext,
      encryptedData: n.encryptedData,
      expiresAt: n.expiresAt ? n.expiresAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }))

    return {
      success: true,
      total,
      unreadCount,
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    }
  }

  /**
   * Delete all notifications for authenticated user.
   */
  public static async deleteAllNotifications(
    userId: string,
    query?: { onlyRead?: boolean }
  ) {
    const where: Prisma.NotificationWhereInput = { userId }
    const onlyRead = typeof query?.onlyRead === 'string' ? query.onlyRead === 'true' : Boolean(query?.onlyRead)
    if (onlyRead) {
      where.isRead = true
    }

    const result = await prisma.notification.deleteMany({ where })
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    })

    return {
      success: true,
      deletedCount: result.count,
      unreadCount,
      message: 'Notifications deleted successfully',
    }
  }

  /**
   * Get single notification details strictly by notification ID.
   */
  public static async getNotification(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId.trim() },
    })

    if (!notification || notification.userId !== userId) {
      throw new NotFound('Notification not found')
    }

    return {
      success: true,
      notification: {
        id: notification.id,
        userId: notification.userId,
        app: notification.app,
        category: notification.category,
        type: notification.type,
        priority: notification.priority,
        isRead: notification.isRead,
        readAt: notification.readAt ? notification.readAt.toISOString() : null,
        actionStatus: notification.actionStatus,
        actionPayload: notification.actionPayload,
        actionHandler: notification.actionHandler,
        kemCiphertext: notification.kemCiphertext,
        encryptedData: notification.encryptedData,
        expiresAt: notification.expiresAt ? notification.expiresAt.toISOString() : null,
        createdAt: notification.createdAt.toISOString(),
        updatedAt: notification.updatedAt.toISOString(),
      },
    }
  }

  /**
   * Delete single notification strictly by notification ID.
   */
  public static async deleteNotification(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId.trim() },
    })

    if (!notification || notification.userId !== userId) {
      throw new NotFound('Notification not found')
    }

    await prisma.notification.delete({
      where: { id: notification.id },
    })

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    })

    return {
      success: true,
      id: notification.id,
      unreadCount,
      message: 'Notification deleted successfully',
    }
  }

  /**
   * Execute an interactive action on a notification.
   */
  public static async executeNotificationAction(
    userId: string,
    notificationId: string,
    body: { action: string; payload?: any }
  ) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId.trim() },
    })

    if (!notification || notification.userId !== userId) {
      throw new NotFound('Notification not found')
    }

    const normAction = body.action.toUpperCase().trim()
    let actionStatus: NotificationActionStatus = 'CONFIRMED'
    if (normAction === 'REJECT' || normAction === 'DECLINE') {
      actionStatus = 'REJECTED'
    } else if (normAction === 'SUBMIT') {
      actionStatus = 'SUBMITTED'
    }

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: {
        actionStatus,
        actionPayload: body.payload !== undefined ? body.payload : notification.actionPayload,
        isRead: true,
        readAt: notification.readAt ?? new Date(),
      },
    })

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    })

    return {
      success: true,
      id: updated.id,
      actionStatus: updated.actionStatus || actionStatus,
      actionPayload: updated.actionPayload,
      isRead: true,
      unreadCount,
      message: 'Notification action executed successfully',
    }
  }

  /**
   * Mark single notification as read strictly by notification ID.
   */
  public static async markNotificationRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId.trim() },
    })

    if (!notification || notification.userId !== userId) {
      throw new NotFound('Notification not found')
    }

    const now = new Date()
    let readAtDate = notification.readAt || now

    if (!notification.isRead) {
      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: {
          isRead: true,
          readAt: now,
        },
      })
      readAtDate = updated.readAt || now
    }

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    })

    return {
      success: true,
      id: notification.id,
      isRead: true,
      readAt: readAtDate.toISOString(),
      unreadCount,
      message: 'Notification marked as read',
    }
  }

  /**
   * Mark all notifications as read for authenticated user.
   */
  public static async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return {
      success: true,
      markedCount: result.count,
      unreadCount: 0 as const,
      message: 'All notifications marked as read',
    }
  }
}
