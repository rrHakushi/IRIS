import { prisma, type Prisma } from '@IRIS/database'
import { LogFactory, c } from '@Iris/logger'
import { normalizeTvdbImageUrl, type TvdbSearchItem } from '../providers/tvdb.provider'
import type { AniListAnimeSearchPreview, AniListMangaSearchPreview } from '../providers/anilist.provider'
import type { GoogleBookPayload } from '../providers/google-books.provider'
import type { IgdbSearchPreview } from '../providers/igdb.provider'
import type { DeezerTrackPayload, DeezerAlbumPayload } from '../providers/deezer.provider'

const logger = new LogFactory('Borealis:PreviewSyncer')

export interface PreviewResult {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  titleNative?: string | null
  coverImage?: string | null
  format?: string | null
  mediaType: string
  releaseDateYear?: number | null
  seasonYear?: number | null
  startDateYear?: number | null
  firstAiredYear?: number | null
  averageScore?: number | null
  queuedForFetch?: boolean
  externalId?: number | string | null
  [key: string]: any
}

function mapAnimeFormat(fmt?: string): any {
  const map: Record<string, string> = {
    TV: 'TV',
    TV_SHORT: 'TV_SHORT',
    MOVIE: 'MOVIE',
    SPECIAL: 'SPECIAL',
    OVA: 'OVA',
    ONA: 'ONA',
    MUSIC: 'MUSIC',
  }
  return (fmt && map[fmt.toUpperCase()]) || 'UNKNOWN'
}

function mapMangaFormat(fmt?: string): any {
  const map: Record<string, string> = {
    MANGA: 'MANGA',
    NOVEL: 'NOVEL',
    LIGHT_NOVEL: 'LIGHT_NOVEL',
    ONE_SHOT: 'ONE_SHOT',
    MANHWA: 'MANHWA',
    MANHUA: 'MANHUA',
  }
  return (fmt && map[fmt.toUpperCase()]) || 'UNKNOWN'
}

function mapTvStatus(st?: string): any {
  const map: Record<string, string> = {
    'RETURNING SERIES': 'RETURNING_SERIES',
    RETURNING_SERIES: 'RETURNING_SERIES',
    CONTINUING: 'RETURNING_SERIES',
    ENDED: 'ENDED',
    CANCELED: 'CANCELED',
    CANCELLED: 'CANCELED',
    'IN PRODUCTION': 'IN_PRODUCTION',
    IN_PRODUCTION: 'IN_PRODUCTION',
    UPCOMING: 'UPCOMING',
  }
  return (st && map[st.toUpperCase()]) || 'UNKNOWN'
}

function mapMovieStatus(st?: string): any {
  const map: Record<string, string> = {
    RELEASED: 'RELEASED',
    'IN PRODUCTION': 'IN_PRODUCTION',
    IN_PRODUCTION: 'IN_PRODUCTION',
    'POST PRODUCTION': 'POST_PRODUCTION',
    POST_PRODUCTION: 'POST_PRODUCTION',
    RUMORED: 'RUMORED',
    CANCELLED: 'CANCELLED',
    CANCELED: 'CANCELLED',
  }
  return (st && map[st.toUpperCase()]) || 'RELEASED'
}

export class MediaPreviewSyncer {
  /**
   * Upserts lightweight search preview stub for Anime.
   */
  static async upsertAnimeSearchPreview(item: AniListAnimeSearchPreview): Promise<PreviewResult> {
    const titlePrimary =
      item.title.english ||
      item.title.userPreferred ||
      item.title.romaji ||
      'Unknown Anime'
    const titleSecondary = item.title.romaji || item.title.english || null
    const titleNative = item.title.native || null
    const coverImage = item.coverImage?.large || null
    const format = mapAnimeFormat(item.format)
    const seasonSeason = (
      item.season && ['WINTER', 'SPRING', 'SUMMER', 'FALL'].includes(item.season)
        ? item.season
        : 'UNKNOWN'
    ) as any

    const existing = await prisma.anime.findUnique({
      where: { anilistId: item.id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        coverImage: true,
        isAdult: true,
        format: true,
        seasonYear: true,
        seasonSeason: true,
      },
    })

    if (existing) {
      logger.info(
        `${c.dim('⏩ [Existing Stub]')}: Found Anime #${existing.id} ("${existing.titlePrimary}") in local DB`
      )
      return {
        ...existing,
        mediaType: 'anime',
        externalId: item.id,
        queuedForFetch: true,
      }
    }

    const created = await prisma.anime.create({
      data: {
        anilistId: item.id,
        titlePrimary,
        titleSecondary,
        titleNative,
        coverImage,
        isAdult: item.isAdult ?? false,
        format,
        seasonSeason,
        seasonYear: item.seasonYear,
        alUpdatedAt: null, // Marks as unhydrated stub -> full background fetch will proceed
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        coverImage: true,
        isAdult: true,
        format: true,
        seasonYear: true,
        seasonSeason: true,
      },
    })

    logger.info(
      `${c.green('✨ [Created Stub]')}: Created Anime preview stub #${created.id} ("${created.titlePrimary}")`
    )
    return {
      ...created,
      mediaType: 'anime',
      externalId: item.id,
      queuedForFetch: true,
    }
  }

