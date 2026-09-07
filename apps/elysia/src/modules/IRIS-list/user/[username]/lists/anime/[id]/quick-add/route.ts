import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  QuickAddResponseSchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { recordMediaListActivity } from "@/services/activity.service.js"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Anime ID" }),
    }),
    response: {
      200: QuickAddResponseSchema,
    },
    detail: {
      summary: "Quick add anime to list with status PLANNING",
      tags: ["Lists - Anime"],
    },
  },

  async POST({ params, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)

    const anime = await prisma.anime.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
        format: true,
      },
    })
    if (!anime) {
      throw new NotFound(`Anime with ID ${id} does not exist`)
    }

    const existing = await prisma.animeList.findUnique({
      where: {
        userId_animeId: {
          userId: dbUser.id,
          animeId: id,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        message: "Anime is already in list",
      }
    }

    const created = await prisma.animeList.create({
      data: {
        userId: dbUser.id,
        animeId: id,
        status: "PLANNING",
        progress: 0,
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "ANIME",
      mediaId: id,
      action: "ADDED",
      title: anime.titlePrimary || anime.titleSecondary || "Anime",
      coverImage: anime.coverImage,
      bannerImage: anime.bannerImage,
      format: anime.format,
      status: created.status,
      progress: created.progress,
      isPrivate: false,
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added anime to list with status PLANNING",
      entry: {
        id: created.id,
        animeId: created.animeId,
        status: created.status,
        progress: created.progress,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },
})
