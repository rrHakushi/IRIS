import { defineRoute, t } from "@/router"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
    query: t.Optional(
      t.Object({
        type: t.Optional(t.String()),
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

  async GET({ params, query, prisma, cache }) {
    return {
      success: true,
      message: `GET /user/${params.username}/reviews handled successfully`,
      timestamp: new Date().toISOString(),
    }
  },
})
