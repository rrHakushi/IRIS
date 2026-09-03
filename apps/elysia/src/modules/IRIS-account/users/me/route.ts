import { defineRoute, t } from "../../../../router"
import { cache } from "../../../../utils/cache"

const userCache = cache.withNamespace("users:me")

export const MediaPreferencesSchema = t.Object({
  title: t.Optional(
    t.Union([t.Literal("primary"), t.Literal("secondary"), t.Literal("native")])
  ),
})

export const PreferencesCustomizationSchema = t.Object({
  media: t.Optional(MediaPreferencesSchema),
})

export const UserCustomizationSchema = t.Partial(
  t.Object({
    profile: t.Optional(t.Any()),
    appearance: t.Optional(t.Any()),
    sidebar: t.Optional(t.Any()),
    dock: t.Optional(t.Any()),
    preferences: t.Optional(PreferencesCustomizationSchema),
  }),
  { additionalProperties: true }
)

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          user: t.Object({
            id: t.String(),
            username: t.String(),
            email: t.String(),
            customization: t.Nullable(UserCustomizationSchema),
            settings: t.Nullable(t.Any()),
            permissions: t.Array(t.Number()),
            TOTPEnabled: t.Boolean(),
            emailMfaEnabled: t.Boolean(),
            publicKey: t.Nullable(t.String()),
            createdAt: t.String(),
            updatedAt: t.String(),
          }),
        }),
      },
    },
    async handler({ session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Session expired" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          }
        )
      }

      const userId = session.user.id
      const cachedUser = await userCache.getOrSet(
        `user:${userId}`,
        async () => {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              username: true,
              email: true,
              customization: true,
              settings: true,
              permissions: true,
              TOTPEnabled: true,
              emailMfaEnabled: true,
              publicKey: true,
              createdAt: true,
              updatedAt: true,
            },
          })

          if (!dbUser) return null

          return {
            id: dbUser.id,
            username: dbUser.username.trim(),
            email: dbUser.email,
            customization: dbUser.customization,
            settings: dbUser.settings,
            permissions: dbUser.permissions,
            TOTPEnabled: dbUser.TOTPEnabled,
            emailMfaEnabled: dbUser.emailMfaEnabled,
            publicKey: dbUser.publicKey,
            createdAt: dbUser.createdAt.toISOString(),
            updatedAt: dbUser.updatedAt.toISOString(),
          }
        },
        300 // 5 minutes TTL
      )

      if (!cachedUser) {
        return new Response(
          JSON.stringify({ error: "Not Found", message: "User not found" }),
          {
            status: 404,
            headers: { "content-type": "application/json" },
          }
        )
      }

      return {
        success: true,
        user: cachedUser,
      }
    },
  },

  PATCH: {
    schema: {
      body: t.Optional(
        t.Object({
          customization: t.Optional(UserCustomizationSchema),
          settings: t.Optional(t.Any()),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          user: t.Object({
            id: t.String(),
            username: t.String(),
            email: t.String(),
            customization: t.Nullable(UserCustomizationSchema),
            settings: t.Nullable(t.Any()),
            permissions: t.Array(t.Number()),
            TOTPEnabled: t.Boolean(),
            emailMfaEnabled: t.Boolean(),
            publicKey: t.Nullable(t.String()),
            createdAt: t.String(),
            updatedAt: t.String(),
          }),
        }),
      },
    },
    async handler({ body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Session expired" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          }
        )
      }

      const updateData: Record<string, unknown> = {}
      if (body?.customization !== undefined) {
        updateData.customization = body.customization
      }
      if (body?.settings !== undefined) {
        updateData.settings = body.settings
      }

      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          customization: true,
          settings: true,
          permissions: true,
          TOTPEnabled: true,
          emailMfaEnabled: true,
          publicKey: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      const formattedUser = {
        id: updatedUser.id,
        username: updatedUser.username.trim(),
        email: updatedUser.email,
        customization: updatedUser.customization,
        settings: updatedUser.settings,
        permissions: updatedUser.permissions,
        TOTPEnabled: updatedUser.TOTPEnabled,
        emailMfaEnabled: updatedUser.emailMfaEnabled,
        publicKey: updatedUser.publicKey,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
      }

      // Invalidate and update cache
      await userCache.set(`user:${session.user.id}`, formattedUser, 300)

      return {
        success: true,
        user: formattedUser,
      }
    },
  },
})
