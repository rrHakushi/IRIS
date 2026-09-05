import { defineRoute, t } from "@/router"
import type { PrismaClient, FavoriteType } from "@IRIS/database"
import { IRISFlags } from "@IRIS/permissions"
import { NotFound, Unauthorized, Forbidden, BadRequest } from "@/utils/errors"

export const FavoriteTypeSchema = t.Union([
  t.Literal("ANIME"),
  t.Literal("MANGA"),
  t.Literal("MOVIE"),
  t.Literal("TV"),
  t.Literal("GAME"),
  t.Literal("BOOK"),
  t.Literal("MUSIC"),
  t.Literal("CHARACTER"),
  t.Literal("PERSON"),
  t.Literal("STUDIO"),
  t.Literal("USER"),
])

export const FavoriteItemSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  type: t.String(),
  targetId: t.Number(),
  createdAt: t.Union([t.Date(), t.String()]),
})

const paramsSchema = t.Object({
  username: t.String({ description: "Target user's username" }),
  targetId: t.Number({ minimum: 1, description: "Target entity ID" }),
})

/**
 * Safely updates the entity's favorites counter in the database.
 */
async function updateEntityFavoritesCounter(
  prisma: PrismaClient,
  type: string,
  targetId: number,
  delta: number
): Promise<void> {
  try {
    switch (type) {
      case "ANIME":
        await prisma.anime.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
      case "MANGA":
        await prisma.manga.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
      case "MOVIE":
        await prisma.movie.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
      case "TV":
        await prisma.tv.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
      case "GAME":
        await prisma.game.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
      case "BOOK":
        await prisma.book.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
      case "MUSIC":
        await prisma.music.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
      case "CHARACTER":
        await prisma.character.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
      case "PERSON":
        await prisma.person.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
      case "STUDIO":
        await prisma.studio.update({
          where: { id: targetId },
          data: { favorites: { increment: delta } },
        })
        break
    }
  } catch {
    // Entity might not exist in database yet; ignore error
  }
}

