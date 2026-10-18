import { defineRoute, t } from "@/router"
import { getServarrAdapterAndCredentials } from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  PUT: {
    schema: {
      params: t.Object({
        id: t.Numeric(),
      }),
      body: t.Any(),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connected: t.Boolean(),
          provider: t.String(),
          episode: t.Optional(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Update Sonarr episode",
        description: "Updates episode properties, including monitoring status.",
        tags: ["Servarr", "Sonarr"],
      },
    },

    async handler({ params, body, session, prisma }: any) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const res = await getServarrAdapterAndCredentials(
        "SONARR",
        session.user.id,
        prisma
      )
      if (!res.connected || res.error) {
        return {
          success: false,
          connected: !!res.connected,
          provider: "SONARR",
          message: res.error,
        }
      }

      try {
        const episodeId = Number(params.id)
        const updated = await res.adapter.updateEpisode(res.credentials, {
          ...body,
          id: episodeId,
        })
        return {
          success: true,
          connected: true,
          provider: "SONARR",
          episode: updated,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          message: err.message || "Failed to update Sonarr episode",
        }
      }
    },
  },
})
