import { defineRoute, t } from "@/router"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionCredentials,
} from "@IRIS/connections"

export const RadarrCommandRequestSchema = t.Object({
  command: t.Optional(
    t.Union([
      t.Literal("refresh"),
      t.Literal("rssSync"),
      t.Literal("searchMissing"),
      t.Literal("custom"),
    ])
  ),
  name: t.Optional(t.String()),
  movieId: t.Optional(t.Number()),
  movieIds: t.Optional(t.Array(t.Number())),
  files: t.Optional(t.Array(t.Number())),
  body: t.Optional(t.Record(t.String(), t.Any())),
})

export const RadarrCommandResponseSchema = t.Object({
  success: t.Boolean(),
  provider: t.String(),
  command: t.String(),
  message: t.String(),
  data: t.Optional(t.Any()),
})

export default defineRoute({
  POST: {
    schema: {
      body: RadarrCommandRequestSchema,
      response: {
        200: RadarrCommandResponseSchema,
      },
      detail: {
        summary: "Execute Radarr command",
        description:
          "Triggers commands in Radarr (RefreshMovie, RssSync, MissingMoviesSearch, MoviesSearch, etc.).",
        tags: ["Servarr", "Radarr"],
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
          provider: "RADARR",
          status: "CONNECTED",
        },
      })

      if (!connection) {
        return {
          success: false,
          provider: "RADARR",
          command: body.command || body.name || "unknown",
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
          provider: "RADARR",
          command: body.command || body.name || "unknown",
          message: "Failed to decrypt Radarr connection credentials",
        }
      }

      let payload: { name: string; [key: string]: unknown } = {
        name: body.name || "RefreshMovie",
        ...body,
      }

      if (body.command === "refresh") {
        payload = { name: "RefreshMovie" }
      } else if (body.command === "rssSync") {
        payload = { name: "RssSync" }
      } else if (body.command === "searchMissing") {
        payload = { name: "MissingMoviesSearch" }
      } else if (body.command === "custom" && body.name) {
        payload = { name: body.name, ...(body.body || {}) }
      }

      try {
        const adapter = getConnectionAdapter("RADARR") as any
        const result = await adapter.executeCommand(credentials, payload)

        return {
          success: true,
          provider: "RADARR",
          command: payload.name,
          message: `Radarr command '${payload.name}' executed successfully`,
          data: result,
        }
      } catch (err: any) {
        return {
          success: false,
          provider: "RADARR",
          command: payload.name,
          message: err?.message || `Failed to execute command on Radarr`,
        }
      }
    },
  },
})
