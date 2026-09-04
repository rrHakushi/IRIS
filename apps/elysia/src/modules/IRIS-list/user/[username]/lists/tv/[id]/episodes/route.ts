import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "TV ID" }),
    }),
    body: t.Object({
      seasonNumber: t.Number({ minimum: 0 }),
      episodeNumber: t.Number({ minimum: 1 }),
      watched: t.Optional(t.Boolean({ default: true })),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        watched: t.Boolean(),
        seasonNumber: t.Number(),
        episodeNumber: t.Number(),
        progress: t.Number(),
      }),
    },
    detail: {
      summary: "Toggle individual episode watched state for TV show",
      tags: ["Lists - TV"],
    },
  },

  async POST({ params, body, prisma, session }) {
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
      select: { id: true },
    })
    if (!tv) {
      throw new NotFound(`TV with ID ${id} does not exist`)
    }

    let tvList = await prisma.tvList.findUnique({
      where: {
        userId_tvId: {
          userId: dbUser.id,
          tvId: id,
        },
      },
    })

    if (!tvList) {
      tvList = await prisma.tvList.create({
        data: {
          userId: dbUser.id,
          tvId: id,
          status: "WATCHING",
          progress: 0,
          startedAt: new Date(),
        },
      })
    }

    const { seasonNumber, episodeNumber } = (body ?? {}) as any
    const shouldBeWatched = (body as any)?.watched ?? true

    const existingWatched = await prisma.tvWatchedEpisode.findUnique({
      where: {
        tvListId_seasonNumber_episodeNumber: {
          tvListId: tvList.id,
          seasonNumber,
          episodeNumber,
        },
      },
    })

    if (shouldBeWatched && !existingWatched) {
      // Find matching episode in database if present
      const episodeRecord = await prisma.tvEpisode.findUnique({
        where: {
          tvId_seasonNumber_episodeNumber: {
            tvId: id,
            seasonNumber,
            episodeNumber,
          },
        },
        select: { id: true },
      })

      await prisma.tvWatchedEpisode.create({
        data: {
          tvListId: tvList.id,
          seasonNumber,
          episodeNumber,
          episodeId: episodeRecord?.id ?? null,
          watchedAt: new Date(),
        },
      })
    } else if (!shouldBeWatched && existingWatched) {
      await prisma.tvWatchedEpisode.delete({
        where: { id: existingWatched.id },
      })
    }

    // Recalculate total progress
    const totalWatchedCount = await prisma.tvWatchedEpisode.count({
      where: { tvListId: tvList.id },
    })

    await prisma.tvList.update({
      where: { id: tvList.id },
      data: { progress: totalWatchedCount },
    })

    return {
      success: true,
      message: shouldBeWatched
        ? `Marked S${seasonNumber}E${episodeNumber} as watched`
        : `Marked S${seasonNumber}E${episodeNumber} as unwatched`,
      watched: shouldBeWatched,
      seasonNumber,
      episodeNumber,
      progress: totalWatchedCount,
    }
  },
})
