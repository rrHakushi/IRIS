import { GenreSchema, TagSchema, MediaStudioSchema, MediaRelationSchema } from "@/modules/IRIS-media/types";
import { t } from "elysia";

export const GameResponseSchema = t.Object({
    id: t.Number(),
    rawgId: t.Nullable(t.Number()),
    igdbId: t.Nullable(t.Number()),
    steamAppId: t.Nullable(t.Number()),
    giantbombId: t.Nullable(t.String()),
    vndbId: t.Nullable(t.String()),

    titlePrimary: t.String(),
    titleSecondary: t.Nullable(t.String()),
    titleNative: t.Nullable(t.String()),
    slug: t.Nullable(t.String()),
    tagline: t.Nullable(t.String()),

    coverImage: t.Nullable(t.String()),
    bannerImage: t.Nullable(t.String()),
    backgroundImage: t.Nullable(t.String()),
    images: t.Nullable(t.Any()),

    description: t.Nullable(t.String()),

    releaseDateYear: t.Nullable(t.Number()),
    releaseDateMonth: t.Nullable(t.Number()),
    releaseDateDay: t.Nullable(t.Number()),
    releaseDate: t.Nullable(t.Union([t.Date(), t.String()])),

    genres: t.Array(GenreSchema),
    tags: t.Array(TagSchema),
    platforms: t.Array(t.String()),
    developers: t.Array(t.String()),
    publishers: t.Array(t.String()),
    franchise: t.Nullable(t.String()),
    gameModes: t.Array(t.String()),
    playerPerspectives: t.Array(t.String()),
    status: t.String(),
    isAdult: t.Boolean(),
    synonyms: t.Array(t.String()),
    trailers: t.Nullable(t.Any()),
    locked: t.Boolean(),

    averageScore: t.Nullable(t.Number()),
    igdbRating: t.Nullable(t.Number()),
    igdbRatingCount: t.Nullable(t.Number()),

    requirements: t.Nullable(t.Any()),
    languages: t.Array(t.String()),
    controllerSupport: t.Nullable(t.String()),
    achievements: t.Nullable(t.Any()),

    linuxSupport: t.Nullable(t.Boolean()),
    steamDeckStatus: t.Nullable(t.String()),
    steamDeck: t.Nullable(t.Any()),

    favorites: t.Number(),
    popularity: t.Number(),
    totalScoreSum: t.Nullable(t.Number()),
    scoredCount: t.Nullable(t.Number()),
    statusDistribution: t.Any(),
    scoreDistribution: t.Any(),

    averagePlaytime: t.Nullable(t.Number()),
    totalPlaytimeSum: t.Nullable(t.Number()),
    playtimeCount: t.Nullable(t.Number()),

    sources: t.Nullable(t.Any()),

    esrbRating: t.Nullable(t.String()),
    pegiRating: t.Nullable(t.String()),
    ageRating: t.Nullable(t.String()),
    ageRatingGuide: t.Nullable(t.String()),
    contentRatings: t.Nullable(t.Any()),

    igdbUpdatedAt: t.Nullable(t.Number()),
    steamUpdatedAt: t.Nullable(t.Number()),

    createdAt: t.Union([t.Date(), t.String()]),
    updatedAt: t.Union([t.Date(), t.String()]),

    studios: t.Array(MediaStudioSchema),
    relations: t.Array(MediaRelationSchema),
});
