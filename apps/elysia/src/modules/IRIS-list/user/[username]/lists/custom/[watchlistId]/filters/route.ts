import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  FilterFacetsResponseSchema,
  aggregateFacetsFromItems,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      watchlistId: t.String({ description: "Watchlist UUID" }),
    }),
    response: {
      200: FilterFacetsResponseSchema,
    },
    detail: {
      summary:
        "Get available filter options from custom watchlist with item counts",
      tags: ["Lists - Custom Watchlist"],
    },
  },

  async GET({ params, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const watchlist = await prisma.watchlist.findUnique({
      where: { id: params.watchlistId },
      select: { id: true, userId: true, isPrivate: true },
    })

    if (!watchlist || watchlist.userId !== dbUser.id) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    if (watchlist.isPrivate && !isOwner) {
      throw new NotFound(`Watchlist "${params.watchlistId}" not found`)
    }

    const entries = await prisma.watchlistEntry.findMany({
      where: { watchlistId: watchlist.id },
      include: {
        anime: {
          select: {
            format: true,
            status: true,
            startDateYear: true,
            genres: { select: { name: true } },
          },
        },
        manga: {
          select: {
            format: true,
            status: true,
            startDateYear: true,
            genres: { select: { name: true } },
          },
        },
        movie: {
          select: {
            status: true,
            releaseDateYear: true,
            genres: { select: { name: true } },
          },
        },
        tv: {
          select: {
            status: true,
            firstAiredYear: true,
            genres: { select: { name: true } },
          },
        },
        game: {
          select: {
            status: true,
            releaseDateYear: true,
            genres: { select: { name: true } },
          },
        },
        book: {
          select: {
            status: true,
            releaseDateYear: true,
            genres: { select: { name: true } },
          },
        },
        album: {
          select: {
            status: true,
            releaseDateYear: true,
            genres: { select: { name: true } },
          },
        },
        track: {
          select: {
            status: true,
            genres: { select: { name: true } },
            album: {
              select: { releaseDateYear: true },
            },
          },
        },
      },
    })

    const items = entries.map((e) => {
      const media =
        e.anime ||
        e.manga ||
        e.movie ||
        e.tv ||
        e.game ||
        e.book ||
        e.album ||
        e.track
      return {
        status: e.mediaType,
        media,
      }
    })

    const facets = aggregateFacetsFromItems(items as any)

    return {
      success: true,
      ...facets,
    }
  },
})
