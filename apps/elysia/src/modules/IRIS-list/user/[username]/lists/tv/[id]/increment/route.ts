import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { TvListStatus } from "@IRIS/database"
import { recordMediaListActivity } from "@/services/activity.service.js"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "TV ID" }),
    }),
    body: t.Optional(
      t.Object({
        count: t.Optional(t.Number({ minimum: 1 })),
        type: t.Optional(
          t.Union([
            t.Literal("EPISODE"),
            t.Literal("SEASON"),
            t.Literal("episode"),
            t.Literal("season"),
          ])
        ),
      })
    ),
    query: t.Optional(
      t.Object({
        type: t.Optional(
          t.Union([
            t.Literal("EPISODE"),
            t.Literal("SEASON"),
            t.Literal("episode"),
            t.Literal("season"),
          ])
        ),
      })
    ),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        episode: t.Optional(
          t.Nullable(
            t.Object({
              id: t.Optional(t.Number()),
              seasonNumber: t.Number(),
              episodeNumber: t.Optional(t.Number()),
              title: t.Optional(t.String()),
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
        "Increment TV progress to next sequential episode or season with overflow guards",
      tags: ["Lists - TV"],
    },
  },

  async POST({ params, body, query, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)
    const rawType = (body as any)?.type || (query as any)?.type || "EPISODE"
    const isSeasonIncrement = String(rawType).toUpperCase() === "SEASON"

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

    const maxEpisodes =
      tv.episodeCount && tv.episodeCount > 0
        ? tv.episodeCount
        : tv.episodes.length > 0
          ? tv.episodes.length
          : null

    const maxSeasons =
      tv.seasonCount && tv.seasonCount > 0
        ? tv.seasonCount
        : tv.seasons.length > 0
          ? tv.seasons.length
          : null

    // -------------------------------------------------------------------------
    // A. Season Increment Flow
    // -------------------------------------------------------------------------
    if (isSeasonIncrement) {
      const completedSeasonRecords = await prisma.tvSeasonProgress.findMany({
        where: {
          tvListId: tvList.id,
          status: "COMPLETED",
        },
        select: { seasonNumber: true },
      })
      const completedSeasonNums = new Set(
        completedSeasonRecords.map((s) => s.seasonNumber)
      )

      if (maxSeasons !== null && completedSeasonRecords.length >= maxSeasons) {
        const clampedProg =
          maxEpisodes !== null
            ? Math.min(tvList.progress, maxEpisodes)
            : tvList.progress
        const updatedList = await prisma.tvList.update({
          where: { id: tvList.id },
          data: {
            status: "COMPLETED",
            progress: clampedProg,
            completedAt: tvList.completedAt || new Date(),
          },
        })
        return {
          success: true,
          message: `Already at maximum seasons (${maxSeasons}/${maxSeasons})`,
          episode: null,
          seasonCompleted: true,
          showCompleted: true,
          progress: updatedList.progress,
          status: updatedList.status,
        }
      }

      // Find the next incomplete season
      const eligibleSeasons =
        tv.seasons.length > 0
          ? tv.seasons.filter((s) => s.seasonNumber >= 1)
          : Array.from({ length: maxSeasons || 1 }, (_, i) => ({
              id: 0,
              seasonNumber: i + 1,
              episodeCount: 0,
            }))

      const nextSeason =
        eligibleSeasons.find((s) => !completedSeasonNums.has(s.seasonNumber)) ||
        eligibleSeasons[0]

      const targetSeasonNumber = nextSeason ? nextSeason.seasonNumber : 1
      const seasonEpisodes = tv.episodes.filter(
        (e) => e.seasonNumber === targetSeasonNumber
      )

      // Mark all episodes in this season as watched
      if (seasonEpisodes.length > 0) {
        await prisma.tvWatchedEpisode.createMany({
          data: seasonEpisodes.map((ep) => ({
            tvListId: tvList.id,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
            episodeId: ep.id,
            watchedAt: new Date(),
          })),
          skipDuplicates: true,
        })
      }

      const seasonEpisodeCount =
        nextSeason?.episodeCount && nextSeason.episodeCount > 0
          ? nextSeason.episodeCount
          : seasonEpisodes.length

      if (nextSeason && nextSeason.id > 0) {
        await prisma.tvSeasonProgress.upsert({
          where: {
            tvListId_seasonNumber: {
              tvListId: tvList.id,
              seasonNumber: targetSeasonNumber,
            },
          },
          create: {
            tvListId: tvList.id,
            seasonId: nextSeason.id,
            seasonNumber: targetSeasonNumber,
            status: "COMPLETED",
            progress: seasonEpisodeCount,
            startedAt: new Date(),
            completedAt: new Date(),
          },
          update: {
            status: "COMPLETED",
            progress: seasonEpisodeCount,
            completedAt: new Date(),
          },
        })
      }

      const totalWatchedCount = await prisma.tvWatchedEpisode.count({
        where: { tvListId: tvList.id },
      })
      let newTotalProgress =
        totalWatchedCount > 0
          ? totalWatchedCount
          : tvList.progress + seasonEpisodeCount

      let isShowCompleted = false
      if (maxEpisodes !== null && newTotalProgress >= maxEpisodes) {
        newTotalProgress = maxEpisodes
        isShowCompleted = true
      }
      if (
        maxSeasons !== null &&
        completedSeasonRecords.length + 1 >= maxSeasons
      ) {
        isShowCompleted = true
      }

      const updatedList = await prisma.tvList.update({
        where: { id: tvList.id },
        data: {
          status: isShowCompleted ? "COMPLETED" : "WATCHING",
          progress: newTotalProgress,
          completedAt: isShowCompleted
            ? tvList.completedAt || new Date()
            : tvList.completedAt,
          ...(tvList.status === "PLANNING" ? { startedAt: new Date() } : {}),
        },
      })

      recordMediaListActivity({
        userId: dbUser.id,
        mediaType: "TV",
        mediaId: id,
        action: isShowCompleted ? "COMPLETED" : "PROGRESS_CHANGED",
        title: tv.titlePrimary || tv.titleSecondary || "TV",
        coverImage: tv.coverImage,
        bannerImage: tv.bannerImage,
        format: "TV",
        status: updatedList.status,
        progress: updatedList.progress,
        score: tvList.score,
        prevStatus: tvList.status,
        prevProgress: tvList.progress,
        prevScore: tvList.score,
        isPrivate: tvList.private,
      })

      return {
        success: true,
        message: `Season ${targetSeasonNumber} marked completed`,
        episode: {
          seasonNumber: targetSeasonNumber,
        },
        seasonCompleted: true,
        showCompleted: isShowCompleted,
        progress: updatedList.progress,
        status: updatedList.status,
      }
    }

    // -------------------------------------------------------------------------
    // B. Episode Increment Flow
    // -------------------------------------------------------------------------
    // Overflow guard: if already at or beyond maxEpisodes, clamp and return
    if (maxEpisodes !== null && tvList.progress >= maxEpisodes) {
      let clampedEntry = tvList
      if (tvList.progress > maxEpisodes || tvList.status !== "COMPLETED") {
        clampedEntry = await prisma.tvList.update({
          where: { id: tvList.id },
          data: {
            status: "COMPLETED",
            progress: maxEpisodes,
            completedAt: tvList.completedAt || new Date(),
          },
        })
      }

      return {
        success: true,
        message: `Already at maximum episodes (${maxEpisodes}/${maxEpisodes})`,
        episode: null,
        seasonCompleted: false,
        showCompleted: true,
        progress: clampedEntry.progress,
        status: clampedEntry.status,
      }
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

    // Handle case where TV has no episode rows in DB, but has episodeCount
    if (!nextEpisode && eligibleEpisodes.length === 0) {
      const count = (body as any)?.count ?? 1
      let newProg = tvList.progress + count
      let isCompleted = false
      if (maxEpisodes !== null && newProg >= maxEpisodes) {
        newProg = maxEpisodes
        isCompleted = true
      }

      const updatedList = await prisma.tvList.update({
        where: { id: tvList.id },
        data: {
          status: isCompleted ? "COMPLETED" : "WATCHING",
          progress: newProg,
          completedAt: isCompleted
            ? tvList.completedAt || new Date()
            : tvList.completedAt,
          ...(tvList.status === "PLANNING" ? { startedAt: new Date() } : {}),
        },
      })

      recordMediaListActivity({
        userId: dbUser.id,
        mediaType: "TV",
        mediaId: id,
        action: isCompleted ? "COMPLETED" : "PROGRESS_CHANGED",
        title: tv.titlePrimary || tv.titleSecondary || "TV",
        coverImage: tv.coverImage,
        bannerImage: tv.bannerImage,
        format: "TV",
        status: updatedList.status,
        progress: updatedList.progress,
        score: tvList.score,
        prevStatus: tvList.status,
        prevProgress: tvList.progress,
        prevScore: tvList.score,
        isPrivate: tvList.private,
      })

      return {
        success: true,
        message: `Marked episode ${newProg} watched`,
        episode: {
          seasonNumber: 1,
          episodeNumber: newProg,
        },
        seasonCompleted: false,
        showCompleted: isCompleted,
        progress: updatedList.progress,
        status: updatedList.status,
      }
    }

    if (!nextEpisode) {
      const clampedProg =
        maxEpisodes !== null
          ? Math.min(tvList.progress, maxEpisodes)
          : tvList.progress
      await prisma.tvList.update({
        where: { id: tvList.id },
        data: {
          status: "COMPLETED",
          progress: clampedProg,
          completedAt: tvList.completedAt || new Date(),
        },
      })

      return {
        success: true,
        message: "All available episodes have already been watched",
        episode: null,
        seasonCompleted: false,
        showCompleted: true,
        progress: clampedProg,
        status: "COMPLETED",
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
    if (maxEpisodes !== null && finalProgress >= maxEpisodes) {
      finalProgress = maxEpisodes
      isAllEpisodesWatched = true
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

    let showCompleted = false
    let newStatus: TvListStatus = tvList.status
    let completedAt = tvList.completedAt

    if (isAllEpisodesWatched) {
      showCompleted = true
      newStatus = "COMPLETED"
      completedAt = completedAt || new Date()
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

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "TV",
      mediaId: id,
      action: showCompleted ? "COMPLETED" : "PROGRESS_CHANGED",
      title: tv.titlePrimary || tv.titleSecondary || "TV",
      coverImage: tv.coverImage,
      bannerImage: tv.bannerImage,
      format: "TV",
      status: updatedList.status,
      progress: updatedList.progress,
      score: tvList.score,
      prevStatus: tvList.status,
      prevProgress: tvList.progress,
      prevScore: tvList.score,
      isPrivate: tvList.private,
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
