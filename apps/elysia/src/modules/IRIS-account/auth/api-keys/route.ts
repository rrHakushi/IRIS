import { randomBytes } from "node:crypto";
import { defineRoute, t } from "../../../../router";
import { hashApiKey } from "../../../../plugins/session";

export default defineRoute({
  GET: {
    schema: {
      query: t.Optional(
        t.Object({
          limit: t.Optional(t.Number({ default: 50 })),
          page: t.Optional(t.Number({ default: 1 })),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          apiKeys: t.Array(
            t.Object({
              id: t.String(),
              name: t.String(),
              prefix: t.String(),
              createdAt: t.String(),
              updatedAt: t.String(),
              lastUsedAt: t.Nullable(t.String()),
              expiresAt: t.Nullable(t.String()),
            })
          ),
        }),
      },
    },
    async handler({ session, prisma }) {
      if (!session.isAuthenticated) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const user = session.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "User session not found" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const keys = await prisma.apiKey.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          prefix: true,
          createdAt: true,
          updatedAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      });

      return {
        success: true,
        apiKeys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          createdAt: k.createdAt.toISOString(),
          updatedAt: k.updatedAt.toISOString(),
          lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
          expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
        })),
      };
    },
  },

  POST: {
    schema: {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 64 }),
        expirationDays: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          rawKey: t.String(),
          apiKey: t.Object({
            id: t.String(),
            name: t.String(),
            prefix: t.String(),
            createdAt: t.String(),
            updatedAt: t.String(),
            lastUsedAt: t.Nullable(t.String()),
            expiresAt: t.Nullable(t.String()),
          }),
        }),
      },
    },
    async handler({ body, session, prisma }) {
      if (!session.isAuthenticated) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const user = session.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "User session not found" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const rawName = (body.name || "").trim();
      if (!rawName) {
        return new Response(
          JSON.stringify({ error: "BadRequest", message: "API key name is required" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      const entropy = randomBytes(24).toString("hex");
      const rawKey = `iris-key-${entropy}`;
      const keyHash = hashApiKey(rawKey);
      const prefix = rawKey.slice(0, 17); // e.g. "iris-key-12345678"

      let expiresAt: Date | null = null;
      if (
        typeof body.expirationDays === "number" &&
        body.expirationDays > 0
      ) {
        expiresAt = new Date(Date.now() + body.expirationDays * 24 * 60 * 60 * 1000);
      }

      const created = await prisma.apiKey.create({
        data: {
          userId: user.id,
          name: rawName.slice(0, 64),
          prefix,
          hash: keyHash,
          expiresAt,
        },
        select: {
          id: true,
          name: true,
          prefix: true,
          createdAt: true,
          updatedAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      });

      return {
        success: true,
        rawKey,
        apiKey: {
          id: created.id,
          name: created.name,
          prefix: created.prefix,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
          lastUsedAt: created.lastUsedAt ? created.lastUsedAt.toISOString() : null,
          expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
        },
      };
    },
  },
});
