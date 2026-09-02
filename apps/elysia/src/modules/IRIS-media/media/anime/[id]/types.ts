import { MediaCharacterSchema, GenreSchema, TagSchema, MediaStaffSchema, MediaStudioSchema, MediaRelationSchema } from "@/modules/IRIS-media/types";
import { t } from "elysia";

export const AnimeEpisodeSchema = t.Object({
    id: t.Number(),
    animeId: t.Number(),
    number: t.Number(),
    type: t.String(),
    titlePrimary: t.String(),
    titleSecondary: t.Nullable(t.String()),
    titleNative: t.Nullable(t.String()),
    description: t.Nullable(t.String()),
    duration: t.Nullable(t.Number()),
    airDate: t.Nullable(t.Union([t.Date(), t.String()])),
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
    anidbEpisodeId: t.Nullable(t.Number()),
    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),
});

export const AnimeAiringScheduleSchema = t.Object({
    id: t.Number(),
    animeId: t.Number(),
    episodeNumber: t.Number(),
    airingAt: t.Union([t.Date(), t.String()]),
    anilistAiringId: t.Nullable(t.Number()),
    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),
});

export const AnimeResponseSchema = t.Object({
    id: t.Number(),
    anilistId: t.Nullable(t.Number()),
    malId: t.Nullable(t.Number()),
    aniDBId: t.Nullable(t.Number()),
    tvDBId: t.Nullable(t.Number()),
    bangumiId: t.Nullable(t.Number()),
    kitsuId: t.Nullable(t.Number()),

    titlePrimary: t.String(),
    titleSecondary: t.Nullable(t.String()),
    titleNative: t.Nullable(t.String()),

    coverImage: t.Nullable(t.String()),
    bannerImage: t.Nullable(t.String()),
    images: t.Nullable(t.Any()),

    description: t.Nullable(t.String()),
    hashtag: t.Nullable(t.String()),
    countryOfOrigin: t.Nullable(t.String()),

    episodeCount: t.Nullable(t.Number()),
    episodeDuration: t.Nullable(t.Number()),

    startDateYear: t.Nullable(t.Number()),
    startDateMonth: t.Nullable(t.Number()),
    startDateDay: t.Nullable(t.Number()),

    endDateYear: t.Nullable(t.Number()),
    endDateMonth: t.Nullable(t.Number()),
    endDateDay: t.Nullable(t.Number()),

    source: t.String(),
    format: t.String(),
    status: t.String(),
    seasonSeason: t.String(),
    seasonYear: t.Nullable(t.Number()),

    averageScore: t.Nullable(t.Number()),
    favorites: t.Number(),
    popularity: t.Number(),
    totalScoreSum: t.Nullable(t.Number()),
    scoredCount: t.Nullable(t.Number()),
    statusDistribution: t.Any(),
    scoreDistribution: t.Any(),

    alAverageScore: t.Nullable(t.Number()),
    alFavorites: t.Nullable(t.Number()),
    alPopularity: t.Nullable(t.Number()),

    malAverageScore: t.Nullable(t.Number()),
    malFavorites: t.Nullable(t.Number()),
    malPopularity: t.Nullable(t.Number()),

    isAdult: t.Boolean(),
    synonyms: t.Array(t.String()),
    trailers: t.Nullable(t.Any()),
    locked: t.Boolean(),

    siteUrl: t.Nullable(t.String()),
    externalLinks: t.Nullable(t.Any()),
    sources: t.Nullable(t.Any()),

    themeSongs: t.Nullable(t.Any()),

    ageRating: t.Nullable(t.String()),
    ageRatingGuide: t.Nullable(t.String()),

    nextAiringEpisodeNumber: t.Nullable(t.Number()),
    nextAiringAt: t.Nullable(t.Union([t.Date(), t.String()])),

    alUpdatedAt: t.Nullable(t.Number()),
    malUpdatedAt: t.Nullable(t.Number()),
    anidbUpdatedAt: t.Nullable(t.Number()),

    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),

    characters: t.Array(MediaCharacterSchema),
    airingSchedule: t.Array(AnimeAiringScheduleSchema),
    episodes: t.Array(AnimeEpisodeSchema),
    genres: t.Array(GenreSchema),
    tags: t.Array(TagSchema),
    staff: t.Array(MediaStaffSchema),
    studios: t.Array(MediaStudioSchema),
    relations: t.Array(MediaRelationSchema),
});