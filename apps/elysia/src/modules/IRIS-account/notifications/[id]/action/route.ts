import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { defineRoute, t } from "../../../../../router"
import { wsHub } from "../../../../../services/websocket-hub"
import type {
  NotificationActionContext,
  NotificationActionResult,
  NotificationActionHandler,
} from "./actions/types"

/**
 * Dynamically resolves and executes an action handler by mapping handler name dots to hyphens:
 * e.g. "lists.comment.reply" -> "./actions/lists-comment-reply.ts"
 * e.g. "auth.quickconnect.approve" -> "./actions/auth-quickconnect-approve.ts"
 */
async function executeNotificationAction(
  handlerName: string,
  ctx: NotificationActionContext
): Promise<NotificationActionResult> {
  const baseName = handlerName.replace(/\./g, "-")
  const actionDir = path.join(__dirname, "actions")
  const candidates = [
    path.join(actionDir, `${baseName}.ts`),
    path.join(actionDir, `${baseName}.js`),
  ]

  let handler: NotificationActionHandler | null = null

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const mod = await import(pathToFileURL(candidate).href)
        handler = mod.default || null
        if (handler) break
      } catch (importErr) {
        console.error(
          `[NotificationAction] Failed to import action handler at '${candidate}':`,
          importErr
        )
      }
    }
  }

  if (!handler) {
    console.warn(
      `[NotificationAction] No handler file found for action '${handlerName}' (checked: ${candidates.join(", ")})`
    )
    return { success: true }
  }

  try {
    const result = await handler(ctx)
    return result || { success: true }
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Notification action execution failed"
    console.error(`[NotificationAction] Error executing '${handlerName}':`, err)
    return { success: false, error: errorMsg }
  }
}

export default defineRoute({
  POST: {
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        action: t.String({ minLength: 1 }),
        payload: t.Optional(t.Any()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          id: t.String(),
          actionStatus: t.String(),
          actionPayload: t.Nullable(t.Any()),
          isRead: t.Boolean(),
          unreadCount: t.Number(),
          message: t.Optional(t.String()),
        }),
      },
    },
    async handler({ session, params, body, prisma, cache }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const notification = await prisma.notification.findUnique({
        where: { id: params.id },
      })

      if (!notification || notification.userId !== session.user.id) {
        return new Response(
          JSON.stringify({
            error: "NotFound",
            message: "Notification not found",
          }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      // 1. Determine resolved action status
      const actionUpper = body.action.toUpperCase()
      let resolvedStatus: "CONFIRMED" | "REJECTED" | "SUBMITTED" = "SUBMITTED"
      if (
        actionUpper === "CONFIRM" ||
        actionUpper === "APPROVE" ||
        actionUpper === "ACCEPT"
      ) {
        resolvedStatus = "CONFIRMED"
      } else if (
        actionUpper === "REJECT" ||
        actionUpper === "DENY" ||
        actionUpper === "DECLINE" ||
        actionUpper === "CANCEL"
      ) {
        resolvedStatus = "REJECTED"
      }

      // 2. Delegate to registered action handler if specified
      let actionResultMsg: string | undefined
      let finalPayload = body.payload ?? null

      if (notification.actionHandler) {
        const result = await executeNotificationAction(
          notification.actionHandler,
          {
            notification,
            action: body.action,
            resolvedStatus,
            payload: body.payload,
            sessionUser: session.user,
            prisma,
            cache,
          }
        )

        if (result.resultPayload) {
          finalPayload = {
            ...(typeof finalPayload === "object" && finalPayload !== null
              ? finalPayload
              : {}),
            ...result.resultPayload,
          }
        }
        if (result.message) {
          actionResultMsg = result.message
        }
      }

      // 3. Persist resolved state and mark notification as read
      const updated = await prisma.notification.update({
        where: { id: params.id },
        data: {
          actionStatus: resolvedStatus,
          actionPayload: finalPayload,
          isRead: true,
          readAt: new Date(),
        },
      })

      const unreadCount = await prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      })

      // 4. Real-time broadcast update to all active sessions of this user
      wsHub.sendToUser(session.user.id, "notification:action-resolved", {
        id: updated.id,
        actionStatus: updated.actionStatus,
        actionPayload: updated.actionPayload,
        isRead: updated.isRead,
        unreadCount,
      })

      return {
        success: true,
        id: updated.id,
        actionStatus: updated.actionStatus!,
        actionPayload: updated.actionPayload,
        isRead: updated.isRead,
        unreadCount,
        message: actionResultMsg,
      }
    },
  },
})
