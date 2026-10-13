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
        summary: "Lookup movies in Radarr",
        description:
          "Searches for new movies to add, including root folders and quality profiles.",
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
        const [rootFolders, qualityProfiles] = await Promise.all([
          res.adapter.getRootFolders(res.credentials).catch(() => []),
          res.adapter.getQualityProfiles(res.credentials).catch(() => []),
        ])

        let records: any[] = []
        if (query?.term && query.term.trim()) {
          records = await res.adapter.lookupMovies(
            res.credentials,
            query.term.trim()
          )
        }

        return {
          success: true,
          connected: true,
          provider: "RADARR",
          records: Array.isArray(records) ? records : [],
          rootFolders,
          qualityProfiles,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          records: [],
          message: err.message || "Failed to lookup movies in Radarr",
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
          movie: t.Optional(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Add movie to Radarr",
        description:
          "Adds a new movie to Radarr with specified root folder and quality profile.",
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
      if (!res.connected) {
        return {
          success: false,
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
        const movie = await res.adapter.addMovie(res.credentials, body)
        return {
          success: true,
          connected: true,
          provider: "RADARR",
          movie,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          message: err.message || "Failed to add movie in Radarr",
        }
      }
    },
  },
})
