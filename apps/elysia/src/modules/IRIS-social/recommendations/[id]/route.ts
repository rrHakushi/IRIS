import { defineRoute, t } from "@/router";

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        timestamp: t.String(),
      }),
    },
  },

  async DELETE({ params, session, prisma }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    return {
      success: true,
      message: `DELETE /recommendations/${params.id} handled successfully`,
      timestamp: new Date().toISOString(),
    };
  },
});
