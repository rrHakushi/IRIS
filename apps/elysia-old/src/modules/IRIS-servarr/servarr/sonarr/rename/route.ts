import { defineRoute, t } from "@/router"
import { getServarrAdapterAndCredentials } from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        seriesId: t.Numeric(),
        seasonNumber: t.Optional(t.Numeric()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connected: t.Boolean(),
          provider: t.String(),
          records: t.Array(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Preview Sonarr episode renaming",
        description:
          "Returns preview diff of proposed filename changes for series or season.",
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
        const records = await res.adapter.getRenamePreview(res.credentials, {
          seriesId: Number(query.seriesId),
          seasonNumber:
            query.seasonNumber !== undefined
              ? Number(query.seasonNumber)
              : undefined,
        })

        return {
          success: true,
          connected: true,
          provider: "SONARR",
          records: Array.isArray(records) ? records : [],
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          records: [],
          message: err.message || "Failed to preview Sonarr file rename",
        }
      }
    },
  },

  POST: {
    schema: {
      body: t.Object({
        seriesId: t.Number(),
        files: t.Array(t.Number()),
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
        summary: "Execute Sonarr file rename",
        description:
          "Applies standard naming conventions to selected episode files.",
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
        await res.adapter.executeCommand(res.credentials, {
          name: "RenameFiles",
          seriesId: body.seriesId,
          files: body.files,
        })

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
          message: err.message || "Failed to execute Sonarr file rename",
        }
      }
    },
  },
})
