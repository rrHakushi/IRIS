import { defineRoute, t } from "@/router"
import { queueMusicSearchFetch } from "@/services/media-queue"
import { NotFound } from "elysia"

import { MusicSearchResponseSchema, type MusicSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"

const SEARCH_MUSIC_TTL = 5 * 60 // 5 minutes

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: MusicSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search music",
      description:
        "Searches music tracks by title or artist and returns matching music preview records.",
      tags: ["Media - Music"],
    },
  },

  cacheKeys: {
    search: {
      music: (q: string) => `search:music:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys, logger }) {
    const { q } = query
    const cleanQuery = decodeURIComponent(String(q || "")).replace(/\+/g, " ").trim()
    const cacheKey = cacheKeys.search.music(cleanQuery)

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const cached = await cache.get<MusicSearchResponse>(cacheKey)
    if (cached) {
      return cached
    }

    const [tracks, albums] = await Promise.all([
      prisma.musicTrack.findMany({
        where: {
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: "insensitive" } },
            { titleSecondary: { contains: cleanQuery, mode: "insensitive" } },
            { artistName: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          artistName: true,
          coverImage: true,
          duration: true,
          albumId: true,
          album: { select: { id: true, titlePrimary: true } },
        },
        take: 20,
        orderBy: {
          titlePrimary: "asc",
        },
      }),
      prisma.musicAlbum.findMany({
        where: {
          OR: [
            { titlePrimary: { contains: cleanQuery, mode: "insensitive" } },
            { titleSecondary: { contains: cleanQuery, mode: "insensitive" } },
            { artistName: { contains: cleanQuery, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          artistName: true,
          coverImage: true,
          duration: true,
        },
        take: 10,
        orderBy: {
          titlePrimary: "asc",
        },
      }),
    ])

    const data: MusicSearchResponse = [
      ...albums.map((a) => ({
        id: a.id,
        titlePrimary: a.titlePrimary,
        titleSecondary: a.titleSecondary,
        artist: a.artistName,
        artistName: a.artistName,
        coverImage: a.coverImage,
        duration: a.duration,
        type: "ALBUM" as const,
      })),
      ...tracks.map((t) => ({
        id: t.id,
        titlePrimary: t.titlePrimary,
        titleSecondary: t.titleSecondary,
        artist: t.artistName,
        artistName: t.artistName,
        coverImage: t.coverImage,
        duration: t.duration,
        album: t.album?.titlePrimary || null,
        albumId: t.albumId,
        type: "TRACK" as const,
      })),
    ]

    if (data.length === 0) {
      logger.warn(`No data found for query: ${cleanQuery}, triggering refresh`)
      const rawResults = await queueMusicSearchFetch(cleanQuery)
      const results: MusicSearchResponse = rawResults.map((item: any) => ({
        id: item.id,
        titlePrimary: item.titlePrimary,
        titleSecondary: item.titleSecondary ?? null,
        artist: item.artistName || item.artist || null,
        artistName: item.artistName || item.artist || null,
        coverImage: item.coverImage ?? null,
        duration: item.duration ?? null,
        album: item.album || item.albumTitle || null,
        albumId: item.albumId,
        type: item.type || item.itemType,
        queuedForFetch: true,
      }))
      await cache.set(cacheKey, results, SEARCH_MUSIC_TTL)
      return results
    }

    await cache.set(cacheKey, data, SEARCH_MUSIC_TTL)
    void queueMusicSearchFetch(cleanQuery).catch((err) => {
      logger.error(
        `[SearchMusicRoute] Failed to queue background search for "${cleanQuery}":`,
        err
      )
    })

    return data
  },
})
