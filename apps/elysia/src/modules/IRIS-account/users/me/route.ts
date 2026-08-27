import { defineRoute, t } from "../../../../router";

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          user: t.Object({
            id: t.String(),
            username: t.String(),
            email: t.String(),
            customization: t.Nullable(t.Any()),
            settings: t.Nullable(t.Any()),
            permissions: t.Array(t.Number()),
            TOTPEnabled: t.Boolean(),
            emailMfaEnabled: t.Boolean(),
            publicKey: t.Nullable(t.String()),
            createdAt: t.String(),
            updatedAt: t.String(),
          }),
        }),
      },
    },
    async handler({ session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Session expired" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          username: true,
          email: true,
          customization: true,
          settings: true,
          permissions: true,
          TOTPEnabled: true,
          emailMfaEnabled: true,
          publicKey: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return new Response(
          JSON.stringify({ error: "Not Found", message: "User not found" }),
          {
            status: 404,
            headers: { "content-type": "application/json" },
          }
        );
      }

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username.trim(),
          email: user.email,
          customization: user.customization,
          settings: user.settings,
          permissions: user.permissions,
          TOTPEnabled: user.TOTPEnabled,
          emailMfaEnabled: user.emailMfaEnabled,
          publicKey: user.publicKey,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      };
    },
  },

  PATCH: {
    schema: {
      body: t.Optional(
        t.Object({
          customization: t.Optional(t.Any()),
          settings: t.Optional(t.Any()),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          user: t.Object({
            id: t.String(),
            username: t.String(),
            email: t.String(),
            customization: t.Nullable(t.Any()),
            settings: t.Nullable(t.Any()),
            permissions: t.Array(t.Number()),
            TOTPEnabled: t.Boolean(),
            emailMfaEnabled: t.Boolean(),
            publicKey: t.Nullable(t.String()),
            createdAt: t.String(),
            updatedAt: t.String(),
          }),
        }),
      },
    },
    async handler({ body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Session expired" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          }
        );
      }

      const updateData: Record<string, unknown> = {};
      if (body?.customization !== undefined) {
        updateData.customization = body.customization;
      }
      if (body?.settings !== undefined) {
        updateData.settings = body.settings;
      }

      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          customization: true,
          settings: true,
          permissions: true,
          TOTPEnabled: true,
          emailMfaEnabled: true,
          publicKey: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username.trim(),
          email: updatedUser.email,
          customization: updatedUser.customization,
          settings: updatedUser.settings,
          permissions: updatedUser.permissions,
          TOTPEnabled: updatedUser.TOTPEnabled,
          emailMfaEnabled: updatedUser.emailMfaEnabled,
          publicKey: updatedUser.publicKey,
          createdAt: updatedUser.createdAt.toISOString(),
          updatedAt: updatedUser.updatedAt.toISOString(),
        },
      };
    },
  },
});
