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
        seriesId: t.Numeric(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          provider: t.String(),
          seriesId: t.Number(),
          files: t.Array(t.Any()),
          episodes: t.Optional(t.Array(t.Any())),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Get Sonarr episode files",
        description:
          "Fetches episode files and media info for a series in Sonarr.",
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

      const connection = await prisma.connection.findFirst({
        where: {
          userId: session.user.id,
          provider: "SONARR",
          status: "CONNECTED",
        },
      })

      if (!connection) {
        return {
          success: false,
          provider: "SONARR",
          seriesId: Number(query.seriesId),
          files: [],
          message: "No active Sonarr connection found",
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
          provider: "SONARR",
          seriesId: Number(query.seriesId),
          files: [],
          message: "Failed to decrypt credentials",
        }
      }

      try {
        const adapter = getConnectionAdapter("SONARR") as any
        const [files, episodes] = await Promise.all([
          adapter
            .getEpisodeFiles(credentials, Number(query.seriesId))
            .catch(() => []),
          adapter
            .getEpisodes(credentials, Number(query.seriesId))
            .catch(() => []),
        ])

        return {
          success: true,
          provider: "SONARR",
          seriesId: Number(query.seriesId),
          files: Array.isArray(files) ? files : [],
          episodes: Array.isArray(episodes) ? episodes : [],
        }
      } catch (err: any) {
        return {
          success: false,
          provider: "SONARR",
          seriesId: Number(query.seriesId),
          files: [],
          message: err?.message || "Failed to fetch episode files",
        }
      }
    },
  },

  DELETE: {
    schema: {
      query: t.Object({
        fileId: t.Numeric(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete Sonarr episode file",
        description:
          "Deletes a specific episode media file from disk via Sonarr.",
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

      const connection = await prisma.connection.findFirst({
        where: {
          userId: session.user.id,
          provider: "SONARR",
          status: "CONNECTED",
        },
      })

      if (!connection) {
        return {
          success: false,
          message: "No active Sonarr connection found",
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
        const adapter = getConnectionAdapter("SONARR") as any
        await adapter.deleteEpisodeFile(credentials, Number(query.fileId))

        return {
          success: true,
          message: "Episode file deleted successfully",
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "Failed to delete episode file",
        }
      }
    },
  },
})
