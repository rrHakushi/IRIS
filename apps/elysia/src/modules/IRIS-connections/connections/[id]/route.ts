import { defineRoute, t } from "../../../../router"

export default defineRoute({
  DELETE: {
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
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

      await prisma.connection.delete({
        where: { id: params.id },
      })

      return {
        success: true,
        message: `Connection for ${connection.provider} removed successfully`,
      }
    },
  },

  PATCH: {
    schema: {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        settings: t.Optional(
          t.Nullable(
            t.Record(
              t.String(),
              t.Union([t.String(), t.Number(), t.Boolean(), t.Null()])
            )
          )
        ),
        displayName: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          connection: t.Object({
            id: t.String(),
            displayName: t.Nullable(t.String()),
            settings: t.Optional(
              t.Nullable(
                t.Record(
                  t.String(),
                  t.Union([t.String(), t.Number(), t.Boolean(), t.Null()])
                )
              )
            ),
          }),
        }),
      },
    },
    async handler({ params, body, session, prisma }) {
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

      const updated = await prisma.connection.update({
        where: { id: params.id },
        data: {
          settings:
            body.settings !== undefined ? body.settings : connection.settings,
          displayName:
            body.displayName !== undefined
              ? body.displayName
              : connection.displayName,
        },
      })

      return {
        success: true,
        connection: {
          id: updated.id,
          displayName: updated.displayName,
          settings: updated.settings,
        },
      }
    },
  },
})
