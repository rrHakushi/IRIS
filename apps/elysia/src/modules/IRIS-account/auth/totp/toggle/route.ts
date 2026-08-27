import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    body: t.Object({
      enabled: t.Boolean(),
      code: t.Optional(t.String({ minLength: 6, maxLength: 6 })),
      password: t.Optional(t.String({ minLength: 1 })),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        backupCodes: t.Optional(t.Array(t.String())),
      }),
    },
  },

  async POST({ body, session, prisma, cache }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    return {
      success: true,
      message: body.enabled ? "TOTP has been enabled" : "TOTP has been disabled",
      backupCodes: body.enabled ? [] : undefined,
    };
  },
});
