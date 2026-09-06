import { defineRoute, t } from "@/router"
import { mediaDbSyncer, queueBookFetch } from "@/services/media-queue"
import type { Prisma } from "@IRIS/database"
import { NotFound } from "elysia"
import { BookResponseSchema } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"
import {
  fetchMediaRelations,
  type MediaRelationItem,
} from "@/modules/IRIS-media/helpers/media-relations"

const BOOK_CACHE_TTL = 5 * 60 // 5 minutes

export const bookInclude = {
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
} as const satisfies Prisma.BookInclude

export type BookDetails = NonNullable<
  Prisma.BookGetPayload<{
    include: typeof bookInclude
  }>
> & {
  relations: MediaRelationItem[]
}

export default defineRoute({
  cacheKeys: {
    book: {
      id: (id: number) => `book:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: BookResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get book by ID",
      description:
        "Fetches book details with characters, staff, studios, tags, genres, and media relations.",
      tags: ["Media - Book"],
    },
  },

  async GET({ params, prisma, cache, cacheKeys, logger }) {
    const id = Number(params.id)
    const cacheKey = cacheKeys.book.id(id)

    const cached = await cache.get<BookDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const data = await prisma.book.findUnique({
      where: {
        id: id,
      },
      include: bookInclude,
    })

    if (!data) {
      return new NotFound(`Book not found with ID ${id}`)
    }

    const relations = await fetchMediaRelations(prisma, "BOOK", data.id)
    const result: BookDetails = {
      ...data,
      relations,
    }

    await cache.set(cacheKey, result, BOOK_CACHE_TTL)

    if (data.googleBookId && mediaDbSyncer.isRecordStale(data, "BOOK")) {
      void queueBookFetch(data.googleBookId).catch((err) => {
        logger.error(
          `[BookRoute] Failed to queue background fetch for id ${id} (googleBook id ${data.googleBookId}):`,
          err
        )
      })
    }

    return result
  },
})
