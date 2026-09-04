import { defineRoute, t } from "@/router"
import {
  ListQuerySchema,
  resolveTargetUserAndAccess,
  parseCommaSeparated,
  parseYears,
  mangaSelect,
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
              mangaId: t.Number(),
              status: t.String(),
              chaptersProgress: t.Number(),
              volumesProgress: t.Number(),
              score: t.Nullable(t.Number()),
              notes: t.Nullable(t.String()),
              reread: t.Number(),
              private: t.Boolean(),
              startedAt: t.Nullable(t.String()),
              completedAt: t.Nullable(t.String()),
              rereadHistory: t.Optional(t.Any()),
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
      summary: "Fetch user manga list with cursor pagination and multi-filters",
      tags: ["Lists - Manga"],
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
    const formats = parseCommaSeparated(query?.mediaFormat)
    const mediaStatuses = parseCommaSeparated(query?.mediaStatus)
    const genres = parseCommaSeparated(query?.genres)
    const years = parseYears(query?.year)
    const sortBy = (query?.sortBy ?? "updatedAt") as string
    const order = (query?.order ?? "desc") as "asc" | "desc"

    const whereClause: any = {
      userId: dbUser.id,
      ...(!isOwner ? { private: false } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(formats.length > 0 ||
      mediaStatuses.length > 0 ||
      genres.length > 0 ||
      years.length > 0
        ? {
            manga: {
              ...(formats.length > 0 ? { format: { in: formats } } : {}),
              ...(mediaStatuses.length > 0
                ? { status: { in: mediaStatuses } }
                : {}),
              ...(years.length > 0 ? { startDateYear: { in: years } } : {}),
              ...(genres.length > 0
                ? {
                    genres: {
                      some: {
                        name: { in: genres, mode: "insensitive" },
                      },
                    },
                  }
                : {}),
            },
          }
        : {}),
    }

    let orderByClause: any = { [sortBy]: order }
    if (sortBy === "title") {
      orderByClause = { manga: { titlePrimary: order } }
    } else if (sortBy === "progress") {
      orderByClause = { chaptersProgress: order }
    } else if (sortBy === "addedAt") {
      orderByClause = { createdAt: order }
    }

    const [total, items] = await Promise.all([
      prisma.mangaList.count({ where: whereClause }),
      prisma.mangaList.findMany({
        where: whereClause,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [orderByClause, { id: "desc" }],
        include: {
          manga: { select: mangaSelect },
        },
      }),
    ])

    const hasMore = items.length > limit
    const paged = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore && paged.length > 0 ? paged[paged.length - 1]?.id : null

    return {
      success: true,
      items: paged.map((item: any) => ({
        entry: {
          id: item.id,
          mangaId: item.mangaId,
          status: item.status,
          chaptersProgress: item.chaptersProgress,
          volumesProgress: item.volumesProgress,
          score: item.score,
          notes: item.notes,
          reread: item.reread,
          private: item.private,
          startedAt: item.startedAt ? item.startedAt.toISOString() : null,
          completedAt: item.completedAt ? item.completedAt.toISOString() : null,
          rereadHistory: item.rereadHistory,
          connections: item.connections,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
        media: item.manga,
      })),
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    }
  },
})
