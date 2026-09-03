import { defineRoute, t } from "@/router"
import { mediaDbSyncer, queueTvFetch } from "@/services/media-queue"
import type { Prisma } from "@IRIS/database"
import { NotFound } from "elysia"
import { TvResponseSchema } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"
import {
  fetchMediaRelations,
  type MediaRelationItem,
} from "@/modules/IRIS-media/helpers/media-relations"

const TV_CACHE_TTL = 5 * 60 // 5 minutes

export const tvInclude = {
  characters: {
    include: {
      character: true,
      actor: true,
    },
  },
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
  seasons: {
    orderBy: {
      seasonNumber: "asc",
    },
  },
  episodes: {
    orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
  },
} as const satisfies Prisma.TvInclude

export type TvDetails = NonNullable<
  Prisma.TvGetPayload<{
    include: typeof tvInclude
  }>
> & {
  relations: MediaRelationItem[]
}

export default defineRoute({
  cacheKeys: {
    tv: {
      id: (id: number) => `tv:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: TvResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get TV series by ID",
      description:
        "Fetches TV series details with seasons, episodes, characters, staff, studios, tags, genres, and media relations.",
      tags: ["Media - TV"],
    },
  },

  async GET({ params, prisma, cache, cacheKeys, logger }) {
    const id = params.id
    const cacheKey = cacheKeys.tv.id(id)

    const cached = await cache.get<TvDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.tv.findUnique({
      where: {
        id: id,
      },
      include: tvInclude,
    })

    if (!data) {
      return new NotFound(`TV series not found with ID ${id}`)
    }

    const relations = await fetchMediaRelations(prisma, "TV", data.id)
    const result: TvDetails = {
      ...data,
      relations,
    }

    await cache.set(cacheKey, result, TV_CACHE_TTL)

    if (data.tvDBId && mediaDbSyncer.isRecordStale(data, "TV")) {
      void queueTvFetch(data.tvDBId).catch((err) => {
        logger.error(
          `[TvRoute] Failed to queue background fetch for id ${id} (tvDB id ${data.tvDBId}):`,
          err
        )
      })
    }

    return result
  },
})
