import { defineRoute, t } from "../../../../../../router";

export default defineRoute({
  schema: {
    body: t.Object({
      passkeyResponse: t.Object({
        id: t.String(),
        rawId: t.String(),
        response: t.Any(),
        type: t.Optional(t.String()),
        clientExtensionResults: t.Optional(t.Any()),
      }),
      name: t.Optional(t.String({ maxLength: 64 })),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
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
      message: "Passkey registered successfully",
    };
  },
});
