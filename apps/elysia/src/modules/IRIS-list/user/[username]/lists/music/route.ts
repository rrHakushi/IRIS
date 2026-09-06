import { defineRoute, t } from "@/router"
import {
  ListQuerySchema,
  resolveTargetUserAndAccess,
  parseCommaSeparated,
  parseYears,
  musicAlbumSelect,
  musicTrackSelect,
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
              musicId: t.Number(),
              albumId: t.Optional(t.Nullable(t.Number())),
              trackId: t.Optional(t.Nullable(t.Number())),
              itemType: t.String(),
              status: t.String(),
              score: t.Nullable(t.Number()),
              progress: t.Number(),
              playCount: t.Number(),
              notes: t.Nullable(t.String()),
              private: t.Boolean(),
              startedAt: t.Nullable(t.String()),
              completedAt: t.Optional(t.Nullable(t.String())),
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
      summary: "Fetch user music list with cursor pagination and multi-filters",
      tags: ["Lists - Music"],
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
    const statuses = parseCommaSeparated(query?.status).map((s) => {
      const upper = s.toUpperCase()
      if (upper === "WATCHING" || upper === "READING" || upper === "PLAYING") {
        return "LISTENING"
      }
      return upper
    })
    const formats = parseCommaSeparated(query?.mediaFormat).map((f) =>
      f.toUpperCase()
    )
    const genres = parseCommaSeparated(query?.genres)
    const years = parseYears(query?.year)
    const sortBy = (query?.sortBy ?? "updatedAt") as string
    const order = (query?.order ?? "desc") as "asc" | "desc"

    const whereClause: any = {
      userId: dbUser.id,
      ...(!isOwner ? { private: false } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(formats.length > 0 ? { itemType: { in: formats } } : {}),
      ...(genres.length > 0 || years.length > 0
        ? {
            music: {
              ...(years.length > 0
                ? { releaseDateYear: { in: years } }
                : {}),
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
      orderByClause = { id: order }
    } else if (sortBy === "progress") {
      orderByClause = { playCount: order }
    } else if (sortBy === "addedAt") {
      orderByClause = { createdAt: order }
    }

    const [total, items] = await Promise.all([
      prisma.musicList.count({ where: whereClause }),
      prisma.musicList.findMany({
        where: whereClause,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [orderByClause, { id: "desc" }],
        include: {
          music: { select: musicAlbumSelect },
        },
      }),
    ])

    const hasMore = items.length > limit
    const paged = hasMore ? items.slice(0, limit) : items
    const nextCursor =
      hasMore && paged.length > 0 ? paged[paged.length - 1]?.id : null

    return {
      success: true,
      items: paged.map((item: any) => {
        const rawMedia = item.music
        const format = item.itemType || item.music?.type || "TRACK"
        const year =
          item.music?.releaseDateYear ??
          item.music?.album?.releaseDateYear ??
          null
        const coverImage =
          item.music?.coverImage || item.music?.album?.coverImage || null
        const artist = item.music?.artistName || null

        return {
          entry: {
            id: item.id,
            musicId: item.musicId,
            albumId: item.music?.type === "ALBUM" ? item.musicId : (item.music?.albumId ?? null),
            trackId: item.music?.type === "TRACK" ? item.musicId : null,
            itemType: format,
            status: item.status,
            score: item.score,
            progress: item.playCount ?? 0,
            playCount: item.playCount ?? 0,
            notes: item.notes,
            private: item.private,
            startedAt: item.startedAt ? item.startedAt.toISOString() : null,
            completedAt: item.completedAt
              ? item.completedAt.toISOString()
              : null,
            connections: item.connections,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          },
          media: rawMedia
            ? {
                ...rawMedia,
                coverImage,
                format,
                year,
                startDateYear: year,
                releaseDateYear: year,
                artist,
                artistName: artist,
              }
            : null,
        }
      }),
      pagination: {
        nextCursor,
        hasMore,
        total,
      },
    }
  },
})
