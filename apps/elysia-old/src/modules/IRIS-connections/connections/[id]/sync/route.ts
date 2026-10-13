import { defineRoute, t } from "../../../../../router"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionProvider,
  type ConnectionCredentials,
} from "@IRIS/connections"

export default defineRoute({
  POST: {
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          itemCount: t.Optional(t.Number()),
          profile: t.Optional(
            t.Object({
              id: t.String(),
              username: t.String(),
              displayName: t.Optional(t.String()),
              avatarUrl: t.Optional(t.String()),
            })
          ),
          connection: t.Optional(
            t.Object({
              id: t.String(),
              provider: t.String(),
              displayName: t.Nullable(t.String()),
              avatarUrl: t.Nullable(t.String()),
              profileUrl: t.Nullable(t.String()),
              status: t.String(),
              lastSyncedAt: t.Nullable(t.String()),
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
        return new Response(
          JSON.stringify({
            error: "Decryption Failed",
            message: "Failed to decrypt credentials",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      let itemCount = 0

      // 1. Fetch updated profile metadata from provider if supported
      let profileData: {
        id: string
        username: string
        displayName?: string
        avatarUrl?: string
        profileUrl?: string
      } | null = null

      try {
        const testRes = await adapter.testConnection(credentials)
        if (testRes.ok && testRes.profile) {
          profileData = testRes.profile
        } else if (adapter.getProfile) {
          profileData = await adapter.getProfile(credentials)
        }
      } catch {
        // Fall back gracefully if test/profile request had network hiccup
      }

      // 2. Sync library/items if provider supports it
      try {
        if (connection.provider === "DEEZER" && credentials.accessToken) {
          const { deezerPlaylistService } =
            await import("../../../../../services/connections/deezer-playlist.service.js")
          const res = await deezerPlaylistService.importUserPlaylists(
            session.user.id,
            credentials.accessToken
          )
          itemCount = res.tracksImported
        } else if (adapter.getLibrary) {
          const library = await adapter.getLibrary(credentials)
          itemCount = library.length
        } else if (adapter.getGames) {
          const games = await adapter.getGames(credentials)
          itemCount = games.length
        }
      } catch {
        // Continue with profile update even if library fetch failed
      }

      const updated = await prisma.connection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: new Date(),
          status: "CONNECTED",
          errorMessage: null,
          ...(profileData?.displayName
            ? { displayName: profileData.displayName }
            : {}),
          ...(profileData?.avatarUrl
            ? { avatarUrl: profileData.avatarUrl }
            : {}),
          ...(profileData?.profileUrl
            ? { profileUrl: profileData.profileUrl }
            : {}),
        },
      })

      return {
        success: true,
        message: `Successfully resynced ${connection.provider} connection`,
        itemCount,
        profile: profileData
          ? {
              id: profileData.id,
              username: profileData.username,
              displayName: profileData.displayName,
              avatarUrl: profileData.avatarUrl,
            }
          : undefined,
        connection: {
          id: updated.id,
          provider: updated.provider,
          displayName: updated.displayName,
          avatarUrl: updated.avatarUrl,
          profileUrl: updated.profileUrl,
          status: updated.status,
          lastSyncedAt: updated.lastSyncedAt?.toISOString() ?? null,
        },
      }
    },
  },
})
