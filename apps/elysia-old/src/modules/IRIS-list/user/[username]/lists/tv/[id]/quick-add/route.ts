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
      id: t.Number({ minimum: 1, description: "TV ID" }),
    }),
    response: {
      200: QuickAddResponseSchema,
    },
    detail: {
      summary: "Quick add TV show to list with status PLANNING",
      tags: ["Lists - TV"],
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

    const tv = await prisma.tv.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!tv) {
      throw new NotFound(`TV with ID ${id} does not exist`)
    }

    const existing = await prisma.tvList.findUnique({
      where: {
        userId_tvId: {
          userId: dbUser.id,
          tvId: id,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        message: "TV show is already in list",
      }
    }

    const created = await prisma.tvList.create({
      data: {
        userId: dbUser.id,
        tvId: id,
        status: "PLANNING",
        progress: 0,
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "TV",
      mediaId: id,
      action: "ADDED",
      title: tv.titlePrimary || tv.titleSecondary || "TV",
      coverImage: tv.coverImage,
      bannerImage: tv.bannerImage,
      status: created.status,
      progress: created.progress,
      isPrivate: false,
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added TV show to list with status PLANNING",
      entry: {
        id: created.id,
        tvId: created.tvId,
        status: created.status,
        progress: created.progress,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },
})
