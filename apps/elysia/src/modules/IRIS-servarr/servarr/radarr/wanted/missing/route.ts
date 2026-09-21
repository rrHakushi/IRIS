import { defineRoute, t } from "@/router"
import { getServarrAdapterAndCredentials } from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
        sortKey: t.Optional(t.String()),
        sortDirection: t.Optional(
          t.Union([t.Literal("ascending"), t.Literal("descending")])
        ),
        monitored: t.Optional(t.BooleanString()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connected: t.Boolean(),
          provider: t.String(),
          page: t.Optional(t.Number()),
          pageSize: t.Optional(t.Number()),
          totalRecords: t.Optional(t.Number()),
          records: t.Array(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Get Radarr wanted missing movies",
        description:
          "Fetches released movies that are monitored without media files.",
        tags: ["Servarr", "Radarr"],
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
        "RADARR",
        session.user.id,
        prisma
      )
      if (!res.connected) {
        return {
          success: true,
          connected: false,
          provider: "RADARR",
          records: [],
          totalRecords: 0,
          message: res.error,
        }
      }
      if (res.error) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          records: [],
          totalRecords: 0,
          message: res.error,
        }
      }

      try {
        const data = await res.adapter.getWantedMissing(res.credentials, {
          page: query?.page || 1,
          pageSize: query?.pageSize || 50,
          sortKey: query?.sortKey || "physicalRelease",
          sortDirection: query?.sortDirection || "descending",
          monitored:
            query?.monitored !== undefined
              ? query.monitored === "true" || query.monitored === true
              : true,
        })

        const records = Array.isArray(data) ? data : data?.records || []
        const totalRecords =
          typeof data?.totalRecords === "number"
            ? data.totalRecords
            : records.length

        return {
          success: true,
          connected: true,
          provider: "RADARR",
          page: query?.page || 1,
          pageSize: query?.pageSize || 50,
          totalRecords,
          records,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          records: [],
          totalRecords: 0,
          message:
            err.message || "Failed to fetch wanted missing movies from Radarr",
        }
      }
    },
  },
})
