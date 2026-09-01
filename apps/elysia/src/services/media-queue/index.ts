import { mediaQueueService } from "./media-queue.service.js";
import type { MediaJob, QueueJobOptions } from "./types.js";

/**
 * 1. Queues an anime fetch/update job using AniList as primary and MyAnimeList as secondary.
 * Crawls all discovered relations (adaptation, sequel, prequel, parent, side_story, character, summary, alternative, spin_off).
 *
 * @param id - AniList Anime ID (or external ID)
 * @param options - Optional queueing configuration (priority, forceRefresh, maxRetries)
 */
export async function queueAnimeFetch(
  id: number | string,
  options?: QueueJobOptions
): Promise<MediaJob> {
  return await mediaQueueService.enqueueJob("ANIME", id, options);
}

/**
 * 2. Queues a manga fetch/update job using AniList as primary and MyAnimeList as secondary.
 * Crawls all discovered relations (adaptation, sequel, prequel, parent, side_story, character, summary, alternative, spin_off).
 *
 * @param id - AniList Manga ID (or external ID)
 * @param options - Optional queueing configuration
 */
export async function queueMangaFetch(
  id: number | string,
  options?: QueueJobOptions
): Promise<MediaJob> {
  return await mediaQueueService.enqueueJob("MANGA", id, options);
}

/**
 * 3. Queues a TV show fetch/update job using TheTVDB.
 * Fetches whole cast, extracts actors -> Person table and characters -> Character table,
 * and fetches all seasons with episodes into TvSeason & TvEpisode using local IDs.
 *
 * @param id - TheTVDB Series ID
 * @param options - Optional queueing configuration
 */
export async function queueTvFetch(
  id: number | string,
  options?: QueueJobOptions
): Promise<MediaJob> {
  return await mediaQueueService.enqueueJob("TV", id, options);
}

/**
 * 4. Queues a movie fetch/update job using TheTVDB.
 * Fetches movie details, studios, cast/characters -> Person & Character tables using local IDs.
 *
 * @param id - TheTVDB Movie ID
 * @param options - Optional queueing configuration
 */
export async function queueMovieFetch(
  id: number | string,
  options?: QueueJobOptions
): Promise<MediaJob> {
  return await mediaQueueService.enqueueJob("MOVIE", id, options);
}

/**
 * 5. Queues a book fetch/update job using Google Books API.
 * Fetches volume metadata, authors -> Person, publishers -> Studio using local IDs.
 *
 * @param id - Google Books Volume ID or ISBN
 * @param options - Optional queueing configuration
 */
export async function queueBookFetch(
  id: string | number,
  options?: QueueJobOptions
): Promise<MediaJob> {
  return await mediaQueueService.enqueueJob("BOOK", id, options);
}

/**
 * 6. Queues a game fetch/update job using IGDB API v4 (via Twitch OAuth).
 * Fetches platforms, developers, publishers, genres, screenshots, ratings using local IDs.
 *
 * @param id - IGDB Game ID
 * @param options - Optional queueing configuration
 */
export async function queueGameFetch(
  id: number | string,
  options?: QueueJobOptions
): Promise<MediaJob> {
  return await mediaQueueService.enqueueJob("GAME", id, options);
}

/**
 * 7. Queues a music fetch/update job using MusicBrainz (for metadata) and LRCLIB (for lyrics).
 *
 * @param id - MusicBrainz Recording MBID
 * @param options - Optional queueing configuration
 */
export async function queueMusicFetch(
  id: string | number,
  options?: QueueJobOptions
): Promise<MediaJob> {
  return await mediaQueueService.enqueueJob("MUSIC", id, options);
}

export { mediaQueueService, MediaQueueService } from "./media-queue.service.js";
export { mediaDbSyncer, MediaDbSyncer } from "./media-db.syncer.js";
export * from "./providers/index.js";
export * from "./types.js";
