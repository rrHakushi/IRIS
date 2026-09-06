import { defineRoute, t } from "@/router"
import { mediaDbSyncer, queueAnimeFetch } from "@/services/media-queue"
import type { Prisma } from "@IRIS/database"
import { NotFound } from "elysia"
import { AnimeResponseSchema } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"
import {
  fetchMediaRelations,
  type MediaRelationItem,
} from "@/modules/IRIS-media/helpers/media-relations"

const ANIME_CACHE_TTL = 5 * 60 // 5 minutes

export const animeInclude = {
  characters: {
    include: {
      character: true,
      actor: true,
    },
  },
  airingSchedule: { orderBy: { episodeNumber: "asc" } },
  episodes: { orderBy: { number: "asc" } },
  genres: true,
  tags: true,
  staff: {
    include: {
      person: true,
    },
  },
  studios: {
    include: {
      studio: true,
    },
  },
} as const satisfies Prisma.AnimeInclude

export type AnimeDetails = NonNullable<
  Prisma.AnimeGetPayload<{
    include: typeof animeInclude
  }>
> & {
  relations: MediaRelationItem[]
}

export default defineRoute({
  cacheKeys: {
    anime: {
      id: (id: number) => `anime:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: AnimeResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get anime by ID",
      description:
        "Fetches anime details with characters, staff, studios, episodes, tags, airing schedules, and media relations.",
      tags: ["Media - Anime"],
    },
  },

  async GET({ params, prisma, cache, cacheKeys, logger }) {
    const id = Number(params.id)
    const cacheKey = cacheKeys.anime.id(id)

    const cached = await cache.get<AnimeDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.anime.findUnique({
      where: {
        id: id,
      },
      include: animeInclude,
    })

    if (!data) {
      return new NotFound(`Anime not found with ID ${id}`)
    }

    const relations = await fetchMediaRelations(prisma, "ANIME", data.id)
    const result: AnimeDetails = {
      ...data,
      relations,
    }

    await cache.set(cacheKey, result, ANIME_CACHE_TTL)

    if (data.anilistId && mediaDbSyncer.isRecordStale(data, "ANIME")) {
      void queueAnimeFetch(data.anilistId).catch((err) => {
        logger.error(
          `[AnimeRoute] Failed to queue background fetch for id ${id} (anilist id ${data.anilistId}):`,
          err
        )
      })
    }

    return result
  },
})
