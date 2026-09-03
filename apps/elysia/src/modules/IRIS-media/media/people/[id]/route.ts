import { defineRoute, t } from "@/router"

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

  async GET({ params, prisma, cache }) {
    return {
      success: true,
      message: `GET /media/people/${params.id} handled successfully`,
      timestamp: new Date().toISOString(),
    }
  },
})
