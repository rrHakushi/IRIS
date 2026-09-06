import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
} from "@/modules/IRIS-list/helpers"
import type { MediaType } from "@IRIS/database"

const WatchlistSummarySchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Nullable(t.String()),
  isPrivate: t.Boolean(),
  isDefault: t.Boolean(),
  coverImage: t.Nullable(t.String()),
  order: t.Number(),
  entriesCount: t.Number(),
  containsMedia: t.Optional(t.Boolean()),
  createdAt: t.String(),
  updatedAt: t.String(),
})

export default defineRoute({
  schemas: {
    GET: {
      params: t.Object({
        username: t.String(),
      }),
      query: t.Object({
        mediaType: t.Optional(
          t.Union([
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
        ),
        mediaId: t.Optional(t.Number({ minimum: 1 })),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          watchlists: t.Array(WatchlistSummarySchema),
        }),
      },
      detail: {
        summary: "Get user's custom watchlists with entry indicators",
        tags: ["Lists - Custom Watchlist"],
      },
    },
    POST: {
      params: t.Object({
        username: t.String(),
      }),
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.Nullable(t.String())),
        isPrivate: t.Optional(t.Boolean({ default: false })),
        coverImage: t.Optional(t.Nullable(t.String())),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          watchlist: WatchlistSummarySchema,
        }),
      },
      detail: {
        summary: "Create a new custom watchlist",
        tags: ["Lists - Custom Watchlist"],
      },
    },
  },

  async GET({ params, query, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const watchlists = await prisma.customList.findMany({
      where: {
        userId: dbUser.id,
        ...(isOwner ? {} : { isPrivate: false }),
      },
      orderBy: [{ isDefault: "desc" }, { order: "asc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { entries: true },
        },
        ...(query?.mediaType && query?.mediaId
          ? {
              entries: {
                where: {
                  mediaType:
                    query.mediaType === "MUSIC"
                      ? { in: ["MUSIC", "MUSIC_ALBUM", "MUSIC_TRACK"] as MediaType[] }
                      : (query.mediaType as MediaType),
                  mediaId: Number(query.mediaId),
                },
                select: { id: true },
              },
            }
          : {}),
      },
    })

    return {
      success: true,
      watchlists: watchlists.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        isPrivate: w.isPrivate,
        isDefault: w.isDefault,
        coverImage: w.coverImage,
        order: w.order,
        entriesCount: w._count.entries,
        containsMedia:
          query?.mediaType && query?.mediaId
            ? (w as any).entries?.length > 0
            : undefined,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    }
  },

  async POST({ params, body, session, prisma }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const b = body as {
      name: string
      description?: string | null
      isPrivate?: boolean
      coverImage?: string | null
    }

    const created = await prisma.customList.create({
      data: {
        userId: dbUser.id,
        name: b.name.trim(),
        description: b.description?.trim() || null,
        isPrivate: b.isPrivate ?? false,
        coverImage: b.coverImage?.trim() || null,
      },
      include: {
        _count: {
          select: { entries: true },
        },
      },
    })

    return {
      success: true,
      message: `Watchlist "${created.name}" created successfully`,
      watchlist: {
        id: created.id,
        name: created.name,
        description: created.description,
        isPrivate: created.isPrivate,
        isDefault: created.isDefault,
        coverImage: created.coverImage,
        order: created.order,
        entriesCount: created._count.entries,
        containsMedia: false,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    }
  },
})
