import { defineRoute, t } from "@/router"
import { getServarrAdapterAndCredentials } from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        term: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connected: t.Boolean(),
          provider: t.String(),
          records: t.Array(t.Any()),
          rootFolders: t.Optional(t.Array(t.Any())),
          qualityProfiles: t.Optional(t.Array(t.Any())),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Lookup series in Sonarr",
        description:
          "Searches for new TV series or anime to add, including root folders and quality profiles.",
        tags: ["Servarr", "Sonarr"],
      },
    },

    async handler({ query, session, prisma }: any) {
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
      if (!res.connected) {
        return {
          success: true,
          connected: false,
          provider: "SONARR",
          records: [],
          message: res.error,
        }
      }
      if (res.error) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          records: [],
          message: res.error,
        }
      }

      try {
        const [rootFolders, qualityProfiles] = await Promise.all([
          res.adapter.getRootFolders(res.credentials).catch(() => []),
          res.adapter.getQualityProfiles(res.credentials).catch(() => []),
        ])

        let records: any[] = []
        if (query?.term && query.term.trim()) {
          records = await res.adapter.lookupSeries(
            res.credentials,
            query.term.trim()
          )
        }

        return {
          success: true,
          connected: true,
          provider: "SONARR",
          records: Array.isArray(records) ? records : [],
          rootFolders,
          qualityProfiles,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          records: [],
          message: err.message || "Failed to lookup series in Sonarr",
        }
      }
    },
  },

  POST: {
    schema: {
      body: t.Any(),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connected: t.Boolean(),
          provider: t.String(),
          series: t.Optional(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Add series to Sonarr",
        description:
          "Adds a new series to Sonarr with specified root folder and quality profile.",
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
      if (!res.connected) {
        return {
          success: false,
          connected: false,
          provider: "SONARR",
          message: res.error,
        }
      }
      if (res.error) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          message: res.error,
        }
      }

      try {
        const series = await res.adapter.addSeries(res.credentials, body)
        return {
          success: true,
          connected: true,
          provider: "SONARR",
          series,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          message: err.message || "Failed to add series in Sonarr",
        }
      }
    },
  },
})
