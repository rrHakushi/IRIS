import { defineRoute, t } from "@/router"
import type { Prisma } from "@IRIS/database"
import { NotFound } from "elysia"
import { PersonResponseSchema } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"

const PERSON_CACHE_TTL = 5 * 60 // 5 minutes

export const personInclude = {
  voicedCharacters: {
    include: {
      character: true,
      anime: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          format: true,
          startDateYear: true,
          averageScore: true,
        },
      },
      movie: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          releaseDateYear: true,
          averageScore: true,
        },
      },
      tv: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          showType: true,
          firstAiredYear: true,
          averageScore: true,
        },
      },
      book: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          coverImage: true,
          bannerImage: true,
          format: true,
          releaseDateYear: true,
          averageScore: true,
        },
      },
    },
    orderBy: {
      order: "asc",
    },
  },
  mediaStaff: {
    include: {
      anime: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          format: true,
          startDateYear: true,
          averageScore: true,
        },
      },
      manga: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          format: true,
          startDateYear: true,
          averageScore: true,
        },
      },
      movie: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          releaseDateYear: true,
          averageScore: true,
        },
      },
      tv: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          showType: true,
          firstAiredYear: true,
          averageScore: true,
        },
      },
      book: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          coverImage: true,
          bannerImage: true,
          format: true,
          releaseDateYear: true,
          averageScore: true,
        },
      },
      album: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          albumType: true,
          releaseDateYear: true,
          popularity: true,
          listeners: true,
          playCount: true,
          lastFmListenersStat: true,
          lastFmPlayCountStat: true,
        },
      },
      track: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          albumId: true,
          trackNumber: true,
          duration: true,
          popularity: true,
          listeners: true,
          playCount: true,
          lastFmListenersStat: true,
          lastFmPlayCountStat: true,
          album: {
            select: {
              id: true,
              titlePrimary: true,
              coverImage: true,
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.PersonInclude

export type PersonDetails = NonNullable<
  Prisma.PersonGetPayload<{
    include: typeof personInclude
  }>
>

export default defineRoute({
  cacheKeys: {
    person: {
      id: (id: number) => `person:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: PersonResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get person by ID",
      description:
        "Fetches person details with voiced characters and staff credits across media.",
      tags: ["Media - Person"],
    },
  },

  async GET({ params, prisma, cache, cacheKeys }) {
    const id = Number(params.id)
    const cacheKey = cacheKeys.person.id(id)

    const cached = await cache.get<PersonDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.person.findUnique({
      where: {
        id: id,
      },
      include: personInclude,
    })

    if (!data) {
      return new NotFound(`Person not found with ID ${id}`)
    }

    // Automatically aggregate artist music (albums and tracks) if present
    if (data.namePrimary) {
      const [artistAlbums, artistTracks] = await Promise.all([
        prisma.musicAlbum.findMany({
          where: { artistName: { equals: data.namePrimary, mode: "insensitive" } },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            bannerImage: true,
            albumType: true,
            releaseDateYear: true,
            popularity: true,
            listeners: true,
            playCount: true,
            lastFmListenersStat: true,
            lastFmPlayCountStat: true,
          },
        }),
        prisma.musicTrack.findMany({
          where: { artistName: { equals: data.namePrimary, mode: "insensitive" } },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            titleNative: true,
            coverImage: true,
            albumId: true,
            trackNumber: true,
            duration: true,
            popularity: true,
            listeners: true,
            playCount: true,
            lastFmListenersStat: true,
            lastFmPlayCountStat: true,
            album: {
              select: {
                id: true,
                titlePrimary: true,
                coverImage: true,
              },
            },
          },
        }),
      ])

      const existingAlbumIds = new Set(
        data.mediaStaff
          .filter((ms) => ms.mediaType === "MUSIC_ALBUM")
          .map((ms) => ms.mediaId)
      )
      for (const alb of artistAlbums) {
        if (!existingAlbumIds.has(alb.id)) {
          ;(data.mediaStaff as any).push({
            id: 0,
            mediaType: "MUSIC_ALBUM",
            mediaId: alb.id,
            personId: data.id,
            role: "ARTIST",
            customRole: null,
            animeId: null,
            mangaId: null,
            movieId: null,
            tvId: null,
            bookId: null,
            albumId: alb.id,
            trackId: null,
            anime: null,
            manga: null,
            movie: null,
            tv: null,
            book: null,
            album: alb,
            track: null,
          })
        }
      }

      const existingTrackIds = new Set(
        data.mediaStaff
          .filter((ms) => ms.mediaType === "MUSIC_TRACK")
          .map((ms) => ms.mediaId)
      )
      for (const trk of artistTracks) {
        if (!existingTrackIds.has(trk.id)) {
          ;(data.mediaStaff as any).push({
            id: 0,
            mediaType: "MUSIC_TRACK",
            mediaId: trk.id,
            personId: data.id,
            role: "ARTIST",
            customRole: null,
            animeId: null,
            mangaId: null,
            movieId: null,
            tvId: null,
            bookId: null,
            albumId: trk.albumId,
            trackId: trk.id,
            anime: null,
            manga: null,
            movie: null,
            tv: null,
            book: null,
            album: null,
            track: trk,
          })
        }
      }
    }

    await cache.set(cacheKey, data, PERSON_CACHE_TTL)
    return data
  },
})
