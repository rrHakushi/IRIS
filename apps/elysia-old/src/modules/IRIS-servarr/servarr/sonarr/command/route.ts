import { defineRoute, t } from "@/router"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionCredentials,
} from "@IRIS/connections"

export const SonarrCommandRequestSchema = t.Object({
  command: t.Optional(
    t.Union([
      t.Literal("refresh"),
      t.Literal("rssSync"),
      t.Literal("searchMissing"),
      t.Literal("custom"),
    ])
  ),
  name: t.Optional(t.String()),
  seriesId: t.Optional(t.Number()),
  seriesIds: t.Optional(t.Array(t.Number())),
  episodeId: t.Optional(t.Number()),
  episodeIds: t.Optional(t.Array(t.Number())),
  files: t.Optional(t.Array(t.Number())),
  body: t.Optional(t.Record(t.String(), t.Any())),
})

export const SonarrCommandResponseSchema = t.Object({
  success: t.Boolean(),
  provider: t.String(),
  command: t.String(),
  message: t.String(),
  data: t.Optional(t.Any()),
})

export default defineRoute({
  POST: {
    schema: {
      body: SonarrCommandRequestSchema,
      response: {
        200: SonarrCommandResponseSchema,
      },
      detail: {
        summary: "Execute Sonarr command",
        description:
          "Triggers commands in Sonarr (RefreshSeries, RssSync, MissingEpisodeSearch, EpisodeSearch, SeriesSearch, etc.).",
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
          provider: "SONARR",
          command: body.command || body.name || "unknown",
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
          provider: "SONARR",
          command: body.command || body.name || "unknown",
          message: "Failed to decrypt Sonarr connection credentials",
        }
      }

      let payload: { name: string; [key: string]: unknown } = {
        name: body.name || "RefreshSeries",
        ...body,
      }

      if (body.command === "refresh") {
        payload = { name: "RefreshSeries" }
      } else if (body.command === "rssSync") {
        payload = { name: "RssSync" }
      } else if (body.command === "searchMissing") {
        payload = { name: "MissingEpisodeSearch" }
      } else if (body.command === "custom" && body.name) {
        payload = { name: body.name, ...(body.body || {}) }
      }

      try {
        const adapter = getConnectionAdapter("SONARR") as any
        const result = await adapter.executeCommand(credentials, payload)

        return {
          success: true,
          provider: "SONARR",
          command: payload.name,
          message: `Sonarr command '${payload.name}' executed successfully`,
          data: result,
        }
      } catch (err: any) {
        return {
          success: false,
          provider: "SONARR",
          command: payload.name,
          message: err?.message || `Failed to execute command on Sonarr`,
        }
      }
    },
  },
})
