import crypto from 'node:crypto'
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js'
import {
  prisma,
  Prisma,
  type NotificationType,
  type NotificationPriority,
  type NotificationActionStatus,
} from '@IRIS/database'
import { LogFactory } from '@Iris/logger'
import { NotFound } from '../../lib/errors'
import { wsHub } from '../ws.serv'

const logger = new LogFactory('CarinaNotifications')

export interface ActionInputDefinition {
  id: string
  label: string
  type?: 'text' | 'number' | 'password' | 'textarea'
  placeholder?: string
  required?: boolean
  defaultValue?: string | number
}

export interface ActionSelectOption {
  value: string
  label: string
  description?: string
  icon?: string
}

export interface ActionSelectDefinition {
  id: string
  label: string
  placeholder?: string
  isMultiSelect?: boolean
  options: ActionSelectOption[]
  required?: boolean
}

export interface ActionConfirmDefinition {
  confirmLabel?: string
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary'
  rejectLabel?: string
  rejectVariant?: 'default' | 'destructive' | 'outline' | 'secondary'
}

export interface NotificationContent {
  title: string
  body?: string
  icon?: string
  link?: string
  actionConfirm?: ActionConfirmDefinition
  actionInputs?: ActionInputDefinition[]
  actionSelect?: ActionSelectDefinition
  actionData?: Record<string, unknown>
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface EncryptedNotificationPayload {
  kemCiphertext: string
  encryptedData: string
}

export interface SendNotificationParams {
  userId: string
  app: string
  category: string
  type?: NotificationType
  priority?: NotificationPriority
  content: NotificationContent
  actionHandler?: string
  actionPayload?: Prisma.InputJsonValue | null
  expiresAt?: Date | null
}

export interface ListNotificationsQuery {
  page?: number
  limit?: number
  isRead?: boolean | string
  app?: string
  category?: string
  priority?: string
  type?: string
}

export type NotificationSendListener = (notification: any) => void

const sendListeners = new Set<NotificationSendListener>()

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
   * Helper to create, encrypt, persist, and send a new post-quantum encrypted notification.
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
      select: { id: true, publicKey: true },
    })

    let userPublicKey = user?.publicKey
    if (user && !userPublicKey) {
      const { publicKey } = ml_kem768.keygen()
      userPublicKey = Buffer.from(publicKey).toString('base64')
      try {
        if (typeof (prisma.user as any)?.update === 'function') {
          await prisma.user.update({
            where: { id: user.id },
            data: { publicKey: userPublicKey },
          })
        }
      } catch (err) {
        logger.warn(`Failed to update recipient user public key: ${err}`)
      }
    }

    const { kemCiphertext, encryptedData } = this.encryptNotificationPayload(
      params.content,
      userPublicKey
    )

    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        app: params.app,
        category: params.category,
        type: params.type ?? 'INFO',
        priority: params.priority ?? 'NORMAL',
        actionStatus: params.type && params.type !== 'INFO' ? 'PENDING' : null,
        actionHandler: params.actionHandler ?? null,
        actionPayload: params.actionPayload === null ? Prisma.JsonNull : (params.actionPayload ?? undefined),
        kemCiphertext,
        encryptedData,
        expiresAt: params.expiresAt ?? null,
      },
    })

    // Broadcast to registered listeners
    for (const listener of sendListeners) {
      try {
        listener(notification)
      } catch (err) {
        logger.warn(`Error in notification send listener: ${err}`)
      }
    }

    try {
      wsHub.sendToUser(params.userId, 'notification:new', { notification })
    } catch (err) {
      logger.warn(`Failed to dispatch real-time notification over WebSocket: ${err}`)
    }

    return notification
  }

  /**
   * Get notifications for authenticated user (10 per page default).
   */
  public static async listNotifications(
    userId: string,
    query?: ListNotificationsQuery
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
    query?: { onlyRead?: boolean | string }
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

    try {
      wsHub.sendToUser(userId, 'notification:bulk-delete', { deletedCount: result.count })
    } catch {}

    return {
      success: true,
      deletedCount: result.count,
      unreadCount,
      message: 'Notifications deleted successfully',
    }
  }

  /**
   * Get single notification details strictly by notification ID.
   * If secretKey is provided, optionally decrypts and returns content.
   */
  public static async getNotification(
    userId: string,
    notificationId: string,
    secretKey?: Uint8Array
  ) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId.trim() },
    })

    if (!notification || notification.userId !== userId) {
      throw new NotFound('Notification not found')
    }

    let decryptedContent: NotificationContent | undefined
    if (secretKey) {
      try {
        decryptedContent = this.decryptNotificationPayload(
          notification.kemCiphertext,
          notification.encryptedData,
          secretKey
        )
      } catch (err) {
        logger.warn(`Failed to decrypt notification ${notification.id}: ${err}`)
      }
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
        ...(decryptedContent ? { content: decryptedContent } : {}),
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

    try {
      wsHub.sendToUser(userId, 'notification:delete', { id: notification.id })
    } catch {}

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

    try {
      wsHub.sendToUser(userId, 'notification:action-resolved', {
        id: updated.id,
        actionStatus: updated.actionStatus || actionStatus,
        actionPayload: updated.actionPayload,
      })
    } catch {}

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

    try {
      wsHub.sendToUser(userId, 'notification:update', {
        id: notification.id,
        isRead: true,
        readAt: readAtDate.toISOString(),
      })
    } catch {}

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

    try {
      wsHub.sendToUser(userId, 'notification:mark-all-read', {
        markedCount: result.count,
      })
    } catch {}

    return {
      success: true,
      markedCount: result.count,
      unreadCount: 0 as const,
      message: 'All notifications marked as read',
    }
  }

  /**
   * Count unread notifications for a user.
   */
  public static async countUnread(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: { userId, isRead: false },
    })
  }

  /**
   * Subscribe to new notification send events.
   */
  public static onSend(listener: NotificationSendListener): () => void {
    sendListeners.add(listener)
    return () => sendListeners.delete(listener)
  }

  // --- Convenience aliases for standard service interface ---
  public static send = CarinaNotificationsServ.createNotification
  public static encrypt = CarinaNotificationsServ.encryptNotificationPayload
  public static decrypt = CarinaNotificationsServ.decryptNotificationPayload
  public static list = CarinaNotificationsServ.listNotifications
  public static get = CarinaNotificationsServ.getNotification
  public static delete = CarinaNotificationsServ.deleteNotification
  public static deleteAll = CarinaNotificationsServ.deleteAllNotifications
  public static markAsRead = CarinaNotificationsServ.markNotificationRead
  public static executeAction = CarinaNotificationsServ.executeNotificationAction
}

