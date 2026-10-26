-- ==============================================================================
-- IRIS Database Migration Helper: Prepare PostgreSQL for Prisma 8
--
-- PURPOSE:
-- 1. Safely converts 49 native PostgreSQL enum columns to text (USING col::text),
--    preserving 100% of data and converting enum defaults to text literals.
-- 2. Backfills any NULL values in list/array columns to '{}' (empty array)
--    so that Prisma 8's non-null array constraints apply without errors.
--
-- This script runs inside a single transaction and can be executed via psql:
--   psql "$DATABASE_URL" -f prepare-prisma8.sql
-- ==============================================================================

BEGIN;

-- 1. Convert all enum columns to text
-- ActivityLog
ALTER TABLE "ActivityLog" ALTER COLUMN "mediaType" TYPE text USING "mediaType"::text;
ALTER TABLE "ActivityLog" ALTER COLUMN "type" TYPE text USING "type"::text;

-- Anime
ALTER TABLE "Anime" ALTER COLUMN "format" DROP DEFAULT;
ALTER TABLE "Anime" ALTER COLUMN "format" TYPE text USING "format"::text;
ALTER TABLE "Anime" ALTER COLUMN "format" SET DEFAULT 'UNKNOWN';

ALTER TABLE "Anime" ALTER COLUMN "seasonSeason" DROP DEFAULT;
ALTER TABLE "Anime" ALTER COLUMN "seasonSeason" TYPE text USING "seasonSeason"::text;
ALTER TABLE "Anime" ALTER COLUMN "seasonSeason" SET DEFAULT 'UNKNOWN';

ALTER TABLE "Anime" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Anime" ALTER COLUMN "source" TYPE text USING "source"::text;
ALTER TABLE "Anime" ALTER COLUMN "source" SET DEFAULT 'UNKNOWN';

ALTER TABLE "Anime" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Anime" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "Anime" ALTER COLUMN "status" SET DEFAULT 'UNKNOWN';

-- AnimeEpisode
ALTER TABLE "AnimeEpisode" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "AnimeEpisode" ALTER COLUMN "type" TYPE text USING "type"::text;
ALTER TABLE "AnimeEpisode" ALTER COLUMN "type" SET DEFAULT 'REGULAR';

-- AnimeList
ALTER TABLE "AnimeList" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "AnimeList" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "AnimeList" ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- Book
ALTER TABLE "Book" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Book" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "Book" ALTER COLUMN "status" SET DEFAULT 'UNKNOWN';

-- BookList
ALTER TABLE "BookList" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BookList" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "BookList" ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- Connection
ALTER TABLE "Connection" ALTER COLUMN "authType" DROP DEFAULT;
ALTER TABLE "Connection" ALTER COLUMN "authType" TYPE text USING "authType"::text;
ALTER TABLE "Connection" ALTER COLUMN "authType" SET DEFAULT 'OAUTH2';

ALTER TABLE "Connection" ALTER COLUMN "provider" TYPE text USING "provider"::text;

ALTER TABLE "Connection" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Connection" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "Connection" ALTER COLUMN "status" SET DEFAULT 'CONNECTED';

-- CustomListEntry
ALTER TABLE "CustomListEntry" ALTER COLUMN "mediaType" TYPE text USING "mediaType"::text;

-- Favorite
ALTER TABLE "Favorite" ALTER COLUMN "type" TYPE text USING "type"::text;

-- FriendRequest
ALTER TABLE "FriendRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "FriendRequest" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "FriendRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Game
ALTER TABLE "Game" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Game" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "Game" ALTER COLUMN "status" SET DEFAULT 'UNKNOWN';

-- GameList
ALTER TABLE "GameList" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "GameList" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "GameList" ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- Manga
ALTER TABLE "Manga" ALTER COLUMN "format" DROP DEFAULT;
ALTER TABLE "Manga" ALTER COLUMN "format" TYPE text USING "format"::text;
ALTER TABLE "Manga" ALTER COLUMN "format" SET DEFAULT 'UNKNOWN';

ALTER TABLE "Manga" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Manga" ALTER COLUMN "source" TYPE text USING "source"::text;
ALTER TABLE "Manga" ALTER COLUMN "source" SET DEFAULT 'UNKNOWN';

ALTER TABLE "Manga" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Manga" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "Manga" ALTER COLUMN "status" SET DEFAULT 'UNKNOWN';

-- MangaList
ALTER TABLE "MangaList" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "MangaList" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "MangaList" ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- MediaCharacter
ALTER TABLE "MediaCharacter" ALTER COLUMN "mediaType" TYPE text USING "mediaType"::text;
ALTER TABLE "MediaCharacter" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "MediaCharacter" ALTER COLUMN "role" TYPE text USING "role"::text;
ALTER TABLE "MediaCharacter" ALTER COLUMN "role" SET DEFAULT 'MAIN';

-- MediaRecommendation
ALTER TABLE "MediaRecommendation" ALTER COLUMN "sourceType" TYPE text USING "sourceType"::text;
ALTER TABLE "MediaRecommendation" ALTER COLUMN "targetType" TYPE text USING "targetType"::text;

-- MediaRecommendationVote
ALTER TABLE "MediaRecommendationVote" ALTER COLUMN "voteType" TYPE text USING "voteType"::text;

