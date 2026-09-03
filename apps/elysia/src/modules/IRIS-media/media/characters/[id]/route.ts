import { defineRoute, t } from "@/router"
import type { Prisma } from "@IRIS/database"
import { NotFound } from "elysia"
import { CharacterResponseSchema } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"

const CHARACTER_CACHE_TTL = 5 * 60 // 5 minutes

export const characterInclude = {
  mediaCharacters: {
    include: {
      actor: true,
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
    orderBy: {
      order: "asc",
    },
  },
} as const satisfies Prisma.CharacterInclude

export type CharacterDetails = NonNullable<
  Prisma.CharacterGetPayload<{
    include: typeof characterInclude
  }>
>

export default defineRoute({
  cacheKeys: {
    character: {
      id: (id: number) => `character:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: CharacterResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get character by ID",
      description:
        "Fetches character details with media appearances (anime, manga, movie, tv, book) and voice actors.",
      tags: ["Media - Character"],
    },
  },

  async GET({ params, prisma, cache, cacheKeys }) {
    const id = Number(params.id)
    const cacheKey = cacheKeys.character.id(id)

    const cached = await cache.get<CharacterDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.character.findUnique({
      where: {
        id: id,
      },
      include: characterInclude,
    })

    if (!data) {
      return new NotFound(`Character not found with ID ${id}`)
    }

    await cache.set(cacheKey, data, CHARACTER_CACHE_TTL)
    return data
  },
})
