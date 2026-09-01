import { defineRoute, t } from "@/router";

export default defineRoute({
  schema: {
    query: t.Optional(
      t.Object({
        q: t.Optional(t.String()),
        page: t.Optional(t.Number({ default: 1 })),
        limit: t.Optional(t.Number({ default: 20 })),
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

  async GET({ query, prisma, cache }) {
    return {
      success: true,
      message: `GET /search/games handled successfully`,
      timestamp: new Date().toISOString(),
    };
  },
});
