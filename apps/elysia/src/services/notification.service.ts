import { ml_kem768 } from "@noble/post-quantum/ml-kem.js"
import { gcm } from "@noble/ciphers/aes.js"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js"
import { prisma } from "@IRIS/database"
import { wsHub } from "./websocket-hub.js"
import { logger } from "../utils/logger.js"
import type {
  NotificationType,
  NotificationPriority,
  NotificationActionStatus,
} from "@IRIS/database"

let notificationServiceLogged = false

export function logNotificationServiceStatus(): void {
  if (notificationServiceLogged) return
  notificationServiceLogged = true

  logger.service("notification", "notifications service")

  const missingRequired: string[] = []
  if (!process.env.DATABASE_URL) {
    missingRequired.push("DATABASE_URL")
  }

  if (missingRequired.length > 0) {
    for (const v of missingRequired) {
      logger.service.missingEnv(
        v,
        "required for recipient key resolution & database persistence"
      )
    }
  } else {
    logger.service.verified("Environment verified (DATABASE_URL configured)")
  }
}

// Auto-log on module initialization
logNotificationServiceStatus()

export interface ActionInputDefinition {
  id: string
  label: string
  type?: "text" | "number" | "password" | "textarea"
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
  confirmVariant?: "default" | "destructive" | "outline" | "secondary"
  rejectLabel?: string
  rejectVariant?: "default" | "destructive" | "outline" | "secondary"
}

export interface NotificationContent {
  title: string
  body: string
  icon?: string
  link?: string
  actionConfirm?: ActionConfirmDefinition
  actionInputs?: ActionInputDefinition[]
  actionSelect?: ActionSelectDefinition
  metadata?: Record<string, unknown>
}

export interface SendNotificationParams {
  userId: string
  app: string
  category: string
  type?: NotificationType
  priority?: NotificationPriority
  content: NotificationContent
  actionHandler?: string
  actionPayload?: Record<string, unknown> | null
  expiresAt?: Date | null
}

/**
 * Encrypts a notification content object for a recipient using their ML-KEM-768 public key and AES-256-GCM.
 */
export function encryptNotificationContent(
  content: NotificationContent,
  publicKeyBase64: string
): { kemCiphertext: string; encryptedData: string } {
  const recipientPublicKey = new Uint8Array(
    Buffer.from(publicKeyBase64, "base64")
  )

  // 1. Post-Quantum KEM Encapsulation
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(recipientPublicKey)

  // 2. Symmetric AES-256-GCM payload encryption with random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aes = gcm(sharedSecret, iv)

  const plaintextBytes = new TextEncoder().encode(JSON.stringify(content))
  const ciphertextWithTag = aes.encrypt(plaintextBytes)

  const cipher = ciphertextWithTag.slice(0, -16)
  const authTag = ciphertextWithTag.slice(-16)

  const encryptedData = `${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(cipher)}`
  const kemCiphertext = Buffer.from(cipherText).toString("base64")

  return {
    kemCiphertext,
    encryptedData,
  }
}

/**
 * Decrypts a notification encrypted payload using the user's ML-KEM-768 secret key.
 */
export function decryptNotificationContent(
  kemCiphertextBase64: string,
  encryptedData: string,
  secretKey: Uint8Array
): NotificationContent {
  const parts = encryptedData.split(":")
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted notification payload format (expected iv:authTag:cipher)"
    )
  }

  const [ivHex, authTagHex, cipherHex] = parts
  const iv = hexToBytes(ivHex!)
  const authTag = hexToBytes(authTagHex!)
  const cipher = hexToBytes(cipherHex!)

  const cipherText = new Uint8Array(Buffer.from(kemCiphertextBase64, "base64"))

  // 1. Post-Quantum KEM Decapsulation
  const sharedSecret = ml_kem768.decapsulate(cipherText, secretKey)

  // 2. Symmetric AES-256-GCM decryption
  const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
  ciphertextWithTag.set(cipher, 0)
  ciphertextWithTag.set(authTag, cipher.length)

  const aes = gcm(sharedSecret, iv)
  const decryptedBytes = aes.decrypt(ciphertextWithTag)

  const jsonString = new TextDecoder().decode(decryptedBytes)
  return JSON.parse(jsonString) as NotificationContent
}

/**
 * Creates, encrypts, saves, and broadcasts a notification to a recipient.
 */
export async function sendNotification(params: SendNotificationParams) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, publicKey: true },
  })

  if (!user || !user.publicKey) {
    throw new Error(`Recipient user ${params.userId} has no public key.`)
  }

  const { kemCiphertext, encryptedData } = encryptNotificationContent(
    params.content,
    user.publicKey
  )

  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      app: params.app,
      category: params.category,
      type: params.type || "INFO",
      priority: params.priority || "NORMAL",
      actionStatus: params.type && params.type !== "INFO" ? "PENDING" : null,
      actionPayload: (params.actionPayload as any) ?? null,
      actionHandler: params.actionHandler ?? null,
      kemCiphertext,
      encryptedData,
      expiresAt: params.expiresAt ?? null,
    },
  })

  // Real-time WebSocket push to active user sessions
  wsHub.sendToUser(params.userId, "notification:new", {
    notification: {
      id: notification.id,
      userId: notification.userId,
      app: notification.app,
      category: notification.category,
      type: notification.type,
      priority: notification.priority,
      isRead: notification.isRead,
      readAt: notification.readAt,
      actionStatus: notification.actionStatus,
      actionPayload: notification.actionPayload,
      actionHandler: notification.actionHandler,
      kemCiphertext: notification.kemCiphertext,
      encryptedData: notification.encryptedData,
      expiresAt: notification.expiresAt,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    },
  })

  return notification
}