/** Convenience alias */
export const NotificationService = CarinaNotificationsServ
export const notificationService = {
  send: CarinaNotificationsServ.createNotification,
  createNotification: CarinaNotificationsServ.createNotification,
  encrypt: CarinaNotificationsServ.encryptNotificationPayload,
  encryptNotificationPayload: CarinaNotificationsServ.encryptNotificationPayload,
  decrypt: CarinaNotificationsServ.decryptNotificationPayload,
  decryptNotificationPayload: CarinaNotificationsServ.decryptNotificationPayload,
  list: CarinaNotificationsServ.listNotifications,
  listNotifications: CarinaNotificationsServ.listNotifications,
  get: CarinaNotificationsServ.getNotification,
  getNotification: CarinaNotificationsServ.getNotification,
  delete: CarinaNotificationsServ.deleteNotification,
  deleteNotification: CarinaNotificationsServ.deleteNotification,
  deleteAll: CarinaNotificationsServ.deleteAllNotifications,
  deleteAllNotifications: CarinaNotificationsServ.deleteAllNotifications,
  markAsRead: CarinaNotificationsServ.markNotificationRead,
  markNotificationRead: CarinaNotificationsServ.markNotificationRead,
  markAllRead: CarinaNotificationsServ.markAllRead,
  executeAction: CarinaNotificationsServ.executeNotificationAction,
  executeNotificationAction: CarinaNotificationsServ.executeNotificationAction,
  countUnread: CarinaNotificationsServ.countUnread,
  onSend: CarinaNotificationsServ.onSend,
}
