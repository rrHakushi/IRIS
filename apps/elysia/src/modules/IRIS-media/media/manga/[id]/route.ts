import { defineRoute, t } from "@/router"
import { mediaDbSyncer, queueMangaFetch } from "@/services/media-queue"
import type { Prisma } from "@IRIS/database"
import { NotFound } from "elysia"
import { MangaResponseSchema } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"
import {
  fetchMediaRelations,
  type MediaRelationItem,
} from "@/modules/IRIS-media/helpers/media-relations"

const MANGA_CACHE_TTL = 60 * 60 * 12 // 12 hours

export const mangaInclude = {
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
} as const satisfies Prisma.MangaInclude

export type MangaDetails = NonNullable<
  Prisma.MangaGetPayload<{
    include: typeof mangaInclude
  }>
> & {
  relations: MediaRelationItem[]
}

export default defineRoute({
  cacheKeys: {
    manga: {
      id: (id: number) => `manga:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: MangaResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get manga by ID",
      description:
        "Fetches manga details with characters, staff, tags, genres, and media relations.",
      tags: ["Media - Manga"],
    },
  },

  async GET({ params, prisma, cache, cacheKeys, logger }) {
    const id = params.id
    const cacheKey = cacheKeys.manga.id(id)

    const cached = await cache.get<MangaDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.manga.findUnique({
      where: {
        id: id,
      },
      include: mangaInclude,
    })

    if (!data) {
      return new NotFound(`Manga not found with ID ${id}`)
    }

    const relations = await fetchMediaRelations(prisma, "MANGA", data.id)
    const result: MangaDetails = {
      ...data,
      relations,
    }

    await cache.set(cacheKey, result, MANGA_CACHE_TTL)

    if (data.anilistId && mediaDbSyncer.isRecordStale(data, "MANGA")) {
      void queueMangaFetch(data.anilistId).catch((err) => {
        logger.error(
          `[MangaRoute] Failed to queue background fetch for id ${id} (anilist id ${data.anilistId}):`,
          err
        )
      })
    }

    return result
  },
})
