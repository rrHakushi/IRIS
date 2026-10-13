import { defineRoute, t } from "@/router"
import { mediaDbSyncer, queueMusicFetch } from "@/services/media-queue"
import { NotFound } from "elysia"
import { MusicResponseSchema, type MusicDetails } from "./types"
import { NotFoundResponseSchema } from "../../../../../../types"
import {
  fetchMediaRelations,
  type MediaRelationItem,
} from "@/modules/IRIS-media/helpers/media-relations"

const MUSIC_CACHE_TTL = 5 * 60 // 5 minutes

export type { MusicDetails }

export default defineRoute({
  cacheKeys: {
    music: {
      id: (id: number, type?: string) =>
        type ? `music:${type}:${id}` : `music:${id}`,
    },
  },

  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    query: t.Optional(
      t.Object({
        type: t.Optional(t.Union([t.Literal("TRACK"), t.Literal("ALBUM")])),
      })
    ),
    response: {
      200: MusicResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Get music by ID",
      description:
        "Fetches music track or album details with tags, genres, staff, tracks, and media relations.",
      tags: ["Media - Music"],
    },
  },

  async GET({ params, query, prisma, cache, cacheKeys, logger }) {
    const id = Number(params.id)
    const targetType =
      query?.type === "TRACK" || query?.type === "ALBUM"
        ? query.type
        : undefined
    const cacheKey = cacheKeys.music.id(id, targetType)

    const cached = await cache.get<MusicDetails>(cacheKey)
    if (cached) {
      return cached
    }

    const item = await prisma.music.findUnique({
      where: { id },
      include: {
        genres: true,
        tags: true,
        artist: {
          select: {
            id: true,
            namePrimary: true,
            nameNative: true,
            image: true,
          },
        },
        album: {
          select: {
            id: true,
            titlePrimary: true,
            coverImage: true,
            releaseDateYear: true,
            releaseDateMonth: true,
            releaseDateDay: true,
            releaseDate: true,
          },
        },
        tracks: {
          select: {
            id: true,
            trackPosition: true,
            diskNumber: true,
            titlePrimary: true,
            duration: true,
            artistName: true,
            audioPreviewUrl: true,
          },
          orderBy: [{ diskNumber: "asc" }, { trackPosition: "asc" }],
        },
        staff: {
          select: {
            id: true,
            role: true,
            person: {
              select: {
                id: true,
                namePrimary: true,
                nameNative: true,
                image: true,
              },
            },
          },
        },
      },
    })

    if (!item) {
      return new NotFound(`Music not found with ID ${id}`)
    }

    const relations = await fetchMediaRelations(prisma, "MUSIC", item.id)
    const artists = item.artistName ? [item.artistName] : []

    let staff = item.staff
    if (staff.length === 0 && item.artist) {
      staff = [{ id: 0, role: "ARTIST", person: item.artist }]
    } else if (staff.length === 0 && item.artistName) {
      const p = await prisma.person.findFirst({
        where: {
          namePrimary: { equals: item.artistName, mode: "insensitive" },
        },
        select: { id: true, namePrimary: true, nameNative: true, image: true },
      })
      if (p) {
        staff = [{ id: 0, role: "ARTIST", person: p }]
      }
    }

    const sources =
      item.sources &&
      typeof item.sources === "object" &&
      !Array.isArray(item.sources)
        ? (item.sources as Record<string, string | number | boolean | null>)
        : null

    const images =
      item.images &&
      typeof item.images === "object" &&
      !Array.isArray(item.images)
        ? (item.images as Record<string, string | null>)
        : null

    const spotifyId =
      typeof sources?.spotifyId === "string" ? sources.spotifyId : null
    const appleMusicId =
      typeof sources?.appleMusicId === "string" ? sources.appleMusicId : null
    const youtubeMusicId =
      typeof sources?.youtubeMusicId === "string"
        ? sources.youtubeMusicId
        : null
    const musicBrainzId =
      typeof sources?.musicBrainzId === "string" ? sources.musicBrainzId : null
    const musicBrainzUpdatedAt =
      typeof sources?.musicBrainzUpdatedAt === "number"
        ? sources.musicBrainzUpdatedAt
        : null

    const result: MusicDetails = {
      id: item.id,
      type: item.type,
      deezerId: item.deezerId,
      spotifyId,
      appleMusicId,
      youtubeMusicId,
      musicBrainzId,
      isrc: item.isrc,
      titlePrimary: item.titlePrimary,
      titleSecondary: item.titleSecondary,
      titleNative: item.titleNative,
      artist: item.artistName,
      artists,
      artistId: item.artistId,
      album:
        item.type === "ALBUM"
          ? item.titlePrimary
          : item.album?.titlePrimary || null,
      albumId: item.type === "ALBUM" ? item.id : item.albumId,
      albumType: item.recordType,
      totalTracks:
        item.type === "ALBUM" ? (item.nbTracks ?? item.tracks.length) : null,
      trackNumber: item.trackPosition,
      discNumber: item.diskNumber,
      coverImage: item.coverImage || item.album?.coverImage || null,
      bannerImage: null,
      coverImages: images,
      images,
      description: item.description,
      duration: item.duration,
      releaseDateYear:
        item.releaseDateYear ?? item.album?.releaseDateYear ?? null,
      releaseDateMonth:
        item.releaseDateMonth ?? item.album?.releaseDateMonth ?? null,
      releaseDateDay: item.releaseDateDay ?? item.album?.releaseDateDay ?? null,
      releaseDate: item.releaseDate ?? item.album?.releaseDate ?? null,
      bpm: item.bpm,
      gain: item.gain,
      explicitLyrics: item.explicitLyrics,
      explicitContentCover: item.explicitContentCover,
      explicitContentLyrics: item.explicitContentLyrics,
      genres: item.genres,
      tags: item.tags,
      audioPreviewUrl: item.audioPreviewUrl,
      lyrics: item.lyrics,
      syncedLyrics: item.syncedLyrics,
      sources,
      status: item.status,
      favorites: item.favorites,
      popularity: item.popularity,
      listeners: item.listeners,
      playCount: item.playCount,
      lastFmListeners: item.listeners,
      lastFmPlayCount: item.playCount,
      lastFmUrl: null,
      deezerUpdatedAt: item.deezerUpdatedAt,
      musicBrainzUpdatedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      relations,
      staff,
      tracks:
        item.type === "ALBUM"
          ? item.tracks.map((t) => ({
              id: t.id,
              trackNumber: t.trackPosition,
              discNumber: t.diskNumber,
              titlePrimary: t.titlePrimary,
              duration: t.duration,
              artistName: t.artistName,
              audioPreviewUrl: t.audioPreviewUrl,
            }))
          : undefined,
    }

    await cache.set(cacheKey, result, MUSIC_CACHE_TTL)

    if (mediaDbSyncer.isRecordStale(item, "MUSIC")) {
      void queueMusicFetch(item.id).catch((err) => {
        logger.error(
          `[MusicRoute] Failed to queue background fetch for music ${id}:`,
          err
        )
      })
    }

    return result
  },
})
