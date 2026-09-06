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

      if (connection.provider === "DEEZER" && credentials.accessToken) {
        const { deezerPlaylistService } = await import(
          "../../../../../services/connections/deezer-playlist.service.js"
        )
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

      await prisma.connection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date() },
      })

      return {
        success: true,
        message: `Synced ${itemCount} items from ${connection.provider}`,
        itemCount,
      }
    },
  },
})
