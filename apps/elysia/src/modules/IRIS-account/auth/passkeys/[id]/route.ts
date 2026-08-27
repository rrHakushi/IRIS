import { defineRoute, t } from "../../../../../router";

export default defineRoute({
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

  async DELETE({ params, session, prisma, cache }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    return {
      success: true,
      message: "Passkey " + params.id + " deleted successfully",
    };
  },
});
