import { randomBytes } from "node:crypto";
import { defineRoute, t } from "../../../../../../router";
import { hashApiKey, invalidateApiKeyCache } from "../../../../../../plugins/session";

export default defineRoute({
  POST: {
    schema: {
      params: t.Object({
        id: t.String(),
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
    async handler({ params, session, prisma }) {
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

      const existing = await prisma.apiKey.findFirst({
        where: { id: params.id, userId: user.id },
      });

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "NotFound", message: "API key not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }

      // Purge old key hash from in-memory cache immediately
      if (existing.hash) {
        invalidateApiKeyCache(existing.hash);
      }
      invalidateApiKeyCache(existing.id);

      const entropy = randomBytes(24).toString("hex");
      const rawKey = `iris-key-${entropy}`;
      const keyHash = hashApiKey(rawKey);
      const prefix = rawKey.slice(0, 17);

      const updated = await prisma.apiKey.update({
        where: { id: existing.id },
        data: {
          hash: keyHash,
          prefix,
          lastUsedAt: null, // Reset last used timestamp on regeneration
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
          id: updated.id,
          name: updated.name,
          prefix: updated.prefix,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          lastUsedAt: updated.lastUsedAt ? updated.lastUsedAt.toISOString() : null,
          expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
        },
      };
    },
  },
});
