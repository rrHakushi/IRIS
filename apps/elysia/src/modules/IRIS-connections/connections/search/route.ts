import { defineRoute, t } from "../../../../router"
import {
  SearchProxyManager,
  type ConnectionProvider,
  type MediaType,
} from "@IRIS/connections"

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        provider: t.String(),
        q: t.String(),
        type: t.Optional(t.String()),
        page: t.Optional(t.Number()),
        perPage: t.Optional(t.Number()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          provider: t.String(),
          results: t.Array(
            t.Object({
              id: t.Optional(t.String()),
              externalId: t.String(),
              provider: t.String(),
              mediaType: t.String(),
              title: t.Object({
                userPreferred: t.String(),
                romaji: t.Optional(t.String()),
                english: t.Optional(t.String()),
                native: t.Optional(t.String()),
              }),
              description: t.Optional(t.String()),
              coverImage: t.Optional(
                t.Object({
                  extraLarge: t.Optional(t.String()),
                  large: t.Optional(t.String()),
                  medium: t.Optional(t.String()),
                  color: t.Optional(t.String()),
                })
              ),
              bannerImage: t.Optional(t.String()),
              format: t.Optional(t.String()),
              status: t.Optional(t.String()),
              episodes: t.Optional(t.Nullable(t.Number())),
              chapters: t.Optional(t.Nullable(t.Number())),
              volumes: t.Optional(t.Nullable(t.Number())),
              durationMinutes: t.Optional(t.Nullable(t.Number())),
              averageScore: t.Optional(t.Nullable(t.Number())),
              popularity: t.Optional(t.Nullable(t.Number())),
              releaseYear: t.Optional(t.Nullable(t.Number())),
              genres: t.Optional(t.Array(t.String())),
              url: t.Optional(t.String()),
            })
          ),
        }),
      },
    },
    async handler({ query, session, prisma }) {
      const provider = query.provider.toUpperCase() as ConnectionProvider
      let userConnection: any = null

      if (session.isAuthenticated && session.user) {
        userConnection = await prisma.connection.findFirst({
          where: {
            userId: session.user.id,
            provider: provider as any,
            status: "CONNECTED",
          },
        })
      }

      const results = await SearchProxyManager.search(
        provider,
        query.q,
        userConnection,
        {
          type: query.type?.toUpperCase() as MediaType,
          page: query.page,
          perPage: query.perPage,
        },
        async (connId, updatedEncrypted, expiresAt) => {
          await prisma.connection.update({
            where: { id: connId },
            data: {
              encryptedData: updatedEncrypted,
              expiresAt,
            },
          })
        }
      )

      return {
        success: true,
        provider,
        results,
      }
    },
  },
})
