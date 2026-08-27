import { defineRoute, t } from "../../../../router";

export default defineRoute({
  schema: {
    query: t.Optional(
      t.Object({
        limit: t.Optional(t.Number({ default: 20 })),
        page: t.Optional(t.Number({ default: 1 })),
      })
    ),
    response: {
      200: t.Object({
        success: t.Boolean(),
        passkeys: t.Array(
          t.Object({
            id: t.String(),
            name: t.Nullable(t.String()),
            createdAt: t.String(),
            transports: t.Array(t.String()),
          })
        ),
      }),
    },
  },

  async GET({ query, session, prisma, cache }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    return {
      success: true,
      passkeys: [],
    };
  },
});
