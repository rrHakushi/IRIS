import { defineRoute, t } from "@/router"
import {
  mediaDbSyncer,
  queueMusicAlbumFetch,
  queueMusicTrackFetch,
} from "@/services/media-queue"
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
        "Fetches music track or album details with tags, genres, staff, and media relations.",
      tags: ["Media - Music"],
    },
  },

  async GET({ params, query, prisma, cache, cacheKeys, logger }) {
    const id = Number(params.id)
    const targetType = (query as any)?.type as "TRACK" | "ALBUM" | undefined
    const cacheKey = cacheKeys.music.id(id, targetType)

    const cached = await cache.get<MusicDetails>(cacheKey)
    if (cached) {
      return cached
    }

    // Try finding track first (unless ALBUM is requested)
    const track =
      targetType === "ALBUM"
        ? null
        : await prisma.musicTrack.findUnique({
            where: { id },
      include: {
        genres: true,
        tags: true,
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

    if (track) {
      const relations = await fetchMediaRelations(
        prisma,
        "MUSIC_TRACK",
        track.id
      )
      const artists = track.artistName ? [track.artistName] : []

      let staff = track.staff
      if (staff.length === 0 && track.artistName) {
        const p = await prisma.person.findFirst({
          where: { namePrimary: { equals: track.artistName, mode: "insensitive" } },
          select: { id: true, namePrimary: true, nameNative: true, image: true },
        })
        if (p) {
          staff = [{ id: 0, role: "ARTIST" as any, person: p }]
        }
      }

      const result: MusicDetails = {
        id: track.id,
        type: "TRACK" as const,
        spotifyId: track.spotifyId,
        appleMusicId: track.appleMusicId,
        youtubeMusicId: track.youtubeMusicId,
        musicBrainzId: track.musicBrainzId,
        isrc: track.isrc,
        titlePrimary: track.titlePrimary,
        titleSecondary: track.titleSecondary,
        titleNative: track.titleNative,
        artist: track.artistName,
        artists,
        album: track.album?.titlePrimary || null,
        albumId: track.albumId,
        albumType: null,
        totalTracks: null,
        trackNumber: track.trackNumber,
        discNumber: track.discNumber,
        coverImage: track.coverImage || track.album?.coverImage || null,
        bannerImage: null,
        images: null,
        description: track.description,
        duration: track.duration,
        releaseDateYear: track.album?.releaseDateYear ?? null,
        releaseDateMonth: track.album?.releaseDateMonth ?? null,
        releaseDateDay: track.album?.releaseDateDay ?? null,
        releaseDate: track.album?.releaseDate ?? null,
        genres: track.genres,
        tags: track.tags,
        audioPreviewUrl: track.audioPreviewUrl,
        lyrics: track.lyrics,
        syncedLyrics: track.syncedLyrics,
        sources: track.sources,
        status: track.status,
        favorites: track.favorites,
        popularity: track.popularity,
        listeners: track.listeners,
        playCount: track.playCount,
        lastFmListeners: track.lastFmListenersStat ?? track.listeners,
        lastFmPlayCount: track.lastFmPlayCountStat ?? track.playCount,
        lastFmUrl: track.lastFmUrl,
        musicBrainzUpdatedAt: track.musicBrainzUpdatedAt,
        createdAt: track.createdAt,
        updatedAt: track.updatedAt,
        relations,
        staff,
      }

      await cache.set(cacheKey, result, MUSIC_CACHE_TTL)

      if (mediaDbSyncer.isRecordStale(track, "MUSIC_TRACK")) {
        void queueMusicTrackFetch(track.id).catch((err) => {
          logger.error(
            `[MusicRoute] Failed to queue background fetch for track ${id}:`,
            err
          )
        })
      }

      return result
    }

    // Otherwise check album
    const album = await prisma.musicAlbum.findUnique({
      where: { id },
      include: {
        genres: true,
        tags: true,
        tracks: {
          select: {
            id: true,
            trackNumber: true,
            discNumber: true,
            titlePrimary: true,
            duration: true,
            artistName: true,
            audioPreviewUrl: true,
          },
          orderBy: [{ discNumber: "asc" }, { trackNumber: "asc" }],
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

    if (album) {
      const relations = await fetchMediaRelations(
        prisma,
        "MUSIC_ALBUM",
        album.id
      )
      const artists = album.artistName ? [album.artistName] : []

      let staff = album.staff
      if (staff.length === 0 && album.artistName) {
        const p = await prisma.person.findFirst({
          where: { namePrimary: { equals: album.artistName, mode: "insensitive" } },
          select: { id: true, namePrimary: true, nameNative: true, image: true },
        })
        if (p) {
          staff = [{ id: 0, role: "ARTIST" as any, person: p }]
        }
      }

      const result: MusicDetails = {
        id: album.id,
        type: "ALBUM" as const,
        spotifyId: album.spotifyId,
        appleMusicId: album.appleMusicId,
        youtubeMusicId: null,
        musicBrainzId: album.musicBrainzId,
        isrc: null,
        titlePrimary: album.titlePrimary,
        titleSecondary: album.titleSecondary,
        titleNative: album.titleNative,
        artist: album.artistName,
        artists,
        album: album.titlePrimary,
        albumId: album.id,
        albumType: album.albumType,
        totalTracks: album.totalTracks ?? album.tracks.length,
        trackNumber: null,
        discNumber: null,
        coverImage: album.coverImage,
        bannerImage: album.bannerImage,
        images: album.images,
        description: album.description,
        duration: album.duration,
        releaseDateYear: album.releaseDateYear,
        releaseDateMonth: album.releaseDateMonth,
        releaseDateDay: album.releaseDateDay,
        releaseDate: album.releaseDate,
        genres: album.genres,
        tags: album.tags,
        audioPreviewUrl: null,
        lyrics: null,
        syncedLyrics: null,
        sources: album.sources,
        status: album.status,
        favorites: album.favorites,
        popularity: album.popularity,
        listeners: album.listeners,
        playCount: album.playCount,
        lastFmListeners: album.lastFmListenersStat ?? album.listeners,
        lastFmPlayCount: album.lastFmPlayCountStat ?? album.playCount,
        lastFmUrl: album.lastFmUrl,
        musicBrainzUpdatedAt: album.musicBrainzUpdatedAt,
        createdAt: album.createdAt,
        updatedAt: album.updatedAt,
        relations,
        staff,
        tracks: album.tracks,
      }

      await cache.set(cacheKey, result, MUSIC_CACHE_TTL)

      if (mediaDbSyncer.isRecordStale(album, "MUSIC_ALBUM")) {
        void queueMusicAlbumFetch(album.id).catch((err) => {
          logger.error(
            `[MusicRoute] Failed to queue background fetch for album ${id}:`,
            err
          )
        })
      }

      return result
    }

    return new NotFound(`Music not found with ID ${id}`)
  },
})
