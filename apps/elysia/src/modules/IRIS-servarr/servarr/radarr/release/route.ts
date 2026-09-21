import { defineRoute, t } from "@/router"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionCredentials,
} from "@IRIS/connections"

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        movieId: t.Optional(t.Numeric()),
        term: t.Optional(t.String()),
        indexerId: t.Optional(t.Numeric()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          provider: t.String(),
          releases: t.Array(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Search Radarr releases (Interactive Search)",
        description: "Searches indexers for available releases of a movie.",
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

      const connection = await prisma.connection.findFirst({
        where: {
          userId: session.user.id,
          provider: "RADARR",
          status: "CONNECTED",
        },
      })

      if (!connection) {
        return {
          success: false,
          provider: "RADARR",
          releases: [],
          message: "No active Radarr connection found",
        }
      }

      let credentials: ConnectionCredentials
      try {
        credentials = decryptConnectionData<ConnectionCredentials>(
          connection.encryptedData,
          session.user.id
        )
      } catch {
        return {
          success: false,
          provider: "RADARR",
          releases: [],
          message: "Failed to decrypt credentials",
        }
      }

      try {
        const adapter = getConnectionAdapter("RADARR") as any
        const releases = await adapter.getReleases(credentials, {
          movieId: query?.movieId ? Number(query.movieId) : undefined,
          term: query?.term || undefined,
          indexerId: query?.indexerId ? Number(query.indexerId) : undefined,
        })

        return {
          success: true,
          provider: "RADARR",
          releases: Array.isArray(releases) ? releases : [],
        }
      } catch (err: any) {
        return {
          success: false,
          provider: "RADARR",
          releases: [],
          message: err?.message || "Failed to fetch releases",
        }
      }
    },
  },

  POST: {
    schema: {
      body: t.Object({
        guid: t.Optional(t.String()),
        indexerId: t.Optional(t.Number()),
        title: t.Optional(t.String()),
        downloadUrl: t.Optional(t.String()),
        protocol: t.Optional(t.String()),
        publishDate: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Optional(t.Any()),
        }),
      },
      detail: {
        summary: "Grab / Download release in Radarr",
        description:
          "Instructs Radarr to download a specific release from an indexer.",
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

      const connection = await prisma.connection.findFirst({
        where: {
          userId: session.user.id,
          provider: "RADARR",
          status: "CONNECTED",
        },
      })

      if (!connection) {
        return {
          success: false,
          message: "No active Radarr connection found",
        }
      }

      let credentials: ConnectionCredentials
      try {
        credentials = decryptConnectionData<ConnectionCredentials>(
          connection.encryptedData,
          session.user.id
        )
      } catch {
        return {
          success: false,
          message: "Failed to decrypt credentials",
        }
      }

      try {
        const adapter = getConnectionAdapter("RADARR") as any
        const result = await adapter.downloadRelease(credentials, body)

        return {
          success: true,
          message: "Release grabbed and queued for download",
          data: result,
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "Failed to grab release",
        }
      }
    },
  },
})
