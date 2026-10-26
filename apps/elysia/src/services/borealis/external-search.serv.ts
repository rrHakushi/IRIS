import { prisma } from '@IRIS/database'
import { LogFactory, c } from '@Iris/logger'
import { cache } from '../../utils/cache'
import { MediaQueueManager } from './queue'
import {
  anilistProvider,
  tvdbProvider,
  igdbProvider,
  googleBooksProvider,
  deezerProvider,
} from './providers'
import { MediaPreviewSyncer, type PreviewResult } from './syncer/media-preview.syncer'

const logger = new LogFactory('Borealis:ExternalSearch')
const SEARCH_THROTTLE_TTL_SECONDS = 300 // 5 minutes

export class BorealisExternalSearchServ {
  /**
   * Queries external providers for media matching the query string,
   * creates/retrieves initial search preview stubs in Prisma,
   * enqueues background BullMQ update jobs with deterministic IDs,
   * and returns preview items immediately tagged with queuedForFetch: true.
   */
  static async enqueueSearchFetch(
    category: string,
    query: string,
    limit: number = 20,
    forceRefresh = false
  ): Promise<PreviewResult[]> {
    const cleanQuery = query.trim()
    if (!cleanQuery) return []

    const normalizedCategory = category.toLowerCase()
    const throttleKey = `iris:search-throttle:${normalizedCategory}:${cleanQuery.toLowerCase()}`

    if (!forceRefresh) {
      const isThrottled = await cache.get<boolean>(throttleKey)
      if (isThrottled) {
        logger.info(
          `${c.dim('⏩ [Search Throttled]')}: Search for ${c.cyan(normalizedCategory)}: "${c.yellow(cleanQuery)}" throttled (cached within 5m)`
        )
        return []
      }
    }

    // Set 5-minute throttle key
    await cache.set(throttleKey, true, SEARCH_THROTTLE_TTL_SECONDS).catch(() => {})

    logger.info(
      `${c.cyan('🔍 [External Search]')} Querying providers for ${c.bold(normalizedCategory)}: "${c.yellow(cleanQuery)}" (limit=${limit})...`
    )
    const results: PreviewResult[] = []

    switch (normalizedCategory) {
      case 'anime': {
        const items = await anilistProvider.searchAnime(cleanQuery, limit)
        logger.info(
          `${c.magenta('📡 [AniList]')} Received ${c.bold(String(items.length))} anime search results for "${c.yellow(cleanQuery)}"`
        )
        for (const item of items) {
          try {
            const stub = await MediaPreviewSyncer.upsertAnimeSearchPreview(item)
            results.push(stub)
            if (stub.queuedForFetch !== false) {
              await MediaQueueManager.enqueueMediaUpdate('ANIME', stub.id, {
                externalId: stub.externalId,
                priority: 2,
                depth: 0,
                jobId: `media-update-ANIME-${stub.id}`,
              })
            }
          } catch (err: any) {
            logger.warn(
              `${c.red('⚠️ [Anime Preview Error]')}: Failed for AniList #${item.id}: ${err?.message || err}`
            )
          }
        }
        break
      }

      case 'manga': {
        const items = await anilistProvider.searchManga(cleanQuery, limit)
        logger.info(
          `${c.magenta('📡 [AniList]')} Received ${c.bold(String(items.length))} manga search results for "${c.yellow(cleanQuery)}"`
        )
        for (const item of items) {
          try {
            const stub = await MediaPreviewSyncer.upsertMangaSearchPreview(item)
            results.push(stub)
            if (stub.queuedForFetch !== false) {
              await MediaQueueManager.enqueueMediaUpdate('MANGA', stub.id, {
                externalId: stub.externalId,
                priority: 2,
                depth: 0,
                jobId: `media-update-MANGA-${stub.id}`,
              })
            }
          } catch (err: any) {
            logger.warn(
              `${c.red('⚠️ [Manga Preview Error]')}: Failed for AniList #${item.id}: ${err?.message || err}`
            )
          }
        }
        break
      }

      case 'tv': {
        const items = await tvdbProvider.searchTvSeries(cleanQuery, limit)
        logger.info(
          `${c.blue('📡 [TheTVDB]')} Received ${c.bold(String(items.length))} TV series search results for "${c.yellow(cleanQuery)}"`
        )
        for (const item of items) {
          try {
            const stub = await MediaPreviewSyncer.upsertTvSearchPreview(item)
            results.push(stub)
            if (stub.queuedForFetch !== false) {
              await MediaQueueManager.enqueueMediaUpdate('TV', stub.id, {
                externalId: stub.externalId,
                priority: 2,
                depth: 0,
                jobId: `media-update-TV-${stub.id}`,
              })
            }
          } catch (err: any) {
            logger.warn(
              `${c.red('⚠️ [TV Preview Error]')}: Failed to upsert TV preview: ${err?.message || err}`
            )
          }
        }
        break
      }

      case 'movies': {
        const items = await tvdbProvider.searchMovies(cleanQuery, limit)
        logger.info(
          `${c.blue('📡 [TheTVDB]')} Received ${c.bold(String(items.length))} movie search results for "${c.yellow(cleanQuery)}"`
        )
        for (const item of items) {
          try {
            const stub = await MediaPreviewSyncer.upsertMovieSearchPreview(item)
            results.push(stub)
            if (stub.queuedForFetch !== false) {
              await MediaQueueManager.enqueueMediaUpdate('MOVIE', stub.id, {
                externalId: stub.externalId,
                priority: 2,
                depth: 0,
                jobId: `media-update-MOVIE-${stub.id}`,
              })
            }
          } catch (err: any) {
            logger.warn(
              `${c.red('⚠️ [Movie Preview Error]')}: Failed to upsert Movie preview: ${err?.message || err}`
            )
          }
        }
        break
      }

      case 'games': {
        const items = await igdbProvider.searchGames(cleanQuery, limit)
        logger.info(
          `${c.magenta('📡 [IGDB]')} Received ${c.bold(String(items.length))} game search results for "${c.yellow(cleanQuery)}"`
        )
        for (const item of items) {
          try {
            const stub = await MediaPreviewSyncer.upsertGameSearchPreview(item)
            results.push(stub)
            if (stub.queuedForFetch !== false) {
              await MediaQueueManager.enqueueMediaUpdate('GAME', stub.id, {
                externalId: stub.externalId,
                priority: 2,
                depth: 0,
                jobId: `media-update-GAME-${stub.id}`,
              })
            }
          } catch (err: any) {
            logger.warn(
              `${c.red('⚠️ [Game Preview Error]')}: Failed to upsert Game preview: ${err?.message || err}`
            )
          }
        }
        break
      }

      case 'books': {
        const items = await googleBooksProvider.searchBooks(cleanQuery, limit)
        logger.info(
          `${c.yellow('📡 [Google Books]')} Received ${c.bold(String(items.length))} book search results for "${c.yellow(cleanQuery)}"`
        )
        for (const item of items) {
          try {
            const stub = await MediaPreviewSyncer.upsertBookSearchPreview(item)
            results.push(stub)
            if (stub.queuedForFetch !== false) {
              await MediaQueueManager.enqueueMediaUpdate('BOOK', stub.id, {
                externalId: stub.externalId,
                priority: 2,
                depth: 0,
                jobId: `media-update-BOOK-${stub.id}`,
              })
            }
          } catch (err: any) {
            logger.warn(
              `${c.red('⚠️ [Book Preview Error]')}: Failed to upsert Book preview: ${err?.message || err}`
            )
          }
        }
        break
      }

      case 'music': {
        const [tracks, albums] = await Promise.all([
          deezerProvider.searchTracks(cleanQuery, Math.ceil(limit / 2)),
          deezerProvider.searchAlbums(cleanQuery, Math.ceil(limit / 2)),
        ])

        logger.info(
          `${c.cyan('📡 [Deezer]')} Received ${c.bold(String(tracks.length))} tracks and ${c.bold(String(albums.length))} albums for "${c.yellow(cleanQuery)}"`
        )

        for (const track of tracks) {
          try {
            const stub = await MediaPreviewSyncer.upsertMusicTrackSearchPreview(track)
            results.push(stub)
            if (stub.queuedForFetch !== false) {
              await MediaQueueManager.enqueueMediaUpdate('MUSIC', stub.id, {
                externalId: stub.externalId,
                priority: 2,
                depth: 0,
                jobId: `media-update-MUSIC-${stub.id}`,
              })
            }
          } catch (err: any) {
            logger.warn(
              `${c.red('⚠️ [Music Track Error]')}: Failed to upsert track preview: ${err?.message || err}`
            )
          }
        }

        for (const album of albums) {
          try {
            const stub = await MediaPreviewSyncer.upsertMusicAlbumSearchPreview(album)
            results.push(stub)
            if (stub.queuedForFetch !== false) {
              await MediaQueueManager.enqueueMediaUpdate('MUSIC', stub.id, {
                externalId: stub.externalId,
                priority: 2,
                depth: 0,
                jobId: `media-update-MUSIC-${stub.id}`,
              })
            }
          } catch (err: any) {
            logger.warn(
              `${c.red('⚠️ [Music Album Error]')}: Failed to upsert album preview: ${err?.message || err}`
            )
          }
        }
        break
      }

      case 'characters': {
        const items = await anilistProvider.searchCharacters(cleanQuery, limit)
        logger.info(
          `${c.magenta('📡 [AniList]')} Received ${c.bold(String(items.length))} character search results for "${c.yellow(cleanQuery)}"`
        )
        for (const item of items) {
          try {
            const charImage = item.image?.large || item.image?.medium || null
            let existing = await prisma.orm.public.Character
              .where({ anilistId: item.id })
              .first()
            if (!existing) {
              existing = await prisma.orm.public.Character.create({
                anilistId: item.id,
                namePrimary: item.name.full,
                nameNative: item.name.native || null,
                nameAlternative: item.name.alternative || [],
                nameAlternativeSpoiler: item.name.alternativeSpoiler || [],
                image: charImage,
                description: item.description || null,
                gender: item.gender || null,
                age: item.age || null,
                favorites: item.favourites || 0,
              })
            }
            results.push({
              ...existing,
              mediaType: 'characters' as any,
              externalId: item.id,
              queuedForFetch: false,
            } as any)
          } catch (err: any) {
            logger.warn(`${c.red('⚠️ [Character Preview Error]')}: ${err?.message || err}`)
          }
        }
        break
      }

      case 'people':
      case 'staff': {
        const items = await anilistProvider.searchStaff(cleanQuery, limit)
        logger.info(
          `${c.magenta('📡 [AniList]')} Received ${c.bold(String(items.length))} staff search results for "${c.yellow(cleanQuery)}"`
        )
        for (const item of items) {
          try {
            const staffImage = item.image?.large || item.image?.medium || null
            let existing = await prisma.orm.public.Person
              .where({ anilistId: item.id })
              .first()
            if (!existing) {
              existing = await prisma.orm.public.Person.create({
                anilistId: item.id,
                namePrimary: item.name.full,
                nameNative: item.name.native || null,
                nameAlternative: item.name.alternative || [],
                image: staffImage,
                description: item.description || null,
                primaryOccupations: item.primaryOccupations || [],
              })
            }
            results.push({
              ...existing,
              mediaType: 'people' as any,
              externalId: item.id,
              queuedForFetch: false,
            } as any)
          } catch (err: any) {
            logger.warn(`${c.red('⚠️ [Staff Preview Error]')}: ${err?.message || err}`)
          }
        }
        break
      }

      default:
        logger.info(
          `${c.yellow('⚠️ [External Search Skipped]')}: Category ${c.bold(category)} is not applicable for external provider search`
        )
        break
    }

    logger.info(
      `${c.green(c.bold('✨ [Search Enqueue Complete]'))}: Enqueued ${c.bold(String(results.length))} external items for ${c.cyan(normalizedCategory)}: "${c.yellow(cleanQuery)}"`
    )
    return results
  }
}
