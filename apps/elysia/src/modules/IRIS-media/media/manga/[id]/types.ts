import { MediaCharacterSchema, GenreSchema, TagSchema, MediaStaffSchema, MediaRelationSchema } from "@/modules/IRIS-media/types";
import { t } from "elysia";

export const MangaResponseSchema = t.Object({
    id: t.Number(),
    anilistId: t.Nullable(t.Number()),
    malId: t.Nullable(t.Number()),
    mangaUpdatesId: t.Nullable(t.String()),
    kitsuId: t.Nullable(t.Number()),
    bangumiId: t.Nullable(t.Number()),

    titlePrimary: t.String(),
    titleSecondary: t.Nullable(t.String()),
    titleNative: t.Nullable(t.String()),

    coverImage: t.Nullable(t.String()),
    bannerImage: t.Nullable(t.String()),
    images: t.Nullable(t.Any()),

    description: t.Nullable(t.String()),
    countryOfOrigin: t.Nullable(t.String()),

    volumeCount: t.Nullable(t.Number()),
    chapterCount: t.Nullable(t.Number()),

    startDateYear: t.Nullable(t.Number()),
    startDateMonth: t.Nullable(t.Number()),
    startDateDay: t.Nullable(t.Number()),

    endDateYear: t.Nullable(t.Number()),
    endDateMonth: t.Nullable(t.Number()),
    endDateDay: t.Nullable(t.Number()),

    source: t.String(),
    format: t.String(),
    status: t.String(),

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
    locked: t.Boolean(),

    siteUrl: t.Nullable(t.String()),
    externalLinks: t.Nullable(t.Any()),
    sources: t.Nullable(t.Any()),

    ageRating: t.Nullable(t.String()),
    ageRatingGuide: t.Nullable(t.String()),

    alUpdatedAt: t.Nullable(t.Number()),
    malUpdatedAt: t.Nullable(t.Number()),

    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),

    characters: t.Array(MediaCharacterSchema),
    genres: t.Array(GenreSchema),
    tags: t.Array(TagSchema),
    staff: t.Array(MediaStaffSchema),
    relations: t.Array(MediaRelationSchema),
});
