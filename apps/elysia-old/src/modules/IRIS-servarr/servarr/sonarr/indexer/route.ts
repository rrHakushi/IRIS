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
        summary: "Get Sonarr configured indexers",
        description: "Returns configured torrent/usenet indexers in Sonarr.",
        tags: ["Servarr", "Sonarr"],
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
        "SONARR",
        session.user.id,
        prisma
      )
      if (!res.connected || res.error) {
        return {
          success: false,
          provider: "SONARR",
          indexers: [],
          message: res.error || "Sonarr not connected",
        }
      }

      try {
        const indexers = await res.adapter.getIndexers(res.credentials)
        return {
          success: true,
          provider: "SONARR",
          indexers: Array.isArray(indexers) ? indexers : [],
        }
      } catch (err: any) {
        return {
          success: false,
          provider: "SONARR",
          indexers: [],
          message: err?.message || "Failed to fetch indexers",
        }
      }
    },
  },
})
