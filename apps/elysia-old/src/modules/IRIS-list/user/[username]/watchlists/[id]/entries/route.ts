import { defineRoute, t } from "@/router"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.String(),
    }),
    body: t.Optional(
      t.Object({
        mediaType: t.String(),
        mediaId: t.Number({ minimum: 1 }),
        customNotes: t.Optional(t.String()),
        order: t.Optional(t.Number()),
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

  async POST({ params, body, session, prisma }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    return {
      success: true,
      message: `POST /user/${params.username}/watchlists/${params.id}/entries handled successfully`,
      timestamp: new Date().toISOString(),
    }
  },

  async DELETE({ params, body, session, prisma }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    return {
      success: true,
      message: `DELETE /user/${params.username}/watchlists/${params.id}/entries handled successfully`,
      timestamp: new Date().toISOString(),
    }
  },
})
