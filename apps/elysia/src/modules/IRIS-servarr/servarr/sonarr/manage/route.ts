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
        seriesIds: t.Array(t.Number()),
        monitored: t.Optional(t.Boolean()),
        qualityProfileId: t.Optional(t.Number()),
        seriesType: t.Optional(
          t.Union([
            t.Literal("standard"),
            t.Literal("daily"),
            t.Literal("anime"),
          ])
        ),
        seasonFolder: t.Optional(t.Boolean()),
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
        summary: "Bulk update Sonarr series",
        description:
          "Mass edits series in Sonarr (monitored, profile, series type, root folder).",
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
        const result = await adapter.bulkUpdateSeries(credentials, body)

        return {
          success: true,
          message: `Successfully updated ${body.seriesIds.length} series`,
          data: result,
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "Failed to update series",
        }
      }
    },
  },

  DELETE: {
    schema: {
      body: t.Object({
        seriesIds: t.Array(t.Number()),
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
        summary: "Bulk delete Sonarr series",
        description: "Mass deletes series from Sonarr.",
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
        await adapter.bulkDeleteSeries(credentials, body)

        return {
          success: true,
          message: `Successfully deleted ${body.seriesIds.length} series`,
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "Failed to delete series",
        }
      }
    },
  },
})
