import { defineRoute, t } from "@/router"
import { mediaDbSyncer, queueMusicFetch } from "@/services/media-queue"
import type { Prisma } from "@IRIS/database"
import { NotFound } from "elysia"
import { MusicResponseSchema } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"
import {
  fetchMediaRelations,
  type MediaRelationItem,
} from "@/modules/IRIS-media/helpers/media-relations"

const MUSIC_CACHE_TTL = 60 * 60 * 12 // 12 hours

export const musicInclude = {
  genres: true,
  tags: true,
} as const satisfies Prisma.MusicInclude

export type MusicDetails = NonNullable<
  Prisma.MusicGetPayload<{
    include: typeof musicInclude
  }>
> & {
  relations: MediaRelationItem[]
}

export default defineRoute({
  cacheKeys: {
    music: {
      id: (id: number) => `music:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: MusicResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get music by ID",
      description:
        "Fetches music details with tags, genres, and media relations.",
      tags: ["Media - Music"],
    },
  },

  async GET({ params, prisma, cache, cacheKeys, logger }) {
    const id = params.id
    const cacheKey = cacheKeys.music.id(id)

    const cached = await cache.get<MusicDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.music.findUnique({
      where: {
        id: id,
      },
      include: musicInclude,
    })

    if (!data) {
      return new NotFound(`Music not found with ID ${id}`)
    }

    const relations = await fetchMediaRelations(prisma, "MUSIC", data.id)
    const result: MusicDetails = {
      ...data,
      relations,
    }

    await cache.set(cacheKey, result, MUSIC_CACHE_TTL)

    if (data.musicBrainzId && mediaDbSyncer.isRecordStale(data, "MUSIC")) {
      void queueMusicFetch(data.musicBrainzId).catch((err) => {
        logger.error(
          `[MusicRoute] Failed to queue background fetch for id ${id} (musicbrainz id ${data.musicBrainzId}):`,
          err
        )
      })
    }

    return result
  },
})
