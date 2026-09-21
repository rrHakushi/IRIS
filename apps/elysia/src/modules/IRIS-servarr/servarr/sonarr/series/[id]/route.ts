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
          series: t.Optional(t.Any()),
          episodes: t.Optional(t.Array(t.Any())),
          files: t.Optional(t.Array(t.Any())),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Get Sonarr series details",
        description:
          "Fetches full series data, season/episode list, and episode files.",
        tags: ["Servarr", "Sonarr"],
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
        "SONARR",
        session.user.id,
        prisma
      )
      if (!res.connected) {
        return {
          success: true,
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
        const seriesId = Number(params.id)
        const [series, episodes, files] = await Promise.all([
          res.adapter.getSeriesById(res.credentials, seriesId),
          res.adapter.getEpisodes(res.credentials, seriesId).catch(() => []),
          res.adapter
            .getEpisodeFiles(res.credentials, seriesId)
            .catch(() => []),
        ])

        return {
          success: true,
          connected: true,
          provider: "SONARR",
          series,
          episodes: Array.isArray(episodes) ? episodes : [],
          files: Array.isArray(files) ? files : [],
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          message: err.message || "Failed to fetch Sonarr series details",
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
          series: t.Optional(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Update Sonarr series",
        description:
          "Updates series metadata, monitoring, or profile configuration.",
        tags: ["Servarr", "Sonarr"],
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
        const seriesId = Number(params.id)
        const updated = await res.adapter.updateSeries(res.credentials, {
          ...body,
          id: seriesId,
        })
        return {
          success: true,
          connected: true,
          provider: "SONARR",
          series: updated,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          message: err.message || "Failed to update Sonarr series",
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
        summary: "Delete Sonarr series",
        description: "Removes series and optionally deletes files from disk.",
        tags: ["Servarr", "Sonarr"],
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
        const seriesId = Number(params.id)
        const deleteFiles =
          query?.deleteFiles === "true" || query?.deleteFiles === true
        const addExclusion =
          query?.addImportListExclusion === "true" ||
          query?.addImportListExclusion === true
        await res.adapter.deleteSeries(
          res.credentials,
          seriesId,
          deleteFiles,
          addExclusion
        )
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
          message: err.message || "Failed to delete Sonarr series",
        }
      }
    },
  },
})
