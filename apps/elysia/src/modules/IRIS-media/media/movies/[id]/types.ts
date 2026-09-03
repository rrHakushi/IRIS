import {
  MediaCharacterSchema,
  GenreSchema,
  TagSchema,
  MediaStaffSchema,
  MediaStudioSchema,
  MediaRelationSchema,
  MediaTrailerItemSchema,
  MediaImagesSchema,
  MediaSourcesSchema,
  MediaStatusDistributionSchema,
  MediaScoreDistributionSchema,
} from "@/modules/IRIS-media/types"
import { t } from "elysia"

export const MovieResponseSchema = t.Object({
  id: t.Number(),
  tmdbId: t.Nullable(t.Number()),
  imdbId: t.Nullable(t.String()),
  tvDBId: t.Nullable(t.Number()),
  simklId: t.Nullable(t.Number()),

  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Nullable(t.String()),

  coverImage: t.Nullable(t.String()),
  bannerImage: t.Nullable(t.String()),
  images: t.Nullable(MediaImagesSchema),

  description: t.Nullable(t.String()),
  originalLanguage: t.Nullable(t.String()),
  countryOfOrigin: t.Nullable(t.String()),
  runtime: t.Nullable(t.Number()),
  budget: t.Nullable(t.Union([t.BigInt(), t.Number(), t.String()])),
  revenue: t.Nullable(t.Union([t.BigInt(), t.Number(), t.String()])),

  releaseDateYear: t.Nullable(t.Number()),
  releaseDateMonth: t.Nullable(t.Number()),
  releaseDateDay: t.Nullable(t.Number()),

  status: t.String(),
  isAdult: t.Boolean(),
  synonyms: t.Array(t.String()),
  trailers: t.Nullable(t.Array(MediaTrailerItemSchema)),
  locked: t.Boolean(),

  averageScore: t.Nullable(t.Number()),
  favorites: t.Number(),
  popularity: t.Number(),
  totalScoreSum: t.Nullable(t.Number()),
  scoredCount: t.Nullable(t.Number()),
  statusDistribution: t.Nullable(MediaStatusDistributionSchema),
  scoreDistribution: t.Nullable(MediaScoreDistributionSchema),

  imdbRating: t.Nullable(t.Number()),
  imdbVotes: t.Nullable(t.Number()),

  sources: t.Nullable(MediaSourcesSchema),

  ageRating: t.Nullable(t.String()),
  ageRatingGuide: t.Nullable(t.String()),

  imdbUpdatedAt: t.Nullable(t.Number()),
  tvdbUpdatedAt: t.Nullable(t.Number()),

  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),

  characters: t.Array(MediaCharacterSchema),
  studios: t.Array(MediaStudioSchema),
  staff: t.Array(MediaStaffSchema),
  genres: t.Array(GenreSchema),
  tags: t.Array(TagSchema),
  relations: t.Array(MediaRelationSchema),
})
