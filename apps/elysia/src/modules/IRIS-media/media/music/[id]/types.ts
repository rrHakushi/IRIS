import {
  GenreSchema,
  TagSchema,
  MediaRelationSchema,
} from "@/modules/IRIS-media/types"
import { t } from "elysia"

export const MusicResponseSchema = t.Object({
  id: t.Number(),
  spotifyId: t.Nullable(t.String()),
  appleMusicId: t.Nullable(t.String()),
  youtubeMusicId: t.Nullable(t.String()),
  musicBrainzId: t.Nullable(t.String()),
  isrc: t.Nullable(t.String()),

  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  artist: t.Nullable(t.String()),
  artists: t.Array(t.String()),
  album: t.Nullable(t.String()),

  coverImage: t.Nullable(t.String()),
  bannerImage: t.Nullable(t.String()),
  images: t.Nullable(t.Any()),

  description: t.Nullable(t.String()),
  duration: t.Nullable(t.Number()),
  releaseDateYear: t.Nullable(t.Number()),
  releaseDateMonth: t.Nullable(t.Number()),
  releaseDateDay: t.Nullable(t.Number()),
  releaseDate: t.Nullable(t.Union([t.Date(), t.String()])),

  genres: t.Array(GenreSchema),
  tags: t.Array(TagSchema),
  audioPreviewUrl: t.Nullable(t.String()),
  lyrics: t.Nullable(t.String()),
  syncedLyrics: t.Nullable(t.String()),
  sources: t.Nullable(t.Any()),

  status: t.String(),
  favorites: t.Number(),
  popularity: t.Number(),

  musicBrainzUpdatedAt: t.Nullable(t.Number()),

  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),

  relations: t.Array(MediaRelationSchema),
})
