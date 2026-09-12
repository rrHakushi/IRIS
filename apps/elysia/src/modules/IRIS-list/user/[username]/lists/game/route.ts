import { defineRoute, t } from "@/router"
import {
  ListQuerySchema,
  resolveTargetUserAndAccess,
  parseCommaSeparated,
  parseYears,
  gameSelect,
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
              gameId: t.Number(),
              status: t.String(),
              progress: t.Number(),
              score: t.Nullable(t.Number()),
              notes: t.Nullable(t.String()),
              replayed: t.Number(),
              private: t.Boolean(),
              startedAt: t.Nullable(t.String()),
              completedAt: t.Nullable(t.String()),
              replayHistory: t.Optional(t.Any()),
              connections: t.Optional(t.Any()),
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
      summary: "Fetch user game list with cursor pagination and multi-filters",
      tags: ["Lists - Game"],
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

    const searchFilter = await buildMediaSearchFilter(prisma, "Game", query?.q)

    const gameConditions: any[] = []
    if (formats.length > 0) {
      gameConditions.push({ format: { in: formats } })
    }
    if (mediaStatuses.length > 0) {
      gameConditions.push({ status: { in: mediaStatuses } })
    }
    if (years.length > 0) {
      gameConditions.push({ releaseDateYear: { in: years } })
    }
    if (genres.length > 0) {
      genres.forEach((genre) => {
        gameConditions.push({
          genres: {
            some: {
              name: { equals: genre, mode: "insensitive" },
            },
          },
        })
      })
    }
    if (searchFilter) {
      gameConditions.push(searchFilter)
    }

    const whereClause: any = {
      userId: dbUser.id,
      ...(!isOwner ? { private: false } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(gameConditions.length > 0
        ? {
            game: {
              AND: gameConditions,
            },
          }
        : {}),
    }

    let orderByClause: any = { [sortBy]: order }
    if (sortBy === "title") {
      orderByClause = { game: { titlePrimary: order } }
    } else if (sortBy === "addedAt") {
      orderByClause = { createdAt: order }
    }

    const {
      items: paged,
      nextCursor,
      hasMore,
      total,
    } = await fetchPrioritizedList(prisma.gameList, {
      whereClause,
      orderByClause,
      include: {
        game: { select: gameSelect },
      },
      statusPriority: MEDIA_STATUS_PRIORITY.game,
      requestedStatuses: statuses,
      limit,
      cursor,
    })

    return {
      success: true,
      items: paged.map((item: any) => ({
        entry: {
          id: item.id,
          gameId: item.gameId,
          status: item.status,
          progress: item.progress,
          score: item.score,
          notes: item.notes,
          replayed: item.replayed,
          private: item.private,
          startedAt: item.startedAt ? item.startedAt.toISOString() : null,
          completedAt: item.completedAt ? item.completedAt.toISOString() : null,
          replayHistory: item.replayHistory,
          connections: item.connections,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
        media: item.game,
      })),
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    }
  },
})
