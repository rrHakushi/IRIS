import { defineRoute, t } from "../../../../../router"

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.String(),
    }),
  },

  GET: {
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          app: t.Any(),
        }),
      },
    },
    async handler({ params, session, prisma }) {
      const user = session.requireUser()

      const app = await prisma.oAuthClient.findFirst({
        where: { id: params.id, userId: user.id },
        select: {
          id: true,
          clientId: true,
          name: true,
          description: true,
          logoUrl: true,
          websiteUrl: true,
          redirectUris: true,
          allowedScopes: true,
          isPublic: true,
          isTrusted: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              consents: true,
              accessTokens: true,
            },
          },
        },
      })

      if (!app) {
        return new Response(
          JSON.stringify({ error: "Application not found or unauthorized" }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      return {
        success: true,
        app: {
          ...app,
          createdAt: app.createdAt.toISOString(),
          updatedAt: app.updatedAt.toISOString(),
          authorizedUsersCount: app._count.consents,
          activeTokensCount: app._count.accessTokens,
        },
      }
    },
  },

  PUT: {
    requireAuth: true,
    schema: {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        websiteUrl: t.Optional(t.Nullable(t.String())),
        logoUrl: t.Optional(t.Nullable(t.String())),
        redirectUris: t.Optional(t.Array(t.String({ minLength: 1 }))),
        allowedScopes: t.Optional(t.Array(t.String())),
        isPublic: t.Optional(t.Boolean()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          app: t.Any(),
        }),
      },
    },
    async handler({ params, body, session, prisma }) {
      const user = session.requireUser()

      const existing = await prisma.oAuthClient.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Application not found or unauthorized" }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      const updated = await prisma.oAuthClient.update({
        where: { id: existing.id },
        data: {
          name: body.name !== undefined ? body.name : undefined,
          description: body.description !== undefined ? body.description : undefined,
          websiteUrl: body.websiteUrl !== undefined ? body.websiteUrl : undefined,
          logoUrl: body.logoUrl !== undefined ? body.logoUrl : undefined,
          redirectUris: body.redirectUris !== undefined ? body.redirectUris : undefined,
          allowedScopes: body.allowedScopes !== undefined ? body.allowedScopes : undefined,
          isPublic: body.isPublic !== undefined ? body.isPublic : undefined,
        },
      })

      return {
        success: true,
        app: {
          id: updated.id,
          clientId: updated.clientId,
          name: updated.name,
          description: updated.description,
          websiteUrl: updated.websiteUrl,
          logoUrl: updated.logoUrl,
          redirectUris: updated.redirectUris,
          allowedScopes: updated.allowedScopes,
          isPublic: updated.isPublic,
          updatedAt: updated.updatedAt.toISOString(),
        },
      }
    },
  },

  DELETE: {
    requireAuth: true,
    async handler({ params, session, prisma }) {
      const user = session.requireUser()

      const existing = await prisma.oAuthClient.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Application not found or unauthorized" }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      await prisma.oAuthClient.delete({
        where: { id: existing.id },
      })

      return {
        success: true,
        message: "Application and associated tokens deleted successfully",
      }
    },
  },
})