  /**
   * Upserts lightweight search preview stub for Manga.
   */
  static async upsertMangaSearchPreview(item: AniListMangaSearchPreview): Promise<PreviewResult> {
    const titlePrimary =
      item.title.english ||
      item.title.userPreferred ||
      item.title.romaji ||
      'Unknown Manga'
    const titleSecondary = item.title.romaji || item.title.english || null
    const titleNative = item.title.native || null
    const coverImage = item.coverImage?.large || null
    const format = mapMangaFormat(item.format)

    const existing = await prisma.manga.findUnique({
      where: { anilistId: item.id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        coverImage: true,
        isAdult: true,
        format: true,
        startDateYear: true,
      },
    })

    if (existing) {
      logger.info(
        `${c.dim('⏩ [Existing Stub]')}: Found Manga #${existing.id} ("${existing.titlePrimary}") in local DB`
      )
      return {
        ...existing,
        mediaType: 'manga',
        externalId: item.id,
        queuedForFetch: true,
      }
    }

    const created = await prisma.manga.create({
      data: {
        anilistId: item.id,
        titlePrimary,
        titleSecondary,
        titleNative,
        coverImage,
        isAdult: item.isAdult ?? false,
        format,
        startDateYear: item.startDate?.year,
        alUpdatedAt: null,
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        coverImage: true,
        isAdult: true,
        format: true,
        startDateYear: true,
      },
    })

    logger.info(
      `${c.green('✨ [Created Stub]')}: Created Manga preview stub #${created.id} ("${created.titlePrimary}")`
    )
    return {
      ...created,
      mediaType: 'manga',
      externalId: item.id,
      queuedForFetch: true,
    }
  }

  /**
   * Upserts lightweight search preview stub for TV series.
   */
  static async upsertTvSearchPreview(item: TvdbSearchItem): Promise<PreviewResult> {
    const rawId = item.tvdb_id || item.id || item.objectID
    const tvdbId =
      typeof rawId === 'number'
        ? rawId
        : parseInt(String(rawId).replace(/\D/g, ''), 10)

    const engTitle = item.translations?.eng?.trim()
    const engOverview = item.overviews?.eng?.trim()

    const titlePrimary = engTitle || item.name || 'Unknown TV Series'
    const titleSecondary = engTitle && engTitle !== item.name ? item.name : undefined
    const titleNative =
      item.primary_language &&
      ['kor', 'jpn', 'zho', 'zhtw', 'ko', 'ja', 'zh'].includes(item.primary_language.toLowerCase())
        ? item.name
        : undefined

    const coverImage = normalizeTvdbImageUrl(item.image_url)
    const firstAiredYear = item.year ? parseInt(String(item.year).slice(0, 4), 10) : undefined
    const status = mapTvStatus(item.status)
    const description = engOverview || item.overview || undefined

    if (tvdbId) {
      const existing = await prisma.tv.findUnique({
        where: { tvDBId: tvdbId },
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          firstAiredYear: true,
          status: true,
        },
      })

      if (existing) {
        logger.info(
          `${c.dim('⏩ [Existing Stub]')}: Found TV Series #${existing.id} ("${existing.titlePrimary}") in local DB`
        )
        return {
          ...existing,
          mediaType: 'tv',
          releaseDateYear: existing.firstAiredYear,
          externalId: tvdbId,
          queuedForFetch: true,
        }
      }
    }

    const created = await prisma.tv.create({
      data: {
        tvDBId: tvdbId || undefined,
        titlePrimary,
        titleSecondary,
        titleNative,
        coverImage,
        firstAiredYear: isNaN(firstAiredYear as number) ? undefined : firstAiredYear,
        status,
        description,
        tvdbUpdatedAt: null,
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        coverImage: true,
        firstAiredYear: true,
        status: true,
      },
    })

