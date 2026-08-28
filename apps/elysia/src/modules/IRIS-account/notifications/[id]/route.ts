import { defineRoute, t } from "../../../../router";
import { wsHub } from "../../../../services/websocket-hub";

export default defineRoute({
  GET: {
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          notification: t.Object({
            id: t.String(),
            userId: t.String(),
            app: t.String(),
            category: t.String(),
            type: t.String(),
            priority: t.String(),
            isRead: t.Boolean(),
            readAt: t.Nullable(t.Date()),
            actionStatus: t.Nullable(t.String()),
            actionPayload: t.Nullable(t.Any()),
            actionHandler: t.Nullable(t.String()),
            kemCiphertext: t.String(),
            encryptedData: t.String(),
            expiresAt: t.Nullable(t.Date()),
            createdAt: t.Date(),
            updatedAt: t.Date(),
          }),
        }),
      },
    },
    async handler({ session, params, prisma }) {
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

      return {
        success: true,
        notification,
      };
    },
  },

  DELETE: {
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          id: t.String(),
          unreadCount: t.Number(),
        }),
      },
    },
    async handler({ session, params, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const notification = await prisma.notification.findUnique({
        where: { id: params.id },
        select: { id: true, userId: true },
      });

      if (!notification || notification.userId !== session.user.id) {
        return new Response(
          JSON.stringify({ error: "NotFound", message: "Notification not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }

      await prisma.notification.delete({
        where: { id: params.id },
      });

      const unreadCount = await prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      });

      wsHub.sendToUser(session.user.id, "notification:delete", {
        id: params.id,
        unreadCount,
      });

      return {
        success: true,
        id: params.id,
        unreadCount,
      };
    },
  },
});
