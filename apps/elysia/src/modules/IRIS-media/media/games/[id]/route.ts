import { defineRoute, t } from "@/router"
import { mediaDbSyncer, queueGameFetch } from "@/services/media-queue"
import type { Prisma } from "@IRIS/database"
import { NotFound } from "elysia"
import { GameResponseSchema } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"
import {
  fetchMediaRelations,
  type MediaRelationItem,
} from "@/modules/IRIS-media/helpers/media-relations"

const GAME_CACHE_TTL = 5 * 60 // 5 minutes

export const gameInclude = {
  genres: true,
  tags: true,
  studios: {
    include: {
      studio: true,
    },
  },
} as const satisfies Prisma.GameInclude

export type GameDetails = NonNullable<
  Prisma.GameGetPayload<{
    include: typeof gameInclude
  }>
> & {
  relations: MediaRelationItem[]
}

export default defineRoute({
  cacheKeys: {
    game: {
      id: (id: number) => `game:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: GameResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get game by ID",
      description:
        "Fetches game details with studios, tags, genres, and media relations.",
      tags: ["Media - Game"],
    },
  },

  async GET({ params, prisma, cache, cacheKeys, logger }) {
    const id = Number(params.id)
    const cacheKey = cacheKeys.game.id(id)

    const cached = await cache.get<GameDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.game.findUnique({
      where: {
        id: id,
      },
      include: gameInclude,
    })

    if (!data) {
      return new NotFound(`Game not found with ID ${id}`)
    }

    const relations = await fetchMediaRelations(prisma, "GAME", data.id)
    const result: GameDetails = {
      ...data,
      relations,
    }

    await cache.set(cacheKey, result, GAME_CACHE_TTL)

    if (data.igdbId && mediaDbSyncer.isRecordStale(data, "GAME")) {
      void queueGameFetch(data.igdbId).catch((err) => {
        logger.error(
          `[GameRoute] Failed to queue background fetch for id ${id} (igdb id ${data.igdbId}):`,
          err
        )
      })
    }

    return result
  },
})
