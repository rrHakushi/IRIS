import { MediaCharacterSchema, GenreSchema, TagSchema, MediaStaffSchema, MediaStudioSchema, MediaRelationSchema } from "@/modules/IRIS-media/types";
import { t } from "elysia";

export const BookResponseSchema = t.Object({
    id: t.Number(),
    googleBookId: t.Nullable(t.String()),
    isbn10: t.Nullable(t.String()),
    isbn13: t.Nullable(t.String()),
    openLibraryId: t.Nullable(t.String()),

    titlePrimary: t.String(),
    titleSecondary: t.Nullable(t.String()),
    subtitle: t.Nullable(t.String()),
    slug: t.Nullable(t.String()),
    tagline: t.Nullable(t.String()),

    coverImage: t.Nullable(t.String()),
    bannerImage: t.Nullable(t.String()),
    images: t.Nullable(t.Any()),

    description: t.Nullable(t.String()),
    originalLanguage: t.Nullable(t.String()),
    countryOfOrigin: t.Nullable(t.String()),
    series: t.Nullable(t.String()),
    seriesPosition: t.Nullable(t.Number()),
    format: t.Nullable(t.String()),
    website: t.Nullable(t.String()),
    siteUrl: t.Nullable(t.String()),
    previewLink: t.Nullable(t.String()),
    infoLink: t.Nullable(t.String()),
    buyLink: t.Nullable(t.String()),

    releaseDateYear: t.Nullable(t.Number()),
    releaseDateMonth: t.Nullable(t.Number()),
    releaseDateDay: t.Nullable(t.Number()),
    releaseDate: t.Nullable(t.Union([t.Date(), t.String()])),

    pageCount: t.Nullable(t.Number()),
    chapterCount: t.Nullable(t.Number()),
    volumeCount: t.Nullable(t.Number()),

    genres: t.Array(GenreSchema),
    subjects: t.Array(t.String()),
    tags: t.Array(TagSchema),
    publishers: t.Array(t.String()),
    authors: t.Array(t.String()),

    status: t.String(),
    isAdult: t.Boolean(),
    synonyms: t.Array(t.String()),
    locked: t.Boolean(),

    averageScore: t.Nullable(t.Number()),
    googleBooksRating: t.Nullable(t.Number()),
    googleBooksRatingsCount: t.Nullable(t.Number()),

    favorites: t.Number(),
    popularity: t.Number(),
    totalScoreSum: t.Nullable(t.Number()),
    scoredCount: t.Nullable(t.Number()),
    statusDistribution: t.Any(),
    scoreDistribution: t.Any(),

    sources: t.Nullable(t.Any()),

    retailPrice: t.Nullable(t.Number()),
    retailPriceCurrency: t.Nullable(t.String()),
    ageRating: t.Nullable(t.String()),
    ageRatingGuide: t.Nullable(t.String()),
    contentRatings: t.Nullable(t.Any()),

    googleBooksUpdatedAt: t.Nullable(t.Number()),

    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),

    characters: t.Array(MediaCharacterSchema),
    studios: t.Array(MediaStudioSchema),
    staff: t.Array(MediaStaffSchema),
    relations: t.Array(MediaRelationSchema),
});
