import { defineRoute, t } from "@/router"
import { mediaDbSyncer, queueMovieFetch } from "@/services/media-queue"
import type { Prisma } from "@IRIS/database"
import { NotFound } from "elysia"
import { MovieResponseSchema } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"
import {
  fetchMediaRelations,
  type MediaRelationItem,
} from "@/modules/IRIS-media/helpers/media-relations"

const MOVIE_CACHE_TTL = 5 * 60 // 5 minutes

export const movieInclude = {
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
} as const satisfies Prisma.MovieInclude

export type MovieDetails = NonNullable<
  Prisma.MovieGetPayload<{
    include: typeof movieInclude
  }>
> & {
  relations: MediaRelationItem[]
}

export default defineRoute({
  cacheKeys: {
    movie: {
      id: (id: number) => `movie:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: MovieResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get movie by ID",
      description:
        "Fetches movie details with characters, staff, studios, tags, genres, and media relations.",
      tags: ["Media - Movie"],
    },
  },

  async GET({ params, prisma, cache, cacheKeys, logger }) {
    const id = params.id
    const cacheKey = cacheKeys.movie.id(id)

    const cached = await cache.get<MovieDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.movie.findUnique({
      where: {
        id: id,
      },
      include: movieInclude,
    })

    if (!data) {
      return new NotFound(`Movie not found with ID ${id}`)
    }

    const relations = await fetchMediaRelations(prisma, "MOVIE", data.id)
    const result: MovieDetails = {
      ...data,
      relations,
    }

    await cache.set(cacheKey, result, MOVIE_CACHE_TTL)

    if (data.tvDBId && mediaDbSyncer.isRecordStale(data, "MOVIE")) {
      void queueMovieFetch(data.tvDBId).catch((err) => {
        logger.error(
          `[MovieRoute] Failed to queue background fetch for id ${id} (tvDB id ${data.tvDBId}):`,
          err
        )
      })
    }

    return result
  },
})
