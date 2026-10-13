import { defineRoute, t } from "@/router"
import { listExportService } from "@/services/lists/list-export.service"

export default defineRoute({
  POST: {
    schema: {
      params: t.Object({
        id: t.String({ description: "Export share ID" }),
      }),
      body: t.Object({
        password: t.String({
          description: "Password configured for the export share",
        }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          data: t.Any(),
        }),
      },
      detail: {
        summary: "Fetch password-protected export data for remote import",
        tags: ["Lists - Export Public"],
      },
    },
    async handler({ params, body }) {
      const data = await listExportService.fetchSharePayload(
        params.id,
        body.password
      )
      return {
        success: true,
        data,
      }
    },
  },
})
