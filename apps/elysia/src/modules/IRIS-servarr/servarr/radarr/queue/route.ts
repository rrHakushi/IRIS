import { defineRoute, t } from "@/router"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionCredentials,
} from "@IRIS/connections"

export const ServarrRadarrQueueResponseSchema = t.Object({
  success: t.Boolean(),
  connected: t.Boolean(),
  provider: t.String(),
  page: t.Optional(t.Number()),
  pageSize: t.Optional(t.Number()),
  totalRecords: t.Optional(t.Number()),
  records: t.Array(t.Any()),
  message: t.Optional(t.String()),
})

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
      response: {
        200: ServarrRadarrQueueResponseSchema,
      },
      detail: {
        summary: "Get Radarr download queue",
        description: "Fetches active and queued downloads from Radarr.",
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
          success: true,
          connected: false,
          provider: "RADARR",
          records: [],
          totalRecords: 0,
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
          connected: true,
          provider: "RADARR",
          records: [],
          totalRecords: 0,
          message: "Failed to decrypt Radarr connection credentials",
        }
      }

      try {
        const adapter = getConnectionAdapter("RADARR") as any
        const data = await adapter.getQueue(credentials, {
          page: query?.page || 1,
          pageSize: query?.pageSize || 50,
          includeMovie: true,
        })

        const records = Array.isArray(data) ? data : data?.records || []
        const totalRecords =
          typeof data?.totalRecords === "number"
            ? data.totalRecords
            : records.length

        return {
          success: true,
          connected: true,
          provider: "RADARR",
          page: query?.page || 1,
          pageSize: query?.pageSize || 50,
          totalRecords,
          records,
        }
      } catch (err: any) {
        return {
          success: false,
          connected: true,
          provider: "RADARR",
          records: [],
          totalRecords: 0,
          message: err?.message || "Failed to fetch Radarr queue",
        }
      }
    },
  },

  DELETE: {
    schema: {
      query: t.Optional(
        t.Object({
          id: t.Optional(t.Numeric()),
          removeFromClient: t.Optional(
            t.Union([t.Boolean(), t.BooleanString()])
          ),
          blocklist: t.Optional(t.Union([t.Boolean(), t.BooleanString()])),
        })
      ),
      body: t.Optional(
        t.Object({
          id: t.Optional(t.Numeric()),
          removeFromClient: t.Optional(t.Boolean()),
          blocklist: t.Optional(t.Boolean()),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Remove item from Radarr download queue",
        description: "Cancels or removes a queued download item.",
        tags: ["Servarr", "Radarr"],
      },
    },

    async handler({ query, body, session, prisma }: any) {
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
        const itemId = Number(query?.id ?? body?.id)
        if (!itemId || isNaN(itemId)) {
          return {
            success: false,
            message: "A valid queue item ID is required",
          }
        }
        const removeFromClient =
          query?.removeFromClient === "true" ||
          query?.removeFromClient === true ||
          body?.removeFromClient === true ||
          (query?.removeFromClient === undefined &&
            body?.removeFromClient === undefined)
        const blocklist =
          query?.blocklist === "true" ||
          query?.blocklist === true ||
          body?.blocklist === true

        const adapter = getConnectionAdapter("RADARR") as any
        await adapter.deleteQueueItem(credentials, itemId, {
          removeFromClient,
          blocklist,
        })

        return {
          success: true,
          message: "Download removed from queue successfully",
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "Failed to remove item from queue",
        }
      }
    },
  },
})
