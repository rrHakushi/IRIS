import { defineRoute, t } from "@/router"
import type { Prisma } from "@IRIS/database"
import { NotFound, type UnwrapSchema } from "elysia"
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
      music: {
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          type: true,
          releaseDateYear: true,
          popularity: true,
          listeners: true,
          playCount: true,
        },
      },
    },
  },
  musicTracks: {
    select: {
      id: true,
      titlePrimary: true,
      titleSecondary: true,
      type: true,
      coverImage: true,
      duration: true,
      popularity: true,
      releaseDateYear: true,
      recordType: true,
      albumId: true,
      trackPosition: true,
      listeners: true,
      playCount: true,
      album: {
        select: {
          id: true,
          titlePrimary: true,
          coverImage: true,
        },
      },
    },
    take: 50,
    orderBy: { popularity: "desc" },
  },
} as const satisfies Prisma.PersonInclude

export type PersonDetails = UnwrapSchema<typeof PersonResponseSchema>

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

    // Automatically aggregate artist music if present and not already linked
    const musicTracks =
      data.musicTracks.length > 0
        ? data.musicTracks
        : data.namePrimary
          ? await prisma.music.findMany({
              where: {
                artistName: { equals: data.namePrimary, mode: "insensitive" },
              },
              select: {
                id: true,
                titlePrimary: true,
                titleSecondary: true,
                type: true,
                coverImage: true,
                duration: true,
                popularity: true,
                releaseDateYear: true,
                recordType: true,
                albumId: true,
                trackPosition: true,
                listeners: true,
                playCount: true,
                album: {
                  select: {
                    id: true,
                    titlePrimary: true,
                    coverImage: true,
                  },
                },
              },
              take: 50,
              orderBy: { popularity: "desc" },
            })
          : []

    const result = {
      ...data,
      musicTracks,
    }

    await cache.set(cacheKey, result, PERSON_CACHE_TTL)
    return result
  },
})
