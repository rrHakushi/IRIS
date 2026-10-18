import { defineRoute, t } from "@/router"
import { getServarrAdapterAndCredentials } from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        movieId: t.Numeric(),
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
        summary: "Preview Radarr movie renaming",
        description:
          "Returns preview diff of proposed filename changes for movie.",
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
          message: res.error,
        }
      }
      if (res.error) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          records: [],
          message: res.error,
        }
      }

      try {
        const records = await res.adapter.getRenamePreview(res.credentials, {
          movieId: Number(query.movieId),
        })

        return {
          success: true,
          connected: true,
          provider: "RADARR",
          records: Array.isArray(records) ? records : [],
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          records: [],
          message: err.message || "Failed to preview Radarr file rename",
        }
      }
    },
  },

  POST: {
    schema: {
      body: t.Object({
        movieId: t.Number(),
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
        summary: "Execute Radarr file rename",
        description:
          "Applies standard naming conventions to selected movie files.",
        tags: ["Servarr", "Radarr"],
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
        await res.adapter.executeCommand(res.credentials, {
          name: "RenameFiles",
          movieId: body.movieId,
          files: body.files,
        })

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
          message: err.message || "Failed to execute Radarr file rename",
        }
      }
    },
  },
})
