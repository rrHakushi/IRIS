import crypto from 'node:crypto'
import {
  prisma,
  countOf,
  toDate,
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
  encryptedKey: string
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
  actionPayload?: any
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
   * Encrypts arbitrary notification content using standard RSA-OAEP (2048-bit) and AES-256-GCM.
   */
  public static encryptNotificationPayload(
    content: NotificationContent | Record<string, unknown>,
    recipientPublicKeyPem?: string | null
  ): EncryptedNotificationPayload {
    let targetPublicKey = recipientPublicKeyPem?.trim()
    if (!targetPublicKey || !targetPublicKey.includes('BEGIN')) {
      const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      })
      targetPublicKey = publicKey
    }

    // 1. Generate random 256-bit AES key and 12-byte IV for payload
    const aesKey = crypto.randomBytes(32)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv)
    const plaintext = JSON.stringify(content)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    const encryptedData = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`

    // 2. Encrypt symmetric AES key with recipient's RSA-OAEP public key
    let encryptedKeyBuffer: Buffer
    try {
      encryptedKeyBuffer = crypto.publicEncrypt(
        {
          key: targetPublicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        aesKey
      )
    } catch {
      const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      })
      encryptedKeyBuffer = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        aesKey
      )
    }
    const encryptedKey = encryptedKeyBuffer.toString('base64')

    return {
      encryptedKey,
      encryptedData,
    }
  }

  /**
   * Decrypts an encrypted notification payload using an RSA-OAEP private key.
   */
  public static decryptNotificationPayload(
    encryptedKeyBase64: string,
    encryptedData: string,
    privateKeyPem: string
  ): NotificationContent {
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted notification format (expected iv:authTag:cipher)')
    }

    const [ivHex, authTagHex, cipherHex] = parts
    const iv = Buffer.from(ivHex!, 'hex')
    const authTag = Buffer.from(authTagHex!, 'hex')
    const cipherBytes = Buffer.from(cipherHex!, 'hex')

    // 1. Decrypt symmetric AES key with RSA-OAEP private key
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encryptedKeyBase64, 'base64')
    )

    // 2. Symmetric AES-256-GCM Decryption
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(cipherBytes), decipher.final()])

    return JSON.parse(decrypted.toString('utf8'))
  }

  /**
   * Helper to create, encrypt, persist, and send a new encrypted notification.
   */
  public static async createNotification(params: {
    userId: string
    app: string
    category: string
    type?: NotificationType
    priority?: NotificationPriority
    content: NotificationContent
    actionHandler?: string
    actionPayload?: any
    expiresAt?: Date | null
  }) {
    const user = await prisma.orm.public.User.where({ id: params.userId })
      .select('id', 'publicKey')
      .first()

    const userPublicKey = user?.publicKey?.trim()
    if (!userPublicKey || !userPublicKey.includes('BEGIN')) {
      const msg = `User ${params.userId} does not have a valid RSA public key (found: ${userPublicKey ? 'legacy/invalid' : 'none'}).`
      logger.warn(`[CarinaNotifications] ${msg}`)
      throw new Error(msg)
    }

    const { encryptedKey, encryptedData } = this.encryptNotificationPayload(
      params.content,
      userPublicKey
    )

    const notification = await prisma.orm.public.Notification.create({
      userId: params.userId,
      app: params.app,
      category: params.category,
      type: params.type ?? 'INFO',
      priority: params.priority ?? 'NORMAL',
      actionStatus: params.type && params.type !== 'INFO' ? 'PENDING' : null,
      actionHandler: params.actionHandler ?? null,
      actionPayload: params.actionPayload ?? null,
      encryptedKey,
      encryptedData,
      expiresAt: params.expiresAt ?? null,
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

    let notifQuery = prisma.orm.public.Notification.where({ userId })

    if (query?.isRead !== undefined) {
      const isReadVal = typeof query.isRead === 'string' ? query.isRead === 'true' : Boolean(query.isRead)
      notifQuery = notifQuery.where({ isRead: isReadVal })
    }
    if (query?.app) {
      notifQuery = notifQuery.where({ app: query.app })
    }
    if (query?.category) {
      notifQuery = notifQuery.where({ category: query.category })
    }
    if (query?.priority) {
      notifQuery = notifQuery.where({ priority: query.priority as NotificationPriority })
    }
    if (query?.type) {
      notifQuery = notifQuery.where({ type: query.type as NotificationType })
    }

    const [total, unreadCount, rawNotifications] = await Promise.all([
      countOf(notifQuery),
      countOf(prisma.orm.public.Notification.where({ userId, isRead: false })),
      notifQuery
        .orderBy((n) => n.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .all(),
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
      readAt: n.readAt ? toDate(n.readAt).toISOString() : null,
      actionStatus: n.actionStatus,
      actionPayload: n.actionPayload,
      actionHandler: n.actionHandler,
      encryptedKey: n.encryptedKey,
      encryptedData: n.encryptedData,
      expiresAt: n.expiresAt ? toDate(n.expiresAt).toISOString() : null,
      createdAt: toDate(n.createdAt).toISOString(),
      updatedAt: toDate(n.updatedAt).toISOString(),
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
    let delQuery = prisma.orm.public.Notification.where({ userId })
    const onlyRead = typeof query?.onlyRead === 'string' ? query.onlyRead === 'true' : Boolean(query?.onlyRead)
    if (onlyRead) {
      delQuery = delQuery.where({ isRead: true })
    }

    const deletedCount = await delQuery.deleteAndCount()
    const unreadCount = await countOf(prisma.orm.public.Notification.where({ userId, isRead: false }))

    try {
      wsHub.sendToUser(userId, 'notification:bulk-delete', { deletedCount })
    } catch {}

    return {
      success: true,
      deletedCount,
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
    const notification = await prisma.orm.public.Notification.where({ id: notificationId.trim() }).first()

    if (!notification || notification.userId !== userId) {
      throw new NotFound('Notification not found')
    }

    let decryptedContent: NotificationContent | undefined
    if (secretKey) {
      try {
        decryptedContent = this.decryptNotificationPayload(
          notification.encryptedKey,
          notification.encryptedData,
          typeof secretKey === 'string' ? secretKey : Buffer.from(secretKey).toString('utf8')
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
        readAt: notification.readAt ? toDate(notification.readAt).toISOString() : null,
        actionStatus: notification.actionStatus,
        actionPayload: notification.actionPayload,
        actionHandler: notification.actionHandler,
        encryptedKey: notification.encryptedKey,
        encryptedData: notification.encryptedData,
        expiresAt: notification.expiresAt ? toDate(notification.expiresAt).toISOString() : null,
        createdAt: toDate(notification.createdAt).toISOString(),
        updatedAt: toDate(notification.updatedAt).toISOString(),
        ...(decryptedContent ? { content: decryptedContent } : {}),
      },
    }
  }

  /**
   * Delete single notification strictly by notification ID.
   */
  public static async deleteNotification(userId: string, notificationId: string) {
    const notification = await prisma.orm.public.Notification.where({ id: notificationId.trim() }).first()

    if (!notification || notification.userId !== userId) {
      throw new NotFound('Notification not found')
    }

    await prisma.orm.public.Notification.where({ id: notification.id }).delete()

    const unreadCount = await countOf(prisma.orm.public.Notification.where({ userId, isRead: false }))

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
    const notification = await prisma.orm.public.Notification.where({ id: notificationId.trim() }).first()

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

    const updated = await prisma.orm.public.Notification.where({ id: notification.id }).update({
      actionStatus,
      actionPayload: body.payload !== undefined ? body.payload : notification.actionPayload,
      isRead: true,
      readAt: notification.readAt ? toDate(notification.readAt) : new Date(),
    })

    if (!updated) {
      throw new NotFound('Notification not found')
    }

    const unreadCount = await countOf(prisma.orm.public.Notification.where({ userId, isRead: false }))

    if (actionStatus === 'CONFIRMED' && notification.actionHandler === 'borealis.other.fork') {
      const otherId = (notification.actionPayload as any)?.otherId
      if (otherId) {
        try {
          const userRecord = await prisma.orm.public.User.where({ id: userId })
            .select('permissions')
            .first()
          const { hasPermission, IRISFlags } = await import('@IRIS/permissions')
          const isAdmin = hasPermission(userRecord?.permissions ? [...userRecord.permissions] : null, IRISFlags.ADMINISTRATOR)
          const { BorealisOtherServ } = await import('../borealis/other.serv')
          await BorealisOtherServ.forkItem(userId, Number(otherId), isAdmin)
        } catch (forkErr) {
          logger.warn(`Failed to fork item on notification action: ${forkErr}`)
        }
      }
    }

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
    const notification = await prisma.orm.public.Notification.where({ id: notificationId.trim() }).first()

    if (!notification || notification.userId !== userId) {
      throw new NotFound('Notification not found')
    }

    const now = new Date()
    let readAtDate = notification.readAt ? toDate(notification.readAt) : now

    if (!notification.isRead) {
      const updated = await prisma.orm.public.Notification.where({ id: notification.id }).update({
        isRead: true,
        readAt: now,
      })
      readAtDate = updated?.readAt ? toDate(updated.readAt) : now
    }

    const unreadCount = await countOf(prisma.orm.public.Notification.where({ userId, isRead: false }))

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
    const markedCount = await prisma.orm.public.Notification.where({
      userId,
      isRead: false,
    }).updateAndCount({
      isRead: true,
      readAt: new Date(),
    })

    try {
      wsHub.sendToUser(userId, 'notification:mark-all-read', {
        markedCount,
      })
    } catch {}

    return {
      success: true,
      markedCount,
      unreadCount: 0 as const,
      message: 'All notifications marked as read',
    }
  }

  /**
   * Count unread notifications for a user.
   */
  public static async countUnread(userId: string): Promise<number> {
    return await countOf(prisma.orm.public.Notification.where({
      userId,
      isRead: false,
    }))
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
