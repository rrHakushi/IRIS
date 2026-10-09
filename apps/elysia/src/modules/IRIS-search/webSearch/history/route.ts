import { defineRoute, t } from "../../../../router"
import { decryptConnectionData } from "@IRIS/connections"

export const SearchHistoryItemSchema = t.Object({
  id: t.String(),
  query: t.String(),
  category: t.String(),
  createdAt: t.String(),
})

export default defineRoute({
  GET: {
    requireAuth: true,
    schema: {
      query: t.Optional(
        t.Object({
          limit: t.Optional(t.String()),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          history: t.Array(SearchHistoryItemSchema),
        }),
      },
    },
    async handler({ query, session, prisma }: any) {
      const user = session.getUser()!
      const limit = Math.min(100, Math.max(1, parseInt(query?.limit || "30", 10) || 30))

      // 30-day retention limit
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const records = await prisma.searchHistory.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: "desc" },
        take: limit * 2, // Take extra to deduplicate
      })

      const seen = new Set<string>()
      const history: Array<{
        id: string
        query: string
        category: string
        createdAt: string
      }> = []

      for (const rec of records) {
        try {
          const plainQuery = decryptConnectionData<string>(rec.encryptedQuery, user.id)
          const normalized = plainQuery.trim().toLowerCase()
          if (!seen.has(normalized)) {
            seen.add(normalized)
            history.push({
              id: rec.id,
              query: plainQuery,
              category: rec.category || "general",
              createdAt: rec.createdAt.toISOString(),
            })
            if (history.length >= limit) break
          }
        } catch {
          // If decryption fails, skip corrupted record
        }
      }

      return {
        success: true,
        history,
      }
    },
  },

  DELETE: {
    requireAuth: true,
    schema: {
      query: t.Optional(
        t.Object({
          id: t.Optional(t.String()),
        })
      ),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    },
    async handler({ query, session, prisma }: any) {
      const user = session.getUser()!

      if (query?.id) {
        await prisma.searchHistory.deleteMany({
          where: {
            id: query.id,
            userId: user.id,
          },
        })
        return {
          success: true,
          message: "Search history item removed",
        }
      }

      // Clear all history for this user
      await prisma.searchHistory.deleteMany({
        where: { userId: user.id },
      })

      return {
        success: true,
        message: "Search history cleared successfully",
      }
    },
  },
})
