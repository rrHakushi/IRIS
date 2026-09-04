import { defineRoute, t } from "@/router"
import type { FavoriteType } from "@IRIS/database"
import { NotFound, Unauthorized } from "@/utils/errors"
import { FavoriteTypeSchema, FavoriteItemSchema } from "./[targetId]/route"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String({ description: "Username or '@me'" }),
    }),
    query: t.Object({
      type: t.Optional(FavoriteTypeSchema),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        data: t.Array(FavoriteItemSchema),
        total: t.Number(),
      }),
    },
    detail: {
      summary: "List all favorites for user",
      description:
        "Retrieves all favorites saved by the specified user or '@me' without pagination.",
      tags: ["Favorites"],
    },
  },

  async GET({ params, query, prisma }) {
    const dbUser = await prisma.user.findFirst({
      where: { username: { equals: params.username, mode: "insensitive" } },
      select: { id: true },
    })
    if (!dbUser) {
      throw new NotFound(`User "${params.username}" not found`)
    }
    const targetUserId = dbUser.id

    const typeFilter = query?.type as FavoriteType | undefined

    const whereClause = {
      userId: targetUserId,
      ...(typeFilter ? { type: typeFilter } : {}),
    }

    const items = await prisma.favorite.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    })

    return {
      success: true,
      data: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        type: item.type,
        targetId: item.targetId,
        createdAt: item.createdAt.toISOString(),
      })),
      total: items.length,
    }
  },
})
