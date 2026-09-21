import { defineRoute, t } from "@/router"
import { getServarrAdapterAndCredentials } from "@/modules/IRIS-servarr/helpers"

export default defineRoute({
  GET: {
    schema: {
      params: t.Object({
        id: t.Numeric(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connected: t.Boolean(),
          provider: t.String(),
          movie: t.Optional(t.Any()),
          files: t.Optional(t.Array(t.Any())),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Get Radarr movie details",
        description: "Fetches full movie data, media info, and disk files.",
        tags: ["Servarr", "Radarr"],
      },
    },

    async handler({ params, session, prisma }: any) {
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
          message: res.error,
        }
      }
      if (res.error) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          message: res.error,
        }
      }

      try {
        const movieId = Number(params.id)
        const [movie, files] = await Promise.all([
          res.adapter.getMovieById(res.credentials, movieId),
          res.adapter.getMovieFiles(res.credentials, movieId).catch(() => []),
        ])

        return {
          success: true,
          connected: true,
          provider: "RADARR",
          movie,
          files: Array.isArray(files) ? files : [],
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          message: err.message || "Failed to fetch Radarr movie details",
        }
      }
    },
  },

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
          movie: t.Optional(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Update Radarr movie",
        description:
          "Updates movie metadata, monitoring, or profile configuration.",
        tags: ["Servarr", "Radarr"],
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
        const movieId = Number(params.id)
        const updated = await res.adapter.updateMovie(res.credentials, {
          ...body,
          id: movieId,
        })
        return {
          success: true,
          connected: true,
          provider: "RADARR",
          movie: updated,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          message: err.message || "Failed to update Radarr movie",
        }
      }
    },
  },

  DELETE: {
    schema: {
      params: t.Object({
        id: t.Numeric(),
      }),
      query: t.Object({
        deleteFiles: t.Optional(t.BooleanString()),
        addImportListExclusion: t.Optional(t.BooleanString()),
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
        summary: "Delete Radarr movie",
        description: "Removes movie and optionally deletes files from disk.",
        tags: ["Servarr", "Radarr"],
      },
    },

    async handler({ params, query, session, prisma }: any) {
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
        const movieId = Number(params.id)
        const deleteFiles =
          query?.deleteFiles === "true" || query?.deleteFiles === true
        const addExclusion =
          query?.addImportListExclusion === "true" ||
          query?.addImportListExclusion === true
        await res.adapter.deleteMovie(
          res.credentials,
          movieId,
          deleteFiles,
          addExclusion
        )
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
          message: err.message || "Failed to delete Radarr movie",
        }
      }
    },
  },
})
