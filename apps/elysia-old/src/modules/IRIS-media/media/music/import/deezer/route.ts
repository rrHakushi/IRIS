import { defineRoute, t } from "@/router"
import { deezerPlaylistService } from "@/services/connections/deezer-playlist.service"

export default defineRoute({
  POST: {
    schema: {
      body: t.Object({
        playlistId: t.Union([t.String(), t.Number()]),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          tracksImported: t.Number(),
          customList: t.Optional(
            t.Object({
              id: t.String(),
              name: t.String(),
              trackCount: t.Number(),
            })
          ),
          error: t.Optional(t.String()),
        }),
      },
      detail: {
        summary: "Import Deezer playlist",
        description:
          "Imports a Deezer playlist into a CustomList, saving songs into Music and user's MusicList.",
        tags: ["Media - Music"],
      },
    },

    async handler({ body, session }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const playlistIdStr = String(body.playlistId).trim()
      const match = playlistIdStr.match(/playlist\/(\d+)/i)
      const finalPlaylistId = match && match[1] ? match[1] : playlistIdStr

      const result = await deezerPlaylistService.importPlaylistById(
        session.user.id,
        finalPlaylistId
      )

      return result
    },
  },
})
