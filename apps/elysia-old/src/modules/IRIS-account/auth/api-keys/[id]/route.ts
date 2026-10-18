import { defineRoute, t } from "../../../../../router"
import { invalidateApiKeyCache } from "../../../../../plugins/session"

export default defineRoute({
  PATCH: {
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 64 }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
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
    async handler({ params, body, session, prisma }) {
      if (!session.isAuthenticated) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const user = session.getUser()
      if (!user) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "User session not found",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const rawName = (body.name || "").trim()
      if (!rawName) {
        return new Response(
          JSON.stringify({
            error: "BadRequest",
            message: "API key name cannot be empty",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const existing = await prisma.apiKey.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "NotFound", message: "API key not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      const updated = await prisma.apiKey.update({
        where: { id: existing.id },
        data: { name: rawName.slice(0, 64) },
        select: {
          id: true,
          name: true,
          prefix: true,
          createdAt: true,
          updatedAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      })

      return {
        success: true,
        apiKey: {
          id: updated.id,
          name: updated.name,
          prefix: updated.prefix,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          lastUsedAt: updated.lastUsedAt
            ? updated.lastUsedAt.toISOString()
            : null,
          expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
        },
      }
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
          message: t.String(),
        }),
      },
    },
    async handler({ params, session, prisma }) {
      if (!session.isAuthenticated) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const user = session.getUser()
      if (!user) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "User session not found",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const existing = await prisma.apiKey.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "NotFound", message: "API key not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      // Purge key from in-memory cache immediately
      if (existing.hash) {
        invalidateApiKeyCache(existing.hash)
      }
      invalidateApiKeyCache(existing.id)

      await prisma.apiKey.delete({
        where: { id: existing.id },
      })

      return {
        success: true,
        message: `API key ${params.id} deleted successfully`,
      }
    },
  },
})
