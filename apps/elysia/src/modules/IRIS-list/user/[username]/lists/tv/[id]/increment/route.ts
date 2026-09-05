import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { TvListStatus } from "@IRIS/database"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "TV ID" }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        episode: t.Optional(
          t.Nullable(
            t.Object({
              id: t.Number(),
              seasonNumber: t.Number(),
              episodeNumber: t.Number(),
              title: t.String(),
            })
          )
        ),
        seasonCompleted: t.Boolean(),
        showCompleted: t.Boolean(),
        progress: t.Number(),
        status: t.String(),
      }),
    },
    detail: {
      summary:
        "Increment TV progress to next sequential episode with season auto-completion",
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
      include: {
        seasons: { orderBy: { seasonNumber: "asc" } },
        episodes: {
          orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
        },
      },
    })
    if (!tv) {
      throw new NotFound(`TV with ID ${id} does not exist`)
    }

    // Resolve or create user's TvList entry
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

    // Query watched episodes
    const watchedEpisodes = await prisma.tvWatchedEpisode.findMany({
      where: { tvListId: tvList.id },
      select: { seasonNumber: true, episodeNumber: true },
    })
    const watchedSet = new Set(
      watchedEpisodes.map((we) => `${we.seasonNumber}:${we.episodeNumber}`)
    )

    // Filter for regular episodes (seasonNumber >= 1), or all if only specials exist
    const hasRegular = tv.episodes.some((e) => e.seasonNumber >= 1)
    const eligibleEpisodes = hasRegular
      ? tv.episodes.filter((e) => e.seasonNumber >= 1)
      : tv.episodes

    const nextEpisode = eligibleEpisodes.find(
      (e) => !watchedSet.has(`${e.seasonNumber}:${e.episodeNumber}`)
    )

    if (!nextEpisode) {
      let currentStatus: TvListStatus = tvList.status
      let isCompleted = currentStatus === "COMPLETED"
      const hasScore =
        tvList.score !== null && tvList.score !== undefined && tvList.score > 0
      const maxProg =
        tv.episodeCount && tv.episodeCount > 0
          ? Math.min(tvList.progress, tv.episodeCount)
          : tvList.progress

      if (!isCompleted && hasScore) {
        currentStatus = "COMPLETED"
        isCompleted = true
        await prisma.tvList.update({
          where: { id: tvList.id },
          data: {
            status: "COMPLETED",
            progress: maxProg,
            completedAt: new Date(),
          },
        })
      } else if (maxProg !== tvList.progress) {
        await prisma.tvList.update({
          where: { id: tvList.id },
          data: { progress: maxProg },
        })
      }

      return {
        success: true,
        message: "All available episodes have already been watched",
        episode: null,
        seasonCompleted: false,
        showCompleted: isCompleted,
        progress: maxProg,
        status: currentStatus,
      }
    }

    // Record episode as watched
    await prisma.tvWatchedEpisode.create({
      data: {
        tvListId: tvList.id,
        seasonNumber: nextEpisode.seasonNumber,
        episodeNumber: nextEpisode.episodeNumber,
        episodeId: nextEpisode.id,
        watchedAt: new Date(),
      },
    })

    const newProgress = tvList.progress + 1

    // Check season progress & completion
    const seasonInfo = tv.seasons.find(
      (s) => s.seasonNumber === nextEpisode.seasonNumber
    )
    const seasonEpisodesWatched =
      watchedEpisodes.filter((w) => w.seasonNumber === nextEpisode.seasonNumber)
        .length + 1

    let seasonCompleted = false
    if (
      seasonInfo?.episodeCount &&
      seasonInfo.episodeCount > 0 &&
      seasonEpisodesWatched >= seasonInfo.episodeCount
    ) {
      seasonCompleted = true
    }

    if (seasonInfo) {
      await prisma.tvSeasonProgress.upsert({
        where: {
          tvListId_seasonNumber: {
            tvListId: tvList.id,
            seasonNumber: nextEpisode.seasonNumber,
          },
        },
        create: {
          tvListId: tvList.id,
          seasonId: seasonInfo.id,
          seasonNumber: nextEpisode.seasonNumber,
          status: seasonCompleted ? "COMPLETED" : "WATCHING",
          progress: seasonEpisodesWatched,
          startedAt: new Date(),
          completedAt: seasonCompleted ? new Date() : null,
        },
        update: {
          status: seasonCompleted ? "COMPLETED" : "WATCHING",
          progress: seasonEpisodesWatched,
          ...(seasonCompleted ? { completedAt: new Date() } : {}),
        },
      })
    }

    // Check show completion (guarded against missing episodeCount)
    let finalProgress = newProgress
    let isAllEpisodesWatched = false
    if (tv.episodeCount && tv.episodeCount > 0) {
      if (finalProgress >= tv.episodeCount) {
        finalProgress = tv.episodeCount
        isAllEpisodesWatched = true
      }
    } else {
      const remainingUnwatched = eligibleEpisodes.filter(
        (e) =>
          !watchedSet.has(`${e.seasonNumber}:${e.episodeNumber}`) &&
          !(
            e.seasonNumber === nextEpisode.seasonNumber &&
            e.episodeNumber === nextEpisode.episodeNumber
          )
      )
      if (remainingUnwatched.length === 0) {
        isAllEpisodesWatched = true
      }
    }

    const hasScore =
      tvList.score !== null && tvList.score !== undefined && tvList.score > 0
    let showCompleted = false
    let newStatus: TvListStatus = tvList.status
    let completedAt = tvList.completedAt

    if (isAllEpisodesWatched) {
      if (hasScore) {
        showCompleted = true
        newStatus = "COMPLETED"
        completedAt = new Date()
      } else {
        newStatus = "WATCHING"
      }
    } else if (tvList.status === "PLANNING") {
      newStatus = "WATCHING"
    }

    const updatedList = await prisma.tvList.update({
      where: { id: tvList.id },
      data: {
        status: newStatus,
        progress: finalProgress,
        completedAt,
        ...(tvList.status === "PLANNING" ? { startedAt: new Date() } : {}),
      },
    })

    return {
      success: true,
      message: seasonCompleted
        ? `Marked S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber} watched. Season ${nextEpisode.seasonNumber} completed!`
        : `Marked S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber} watched`,
      episode: {
        id: nextEpisode.id,
        seasonNumber: nextEpisode.seasonNumber,
        episodeNumber: nextEpisode.episodeNumber,
        title: nextEpisode.titlePrimary,
      },
      seasonCompleted,
      showCompleted,
      progress: updatedList.progress,
      status: updatedList.status,
    }
  },
})
