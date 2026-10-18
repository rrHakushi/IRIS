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
        folder: t.Optional(t.String()),
        downloadId: t.Optional(t.String()),
        seriesId: t.Optional(t.Numeric()),
        filterExistingFiles: t.Optional(t.Boolean()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          provider: t.String(),
          items: t.Array(t.Any()),
          message: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Scan Sonarr manual import files",
        description:
          "Scans a folder or download for manual importing into Sonarr.",
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
          items: [],
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
          items: [],
          message: "Failed to decrypt Sonarr connection credentials",
        }
      }

      try {
        const adapter = getConnectionAdapter("SONARR") as any
        const items = await adapter.getManualImport(credentials, query)

        return {
          success: true,
          provider: "SONARR",
          items: Array.isArray(items) ? items : [],
        }
      } catch (err: any) {
        return {
          success: false,
          provider: "SONARR",
          items: [],
          message: err?.message || "Failed to scan manual import",
        }
      }
    },
  },

  POST: {
    schema: {
      body: t.Object({
        files: t.Array(t.Any()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Optional(t.Any()),
        }),
      },
      detail: {
        summary: "Execute Sonarr manual import",
        description: "Imports selected files into Sonarr.",
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
        const result = await adapter.executeManualImport(
          credentials,
          body.files
        )

        return {
          success: true,
          message: "Manual import initiated successfully",
          data: result,
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "Failed to execute manual import",
        }
      }
    },
  },
})
