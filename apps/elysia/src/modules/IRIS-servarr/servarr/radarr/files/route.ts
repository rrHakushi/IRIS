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
        movieId: t.Numeric(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          provider: t.String(),
          movieId: t.Number(),
          files: t.Array(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Get Radarr movie files",
        description:
          "Fetches movie media files and media info for a movie in Radarr.",
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
          movieId: Number(query.movieId),
          files: [],
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
          movieId: Number(query.movieId),
          files: [],
          message: "Failed to decrypt credentials",
        }
      }

      try {
        const adapter = getConnectionAdapter("RADARR") as any
        const files = await adapter.getMovieFiles(
          credentials,
          Number(query.movieId)
        )

        return {
          success: true,
          provider: "RADARR",
          movieId: Number(query.movieId),
          files: Array.isArray(files) ? files : [],
        }
      } catch (err: any) {
        return {
          success: false,
          provider: "RADARR",
          movieId: Number(query.movieId),
          files: [],
          message: err?.message || "Failed to fetch movie files",
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
        summary: "Delete Radarr movie file",
        description:
          "Deletes a specific movie media file from disk via Radarr.",
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
        await adapter.deleteMovieFile(credentials, Number(query.fileId))

        return {
          success: true,
          message: "Movie file deleted successfully",
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "Failed to delete movie file",
        }
      }
    },
  },
})
