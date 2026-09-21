import { defineRoute, t } from "@/router"
import { getServarrAdapterAndCredentials } from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          provider: t.String(),
          indexers: t.Array(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Get Radarr configured indexers",
        description: "Returns configured torrent/usenet indexers in Radarr.",
        tags: ["Servarr", "Radarr"],
      },
    },

    async handler({ session, prisma }: any) {
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
        "RADARR",
        session.user.id,
        prisma
      )
      if (!res.connected || res.error) {
        return {
          success: false,
          provider: "RADARR",
          indexers: [],
          message: res.error || "Radarr not connected",
        }
      }

      try {
        const indexers = await res.adapter.getIndexers(res.credentials)
        return {
          success: true,
          provider: "RADARR",
          indexers: Array.isArray(indexers) ? indexers : [],
        }
      } catch (err: any) {
        return {
          success: false,
          provider: "RADARR",
          indexers: [],
          message: err?.message || "Failed to fetch indexers",
        }
      }
    },
  },
})
