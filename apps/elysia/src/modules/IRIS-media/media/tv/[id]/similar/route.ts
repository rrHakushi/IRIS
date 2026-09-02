import { defineRoute, t } from "../../../../../../router";

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    query: t.Optional(
      t.Object({
        limit: t.Optional(t.Number({ default: 20 })),
        page: t.Optional(t.Number({ default: 1 })),
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

  async GET({ params, query, session, prisma, cache }) {
    return {
      success: true,
      message: "GET /media/anime/[id]/similar handled successfully",
      timestamp: new Date().toISOString(),
    };
  },
});
