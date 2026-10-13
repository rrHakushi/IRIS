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
        summary: "Get Radarr blocklist",
        description:
          "Fetches blacklisted releases that failed or were manually rejected.",
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
        const data = await res.adapter.getBlocklist(res.credentials, {
          page: query?.page || 1,
          pageSize: query?.pageSize || 50,
          sortKey: query?.sortKey || "date",
          sortDirection: query?.sortDirection || "descending",
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
          message: err.message || "Failed to fetch blocklist from Radarr",
        }
      }
    },
  },

  DELETE: {
    schema: {
      query: t.Object({
        id: t.Optional(t.Numeric()),
      }),
      body: t.Optional(
        t.Object({
          ids: t.Optional(t.Array(t.Number())),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connected: t.Boolean(),
          provider: t.String(),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Remove from Radarr blocklist",
        description:
          "Removes one or more releases from the blocklist to allow re-downloading.",
        tags: ["Servarr", "Radarr"],
      },
    },

    async handler({ query, body, session, prisma }: any) {
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
          connected: !!res.connected,
          provider: "RADARR",
          message: res.error,
        }
      }

      try {
        if (body?.ids && Array.isArray(body.ids) && body.ids.length > 0) {
          await res.adapter.deleteBlocklistBulk(res.credentials, body.ids)
        } else if (query?.id) {
          await res.adapter.deleteBlocklist(res.credentials, query.id)
        } else {
          return {
            success: false,
            connected: true,
            provider: "RADARR",
            message: "No blocklist ID or ids array provided",
          }
        }

        return {
          success: true,
          connected: true,
          provider: "RADARR",
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          message: err.message || "Failed to remove item from blocklist",
        }
      }
    },
  },
})
