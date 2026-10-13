import { Elysia } from "elysia"
import {
  sendNotification,
  encryptNotificationContent,
  decryptNotificationContent,
  logNotificationServiceStatus,
  type SendNotificationParams,
  type NotificationContent,
} from "../services/notification.service"

export type { SendNotificationParams, NotificationContent }

/**
 * Service interface exposed to Elysia routes for post-quantum encrypted notification dispatch.
 */
export interface NotificationService {
  /**
   * Creates, encrypts, persists to database, and broadcasts a notification via WebSockets.
   */
  send: typeof sendNotification

  /**
   * Encrypts notification content with recipient's ML-KEM-768 public key and AES-256-GCM.
   */
  encrypt: typeof encryptNotificationContent

  /**
   * Decrypts encrypted notification content using recipient's secret key.
   */
  decrypt: typeof decryptNotificationContent

  /**
   * Logs status of the notification service during boot.
   */
  logStatus: typeof logNotificationServiceStatus
}

/** Singleton notification service instance. */
export const notificationService: NotificationService = {
  send: sendNotification,
  encrypt: encryptNotificationContent,
  decrypt: decryptNotificationContent,
  logStatus: logNotificationServiceStatus,
}

/**
 * Elysia plugin that injects the post-quantum encrypted notification service
 * directly into the route handler context as `ctx.notifications`.
 *
 * @example
 * ```typescript
 * // In server setup:
 * app.use(notificationPlugin())
 *
 * // In route handlers:
 * export default defineRoute({
 *   DELETE: {
 *     requireAuth: true,
 *     async handler({ params, notifications }) {
 *       await notifications.send({
 *         userId: "user-id",
 *         app: "IRIS List",
 *         category: "Social",
 *         content: { title: "Deleted", body: "Item removed" },
 *       })
 *     }
 *   }
 * })
 * ```
 */
export const notificationPlugin = () =>
  new Elysia({ name: "iris-notifications" }).decorate(
    "notifications",
    notificationService
  )
