import { defineRoute, t } from "../../../../../router"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionProvider,
  type ConnectionCredentials,
} from "@IRIS/connections"

export default defineRoute({
  POST: {
    rateLimit: {
      capacity: 6,
      duration: 60_000,
    },
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          status: t.String(),
          message: t.Optional(t.String()),
          profile: t.Optional(
            t.Object({
              id: t.String(),
              username: t.String(),
              displayName: t.Optional(t.String()),
              avatarUrl: t.Optional(t.String()),
            })
          ),
        }),
      },
    },
    async handler({ params, session, prisma }) {
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
          id: params.id,
          userId: session.user.id,
        },
      })

      if (!connection) {
        return new Response(
          JSON.stringify({
            error: "Not Found",
            message: "Connection not found",
          }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      const adapter = getConnectionAdapter(
        connection.provider as ConnectionProvider
      )
      let credentials: ConnectionCredentials

      try {
        credentials = decryptConnectionData<ConnectionCredentials>(
          connection.encryptedData,
          session.user.id
        )
      } catch (err) {
        await prisma.connection.update({
          where: { id: connection.id },
          data: {
            status: "ERROR",
            errorMessage: "Failed to decrypt stored credentials",
          },
        })

        return {
          success: false,
          status: "ERROR",
          message: "Failed to decrypt connection credentials",
        }
      }

      const testResult = await adapter.testConnection(credentials)

      if (testResult.ok) {
        await prisma.connection.update({
          where: { id: connection.id },
          data: {
            status: "CONNECTED",
            errorMessage: null,
            displayName:
              testResult.profile?.displayName || connection.displayName,
            avatarUrl: testResult.profile?.avatarUrl || connection.avatarUrl,
            lastSyncedAt: new Date(),
          },
        })

        return {
          success: true,
          status: "CONNECTED",
          profile: testResult.profile
            ? {
                id: testResult.profile.id,
                username: testResult.profile.username,
                displayName: testResult.profile.displayName,
                avatarUrl: testResult.profile.avatarUrl,
              }
            : undefined,
        }
      } else {
        await prisma.connection.update({
          where: { id: connection.id },
          data: {
            status: "ERROR",
            errorMessage: testResult.message || "Connection health test failed",
          },
        })

        return {
          success: false,
          status: "ERROR",
          message: testResult.message || "Connection test failed",
        }
      }
    },
  },
})
