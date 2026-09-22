import { defineRoute, t } from "../../../../router"
import { NotFound } from "../../../../utils/errors"
import { UserCustomizationSchema } from "../me/route"
import {
  getConnectionAdapter,
  type ConnectionProvider,
} from "@IRIS/connections"

export const PublicUserConnectionSchema = t.Object({
  id: t.String(),
  provider: t.String(),
  displayName: t.Nullable(t.String()),
  avatarUrl: t.Nullable(t.String()),
  iconUrl: t.Optional(t.Nullable(t.String())),
  profileUrl: t.Nullable(t.String()),
  status: t.String(),
})

export default defineRoute({
  GET: {
    schema: {
      params: t.Object({
        username: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          user: t.Object({
            id: t.String(),
            username: t.String(),
            customization: t.Nullable(UserCustomizationSchema),
            createdAt: t.String(),
            connections: t.Array(PublicUserConnectionSchema),
          }),
        }),
      },
      detail: {
        summary: "Get public user profile by username",
        tags: ["Users"],
      },
    },
    async handler({ params, prisma }) {
      const username = params.username?.trim()
      if (!username) {
        throw new NotFound("User not found")
      }

      const dbUser = await prisma.user.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
        },
        select: {
          id: true,
          username: true,
          customization: true,
          createdAt: true,
          connections: {
            where: {
              status: "CONNECTED",
            },
            select: {
              id: true,
              provider: true,
              displayName: true,
              avatarUrl: true,
              profileUrl: true,
              status: true,
              settings: true,
            },
          },
        },
      })

      if (!dbUser) {
        throw new NotFound(`User "${username}" not found`)
      }

      // Filter out private connections
      const publicConnections = dbUser.connections
        .filter((conn) => {
          const settings = (conn.settings as Record<string, any>) || {}
          return settings.isPrivate !== true
        })
        .map((conn) => {
          let iconUrl: string | null = null
          try {
            const adapter = getConnectionAdapter(conn.provider as ConnectionProvider)
            iconUrl = adapter.iconUrl || null
          } catch {
            // ignore if unsupported provider
          }

          return {
            id: conn.id,
            provider: conn.provider,
            displayName: conn.displayName,
            avatarUrl: conn.avatarUrl,
            iconUrl,
            profileUrl: conn.profileUrl,
            status: conn.status,
          }
        })

      return {
        success: true,
        user: {
          id: dbUser.id,
          username: dbUser.username.trim(),
          customization: dbUser.customization as any,
          createdAt: dbUser.createdAt.toISOString(),
          connections: publicConnections,
        },
      }
    },
  },
})