-- MediaRelation
ALTER TABLE "MediaRelation" ALTER COLUMN "sourceType" TYPE text USING "sourceType"::text;
ALTER TABLE "MediaRelation" ALTER COLUMN "targetType" TYPE text USING "targetType"::text;
ALTER TABLE "MediaRelation" ALTER COLUMN "type" TYPE text USING "type"::text;

-- MediaStaff
ALTER TABLE "MediaStaff" ALTER COLUMN "mediaType" DROP DEFAULT;
ALTER TABLE "MediaStaff" ALTER COLUMN "mediaType" TYPE text USING "mediaType"::text;
ALTER TABLE "MediaStaff" ALTER COLUMN "mediaType" SET DEFAULT 'ANIME';

ALTER TABLE "MediaStaff" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "MediaStaff" ALTER COLUMN "role" TYPE text USING "role"::text;
ALTER TABLE "MediaStaff" ALTER COLUMN "role" SET DEFAULT 'OTHER';

-- MediaStudio
ALTER TABLE "MediaStudio" ALTER COLUMN "mediaType" DROP DEFAULT;
ALTER TABLE "MediaStudio" ALTER COLUMN "mediaType" TYPE text USING "mediaType"::text;
ALTER TABLE "MediaStudio" ALTER COLUMN "mediaType" SET DEFAULT 'ANIME';

-- Movie
ALTER TABLE "Movie" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Movie" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "Movie" ALTER COLUMN "status" SET DEFAULT 'RELEASED';

-- MovieList
ALTER TABLE "MovieList" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "MovieList" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "MovieList" ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- Music
ALTER TABLE "Music" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Music" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "Music" ALTER COLUMN "status" SET DEFAULT 'RELEASED';

ALTER TABLE "Music" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Music" ALTER COLUMN "type" TYPE text USING "type"::text;
ALTER TABLE "Music" ALTER COLUMN "type" SET DEFAULT 'TRACK';

-- MusicList
ALTER TABLE "MusicList" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "MusicList" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "MusicList" ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- Notification
ALTER TABLE "Notification" ALTER COLUMN "actionStatus" TYPE text USING "actionStatus"::text;

ALTER TABLE "Notification" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Notification" ALTER COLUMN "priority" TYPE text USING "priority"::text;
ALTER TABLE "Notification" ALTER COLUMN "priority" SET DEFAULT 'NORMAL';

ALTER TABLE "Notification" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE text USING "type"::text;
ALTER TABLE "Notification" ALTER COLUMN "type" SET DEFAULT 'INFO';

-- PassCipher
ALTER TABLE "PassCipher" ALTER COLUMN "reprompt" DROP DEFAULT;
ALTER TABLE "PassCipher" ALTER COLUMN "reprompt" TYPE text USING "reprompt"::text;
ALTER TABLE "PassCipher" ALTER COLUMN "reprompt" SET DEFAULT 'NONE';

ALTER TABLE "PassCipher" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "PassCipher" ALTER COLUMN "type" TYPE text USING "type"::text;
ALTER TABLE "PassCipher" ALTER COLUMN "type" SET DEFAULT 'LOGIN';

-- ReviewVote
ALTER TABLE "ReviewVote" ALTER COLUMN "reviewType" TYPE text USING "reviewType"::text;
ALTER TABLE "ReviewVote" ALTER COLUMN "voteType" TYPE text USING "voteType"::text;

-- Tv
ALTER TABLE "Tv" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Tv" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "Tv" ALTER COLUMN "status" SET DEFAULT 'UNKNOWN';

-- TvList
ALTER TABLE "TvList" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TvList" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "TvList" ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- TvSeasonProgress
ALTER TABLE "TvSeasonProgress" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TvSeasonProgress" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "TvSeasonProgress" ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- UserStats
ALTER TABLE "UserStats" ALTER COLUMN "mediaType" TYPE text USING "mediaType"::text;

-- 2. Backfill NULL array values to empty array '{}'
UPDATE "Anime" SET "synonyms" = '{}' WHERE "synonyms" IS NULL;
UPDATE "Book" SET "subjects" = '{}' WHERE "subjects" IS NULL;
UPDATE "Book" SET "synonyms" = '{}' WHERE "synonyms" IS NULL;
UPDATE "Character" SET "nameAlternative" = '{}' WHERE "nameAlternative" IS NULL;
UPDATE "Character" SET "nameAlternativeSpoiler" = '{}' WHERE "nameAlternativeSpoiler" IS NULL;
UPDATE "Game" SET "synonyms" = '{}' WHERE "synonyms" IS NULL;
UPDATE "Manga" SET "synonyms" = '{}' WHERE "synonyms" IS NULL;
UPDATE "Movie" SET "synonyms" = '{}' WHERE "synonyms" IS NULL;
UPDATE "Person" SET "nameAlternative" = '{}' WHERE "nameAlternative" IS NULL;
UPDATE "Tv" SET "broadcastDays" = '{}' WHERE "broadcastDays" IS NULL;
UPDATE "Tv" SET "networks" = '{}' WHERE "networks" IS NULL;
UPDATE "Tv" SET "synonyms" = '{}' WHERE "synonyms" IS NULL;

COMMIT;
