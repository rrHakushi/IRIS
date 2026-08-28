import { defineRoute, t } from "../../../../../router";
import { wsHub } from "../../../../../services/websocket-hub";
import { executeNotificationAction } from "./actions";

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
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const notification = await prisma.notification.findUnique({
        where: { id: params.id },
      });

      if (!notification || notification.userId !== session.user.id) {
        return new Response(
          JSON.stringify({ error: "NotFound", message: "Notification not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }

      // 1. Determine resolved action status
      const actionUpper = body.action.toUpperCase();
      let resolvedStatus: "CONFIRMED" | "REJECTED" | "SUBMITTED" = "SUBMITTED";
      if (actionUpper === "CONFIRM" || actionUpper === "APPROVE" || actionUpper === "ACCEPT") {
        resolvedStatus = "CONFIRMED";
      } else if (actionUpper === "REJECT" || actionUpper === "DENY" || actionUpper === "DECLINE" || actionUpper === "CANCEL") {
        resolvedStatus = "REJECTED";
      }

      // 2. Delegate to registered action handler if specified
      let actionResultMsg: string | undefined;
      let finalPayload = body.payload ?? null;

      if (notification.actionHandler) {
        const result = await executeNotificationAction(notification.actionHandler, {
          notification,
          action: body.action,
          resolvedStatus,
          payload: body.payload,
          sessionUser: session.user,
          prisma,
          cache,
        });

        if (result.resultPayload) {
          finalPayload = {
            ...(typeof finalPayload === "object" && finalPayload !== null ? finalPayload : {}),
            ...result.resultPayload,
          };
        }
        if (result.message) {
          actionResultMsg = result.message;
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
      });

      const unreadCount = await prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      });

      // 4. Real-time broadcast update to all active sessions of this user
      wsHub.sendToUser(session.user.id, "notification:action-resolved", {
        id: updated.id,
        actionStatus: updated.actionStatus,
        actionPayload: updated.actionPayload,
        isRead: updated.isRead,
        unreadCount,
      });

      return {
        success: true,
        id: updated.id,
        actionStatus: updated.actionStatus!,
        actionPayload: updated.actionPayload,
        isRead: updated.isRead,
        unreadCount,
        message: actionResultMsg,
      };
    },
  },
});
