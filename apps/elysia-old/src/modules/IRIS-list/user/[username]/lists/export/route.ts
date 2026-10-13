import { defineRoute, t } from "@/router"
import { listExportService } from "@/services/lists/list-export.service"
import { resolveTargetUserAndAccess } from "@/modules/IRIS-list/helpers"
import { Unauthorized, Forbidden, BadRequest } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
  },

  GET: {
    schema: {
      query: t.Object({
        format: t.Optional(
          t.Union([t.Literal("iris-json"), t.Literal("mal-xml")], {
            default: "iris-json",
          })
        ),
        types: t.Optional(
          t.String({
            description:
              "Comma-separated media types e.g. anime,manga,tv,movie",
          })
        ),
      }),
      detail: {
        summary: "Direct export of user lists as IRIS JSON or MAL XML",
        tags: ["Lists - Export"],
      },
    },
    async handler({ params, query, prisma, session }) {
      const { dbUser, isOwner } = await resolveTargetUserAndAccess(
        prisma,
        params.username,
        session
      )

      if (!isOwner) {
        throw new Forbidden("You can only export your own media lists")
      }

      const requestedTypes = query.types
        ? query.types
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        : undefined

      const format = query.format || "iris-json"

      if (format === "mal-xml") {
        const xml = await listExportService.generateMalXmlExport(
          dbUser.id,
          requestedTypes
        )
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Content-Disposition": `attachment; filename="${params.username}-mal-export.xml"`,
          },
        })
      }

      const jsonData = await listExportService.generateIrisJsonExport(
        dbUser.id,
        requestedTypes
      )
      return new Response(JSON.stringify(jsonData, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${params.username}-iris-export.json"`,
        },
      })
    },
  },

  POST: {
    schema: {
      body: t.Object({
        password: t.String({ minLength: 4 }),
        mediaTypes: t.Array(t.String()),
        description: t.Optional(t.String()),
        expiresInHours: t.Optional(t.Nullable(t.Number())),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          shareId: t.String(),
          expiresAt: t.Nullable(t.String()),
        }),
      },
      detail: {
        summary: "Create password-protected export share link",
        tags: ["Lists - Export"],
      },
    },
    async handler({ params, body, prisma, session }) {
      const { dbUser, isOwner } = await resolveTargetUserAndAccess(
        prisma,
        params.username,
        session
      )

      if (!isOwner) {
        throw new Forbidden(
          "You can only create export shares for your own account"
        )
      }

      const result = await listExportService.createShare(dbUser.id, body)
      return {
        success: true,
        shareId: result.shareId,
        expiresAt: result.expiresAt,
      }
    },
  },

  DELETE: {
    schema: {
      query: t.Object({
        shareId: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Revoke password-protected export share link",
        tags: ["Lists - Export"],
      },
    },
    async handler({ params, query, prisma, session }) {
      const { dbUser, isOwner } = await resolveTargetUserAndAccess(
        prisma,
        params.username,
        session
      )

      if (!isOwner) {
        throw new Forbidden("You can only revoke your own export shares")
      }

      await listExportService.revokeShare(dbUser.id, query.shareId)
      return {
        success: true,
        message: "Export share link revoked successfully",
      }
    },
  },
})
