import { prisma } from '@IRIS/database'
import { LogFactory, c } from '@Iris/logger'
import {
  anilistProvider,
  tvdbProvider,
  igdbProvider,
  googleBooksProvider,
  deezerProvider,
} from '../providers'

const logger = new LogFactory('Borealis:EntitySyncer')

export class MediaEntitySyncer {
  private static async upsertGenres(genreNames?: string[]): Promise<Array<{ id: number }>> {
    if (!genreNames || genreNames.length === 0) return []
    const results: Array<{ id: number }> = []
    for (const name of genreNames) {
      const clean = name.trim()
      if (!clean) continue
      const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'genre'
      try {
        const genre = await prisma.genre.upsert({
          where: { name: clean },
          update: {},
          create: { name: clean, slug },
          select: { id: true },
        })
        results.push(genre)
      } catch {}
    }
    return results
  }

  /**
   * Fully synchronizes an Anime entity from AniList.
   */
  static async syncAnime(animeId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let anilistId: number | null = externalId ? Number(externalId) : null
      if (!anilistId) {
        const record = await prisma.anime.findUnique({
          where: { id: animeId },
          select: { anilistId: true },
        })
        anilistId = record?.anilistId ?? null
      }

      if (!anilistId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Anime #${animeId}: missing AniList ID`)
        return false
      }

      logger.info(
        `${c.magenta('📡 [1/2]')} Querying AniList GraphQL API for Anime #${anilistId} (Local #${animeId})...`
      )
      const alData = await anilistProvider.fetchAnime(anilistId)
      if (!alData) {
        logger.warn(
          `${c.yellow('⚠️ [AniList Empty]')}: No anime data returned for AniList #${anilistId}`
        )
        return false
      }

      const displayTitle = alData.title.userPreferred || alData.title.english || alData.title.romaji || 'Unknown'
      const genreRecords = await this.upsertGenres(alData.genres)
      logger.info(
        `${c.magenta('📥 [1/2]')} AniList received: "${c.bold(displayTitle)}" (episodes=${alData.episodes || 'N/A'}, duration=${alData.duration || 'N/A'}m, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting Anime #${animeId} record to database...`)
      await prisma.anime.update({
        where: { id: animeId },
        data: {
          titlePrimary:
            alData.title.english ||
            alData.title.userPreferred ||
            alData.title.romaji ||
            undefined,
          titleSecondary: alData.title.romaji || alData.title.english || undefined,
          titleNative: alData.title.native || undefined,
          description: alData.description || undefined,
          coverImage: alData.coverImage?.extraLarge || alData.coverImage?.large || undefined,
          bannerImage: alData.bannerImage || undefined,
          episodeCount: alData.episodes || undefined,
          episodeDuration: alData.duration || undefined,
          averageScore: alData.averageScore || undefined,
          popularity: alData.popularity || undefined,
          favorites: alData.favourites || undefined,
          seasonYear: alData.seasonYear || undefined,
          seasonSeason: (alData.season as any) || undefined,
          format: (alData.format as any) || undefined,
          status: (alData.status as any) || undefined,
          alUpdatedAt: nowUnix,
          updatedAt: now,
          genres: {
            set: genreRecords.map((g) => ({ id: g.id })),
          },
        },
      })

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Anime #${animeId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Anime #${animeId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a Manga entity from AniList.
   */
  static async syncManga(mangaId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let anilistId: number | null = externalId ? Number(externalId) : null
      if (!anilistId) {
        const record = await prisma.manga.findUnique({
          where: { id: mangaId },
          select: { anilistId: true },
        })
        anilistId = record?.anilistId ?? null
      }

      if (!anilistId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Manga #${mangaId}: missing AniList ID`)
        return false
      }

      logger.info(
        `${c.magenta('📡 [1/2]')} Querying AniList GraphQL API for Manga #${anilistId} (Local #${mangaId})...`
      )
      const alData = await anilistProvider.fetchManga(anilistId)
      if (!alData) {
        logger.warn(
          `${c.yellow('⚠️ [AniList Empty]')}: No manga data returned for AniList #${anilistId}`
        )
        return false
      }

      const displayTitle = alData.title.userPreferred || alData.title.english || alData.title.romaji || 'Unknown'
      const genreRecords = await this.upsertGenres(alData.genres)
      logger.info(
        `${c.magenta('📥 [1/2]')} AniList received: "${c.bold(displayTitle)}" (chapters=${alData.chapters || 'N/A'}, volumes=${alData.volumes || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting Manga #${mangaId} record to database...`)
      await prisma.manga.update({
        where: { id: mangaId },
        data: {
          titlePrimary:
            alData.title.english ||
            alData.title.userPreferred ||
            alData.title.romaji ||
            undefined,
          titleSecondary: alData.title.romaji || alData.title.english || undefined,
          titleNative: alData.title.native || undefined,
          description: alData.description || undefined,
          coverImage: alData.coverImage?.extraLarge || alData.coverImage?.large || undefined,
          bannerImage: alData.bannerImage || undefined,
          chapterCount: alData.chapters || undefined,
          volumeCount: alData.volumes || undefined,
          averageScore: alData.averageScore || undefined,
          popularity: alData.popularity || undefined,
          favorites: alData.favourites || undefined,
          startDateYear: alData.startDate?.year || undefined,
          format: (alData.format as any) || undefined,
          status: (alData.status as any) || undefined,
          alUpdatedAt: nowUnix,
          updatedAt: now,
          genres: {
            set: genreRecords.map((g) => ({ id: g.id })),
          },
        },
      })

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Manga #${mangaId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Manga #${mangaId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a TV entity from TheTVDB.
   */
  static async syncTv(tvId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let tvdbId: number | null = externalId ? Number(externalId) : null
      if (!tvdbId) {
        const record = await prisma.tv.findUnique({
          where: { id: tvId },
          select: { tvDBId: true },
        })
        tvdbId = record?.tvDBId ?? null
      }

      if (!tvdbId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync TV #${tvId}: missing TVDB ID`)
        return false
      }

      logger.info(
        `${c.blue('📡 [1/2]')} Querying TheTVDB API v4 for TV Series #${tvdbId} (Local #${tvId})...`
      )
      const series = await tvdbProvider.fetchTvSeries(tvdbId)
      if (!series) {
        logger.warn(
          `${c.yellow('⚠️ [TVDB Empty]')}: No series data returned for TVDB #${tvdbId}`
        )
        return false
      }

      const displayTitle = series.name || 'Unknown TV Series'
      const genreNames = series.genres?.map((g) => g.name).filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      logger.info(
        `${c.blue('📥 [1/2]')} TVDB received Series: "${c.bold(displayTitle)}" (firstAired=${series.firstAired || 'N/A'}, score=${series.score || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting TV Series #${tvId} record to database...`)
      await prisma.tv.update({
        where: { id: tvId },
        data: {
          titlePrimary: series.name || undefined,
          description: series.overview || undefined,
          coverImage: series.image || undefined,
          firstAiredYear: series.firstAired ? parseInt(series.firstAired.slice(0, 4), 10) : undefined,
          averageScore: series.score ? Math.round(series.score * 10) : undefined,
          tvdbUpdatedAt: nowUnix,
          updatedAt: now,
          genres: {
            set: genreRecords.map((g) => ({ id: g.id })),
          },
        },
      })

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced TV Series #${tvId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync TV #${tvId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a Movie entity from TheTVDB.
   */
  static async syncMovie(movieId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let tvdbId: number | null = externalId ? Number(externalId) : null
      if (!tvdbId) {
        const record = await prisma.movie.findUnique({
          where: { id: movieId },
          select: { tvDBId: true },
        })
        tvdbId = record?.tvDBId ?? null
      }

      if (!tvdbId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Movie #${movieId}: missing TVDB ID`)
        return false
      }

      logger.info(
        `${c.blue('📡 [1/2]')} Querying TheTVDB API v4 for Movie #${tvdbId} (Local #${movieId})...`
      )
      const movie = await tvdbProvider.fetchMovie(tvdbId)
      if (!movie) {
        logger.warn(
          `${c.yellow('⚠️ [TVDB Empty]')}: No movie data returned for TVDB #${tvdbId}`
        )
        return false
      }

      const displayTitle = movie.name || 'Unknown Movie'
      const genreNames = movie.genres?.map((g) => g.name).filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      logger.info(
        `${c.blue('📥 [1/2]')} TVDB received Movie: "${c.bold(displayTitle)}" (runtime=${movie.runtime || 'N/A'}m, score=${movie.score || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting Movie #${movieId} record to database...`)
      await prisma.movie.update({
        where: { id: movieId },
        data: {
          titlePrimary: movie.name || undefined,
          description: movie.overview || undefined,
          coverImage: movie.image || undefined,
          runtime: movie.runtime || undefined,
          releaseDateYear: movie.first_release_date ? parseInt(movie.first_release_date.slice(0, 4), 10) : undefined,
          averageScore: movie.score ? Math.round(movie.score * 10) : undefined,
          tvdbUpdatedAt: nowUnix,
          updatedAt: now,
          genres: {
            set: genreRecords.map((g) => ({ id: g.id })),
          },
        },
      })

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Movie #${movieId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Movie #${movieId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a Game entity from IGDB.
   */
  static async syncGame(gameId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let igdbId: number | null = externalId ? Number(externalId) : null
      if (!igdbId) {
        const record = await prisma.game.findUnique({
          where: { id: gameId },
          select: { igdbId: true },
        })
        igdbId = record?.igdbId ?? null
      }

      if (!igdbId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Game #${gameId}: missing IGDB ID`)
        return false
      }

      logger.info(
        `${c.magenta('📡 [1/2]')} Querying IGDB API v4 for Game #${igdbId} (Local #${gameId})...`
      )
      const game = await igdbProvider.fetchGame(igdbId)
      if (!game) {
        logger.warn(
          `${c.yellow('⚠️ [IGDB Empty]')}: No game data returned for IGDB #${igdbId}`
        )
        return false
      }

      const displayTitle = game.name || 'Unknown Game'
      const genreNames = game.genres?.map((g) => g.name).filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      const platforms = game.platforms?.map((p) => p.name).filter(Boolean) || []
      logger.info(
        `${c.magenta('📥 [1/2]')} IGDB received Game: "${c.bold(displayTitle)}" (rating=${game.rating ? Math.round(game.rating) : 'N/A'}, platforms=${platforms.length}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting Game #${gameId} record to database...`)
      await prisma.game.update({
        where: { id: gameId },
        data: {
          titlePrimary: game.name || undefined,
          description: game.summary || game.storyline || undefined,
          coverImage: game.cover?.image_id
            ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
            : undefined,
          releaseDateYear: game.first_release_date
            ? new Date(game.first_release_date * 1000).getUTCFullYear()
            : undefined,
          averageScore: game.rating ? Math.round(game.rating) : undefined,
          platforms,
          igdbUpdatedAt: nowUnix,
          updatedAt: now,
          genres: {
            set: genreRecords.map((g) => ({ id: g.id })),
          },
        },
      })

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Game #${gameId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Game #${gameId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a Book entity from Google Books.
   */
  static async syncBook(bookId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let volumeId: string | null = externalId ? String(externalId) : null
      if (!volumeId) {
        const record = await prisma.book.findUnique({
          where: { id: bookId },
          select: { googleBookId: true },
        })
        volumeId = record?.googleBookId ?? null
      }

      if (!volumeId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Book #${bookId}: missing Google Books ID`)
        return false
      }

      logger.info(
        `${c.yellow('📡 [1/2]')} Querying Google Books API for Volume "${volumeId}" (Local #${bookId})...`
      )
      const book = await googleBooksProvider.fetchBook(volumeId)
      if (!book) {
        logger.warn(
          `${c.yellow('⚠️ [Google Books Empty]')}: No book data returned for Google Books ID "${volumeId}"`
        )
        return false
      }

      const info = book.volumeInfo || {}
      const displayTitle = info.title || 'Unknown Book'
      const genreNames = info.categories?.filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      logger.info(
        `${c.yellow('📥 [1/2]')} Google Books received: "${c.bold(displayTitle)}" (pages=${info.pageCount || 'N/A'}, authors=${info.authors?.join(', ') || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      let releaseDateYear: number | undefined
      if (info.publishedDate) {
        const yr = parseInt(info.publishedDate.slice(0, 4), 10)
        if (!isNaN(yr)) releaseDateYear = yr
      }

      logger.info(`${c.blue('💾 [2/2]')} Upserting Book #${bookId} record to database...`)
      await prisma.book.update({
        where: { id: bookId },
        data: {
          titlePrimary: info.title || undefined,
          titleSecondary: info.subtitle || undefined,
          description: info.description || undefined,
          pageCount: info.pageCount || undefined,
          authors: info.authors || undefined,
          publishers: info.publisher ? [info.publisher] : undefined,
          releaseDateYear,
          googleBooksUpdatedAt: nowUnix,
          updatedAt: now,
          genres: {
            set: genreRecords.map((g) => ({ id: g.id })),
          },
        },
      })

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Book #${bookId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Book #${bookId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a Music entity from Deezer.
   */
  static async syncMusic(musicId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let deezerId: string | null = externalId ? String(externalId) : null
      if (!deezerId) {
        const record = await prisma.music.findUnique({
          where: { id: musicId },
          select: { deezerId: true, type: true },
        })
        deezerId = record?.deezerId ?? null
      }

      if (!deezerId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Music #${musicId}: missing Deezer ID`)
        return false
      }

      logger.info(
        `${c.cyan('📡 [1/2]')} Querying Deezer API for Track/Album #${deezerId} (Local #${musicId})...`
      )
      const track = await deezerProvider.getTrack(deezerId)
      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      if (track) {
        logger.info(
          `${c.cyan('📥 [1/2]')} Deezer received Track: "${c.bold(track.title)}" (artist=${track.artist?.name || 'N/A'}, duration=${track.duration || 0}s)`
        )
        logger.info(`${c.blue('💾 [2/2]')} Upserting Music Track #${musicId} record to database...`)
        await prisma.music.update({
          where: { id: musicId },
          data: {
            titlePrimary: track.title || undefined,
            artistName: track.artist?.name || undefined,
            duration: track.duration || undefined,
            audioPreviewUrl: track.preview || undefined,
            deezerUpdatedAt: nowUnix,
            updatedAt: now,
          },
        })
        logger.info(
          `${c.green('✅ [Sync Complete]')} Successfully synced Music Track #${musicId} ("${track.title}")`
        )
        return true
      }

      const album = await deezerProvider.getAlbum(deezerId)
      if (album) {
        logger.info(
          `${c.cyan('📥 [1/2]')} Deezer received Album: "${c.bold(album.title)}" (artist=${album.artist?.name || 'N/A'}, duration=${album.duration || 0}s)`
        )
        logger.info(`${c.blue('💾 [2/2]')} Upserting Music Album #${musicId} record to database...`)
        await prisma.music.update({
          where: { id: musicId },
          data: {
            titlePrimary: album.title || undefined,
            artistName: album.artist?.name || undefined,
            duration: album.duration || undefined,
            deezerUpdatedAt: nowUnix,
            updatedAt: now,
          },
        })
        logger.info(
          `${c.green('✅ [Sync Complete]')} Successfully synced Music Album #${musicId} ("${album.title}")`
        )
        return true
      }

      logger.warn(
        `${c.yellow('⚠️ [Deezer Empty]')}: No track or album data returned for Deezer ID "${deezerId}"`
      )
      return false
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Music #${musicId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Routes entity sync based on media type.
   */
  static async syncEntity(
    mediaType: string,
    mediaId: number,
    externalId?: number | string | null
  ): Promise<boolean> {
    const norm = mediaType.toUpperCase()
    switch (norm) {
      case 'ANIME':
        return await this.syncAnime(mediaId, externalId)
      case 'MANGA':
        return await this.syncManga(mediaId, externalId)
      case 'TV':
        return await this.syncTv(mediaId, externalId)
      case 'MOVIE':
        return await this.syncMovie(mediaId, externalId)
      case 'GAME':
        return await this.syncGame(mediaId, externalId)
      case 'BOOK':
        return await this.syncBook(mediaId, externalId)
      case 'MUSIC':
        return await this.syncMusic(mediaId, externalId)
      default:
        logger.warn(`${c.yellow('⚠️ [Unknown Type]')}: Unsupported media type for sync: ${mediaType}`)
        return false
    }
  }
}
