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
        summary: "Get Sonarr cutoff unmet episodes",
        description:
          "Fetches episodes whose file quality is below the profile cutoff.",
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
          totalRecords: 0,
          message: res.error,
        }
      }
      if (res.error) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          records: [],
          totalRecords: 0,
          message: res.error,
        }
      }

      try {
        const data = await res.adapter.getWantedCutoff(res.credentials, {
          page: query?.page || 1,
          pageSize: query?.pageSize || 50,
          sortKey: query?.sortKey || "airDateUtc",
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
          provider: "SONARR",
          page: query?.page || 1,
          pageSize: query?.pageSize || 50,
          totalRecords,
          records,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          records: [],
          totalRecords: 0,
          message:
            err.message || "Failed to fetch cutoff unmet episodes from Sonarr",
        }
      }
    },
  },
})
