import { defineRoute, t } from "@/router"
import { getServarrAdapterAndCredentials } from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  PUT: {
    schema: {
      body: t.Object({
        episodeIds: t.Array(t.Numeric()),
        monitored: t.Boolean(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connected: t.Boolean(),
          provider: t.String(),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Set episode monitoring in batch",
        description:
          "Enables or disables monitoring for a list of episode IDs.",
        tags: ["Servarr", "Sonarr"],
      },
    },

    async handler({ body, session, prisma }: any) {
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
        await res.adapter.setEpisodeMonitoring(
          res.credentials,
          body.episodeIds,
          body.monitored
        )
        return {
          success: true,
          connected: true,
          provider: "SONARR",
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          message: err.message || "Failed to update episode monitoring",
        }
      }
    },
  },
})