    logger.info(
      `${c.green('✨ [Created Stub]')}: Created TV preview stub #${created.id} ("${created.titlePrimary}")`
    )
    return {
      ...created,
      mediaType: 'tv',
      releaseDateYear: created.firstAiredYear,
      externalId: tvdbId,
      queuedForFetch: true,
    }
  }

  /**
   * Upserts lightweight search preview stub for Movie.
   */
  static async upsertMovieSearchPreview(item: TvdbSearchItem): Promise<PreviewResult> {
    const rawId = item.tvdb_id || item.id || item.objectID
    const tvdbId =
      typeof rawId === 'number'
        ? rawId
        : parseInt(String(rawId).replace(/\D/g, ''), 10)

    const engTitle = item.translations?.eng?.trim()
    const engOverview = item.overviews?.eng?.trim()

    const titlePrimary = engTitle || item.name || 'Unknown Movie'
    const titleSecondary = engTitle && engTitle !== item.name ? item.name : undefined
    const titleNative =
      item.primary_language &&
      ['kor', 'jpn', 'zho', 'zhtw', 'ko', 'ja', 'zh'].includes(item.primary_language.toLowerCase())
        ? item.name
        : undefined

    const coverImage = normalizeTvdbImageUrl(item.image_url)
    const releaseDateYear = item.year ? parseInt(String(item.year).slice(0, 4), 10) : undefined
    const status = mapMovieStatus(item.status)
    const description = engOverview || item.overview || undefined

    if (tvdbId) {
      const existing = await prisma.movie.findUnique({
        where: { tvDBId: tvdbId },
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          releaseDateYear: true,
          status: true,
        },
      })

      if (existing) {
        logger.info(
          `${c.dim('⏩ [Existing Stub]')}: Found Movie #${existing.id} ("${existing.titlePrimary}") in local DB`
        )
        return {
          ...existing,
          mediaType: 'movie',
          externalId: tvdbId,
          queuedForFetch: true,
        }
      }
    }

    const created = await prisma.movie.create({
      data: {
        tvDBId: tvdbId || undefined,
        titlePrimary,
        titleSecondary,
        titleNative,
        coverImage,
        releaseDateYear: isNaN(releaseDateYear as number) ? undefined : releaseDateYear,
        status,
        description,
        tvdbUpdatedAt: null,
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        coverImage: true,
        bannerImage: true,
        releaseDateYear: true,
        status: true,
      },
    })

    logger.info(
      `${c.green('✨ [Created Stub]')}: Created Movie preview stub #${created.id} ("${created.titlePrimary}")`
    )
    return {
      ...created,
      mediaType: 'movie',
      externalId: tvdbId,
      queuedForFetch: true,
    }
  }

  /**
   * Upserts lightweight search preview stub for Book.
   */
  static async upsertBookSearchPreview(item: GoogleBookPayload): Promise<PreviewResult> {
    const info = item.volumeInfo || {}
    const titlePrimary = info.title || 'Unknown Book'
    const titleSecondary = info.subtitle || null
    const coverImage =
      info.imageLinks?.large ||
      info.imageLinks?.medium ||
      info.imageLinks?.thumbnail ||
      null
    const authors = info.authors || []
    let releaseDateYear: number | undefined
    if (info.publishedDate) {
      const yr = parseInt(info.publishedDate.slice(0, 4), 10)
      if (!isNaN(yr)) releaseDateYear = yr
    }

    const existing = await prisma.book.findUnique({
      where: { googleBookId: item.id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        authors: true,
        releaseDateYear: true,
      },
    })

    if (existing) {
      logger.info(
        `${c.dim('⏩ [Existing Stub]')}: Found Book #${existing.id} ("${existing.titlePrimary}") in local DB`
      )
      return {
        ...existing,
        mediaType: 'book',
        externalId: item.id,
        queuedForFetch: true,
      }
    }

    const created = await prisma.book.create({
      data: {
        googleBookId: item.id,
        titlePrimary,
        titleSecondary,
        subtitle: info.subtitle,
        coverImage,
        authors,
        publishers: info.publisher ? [info.publisher] : [],
        description: info.description,
        releaseDateYear,
        pageCount: info.pageCount,
        googleBooksUpdatedAt: null,
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        authors: true,
        releaseDateYear: true,
      },
    })

    logger.info(
      `${c.green('✨ [Created Stub]')}: Created Book preview stub #${created.id} ("${created.titlePrimary}")`
    )
    return {
      ...created,
      mediaType: 'book',
      externalId: item.id,
      queuedForFetch: true,
    }
  }

  /**
   * Upserts lightweight search preview stub for Game.
   */
  static async upsertGameSearchPreview(item: IgdbSearchPreview): Promise<PreviewResult> {
    const titlePrimary = item.name || 'Unknown Game'
    const coverImage = item.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${item.cover.image_id}.jpg`
      : null
    let releaseDateYear: number | undefined
    if (item.first_release_date) {
      releaseDateYear = new Date(item.first_release_date * 1000).getUTCFullYear()
    }

    const existing = await prisma.game.findUnique({
      where: { igdbId: item.id },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        releaseDateYear: true,
      },
    })

    if (existing) {
      logger.info(
        `${c.dim('⏩ [Existing Stub]')}: Found Game #${existing.id} ("${existing.titlePrimary}") in local DB`
      )
      return {
        ...existing,
        mediaType: 'game',
        externalId: item.id,
        queuedForFetch: true,
      }
    }

    const created = await prisma.game.create({
      data: {
        igdbId: item.id,
        titlePrimary,
        coverImage,
        releaseDateYear,
        igdbUpdatedAt: null,
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
        releaseDateYear: true,
      },
    })

    logger.info(
      `${c.green('✨ [Created Stub]')}: Created Game preview stub #${created.id} ("${created.titlePrimary}")`
    )
    return {
      ...created,
      mediaType: 'game',
      externalId: item.id,
      queuedForFetch: true,
    }
  }

  /**
   * Upserts lightweight search preview stub for Music Track.
   */
  static async upsertMusicTrackSearchPreview(item: DeezerTrackPayload): Promise<PreviewResult> {
    const titlePrimary = item.title?.trim() || 'Unknown Track'
    const artist = item.artist?.name?.trim() || null
    const deezerIdStr = String(item.id)
    const coverImage = item.album?.cover_big || item.album?.cover_medium || item.album?.cover || null

    const existing = await prisma.music.findUnique({
      where: { deezerId: deezerIdStr },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        artistName: true,
        coverImage: true,
        duration: true,
        audioPreviewUrl: true,
      },
    })

    if (existing) {
      logger.info(
        `${c.dim('⏩ [Existing Stub]')}: Found Music Track #${existing.id} ("${existing.titlePrimary}") in local DB`
      )
      return {
        ...existing,
        mediaType: 'music',
        itemType: 'TRACK',
        type: 'TRACK',
        artist: existing.artistName,
        externalId: item.id,
        queuedForFetch: true,
      }
    }

    const created = await prisma.music.upsert({
      where: { deezerId: deezerIdStr },
      update: {
        titlePrimary,
        artistName: artist,
        coverImage,
        duration: item.duration,
        audioPreviewUrl: item.preview,
      },
      create: {
        type: 'TRACK',
        deezerId: deezerIdStr,
        titlePrimary,
        artistName: artist,
        coverImage,
        duration: item.duration,
        audioPreviewUrl: item.preview,
        deezerUpdatedAt: null,
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        artistName: true,
        coverImage: true,
        duration: true,
        audioPreviewUrl: true,
      },
    })

    logger.info(
      `${c.green('✨ [Created Stub]')}: Upserted Music Track preview stub #${created.id} ("${created.titlePrimary}")`
    )
    return {
      ...created,
      mediaType: 'music',
      itemType: 'TRACK',
      type: 'TRACK',
      artist: created.artistName,
      externalId: item.id,
      queuedForFetch: true,
    }
  }

  /**
   * Upserts lightweight search preview stub for Music Album.
   */
  static async upsertMusicAlbumSearchPreview(item: DeezerAlbumPayload): Promise<PreviewResult> {
    const titlePrimary = item.title?.trim() || 'Unknown Album'
    const artist = item.artist?.name?.trim() || null
    const deezerIdStr = String(item.id)
    const coverImage = item.cover_big || item.cover_medium || item.cover || null
    let releaseDateYear: number | undefined
    if (item.release_date) {
      const yr = parseInt(item.release_date.slice(0, 4), 10)
      if (!isNaN(yr)) releaseDateYear = yr
    }

    const existing = await prisma.music.findUnique({
      where: { deezerId: deezerIdStr },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        artistName: true,
        coverImage: true,
        duration: true,
      },
    })

    if (existing) {
      logger.info(
        `${c.dim('⏩ [Existing Stub]')}: Found Music Album #${existing.id} ("${existing.titlePrimary}") in local DB`
      )
      return {
        ...existing,
        mediaType: 'music',
        itemType: 'ALBUM',
        type: 'ALBUM',
        artist: existing.artistName,
        releaseDateYear,
        externalId: item.id,
        queuedForFetch: true,
      }
    }

    const created = await prisma.music.upsert({
      where: { deezerId: deezerIdStr },
      update: {
        titlePrimary,
        artistName: artist,
        coverImage,
        duration: item.duration,
      },
      create: {
        type: 'ALBUM',
        deezerId: deezerIdStr,
        titlePrimary,
        artistName: artist,
        coverImage,
        duration: item.duration,
        deezerUpdatedAt: null,
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        artistName: true,
        coverImage: true,
        duration: true,
      },
    })

    logger.info(
      `${c.green('✨ [Created Stub]')}: Upserted Music Album preview stub #${created.id} ("${created.titlePrimary}")`
    )
    return {
      ...created,
      mediaType: 'music',
      itemType: 'ALBUM',
      type: 'ALBUM',
      artist: created.artistName,
      releaseDateYear,
      externalId: item.id,
      queuedForFetch: true,
    }
  }
}
