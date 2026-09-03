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

    await cache.set(cacheKey, data, PERSON_CACHE_TTL)
    return data
  },
})