export default defineRoute({
  schemas: {
    GET: {
      params: paramsSchema,
      query: t.Object({
        type: t.Optional(FavoriteTypeSchema),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          isFavorited: t.Boolean(),
          message: t.String(),
          favorite: t.Nullable(FavoriteItemSchema),
        }),
      },
      detail: {
        summary: "Check if entity is favorited",
        description:
          "Returns whether a specific media item, character, person, or studio is in the user's favorites.",
        tags: ["Favorites"],
      },
    },
    POST: {
      params: paramsSchema,
      body: t.Object({
        type: FavoriteTypeSchema,
        title: t.Optional(
          t.String({ description: "Display title for user feedback" })
        ),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          isFavorited: t.Boolean(),
          action: t.Optional(
            t.Union([t.Literal("added"), t.Literal("removed")])
          ),
          message: t.String(),
          favorite: t.Optional(t.Nullable(FavoriteItemSchema)),
        }),
      },
      detail: {
        summary: "Toggle favorite status",
        description:
          "Adds or removes the specified target entity from the authenticated user's favorites.",
        tags: ["Favorites"],
      },
    },
    DELETE: {
      params: paramsSchema,
      query: t.Object({
        type: t.Optional(FavoriteTypeSchema),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          isFavorited: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Remove from favorites",
        description:
          "Explicitly removes the target entity from user's favorites.",
        tags: ["Favorites"],
      },
    },
  },

  async GET({ params, query, prisma }) {
    const username = String(params.username)
    const targetId = Number(params.targetId)

    const dbUser = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true },
    })
    if (!dbUser) {
      throw new NotFound(`User "${username}" not found`)
    }

    const typeFilter = query?.type as FavoriteType | undefined

    const favorite = typeFilter
      ? await prisma.favorite.findUnique({
          where: {
            userId_type_targetId: {
              userId: dbUser.id,
              type: typeFilter,
              targetId,
            },
          },
        })
      : await prisma.favorite.findFirst({
          where: {
            userId: dbUser.id,
            targetId,
          },
        })

    return {
      success: true,
      isFavorited: Boolean(favorite),
      message: favorite ? "Entity is favorited" : "Entity is not favorited",
      favorite: favorite
        ? {
            id: favorite.id,
            userId: favorite.userId,
            type: favorite.type,
            targetId: favorite.targetId,
            createdAt: favorite.createdAt.toISOString(),
          }
        : null,
    }
  },

  async POST({ params, body, prisma, session }) {
    if (!session.isAuthenticated) {
      throw new Unauthorized("Authentication required to update favorites")
    }

    const currentUser = session.getUser()
    if (!currentUser) {
      throw new Unauthorized("User session not found")
    }

    const username = String(params.username)
    const targetId = Number(params.targetId)

    const payload = body as { type?: FavoriteType; title?: string } | undefined
    if (!payload || !payload.type) {
      throw new BadRequest("Property 'type' is required in request body")
    }

    const isSelf = username.toLowerCase() === currentUser.username.toLowerCase()
    const isAdmin = session.hasPermission(IRISFlags.ADMINISTRATOR)

    if (!isSelf && !isAdmin) {
      throw new Forbidden("Cannot modify favorites for another user")
    }

    const targetUser = isSelf
      ? currentUser
      : await prisma.user.findFirst({
          where: { username: { equals: username, mode: "insensitive" } },
          select: { id: true },
        })

    if (!targetUser) {
      throw new NotFound(`User "${username}" not found`)
    }

    const targetType = payload.type
    const displayTitle = payload.title?.trim() || `${targetType} #${targetId}`

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_type_targetId: {
          userId: targetUser.id,
          type: targetType,
          targetId,
        },
      },
    })

    if (existing) {
      await prisma.favorite.delete({
        where: { id: existing.id },
      })

      await updateEntityFavoritesCounter(
        prisma as unknown as PrismaClient,
        targetType,
        targetId,
        -1
      )

      return {
        success: true,
        isFavorited: false,
        action: "removed" as const,
        message: `Removed ${displayTitle} from favorites`,
        favorite: null,
      }
    }

    const created = await prisma.favorite.create({
      data: {
        userId: targetUser.id,
        type: targetType,
        targetId,
      },
    })

    await updateEntityFavoritesCounter(
      prisma as unknown as PrismaClient,
      targetType,
      targetId,
      1
    )

    return {
      success: true,
      isFavorited: true,
      action: "added" as const,
      message: `Added ${displayTitle} to favorites`,
      favorite: {
        id: created.id,
        userId: created.userId,
        type: created.type,
        targetId: created.targetId,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },

  async DELETE({ params, query, prisma, session }) {
    if (!session.isAuthenticated) {
      throw new Unauthorized("Authentication required to update favorites")
    }

    const currentUser = session.getUser()
    if (!currentUser) {
      throw new Unauthorized("User session not found")
    }

    const username = String(params.username)
    const targetId = Number(params.targetId)

    const isSelf = username.toLowerCase() === currentUser.username.toLowerCase()
    const isAdmin = session.hasPermission(IRISFlags.ADMINISTRATOR)

    if (!isSelf && !isAdmin) {
      throw new Forbidden("Cannot modify favorites for another user")
    }

    const targetUser = isSelf
      ? currentUser
      : await prisma.user.findFirst({
          where: { username: { equals: username, mode: "insensitive" } },
          select: { id: true },
        })

    if (!targetUser) {
      throw new NotFound(`User "${username}" not found`)
    }

    const typeFilter = query?.type as FavoriteType | undefined
    const existing = typeFilter
      ? await prisma.favorite.findUnique({
          where: {
            userId_type_targetId: {
              userId: targetUser.id,
              type: typeFilter,
              targetId,
            },
          },
        })
      : await prisma.favorite.findFirst({
          where: {
            userId: targetUser.id,
            targetId,
          },
        })

    if (!existing) {
      return {
        success: true,
        isFavorited: false,
        message: "Entity was not in favorites",
      }
    }

    await prisma.favorite.delete({
      where: { id: existing.id },
    })

    await updateEntityFavoritesCounter(
      prisma as unknown as PrismaClient,
      existing.type,
      targetId,
      -1
    )

    return {
      success: true,
      isFavorited: false,
      message: `Removed ${existing.type} #${targetId} from favorites`,
    }
  },
})
