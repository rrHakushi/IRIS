import { defineRoute, t } from "../../../../../router";
import { wsHub } from "../../../../../services/websocket-hub";

export default defineRoute({
  PATCH: {
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Optional(
        t.Object({
          isRead: t.Optional(t.Boolean()),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          id: t.String(),
          isRead: t.Boolean(),
          readAt: t.Nullable(t.Date()),
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
        select: { id: true, userId: true, isRead: true, readAt: true },
      });

      if (!notification || notification.userId !== session.user.id) {
        return new Response(
          JSON.stringify({ error: "NotFound", message: "Notification not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }

      // Marking as read is permanent and one-way
      if (!notification.isRead) {
        const updated = await prisma.notification.update({
          where: { id: params.id },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        });

        const unreadCount = await prisma.notification.count({
          where: { userId: session.user.id, isRead: false },
        });

        wsHub.sendToUser(session.user.id, "notification:update", {
          id: updated.id,
          isRead: true,
          readAt: updated.readAt,
          unreadCount,
        });

        return {
          success: true,
          id: updated.id,
          isRead: true,
          readAt: updated.readAt,
          unreadCount,
        };
      }

      const unreadCount = await prisma.notification.count({
        where: { userId: session.user.id, isRead: false },
      });

      return {
        success: true,
        id: notification.id,
        isRead: true,
        readAt: notification.readAt || new Date(),
        unreadCount,
      };
    },
  },
});
