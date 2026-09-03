import { defineRoute, t } from "../../../router"
import {
  getConnectionAdapter,
  encryptConnectionData,
  type ConnectionProvider,
  type ConnectionCredentials,
} from "@IRIS/connections"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          connections: t.Array(
            t.Object({
              id: t.String(),
              provider: t.String(),
              authType: t.String(),
              externalId: t.Nullable(t.String()),
              displayName: t.Nullable(t.String()),
              avatarUrl: t.Nullable(t.String()),
              profileUrl: t.Nullable(t.String()),
              status: t.String(),
              errorMessage: t.Nullable(t.String()),
              settings: t.Nullable(t.Any()),
              lastSyncedAt: t.Nullable(t.String()),
              expiresAt: t.Nullable(t.String()),
              createdAt: t.String(),
              updatedAt: t.String(),
            })
          ),
        }),
      },
    },
    async handler({ session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const connections = await prisma.connection.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      })

      return {
        success: true,
        connections: connections.map((conn) => ({
          id: conn.id,
          provider: conn.provider,
          authType: conn.authType,
          externalId: conn.externalId,
          displayName: conn.displayName,
          avatarUrl: conn.avatarUrl,
          profileUrl: conn.profileUrl,
          status: conn.status,
          errorMessage: conn.errorMessage,
          settings: conn.settings,
          lastSyncedAt: conn.lastSyncedAt?.toISOString() || null,
          expiresAt: conn.expiresAt?.toISOString() || null,
          createdAt: conn.createdAt.toISOString(),
          updatedAt: conn.updatedAt.toISOString(),
        })),
      }
    },
  },

  POST: {
    schema: {
      body: t.Object({
        provider: t.String(),
        authType: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
        hostUrl: t.Optional(t.String()),
        username: t.Optional(t.String()),
        password: t.Optional(t.String()),
        settings: t.Optional(t.Any()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connection: t.Object({
            id: t.String(),
            provider: t.String(),
            displayName: t.Nullable(t.String()),
            status: t.String(),
          }),
        }),
      },
    },
    async handler({ body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const provider = body.provider.toUpperCase() as ConnectionProvider
      let adapter
      try {
        adapter = getConnectionAdapter(provider)
      } catch {
        return new Response(
          JSON.stringify({
            error: "Bad Request",
            message: `Unsupported provider: ${body.provider}`,
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const credentials: ConnectionCredentials = {
        apiKey: body.apiKey,
        hostUrl: body.hostUrl,
        username: body.username,
        password: body.password,
      }

      // Test connection with provider
      const testResult = await adapter.testConnection(credentials)
      if (!testResult.ok) {
        return new Response(
          JSON.stringify({
            error: "Connection Failed",
            message:
              testResult.message || "Failed to authenticate with provider",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const finalCredentials = testResult.credentials || credentials
      const encryptedData = encryptConnectionData(
        finalCredentials,
        session.user.id
      )
      const profile = testResult.profile

      const connection = await prisma.connection.upsert({
        where: {
          userId_provider_externalId: {
            userId: session.user.id,
            provider: provider as any,
            externalId: profile?.id || body.username || "default",
          },
        },
        create: {
          userId: session.user.id,
          provider: provider as any,
          authType:
            (body.authType?.toUpperCase() as any) || (adapter.authType as any),
          externalId: profile?.id || body.username || "default",
          displayName:
            profile?.displayName ||
            profile?.username ||
            body.username ||
            provider,
          avatarUrl: profile?.avatarUrl,
          profileUrl: profile?.profileUrl || body.hostUrl,
          encryptedData,
          status: "CONNECTED",
          settings: {
            librarySync: true,
            isPrivate: false,
            ...(body.hostUrl ? { hostUrl: body.hostUrl } : {}),
            ...(body.settings || {}),
          },
          lastSyncedAt: new Date(),
        },
        update: {
          displayName:
            profile?.displayName ||
            profile?.username ||
            body.username ||
            provider,
          avatarUrl: profile?.avatarUrl,
          profileUrl: profile?.profileUrl || body.hostUrl,
          encryptedData,
          status: "CONNECTED",
          errorMessage: null,
          settings: {
            librarySync: true,
            isPrivate: false,
            ...(body.hostUrl ? { hostUrl: body.hostUrl } : {}),
            ...(body.settings || {}),
          },
          lastSyncedAt: new Date(),
        },
      })

      return {
        success: true,
        connection: {
          id: connection.id,
          provider: connection.provider,
          displayName: connection.displayName,
          status: connection.status,
        },
      }
    },
  },
})
