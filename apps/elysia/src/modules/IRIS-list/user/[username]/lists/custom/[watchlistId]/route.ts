import { defineRoute, t } from "@/router"
import {
  CustomWatchlistQuerySchema,
  resolveTargetUserAndAccess,
  parseCommaSeparated,
  parseYears,
  animeSelect,
  mangaSelect,
  movieSelect,
  tvSelect,
  gameSelect,
  bookSelect,
  musicSelect,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import type { MediaType } from "@IRIS/database"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      watchlistId: t.String({ description: "Watchlist UUID" }),
    }),
    query: CustomWatchlistQuerySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        watchlist: t.Object({
          id: t.String(),
          name: t.String(),
          description: t.Nullable(t.String()),
          isPrivate: t.Boolean(),
          coverImage: t.Nullable(t.String()),
        }),
        items: t.Array(
          t.Object({
            entry: t.Object({
              id: t.String(),
              watchlistId: t.String(),
              mediaType: t.String(),
              mediaId: t.Number(),
              order: t.Number(),
              customNotes: t.Nullable(t.String()),
              addedAt: t.String(),
            }),
            media: t.Any(),
          })
        ),
        pagination: t.Object({
          nextCursor: t.Nullable(t.String()),
          hasMore: t.Boolean(),
          total: t.Number(),
        }),
      }),
    },
    detail: {
      summary: "Fetch entries of a custom watchlist with cursor pagination",
      tags: ["Lists - Custom Watchlist"],
    },
  },

  async GET({ params, query, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const watchlist = await prisma.watchlist.findUnique({
      where: { id: params.watchlistId },
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        isPrivate: true,
        coverImage: true,
      },
    })

    if (!watchlist || watchlist.userId !== dbUser.id) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    if (watchlist.isPrivate && !isOwner) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    const limit = Number(query?.limit ?? 50)
    const cursor = query?.cursor ? String(query.cursor) : undefined
    const mediaTypes = parseCommaSeparated(query?.mediaType)
    const sortBy = (query?.sortBy ?? "order") as string
    const order = (query?.order ?? "asc") as "asc" | "desc"

    const whereClause: any = {
      watchlistId: watchlist.id,
      ...(mediaTypes.length > 0
        ? { mediaType: { in: mediaTypes as MediaType[] } }
        : {}),
    }

    let orderByClause: any = { [sortBy]: order }
    if (sortBy === "addedAt") {
      orderByClause = { addedAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.watchlistEntry.count({ where: whereClause }),
      prisma.watchlistEntry.findMany({
        where: whereClause,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [orderByClause, { id: "asc" }],
        include: {
          anime: { select: animeSelect },
          manga: { select: mangaSelect },
          movie: { select: movieSelect },
          tv: { select: tvSelect },
          game: { select: gameSelect },
          book: { select: bookSelect },
          music: { select: musicSelect },
        },
      }),
    ])

    const hasMore = entries.length > limit
    const paged = hasMore ? entries.slice(0, limit) : entries
    const nextCursor =
      hasMore && paged.length > 0 ? paged[paged.length - 1]?.id : null

    return {
      success: true,
      watchlist: {
        id: watchlist.id,
        name: watchlist.name,
        description: watchlist.description,
        isPrivate: watchlist.isPrivate,
        coverImage: watchlist.coverImage,
      },
      items: paged.map((entry) => {
        const media =
          entry.anime ||
          entry.manga ||
          entry.movie ||
          entry.tv ||
          entry.game ||
          entry.book ||
          entry.music ||
          null

        return {
          entry: {
            id: entry.id,
            watchlistId: entry.watchlistId,
            mediaType: entry.mediaType,
            mediaId: entry.mediaId,
            order: entry.order,
            customNotes: entry.customNotes,
            addedAt: entry.addedAt.toISOString(),
          },
          media,
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
