import { defineRoute, t } from "@/router"
import {
  ListQuerySchema,
  resolveTargetUserAndAccess,
  parseCommaSeparated,
  parseYears,
  parseMonths,
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
    const validFormats = formats.filter(
      (f): f is "TRACK" | "ALBUM" => f === "TRACK" || f === "ALBUM"
    )
    const genres = parseCommaSeparated(query?.genres)
    const years = parseYears(query?.year)
    const months = parseMonths(query?.month)
    const artists = parseCommaSeparated(query?.artist)
    const sortBy = (query?.sortBy ?? "updatedAt") as string
    const order = (query?.order ?? "desc") as "asc" | "desc"

    const musicConditions: any[] = []

    if (validFormats.length > 0) {
      musicConditions.push({ type: { in: validFormats } })
    }

    if (years.length > 0) {
      musicConditions.push({
        OR: [
          { releaseDateYear: { in: years } },
          { album: { releaseDateYear: { in: years } } },
        ],
      })
    }

    if (months.length > 0) {
      musicConditions.push({
        OR: [
          { releaseDateMonth: { in: months } },
          { album: { releaseDateMonth: { in: months } } },
        ],
      })
    }

    if (artists.length > 0) {
      musicConditions.push({
        OR: artists.flatMap((artist) => [
          { artistName: { contains: artist, mode: "insensitive" } },
          { album: { artistName: { contains: artist, mode: "insensitive" } } },
        ]),
      })
    }

    if (genres.length > 0) {
      // AND conjunction across all selected genres
      genres.forEach((genre) => {
        musicConditions.push({
          OR: [
            {
              genres: {
                some: {
                  name: { equals: genre, mode: "insensitive" },
                },
              },
            },
            {
              album: {
                genres: {
                  some: {
                    name: { equals: genre, mode: "insensitive" },
                  },
                },
              },
            },
          ],
        })
      })
    }

    const whereClause: any = {
      userId: dbUser.id,
      ...(!isOwner ? { private: false } : {}),
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(musicConditions.length > 0
        ? {
            music: {
              AND: musicConditions,
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
        const format = rawMedia?.type || item.itemType || "TRACK"
        const year =
          rawMedia?.releaseDateYear ??
          rawMedia?.album?.releaseDateYear ??
          null
        const month =
          rawMedia?.releaseDateMonth ??
          rawMedia?.album?.releaseDateMonth ??
          null
        const coverImage =
          rawMedia?.coverImage || rawMedia?.album?.coverImage || null
        const artist =
          rawMedia?.artistName || rawMedia?.album?.artistName || null

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
                month,
                releaseDateMonth: month,
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
