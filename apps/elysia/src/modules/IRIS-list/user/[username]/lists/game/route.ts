import { defineRoute, t } from "@/router"
import {
  ListQuerySchema,
  resolveTargetUserAndAccess,
  parseCommaSeparated,
  parseYears,
  gameSelect,
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
          nextCursor: t.Nullable(t.Number()),
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

    const limit = Number(query?.limit ?? 50)
    const cursor = query?.cursor ? Number(query.cursor) : undefined
    const statuses = parseCommaSeparated(query?.status)
    const mediaStatuses = parseCommaSeparated(query?.mediaStatus)
    const genres = parseCommaSeparated(query?.genres)
    const years = parseYears(query?.year)
    const sortBy = (query?.sortBy ?? "updatedAt") as string
    const order = (query?.order ?? "desc") as "asc" | "desc"

    const whereClause: any = {
      userId: dbUser.id,
      ...(!isOwner ? { private: false } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(mediaStatuses.length > 0 || genres.length > 0 || years.length > 0
        ? {
            game: {
              ...(mediaStatuses.length > 0
                ? { status: { in: mediaStatuses } }
                : {}),
              ...(years.length > 0 ? { releaseDateYear: { in: years } } : {}),
              ...(genres.length > 0
                ? {
                    AND: genres.map((genre) => ({
                      genres: {
                        some: {
                          name: { equals: genre, mode: "insensitive" },
                        },
                      },
                    })),
                  }
                : {}),
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

    const [total, items] = await Promise.all([
      prisma.gameList.count({ where: whereClause }),
      prisma.gameList.findMany({
        where: whereClause,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [orderByClause, { id: "desc" }],
        include: {
          game: { select: gameSelect },
        },
      }),
    ])

    const hasMore = items.length > limit
    const paged = hasMore ? items.slice(0, limit) : items
    const nextCursor =
      hasMore && paged.length > 0 ? paged[paged.length - 1]?.id : null

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
