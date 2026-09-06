import { defineRoute, t } from "@/router"
import { mediaQueueService } from "@/services/media-queue"
import { NotFound } from "elysia"

import { MusicSearchResponseSchema, type MusicSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"

const SEARCH_MUSIC_TTL = 5 * 60 // 5 minutes

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 2 characters)",
        minLength: 2,
      }),
      type: t.Optional(
        t.Union([
          t.Literal("ALL"),
          t.Literal("TRACK"),
          t.Literal("ALBUM"),
        ])
      ),
    }),
    response: {
      200: MusicSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search music",
      description:
        "Searches music tracks and albums by title or artist and returns matching music preview records.",
      tags: ["Media - Music"],
    },
  },

  cacheKeys: {
    search: {
      music: (q: string) => `search:music:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys, logger }) {
    const { q, type } = query
    const cleanQuery = decodeURIComponent(String(q || "")).replace(/\+/g, " ").trim()
    const filterType = type && type !== "ALL" ? type : undefined
    const cacheKey = cacheKeys.search.music(`${filterType || "ALL"}:${cleanQuery}`)

    if (!cleanQuery || cleanQuery.length < 2) {
      return new NotFound("Query must be at least 2 characters long")
    }

    const cached = await cache.get<MusicSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const whereClause = {
      ...(filterType ? { type: filterType } : {}),
      OR: [
        { titlePrimary: { contains: cleanQuery, mode: "insensitive" as const } },
        { titleSecondary: { contains: cleanQuery, mode: "insensitive" as const } },
        { artistName: { contains: cleanQuery, mode: "insensitive" as const } },
      ],
    }

    const items = await prisma.music.findMany({
      where: whereClause,
      select: {
        id: true,
        type: true,
        titlePrimary: true,
        titleSecondary: true,
        artistName: true,
        coverImage: true,
        duration: true,
        audioPreviewUrl: true,
        explicitLyrics: true,
        albumId: true,
        album: { select: { id: true, titlePrimary: true } },
      },
      take: 30,
      orderBy: {
        titlePrimary: "asc",
      },
    })

    const data: MusicSearchResponse = items.map((item) => ({
      id: item.id,
      titlePrimary: item.titlePrimary,
      titleSecondary: item.titleSecondary,
      artist: item.artistName,
      artistName: item.artistName,
      coverImage: item.coverImage,
      duration: item.duration,
      album: item.type === "TRACK" ? item.album?.titlePrimary || null : null,
      albumId: item.type === "TRACK" ? item.albumId : null,
      type: item.type,
      audioPreviewUrl: item.audioPreviewUrl,
      explicitLyrics: item.explicitLyrics,
    }))

    const queueType =
      filterType === "TRACK"
        ? "MUSIC_TRACK"
        : filterType === "ALBUM"
          ? "MUSIC_ALBUM"
          : "MUSIC"

    if (data.length === 0) {
      logger.warn(`No data found for query: ${cleanQuery} (type: ${filterType || "ALL"}), triggering refresh`)
      const rawResults = await mediaQueueService.enqueueSearchFetch(queueType, cleanQuery)
      const results: MusicSearchResponse = rawResults.map((item) => ({
        id: item.id,
        titlePrimary: item.titlePrimary,
        titleSecondary: item.titleSecondary ?? null,
        artist: item.artistName || item.artist || null,
        artistName: item.artistName || item.artist || null,
        coverImage: item.coverImage ?? null,
        duration: item.duration ?? null,
        album: item.albumTitle ?? null,
        albumId: item.albumId,
        type: item.itemType,
        audioPreviewUrl: item.audioPreviewUrl ?? null,
        explicitLyrics: item.explicitLyrics ?? null,
        queuedForFetch: true,
      }))
      await cache.set(cacheKey, results, SEARCH_MUSIC_TTL)
      return results
    }

    await cache.set(cacheKey, data, SEARCH_MUSIC_TTL)
    void mediaQueueService.enqueueSearchFetch(queueType, cleanQuery).catch((err: Error) => {
      logger.error(
        `[SearchMusicRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
