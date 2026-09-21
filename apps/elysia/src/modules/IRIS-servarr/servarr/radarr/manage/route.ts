import { defineRoute, t } from "@/router"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionCredentials,
} from "@IRIS/connections"

export default defineRoute({
  PUT: {
    schema: {
      body: t.Object({
        movieIds: t.Array(t.Number()),
        monitored: t.Optional(t.Boolean()),
        qualityProfileId: t.Optional(t.Number()),
        minimumAvailability: t.Optional(t.String()),
        rootFolderPath: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Optional(t.Any()),
        }),
      },
      detail: {
        summary: "Bulk update Radarr movies",
        description:
          "Mass edits movies in Radarr (monitored, profile, root folder).",
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
        const result = await adapter.bulkUpdateMovies(credentials, body)

        return {
          success: true,
          message: `Successfully updated ${body.movieIds.length} movies`,
          data: result,
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "Failed to update movies",
        }
      }
    },
  },

  DELETE: {
    schema: {
      body: t.Object({
        movieIds: t.Array(t.Number()),
        deleteFiles: t.Optional(t.Boolean()),
        addImportListExclusion: t.Optional(t.Boolean()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Bulk delete Radarr movies",
        description: "Mass deletes movies from Radarr.",
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
        await adapter.bulkDeleteMovies(credentials, body)

        return {
          success: true,
          message: `Successfully deleted ${body.movieIds.length} movies`,
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "Failed to delete movies",
        }
      }
    },
  },
})
