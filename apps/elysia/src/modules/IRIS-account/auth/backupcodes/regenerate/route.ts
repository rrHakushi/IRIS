import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    response: {
      200: t.Object({
        success: t.Boolean(),
        backupCodes: t.Array(t.String()),
      }),
    },
  },

  async POST({ session, prisma, cache }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    return {
      success: true,
      backupCodes: [],
    };
  },
});
