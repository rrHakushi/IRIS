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
      id: t.Number({ minimum: 1, description: "Movie ID" }),
    }),
    response: {
      200: QuickAddResponseSchema,
    },
    detail: {
      summary: "Quick add movie to list with status PLANNING",
      tags: ["Lists - Movie"],
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

    const movie = await prisma.movie.findUnique({
      where: { id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        bannerImage: true,
      },
    })
    if (!movie) {
      throw new NotFound(`Movie with ID ${id} does not exist`)
    }

    const existing = await prisma.movieList.findUnique({
      where: {
        userId_movieId: {
          userId: dbUser.id,
          movieId: id,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        message: "Movie is already in list",
      }
    }

    const created = await prisma.movieList.create({
      data: {
        userId: dbUser.id,
        movieId: id,
        status: "PLANNING",
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "MOVIE",
      mediaId: id,
      action: "ADDED",
      title: movie.titlePrimary || movie.titleSecondary || "Movie",
      coverImage: movie.coverImage,
      bannerImage: movie.bannerImage,
      status: created.status,
      isPrivate: false,
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added movie to list with status PLANNING",
      entry: {
        id: created.id,
        movieId: created.movieId,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },
})
