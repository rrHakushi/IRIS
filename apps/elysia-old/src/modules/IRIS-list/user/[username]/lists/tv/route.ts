import { defineRoute, t } from "@/router"
import {
  ListQuerySchema,
  resolveTargetUserAndAccess,
  parseCommaSeparated,
  parseYears,
  tvSelect,
  buildMediaSearchFilter,
  fetchPrioritizedList,
  MEDIA_STATUS_PRIORITY,
} from "@/modules/IRIS-list/helpers"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
    query: ListQuerySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        items: t.Array(
          t.Object({
            entry: t.Object({
              id: t.Number(),
              tvId: t.Number(),
              status: t.String(),
              progress: t.Number(),
              score: t.Nullable(t.Number()),
              notes: t.Nullable(t.String()),
              rewatched: t.Number(),
              private: t.Boolean(),
              startedAt: t.Nullable(t.String()),
              completedAt: t.Nullable(t.String()),
              rewatchHistory: t.Optional(t.Any()),
              connections: t.Optional(t.Any()),
              seasons: t.Optional(t.Array(t.Any())),
              watchedEpisodes: t.Optional(t.Array(t.Any())),
              watchedEpisodesCount: t.Optional(t.Number()),
              createdAt: t.String(),
              updatedAt: t.String(),
            }),
            media: t.Any(),
          })
        ),
        pagination: t.Object({
          nextCursor: t.Nullable(t.Union([t.String(), t.Number()])),
          hasMore: t.Boolean(),
          total: t.Number(),
        }),
      }),
    },
    detail: {
      summary: "Fetch user TV list with cursor pagination and multi-filters",
      tags: ["Lists - TV"],
    },
  },

  async GET({ params, query, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const limit = Number(query?.limit ?? 30)
    const cursor = query?.cursor as string | number | undefined
    const statuses = parseCommaSeparated(query?.status)
    const formats = parseCommaSeparated(query?.mediaFormat)
    const mediaStatuses = parseCommaSeparated(query?.mediaStatus)
    const genres = parseCommaSeparated(query?.genres)
    const years = parseYears(query?.year)
    const sortBy = (query?.sortBy ?? "updatedAt") as string
    const order = (query?.order ?? "desc") as "asc" | "desc"

    const searchFilter = await buildMediaSearchFilter(prisma, "Tv", query?.q)

    const tvConditions: any[] = []
    if (formats.length > 0) {
      tvConditions.push({ showType: { in: formats, mode: "insensitive" } })
    }
    if (mediaStatuses.length > 0) {
      tvConditions.push({ status: { in: mediaStatuses } })
    }
    if (years.length > 0) {
      tvConditions.push({ firstAiredYear: { in: years } })
    }
    if (genres.length > 0) {
      genres.forEach((genre) => {
        tvConditions.push({
          genres: {
            some: {
              name: { equals: genre, mode: "insensitive" },
            },
          },
        })
      })
    }
    if (searchFilter) {
      tvConditions.push(searchFilter)
    }

    const whereClause: any = {
      userId: dbUser.id,
      ...(!isOwner ? { private: false } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(tvConditions.length > 0
        ? {
            tv: {
              AND: tvConditions,
            },
          }
        : {}),
    }

    let orderByClause: any = { [sortBy]: order }
    if (sortBy === "title") {
      orderByClause = { tv: { titlePrimary: order } }
    } else if (sortBy === "addedAt") {
      orderByClause = { createdAt: order }
    }

    const {
      items: paged,
      nextCursor,
      hasMore,
      total,
    } = await fetchPrioritizedList(prisma.tvList, {
      whereClause,
      orderByClause,
      include: {
        tv: { select: tvSelect },
        seasons: true,
        watchedEpisodes: {
          select: {
            seasonNumber: true,
            episodeNumber: true,
            watchedAt: true,
          },
        },
        _count: {
          select: { watchedEpisodes: true },
        },
      },
      statusPriority: MEDIA_STATUS_PRIORITY.tv,
      requestedStatuses: statuses,
      limit,
      cursor,
    })

    return {
      success: true,
      items: paged.map((item: any) => ({
        entry: {
          id: item.id,
          tvId: item.tvId,
          status: item.status,
          progress: item.progress,
          score: item.score,
          notes: item.notes,
          rewatched: item.rewatched,
          private: item.private,
          startedAt: item.startedAt ? item.startedAt.toISOString() : null,
          completedAt: item.completedAt ? item.completedAt.toISOString() : null,
          rewatchHistory: item.rewatchHistory,
          connections: item.connections,
          seasons: item.seasons,
          watchedEpisodes: item.watchedEpisodes
            ? item.watchedEpisodes.map((we: any) => ({
                seasonNumber: we.seasonNumber,
                episodeNumber: we.episodeNumber,
                watchedAt: we.watchedAt
                  ? we.watchedAt.toISOString()
                  : new Date().toISOString(),
              }))
            : [],
          watchedEpisodesCount: item._count?.watchedEpisodes ?? 0,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
        media: item.tv,
      })),
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    }
  },
})
