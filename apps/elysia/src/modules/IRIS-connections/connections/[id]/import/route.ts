import { defineRoute, t } from "../../../../../router"
import { listImportService } from "../../../../../services/connections/list-import.service"

export default defineRoute({
  POST: {
    schema: {
      params: t.Object({
        id: t.String({
          description:
            "Connection ID or provider name (e.g. anilist, mal, simkl, bangumi, deezer)",
        }),
      }),
      body: t.Optional(
        t.Object({
          mediaTypes: t.Optional(t.Array(t.String())),
          customLists: t.Optional(t.Boolean()),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          status: t.String(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Start list import",
        description:
          "Initiates background importing of tracking lists and custom lists from an external connected provider.",
        tags: ["Connections"],
      },
    },

    async handler({ params, body, session }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const result = await listImportService.startImport(
        session.user.id,
        params.id,
        {
          mediaTypes: body?.mediaTypes,
          customLists: body?.customLists,
        }
      )

      return result
    },
  },
})
