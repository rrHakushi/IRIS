import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    body: t.Object({
      code: t.String({ minLength: 6, maxLength: 64 }),
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
      message: "Device approved successfully",
    };
  },
});
