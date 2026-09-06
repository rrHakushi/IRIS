import { defineRoute, t } from "@/router"
import {
  CustomWatchlistQuerySchema,
  resolveTargetUserAndAccess,
  assertIsOwner,
  parseCommaSeparated,
  parseYears,
  animeSelect,
  mangaSelect,
  movieSelect,
  tvSelect,
  gameSelect,
  bookSelect,
  musicAlbumSelect,
  musicTrackSelect,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import type { MediaType } from "@IRIS/database"

const CustomListEntryMediaTypeSchema = t.Union([
  t.Literal("ANIME"),
  t.Literal("MANGA"),
  t.Literal("MOVIE"),
  t.Literal("TV"),
  t.Literal("GAME"),
  t.Literal("BOOK"),
  t.Literal("MUSIC"),
  t.Literal("MUSIC_ALBUM"),
  t.Literal("MUSIC_TRACK"),
])

const CustomListMediaItemSchema = t.Nullable(
  t.Object({
    id: t.Number(),
    titlePrimary: t.String(),
    titleSecondary: t.Optional(t.Nullable(t.String())),
    titleNative: t.Optional(t.Nullable(t.String())),
    coverImage: t.Optional(t.Nullable(t.String())),
    bannerImage: t.Optional(t.Nullable(t.String())),
    status: t.Optional(t.Nullable(t.String())),
    format: t.Optional(t.Nullable(t.String())),
    averageScore: t.Optional(t.Nullable(t.Number())),
    artistName: t.Optional(t.Nullable(t.String())),
    type: t.Optional(t.Nullable(t.String())),
    duration: t.Optional(t.Nullable(t.Number())),
    recordType: t.Optional(t.Nullable(t.String())),
  })
)

export default defineRoute({
  schemas: {
    GET: {
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
                mediaType: CustomListEntryMediaTypeSchema,
                mediaId: t.Number(),
                order: t.Number(),
                customNotes: t.Nullable(t.String()),
                addedAt: t.String(),
              }),
              media: CustomListMediaItemSchema,
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
    DELETE: {
      params: t.Object({
        username: t.String(),
        watchlistId: t.String({ description: "Watchlist UUID" }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
      detail: {
        summary: "Delete a custom watchlist and its entries",
        tags: ["Lists - Custom Watchlist"],
      },
    },
  },

  async DELETE({ params, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, dbUser.username)

    const watchlist = await prisma.customList.findUnique({
      where: { id: params.watchlistId },
    })
    if (!watchlist || watchlist.userId !== dbUser.id) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    await prisma.customList.delete({
      where: { id: params.watchlistId },
    })

    return {
      success: true,
      message: `Watchlist "${watchlist.name}" deleted successfully`,
    }
  },

  async GET({ params, query, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const watchlist = await prisma.customList.findUnique({
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
      listId: watchlist.id,
      ...(mediaTypes.length > 0
        ? { mediaType: { in: mediaTypes as MediaType[] } }
        : {}),
    }

    let orderByClause: any = { [sortBy]: order }
    if (sortBy === "addedAt") {
      orderByClause = { addedAt: order }
    }

    const [total, entries] = await Promise.all([
      prisma.customListEntry.count({ where: whereClause }),
      prisma.customListEntry.findMany({
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
          music: { select: musicAlbumSelect },
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
            watchlistId: entry.listId,
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
