import { defineRoute, t } from "../../../router";
import { wsHub } from "../../../services/websocket-hub";

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        app: t.Optional(t.String()),
        category: t.Optional(t.String()),
        type: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        isRead: t.Optional(t.BooleanString()),
        limit: t.Optional(t.Numeric({ default: 50, minimum: 1, maximum: 100 })),
        offset: t.Optional(t.Numeric({ default: 0, minimum: 0 })),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          total: t.Number(),
          unreadCount: t.Number(),
          notifications: t.Array(
            t.Object({
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
            })
          ),
        }),
      },
    },
    async handler({ session, query, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const userId = session.user.id;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const where: any = { userId };

      if (query.app) {
        where.app = query.app;
      }
      if (query.category) {
        where.category = query.category;
      }
      if (query.type) {
        where.type = query.type as any;
      }
      if (query.priority) {
        where.priority = query.priority as any;
      }
      if (query.isRead !== undefined) {
        where.isRead = Boolean(query.isRead);
      }

      const [total, unreadCount, notifications] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, isRead: false } }),
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
      ]);

      return {
        success: true,
        total,
        unreadCount,
        notifications,
      };
    },
  },

  DELETE: {
    schema: {
      query: t.Object({
        onlyRead: t.Optional(t.BooleanString()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          deletedCount: t.Number(),
          unreadCount: t.Number(),
        }),
      },
    },
    async handler({ session, query, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const userId = session.user.id;
      const where: any = { userId };
      if (query.onlyRead) {
        where.isRead = true;
      }

      const result = await prisma.notification.deleteMany({ where });
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      wsHub.sendToUser(userId, "notification:bulk-delete", {
        deletedCount: result.count,
        unreadCount,
      });

      return {
        success: true,
        deletedCount: result.count,
        unreadCount,
      };
    },
  },
});
