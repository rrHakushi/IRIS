import {
  MediaCharacterSchema,
  GenreSchema,
  TagSchema,
  MediaStaffSchema,
  MediaStudioSchema,
  MediaRelationSchema,
} from "@/modules/IRIS-media/types"
import { t } from "elysia"

export const TvSeasonSchema = t.Object({
  id: t.Number(),
  tvId: t.Number(),
  seasonNumber: t.Number(),
  tvdbSeasonId: t.Nullable(t.Number()),
  tmdbSeasonId: t.Nullable(t.Number()),

  titlePrimary: t.Nullable(t.String()),
  titleSecondary: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  posterImage: t.Nullable(t.String()),

  airDateYear: t.Nullable(t.Number()),
  airDateMonth: t.Nullable(t.Number()),
  airDateDay: t.Nullable(t.Number()),
  episodeCount: t.Nullable(t.Number()),

  trailers: t.Nullable(t.Any()),
  sources: t.Nullable(t.Any()),

  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),
})

export const TvEpisodeSchema = t.Object({
  id: t.Number(),
  tvId: t.Number(),
  seasonId: t.Nullable(t.Number()),
  seasonNumber: t.Number(),
  episodeNumber: t.Number(),

  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Nullable(t.String()),

  description: t.Nullable(t.String()),
  duration: t.Nullable(t.Number()),
  airDate: t.Nullable(t.Union([t.Date(), t.String()])),
  rating: t.Nullable(t.Number()),
  episodeType: t.Nullable(t.String()),
  thumbnail: t.Nullable(t.String()),
  isFiller: t.Boolean(),
  isRecap: t.Boolean(),
  streamingLinks: t.Nullable(t.Any()),

  opStart: t.Nullable(t.Number()),
  opEnd: t.Nullable(t.Number()),
  edStart: t.Nullable(t.Number()),
  edEnd: t.Nullable(t.Number()),
  recapStart: t.Nullable(t.Number()),
  recapEnd: t.Nullable(t.Number()),

  skipTimestamps: t.Nullable(t.Any()),
  sources: t.Nullable(t.Any()),

  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),
})

export const TvResponseSchema = t.Object({
  id: t.Number(),
  tmdbId: t.Nullable(t.Number()),
  imdbId: t.Nullable(t.String()),
  tvDBId: t.Nullable(t.Number()),
  simklId: t.Nullable(t.Number()),
  tvmazeId: t.Nullable(t.Number()),

  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Nullable(t.String()),

  coverImage: t.Nullable(t.String()),
  bannerImage: t.Nullable(t.String()),
  images: t.Nullable(t.Any()),

  description: t.Nullable(t.String()),
  originalLanguage: t.Nullable(t.String()),
  countryOfOrigin: t.Nullable(t.String()),
  episodeCount: t.Nullable(t.Number()),
  seasonCount: t.Nullable(t.Number()),
  averageRuntime: t.Nullable(t.Number()),
  showType: t.Nullable(t.String()),

  broadcastTime: t.Nullable(t.String()),
  broadcastDays: t.Array(t.String()),

  firstAiredYear: t.Nullable(t.Number()),
  firstAiredMonth: t.Nullable(t.Number()),
  firstAiredDay: t.Nullable(t.Number()),

  lastAiredYear: t.Nullable(t.Number()),
  lastAiredMonth: t.Nullable(t.Number()),
  lastAiredDay: t.Nullable(t.Number()),

  genres: t.Array(GenreSchema),
  tags: t.Array(TagSchema),
  networks: t.Array(t.String()),

  status: t.String(),
  isAdult: t.Boolean(),
  synonyms: t.Array(t.String()),
  trailers: t.Nullable(t.Any()),
  locked: t.Boolean(),

  averageScore: t.Nullable(t.Number()),
  imdbRating: t.Nullable(t.Number()),
  imdbVotes: t.Nullable(t.Number()),
  tvmazeRating: t.Nullable(t.Number()),
  rottenTomatoesScore: t.Nullable(t.Number()),
  awards: t.Nullable(t.String()),

  favorites: t.Number(),
  popularity: t.Number(),
  totalScoreSum: t.Nullable(t.Number()),
  scoredCount: t.Nullable(t.Number()),
  statusDistribution: t.Any(),
  scoreDistribution: t.Any(),

  sources: t.Nullable(t.Any()),

  ageRating: t.Nullable(t.String()),
  ageRatingGuide: t.Nullable(t.String()),
  contentRatings: t.Nullable(t.Any()),

  imdbUpdatedAt: t.Nullable(t.Number()),
  tvdbUpdatedAt: t.Nullable(t.Number()),
  tvmazeUpdatedAt: t.Nullable(t.Number()),

  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),

  seasons: t.Array(TvSeasonSchema),
  episodes: t.Array(TvEpisodeSchema),
  characters: t.Array(MediaCharacterSchema),
  studios: t.Array(MediaStudioSchema),
  staff: t.Array(MediaStaffSchema),
  relations: t.Array(MediaRelationSchema),
})
