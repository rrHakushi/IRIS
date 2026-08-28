import { defineRoute, t } from "../../../../router";
import { wsHub } from "../../../../services/websocket-hub";

export default defineRoute({
  POST: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          markedCount: t.Number(),
          unreadCount: t.Number(),
        }),
      },
    },
    async handler({ session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const userId = session.user.id;

      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      wsHub.sendToUser(userId, "notification:mark-all-read", {
        markedCount: result.count,
        unreadCount: 0,
      });

      return {
        success: true,
        markedCount: result.count,
        unreadCount: 0,
      };
    },
  },
});
