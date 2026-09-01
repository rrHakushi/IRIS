import { defineRoute, t } from "@/router";

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
    body: t.Optional(
      t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        isPrivate: t.Optional(t.Boolean({ default: false })),
        coverImage: t.Optional(t.String()),
      })
    ),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        timestamp: t.String(),
      }),
    },
  },

  async GET({ params, prisma, cache }) {
    return {
      success: true,
      message: `GET /user/${params.username}/watchlists handled successfully`,
      timestamp: new Date().toISOString(),
    };
  },

  async POST({ params, body, session, prisma }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    return {
      success: true,
      message: `POST /user/${params.username}/watchlists handled successfully`,
      timestamp: new Date().toISOString(),
    };
  },
});
