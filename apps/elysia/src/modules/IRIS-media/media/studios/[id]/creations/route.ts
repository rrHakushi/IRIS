import { defineRoute, t } from "@/router"
import { NotFound } from "elysia"
import {
  StudioCreationsQuerySchema,
  StudioCreationsResponseSchema,
  type StudioCreationsResponse,
} from "./types"
import { mediaStudioInclude, mapMediaStudioRecord } from "../route"
import type { StudioCreationItem } from "../types"
import { NotFoundResponseSchema } from "../../../../../../../types"

const CREATIONS_CACHE_TTL = 5 * 60 // 5 minutes

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    query: StudioCreationsQuerySchema,
    response: {
      200: StudioCreationsResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get studio creations with cursor pagination",
      description:
        "Fetches infinitely scrollable studio creations with cursor pagination, media filtering, and sorting.",
      tags: ["Media - Studio"],
    },
  },

  cacheKeys: {
    studio: {
      creations: (id: number, queryKey: string) =>
        `studio:${id}:creations:${queryKey}`,
    },
  },

  async GET({ params, query, prisma, cache, cacheKeys }) {
    const id = Number(params.id)
    const limit = Number(query?.limit ?? 36)
    const cursor = query?.cursor
      ? parseInt(String(query.cursor), 10)
      : undefined
    const cleanCursor =
      typeof cursor === "number" && !isNaN(cursor) && cursor > 0
        ? cursor
        : undefined

    const mediaType =
      query && typeof query.mediaType === "string" && query.mediaType.trim()
        ? query.mediaType.trim().toUpperCase()
        : undefined
    const sortBy = query?.sortBy ?? "releaseDate"
    const order = query?.order ?? "desc"

    const queryKeyStr = JSON.stringify({
      cursor: cleanCursor,
      limit,
      mediaType,
      sortBy,
      order,
    })

    const cacheKey = cacheKeys.studio.creations(id, queryKeyStr)
    const cached = await cache.get<StudioCreationsResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const studioExists = await prisma.studio.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!studioExists) {
      return new NotFound(`Studio not found with ID ${id}`)
    }

    const where: any = {
      studioId: id,
      ...(mediaType ? { mediaType: mediaType as any } : {}),
    }

    const [records, totalCount] = await Promise.all([
      prisma.mediaStudio.findMany({
        where,
        include: mediaStudioInclude,
        take: limit + 1,
        ...(cleanCursor ? { cursor: { id: cleanCursor }, skip: 1 } : {}),
        orderBy: [{ id: "desc" }],
      }),
      prisma.mediaStudio.count({ where }),
    ])

    const hasMore = records.length > limit
    const paged = hasMore ? records.slice(0, limit) : records
    const nextCursor = paged.length > 0 ? paged[paged.length - 1]!.id : null

    const items = paged
      .map(mapMediaStudioRecord)
      .filter((item): item is StudioCreationItem => item !== null)
      .sort((a, b) => {
        if (sortBy === "popularity") {
          const popA = a.popularity ?? 0
          const popB = b.popularity ?? 0
          return order === "asc" ? popA - popB : popB - popA
        }
        if (sortBy === "score") {
          const scA = a.averageScore ?? 0
          const scB = b.averageScore ?? 0
          return order === "asc" ? scA - scB : scB - scA
        }
        if (sortBy === "favorites") {
          const favA = a.favorites ?? 0
          const favB = b.favorites ?? 0
          return order === "asc" ? favA - favB : favB - favA
        }
        if (sortBy === "title") {
          return order === "asc"
            ? a.titlePrimary.localeCompare(b.titlePrimary)
            : b.titlePrimary.localeCompare(a.titlePrimary)
        }
        // Default: releaseDate (year)
        const yearA = a.releaseYear ?? -1
        const yearB = b.releaseYear ?? -1
        if (yearA !== yearB) {
          return order === "asc" ? yearA - yearB : yearB - yearA
        }
        return (b.popularity ?? 0) - (a.popularity ?? 0)
      })

    const response: StudioCreationsResponse = {
      success: true,
      studioId: id,
      items,
      pagination: {
        nextCursor,
        hasMore,
        total: totalCount,
      },
    }

    await cache.set(cacheKey, response, CREATIONS_CACHE_TTL)
    return response
  },
})
