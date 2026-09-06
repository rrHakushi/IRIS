import {
  GenreSchema,
  TagSchema,
  MediaRelationSchema,
} from "@/modules/IRIS-media/types"
import type { MediaRelationItem } from "@/modules/IRIS-media/helpers/media-relations"
import { t } from "elysia"

export const MusicStaffSchema = t.Object({
  id: t.Number(),
  role: t.String(),
  person: t.Object({
    id: t.Number(),
    namePrimary: t.String(),
    nameNative: t.Optional(t.Nullable(t.String())),
    image: t.Nullable(t.String()),
  }),
})

export const MusicResponseSchema = t.Object({
  id: t.Number(),
  type: t.Optional(t.Union([t.Literal("ALBUM"), t.Literal("TRACK")])),
  deezerId: t.Optional(t.Nullable(t.String())),
  spotifyId: t.Nullable(t.String()),
  appleMusicId: t.Nullable(t.String()),
  youtubeMusicId: t.Optional(t.Nullable(t.String())),
  musicBrainzId: t.Nullable(t.String()),
  isrc: t.Optional(t.Nullable(t.String())),

  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Optional(t.Nullable(t.String())),
  artist: t.Nullable(t.String()),
  artists: t.Array(t.String()),
  artistId: t.Optional(t.Nullable(t.Number())),
  album: t.Optional(t.Nullable(t.String())),
  albumId: t.Optional(t.Nullable(t.Number())),
  albumType: t.Optional(t.Nullable(t.String())),
  totalTracks: t.Optional(t.Nullable(t.Number())),
  trackNumber: t.Optional(t.Nullable(t.Number())),
  discNumber: t.Optional(t.Nullable(t.Number())),

  coverImage: t.Optional(t.Nullable(t.String())),
  bannerImage: t.Optional(t.Nullable(t.String())),
  coverImages: t.Optional(t.Nullable(t.Any())),
  images: t.Optional(t.Nullable(t.Any())),

  description: t.Optional(t.Nullable(t.String())),
  duration: t.Optional(t.Nullable(t.Number())),
  releaseDateYear: t.Optional(t.Nullable(t.Number())),
  releaseDateMonth: t.Optional(t.Nullable(t.Number())),
  releaseDateDay: t.Optional(t.Nullable(t.Number())),
  releaseDate: t.Optional(t.Nullable(t.Union([t.Date(), t.String()]))),

  bpm: t.Optional(t.Nullable(t.Number())),
  gain: t.Optional(t.Nullable(t.Number())),
  explicitLyrics: t.Optional(t.Nullable(t.Boolean())),
  explicitContentCover: t.Optional(t.Nullable(t.Number())),
  explicitContentLyrics: t.Optional(t.Nullable(t.Number())),

  genres: t.Optional(t.Array(GenreSchema)),
  tags: t.Optional(t.Array(TagSchema)),
  audioPreviewUrl: t.Optional(t.Nullable(t.String())),
  lyrics: t.Optional(t.Nullable(t.String())),
  syncedLyrics: t.Optional(t.Nullable(t.String())),
  sources: t.Optional(t.Nullable(t.Any())),

  status: t.Optional(t.String()),
  favorites: t.Optional(t.Number()),
  popularity: t.Optional(t.Number()),

  listeners: t.Optional(t.Nullable(t.Number())),
  playCount: t.Optional(t.Nullable(t.Number())),
  lastFmListeners: t.Optional(t.Nullable(t.Number())),
  lastFmPlayCount: t.Optional(t.Nullable(t.Number())),
  lastFmUrl: t.Optional(t.Nullable(t.String())),

  deezerUpdatedAt: t.Optional(t.Nullable(t.Number())),
  musicBrainzUpdatedAt: t.Optional(t.Nullable(t.Number())),

  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),

  relations: t.Optional(t.Array(MediaRelationSchema)),
  staff: t.Optional(t.Array(MusicStaffSchema)),
  tracks: t.Optional(
    t.Array(
      t.Object({
        id: t.Number(),
        trackNumber: t.Optional(t.Nullable(t.Number())),
        discNumber: t.Optional(t.Nullable(t.Number())),
        titlePrimary: t.String(),
        duration: t.Optional(t.Nullable(t.Number())),
        artistName: t.Optional(t.Nullable(t.String())),
        audioPreviewUrl: t.Optional(t.Nullable(t.String())),
      })
    )
  ),
})

export interface MusicTrackSummary {
  id: number
  trackNumber: number | null
  discNumber: number | null
  titlePrimary: string
  duration: number | null
  artistName: string | null
  audioPreviewUrl: string | null
}

export interface MusicStaffMember {
  id: number
  role: string
  person: {
    id: number
    namePrimary: string
    nameNative?: string | null
    image: string | null
  }
}

export interface MusicDetails {
  id: number
  type?: "ALBUM" | "TRACK"
  deezerId?: string | null
  spotifyId: string | null
  appleMusicId: string | null
  youtubeMusicId?: string | null
  musicBrainzId: string | null
  isrc?: string | null

  titlePrimary: string
  titleSecondary: string | null
  titleNative?: string | null
  artist: string | null
  artists: string[]
  artistId?: number | null
  album?: string | null
  albumId?: number | null
  albumType?: string | null
  totalTracks?: number | null
  trackNumber?: number | null
  discNumber?: number | null

  coverImage: string | null
  bannerImage: string | null
  coverImages?: Record<string, string | null> | null
  images?: Record<string, string | null> | null

  description: string | null
  duration: number | null
  releaseDateYear: number | null
  releaseDateMonth: number | null
  releaseDateDay: number | null
  releaseDate: Date | string | null

  bpm?: number | null
  gain?: number | null
  explicitLyrics?: boolean | null
  explicitContentCover?: number | null
  explicitContentLyrics?: number | null

  genres: Array<{ id: number; name: string; slug: string }>
  tags: Array<{ id: number; name: string; slug: string; description: string | null }>
  audioPreviewUrl?: string | null
  lyrics?: string | null
  syncedLyrics?: string | null
  sources?: Record<string, string | number | boolean | null> | null

  status: string
  favorites: number
  popularity: number

  listeners?: number | null
  playCount?: number | null
  lastFmListeners?: number | null
  lastFmPlayCount?: number | null
  lastFmUrl?: string | null

  deezerUpdatedAt?: number | null
  musicBrainzUpdatedAt: number | null

  createdAt: Date | string
  updatedAt: Date | string

  relations: MediaRelationItem[]
  staff?: MusicStaffMember[]
  tracks?: MusicTrackSummary[]
}
