import { defineRoute, t } from "../../../../router"

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          sub: t.String(),
          id: t.String(),
          username: t.String(),
          name: t.Optional(t.String()),
          email: t.Optional(t.Nullable(t.String())),
          email_verified: t.Optional(t.Boolean()),
          picture: t.Optional(t.Nullable(t.String())),
          avatarUrl: t.Optional(t.Nullable(t.String())),
          permissions: t.Array(t.Number()),
        }),
      },
    },
    async handler({ session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({
            error: "invalid_token",
            error_description: "Active bearer access token required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      if (session.method === "oauth" && !session.hasScope("identify") && !session.hasScope("profile")) {
        return new Response(
          JSON.stringify({
            error: "insufficient_scope",
            error_description: "The 'identify' or 'profile' scope is required to access userinfo.",
          }),
          { status: 403, headers: { "content-type": "application/json" } }
        )
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          username: true,
          email: true,
          customization: true,
          permissions: true,
        },
      })

      if (!user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      const canViewEmail = session.method !== "oauth" || session.hasScope("email")
      const customization = (user.customization as Record<string, unknown>) || {}
      const avatarUrl = (customization.avatarUrl as string) || null

      return {
        sub: user.id,
        id: user.id,
        username: user.username,
        name: user.username,
        email: canViewEmail ? user.email : undefined,
        email_verified: Boolean(user.email),
        picture: avatarUrl,
        avatarUrl,
        permissions: user.permissions,
      }
    },
  },
})
