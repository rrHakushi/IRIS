import { defineRoute, t } from "../../../../router"

export default defineRoute({
  schema: {
    query: t.Optional(
      t.Object({
        limit: t.Optional(t.Number({ default: 20 })),
        page: t.Optional(t.Number({ default: 1 })),
      })
    ),
    response: {
      200: t.Object({
        success: t.Boolean(),
        passkeys: t.Array(
          t.Object({
            id: t.String(),
            name: t.Nullable(t.String()),
            createdAt: t.String(),
            transports: t.Array(t.String()),
          })
        ),
      }),
    },
  },

  async GET({ session, prisma }) {
    if (!session.isAuthenticated) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Authentication required",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    const user = session.getUser()
    if (!user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "User session not found",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    }

    const passkeys = await prisma.passkey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        transports: true,
      },
    })

    return {
      success: true,
      passkeys: passkeys.map((pk) => ({
        id: pk.id,
        name: pk.name,
        createdAt: pk.createdAt.toISOString(),
        transports: pk.transports,
      })),
    }
  },
})
