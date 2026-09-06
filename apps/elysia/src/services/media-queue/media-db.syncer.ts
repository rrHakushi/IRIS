import { prisma, type Prisma } from "@IRIS/database"
import type {
  AniListAnimePayload,
  AniListMangaPayload,
  AniListAnimeSearchPreview,
  AniListMangaSearchPreview,
} from "./providers/anilist.provider.js"
import type {
  MalAnimePayload,
  MalMangaPayload,
} from "./providers/mal.provider.js"
import {
  type TvdbSeriesPayload,
  type TvdbMoviePayload,
  type TvdbEpisode,
  type TvdbCharacter,
  normalizeTvdbImageUrl,
} from "./providers/tvdb.provider.js"
import type { GoogleBookPayload } from "./providers/google-books.provider.js"
import type { IgdbGamePayload } from "./providers/igdb.provider.js"
import type {
  SteamAppDetailsPayload,
  SteamDeckCompatibilityReport,
} from "./providers/steam.provider.js"
import type { MusicBrainzRecordingPayload } from "./providers/musicbrainz.provider.js"
import type { LrcLibLyricsPayload } from "./providers/lrclib.provider.js"
import type {
  LastFmAlbumInfo,
  LastFmTrackInfo,
  LastFmArtistInfo,
} from "./providers/lastfm.provider.js"
import type {
  DeezerArtistPayload,
  DeezerAlbumPayload,
  DeezerTrackPayload,
} from "./providers/deezer.provider.js"
import type {
  DiscoveredRelation,
  MediaJobType,
  AnimeSearchResult,
  MangaSearchResult,
  TvSearchResult,
  MovieSearchResult,
  BookSearchResult,
  GameSearchResult,
  MusicSearchResult,
} from "./types.js"

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_WEEK_MS = 7 * ONE_DAY_MS
const ONE_YEAR_MS = 365 * ONE_DAY_MS

const VALID_RELATION_TYPES = new Set([
  "ADAPTATION",
  "SEQUEL",
  "PREQUEL",
  "PARENT",
  "SIDE_STORY",
  "CHARACTER",
  "SUMMARY",
  "ALTERNATIVE",
  "SPIN_OFF",
])

export class MediaDbSyncer {
  /**
   * Evaluates if a database record is stale and needs a fresh fetch.
   */
  isRecordStale(
    record: {
      updatedAt?: Date | null
      alUpdatedAt?: number | null
      malUpdatedAt?: number | null
      tvdbUpdatedAt?: number | null
      googleBooksUpdatedAt?: number | null
      igdbUpdatedAt?: number | null
      status?: string | null
      nextAiringAt?: Date | null
      startDateYear?: number | null
      startDateMonth?: number | null
      releaseDate?: Date | null
    } | null,
    mediaType: MediaJobType
  ): boolean {
    if (!record) return true

    // If provider updated timestamp is explicitly null or 0, it's an unhydrated stub -> STALE (must fetch!)
    if (
      mediaType === "ANIME" &&
      (record.alUpdatedAt === null || record.alUpdatedAt === 0)
    )
      return true
    if (
      mediaType === "MANGA" &&
      (record.alUpdatedAt === null || record.alUpdatedAt === 0)
    )
      return true
    if (
      mediaType === "TV" &&
      (record.tvdbUpdatedAt === null || record.tvdbUpdatedAt === 0)
    )
      return true
    if (
      mediaType === "MOVIE" &&
      (record.tvdbUpdatedAt === null || record.tvdbUpdatedAt === 0)
    )
      return true
    if (
      mediaType === "BOOK" &&
      (record.googleBooksUpdatedAt === null ||
        record.googleBooksUpdatedAt === 0)
    )
      return true
    if (
      mediaType === "GAME" &&
      (record.igdbUpdatedAt === null || record.igdbUpdatedAt === 0)
    )
      return true
    if (
      (mediaType === "MUSIC" ||
        mediaType === "MUSIC_ALBUM" ||
        mediaType === "MUSIC_TRACK") &&
      ((record as any).deezerUpdatedAt === null ||
        (record as any).deezerUpdatedAt === 0)
    )
      return true

    // If music track has no cover image and no audio preview, it is an unhydrated stub
    if (
      (mediaType === "MUSIC" || mediaType === "MUSIC_TRACK") &&
      !(record as any).coverImage &&
      !(record as any).audioPreviewUrl &&
      !(record as any).link
    ) {
      return true
    }

    if (!record.updatedAt) return true

    const now = Date.now()
    const updatedAge = now - new Date(record.updatedAt).getTime()

    // Freshness cooldown: if updated less than 1 hour ago, it is always fresh (prevents tight loops)
    if (updatedAge < ONE_HOUR_MS) {
      return false
    }

    // Check airing schedule timestamp (+ 1 day after airing to allow external data to update)
    if (record.nextAiringAt) {
      const nextAir = new Date(record.nextAiringAt).getTime()
      // If 1 day has passed since scheduled airing time and record hasn't been refreshed in 6 hours:
      if (now >= nextAir + ONE_DAY_MS && updatedAge > 6 * ONE_HOUR_MS) {
        return true
      }
    }

    const statusUpper = (record.status || "").toUpperCase()
    const isActive =
      statusUpper === "RELEASING" ||
      statusUpper === "RETURNING_SERIES" ||
      statusUpper === "IN_PRODUCTION" ||
      statusUpper === "AIRING" ||
      statusUpper === "UPCOMING" ||
      statusUpper === "EARLY_ACCESS" ||
      statusUpper === "NOT_YET_RELEASED"

    if (isActive) {
      // Releasing / active media: stale if older than 1 week (7 days)
      return updatedAge > ONE_WEEK_MS
    }

    // Default: stale if older than 1 year (365 days)
    return updatedAge > ONE_YEAR_MS
  }

  /**
   * Helper to parse enum AnimeFormat.
   */
  public mapAnimeFormat(fmt?: string): any {
    const map: Record<string, string> = {
      TV: "TV",
      TV_SHORT: "TV_SHORT",
      MOVIE: "MOVIE",
      SPECIAL: "SPECIAL",
      OVA: "OVA",
      ONA: "ONA",
      MUSIC: "MUSIC",
    }
    return (fmt && map[fmt.toUpperCase()]) || "UNKNOWN"
  }

  /**
   * Helper to parse enum AnimeStatus.
   */
  public mapAnimeStatus(st?: string): any {
    const map: Record<string, string> = {
      FINISHED: "FINISHED",
      RELEASING: "RELEASING",
      NOT_YET_RELEASED: "NOT_YET_RELEASED",
      CANCELLED: "CANCELLED",
      HIATUS: "HIATUS",
    }
    return (st && map[st.toUpperCase()]) || "UNKNOWN"
  }

  /**
   * Helper to parse enum AnimeSource.
   */
  public mapAnimeSource(alSource?: string, malSource?: string): any {
    const raw = (alSource || malSource || "")
      .toUpperCase()
      .replace(/[\s-]+/g, "_")
    const map: Record<string, string> = {
      ORIGINAL: "ORIGINAL",
      MANGA: "MANGA",
      LIGHT_NOVEL: "LIGHT_NOVEL",
      VISUAL_NOVEL: "VISUAL_NOVEL",
      VIDEO_GAME: "VIDEO_GAME",
      GAME: "GAME",
      NOVEL: "NOVEL",
      DOUJINSHI: "DOUJINSHI",
      ANIME: "ANIME",
      WEB_NOVEL: "WEB_NOVEL",
      WEB_MANGA: "MANGA",
      "4_KOMA_MANGA": "MANGA",
      FOUR_KOMA_MANGA: "MANGA",
      LIVE_ACTION: "LIVE_ACTION",
      COMIC: "COMIC",
      MULTIMEDIA_PROJECT: "MULTIMEDIA_PROJECT",
      MIXED_MEDIA: "MULTIMEDIA_PROJECT",
      PICTURE_BOOK: "PICTURE_BOOK",
      OTHER: "OTHER",
    }
    return map[raw] || "UNKNOWN"
  }

  /**
   * Helper to parse enum MangaFormat.
   */
  public mapMangaFormat(fmt?: string): any {
    const map: Record<string, string> = {
      MANGA: "MANGA",
      NOVEL: "NOVEL",
      LIGHT_NOVEL: "LIGHT_NOVEL",
      ONE_SHOT: "ONE_SHOT",
      MANHWA: "MANHWA",
      MANHUA: "MANHUA",
    }
    return (fmt && map[fmt.toUpperCase()]) || "UNKNOWN"
  }

  /**
   * Helper to parse enum MangaStatus.
   */
  public mapMangaStatus(st?: string): any {
    const map: Record<string, string> = {
      FINISHED: "FINISHED",
      RELEASING: "RELEASING",
      NOT_YET_RELEASED: "NOT_YET_RELEASED",
      CANCELLED: "CANCELLED",
      HIATUS: "HIATUS",
    }
    return (st && map[st.toUpperCase()]) || "UNKNOWN"
  }

  /**
   * Helper to parse enum TvStatus.
   */
  public mapTvStatus(st?: string): any {
    const map: Record<string, string> = {
      "RETURNING SERIES": "RETURNING_SERIES",
      RETURNING_SERIES: "RETURNING_SERIES",
      CONTINUING: "RETURNING_SERIES",
      ENDED: "ENDED",
      CANCELED: "CANCELED",
      CANCELLED: "CANCELED",
      "IN PRODUCTION": "IN_PRODUCTION",
      IN_PRODUCTION: "IN_PRODUCTION",
      UPCOMING: "UPCOMING",
    }
    return (st && map[st.toUpperCase()]) || "UNKNOWN"
  }

  /**
   * Helper to parse enum MovieStatus.
   */
  public mapMovieStatus(st?: string): any {
    const map: Record<string, string> = {
      RELEASED: "RELEASED",
      "IN PRODUCTION": "IN_PRODUCTION",
      IN_PRODUCTION: "IN_PRODUCTION",
      "POST PRODUCTION": "POST_PRODUCTION",
      POST_PRODUCTION: "POST_PRODUCTION",
      RUMORED: "RUMORED",
      CANCELLED: "CANCELLED",
      CANCELED: "CANCELLED",
    }
    return (st && map[st.toUpperCase()]) || "RELEASED"
  }

  /**
   * Upserts a lightweight search preview stub for Anime and returns the search result record.
   */
  async upsertAnimeSearchPreview(
    item: AniListAnimeSearchPreview
  ): Promise<AnimeSearchResult> {
    const titlePrimary =
      item.title.english ||
      item.title.userPreferred ||
      item.title.romaji ||
      "Unknown Anime"
    const titleSecondary = item.title.romaji || item.title.english || null
    const titleNative = item.title.native || null
    const coverImage = item.coverImage?.large || null
    const format = this.mapAnimeFormat(item.format)
    const seasonSeason = (
      item.season &&
      ["WINTER", "SPRING", "SUMMER", "FALL"].includes(item.season)
        ? item.season
        : "UNKNOWN"
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
      return {
        id: existing.id,
        titlePrimary: existing.titlePrimary,
        titleSecondary: existing.titleSecondary,
        titleNative: existing.titleNative,
        coverImage: existing.coverImage,
        isAdult: existing.isAdult,
        format: existing.format,
        seasonYear: existing.seasonYear,
        seasonSeason: existing.seasonSeason,
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

    return {
      id: created.id,
      titlePrimary: created.titlePrimary,
      titleSecondary: created.titleSecondary,
      titleNative: created.titleNative,
      coverImage: created.coverImage,
      isAdult: created.isAdult,
      format: created.format,
      seasonYear: created.seasonYear,
      seasonSeason: created.seasonSeason,
    }
  }

  /**
   * Upserts a lightweight search preview stub for Manga and returns the search result record.
   */
  async upsertMangaSearchPreview(
    item: AniListMangaSearchPreview
  ): Promise<MangaSearchResult> {
    const titlePrimary =
      item.title.english ||
      item.title.userPreferred ||
      item.title.romaji ||
      "Unknown Manga"
    const titleSecondary = item.title.romaji || item.title.english || null
    const titleNative = item.title.native || null
    const coverImage = item.coverImage?.large || null
    const format = this.mapMangaFormat(item.format)

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
      return existing
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

    return created
  }

  /**
   * Upserts a lightweight search preview stub for TV and returns the search result record.
   */
  async upsertTvSearchPreview(item: any): Promise<TvSearchResult> {
    const rawId = item.tvdb_id || item.id || item.objectID
    const tvdbId =
      typeof rawId === "number"
        ? rawId
        : parseInt(String(rawId).replace(/\D/g, ""), 10)
    const titlePrimary = item.name || "Unknown TV Series"
    const coverImage = normalizeTvdbImageUrl(item.image_url)
    const firstAiredYear = item.year
      ? parseInt(String(item.year).slice(0, 4), 10)
      : undefined
    const status = this.mapTvStatus(item.status)

    if (tvdbId) {
      const existing = await prisma.tv.findUnique({
        where: { tvDBId: tvdbId },
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          firstAiredYear: true,
          status: true,
        },
      })
      if (existing) return existing
    }

    const created = await prisma.tv.create({
      data: {
        tvDBId: tvdbId || undefined,
        titlePrimary,
        coverImage,
        firstAiredYear: isNaN(firstAiredYear as number)
          ? undefined
          : firstAiredYear,
        status,
        description: item.overview,
        tvdbUpdatedAt: null,
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        coverImage: true,
        bannerImage: true,
        firstAiredYear: true,
        status: true,
      },
    })

    return created
  }

  /**
   * Upserts a lightweight search preview stub for Movie and returns the search result record.
   */
  async upsertMovieSearchPreview(item: any): Promise<MovieSearchResult> {
    const rawId = item.tvdb_id || item.id || item.objectID
    const tvdbId =
      typeof rawId === "number"
        ? rawId
        : parseInt(String(rawId).replace(/\D/g, ""), 10)
    const titlePrimary = item.name || "Unknown Movie"
    const coverImage = normalizeTvdbImageUrl(item.image_url)
    const releaseDateYear = item.year
      ? parseInt(String(item.year).slice(0, 4), 10)
      : undefined
    const status = this.mapMovieStatus(item.status)

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
      if (existing) return existing
    }

    const created = await prisma.movie.create({
      data: {
        tvDBId: tvdbId || undefined,
        titlePrimary,
        coverImage,
        releaseDateYear: isNaN(releaseDateYear as number)
          ? undefined
          : releaseDateYear,
        status,
        description: item.overview,
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

    return created
  }

  /**
   * Upserts a lightweight search preview stub for Book and returns the search result record.
   */
  async upsertBookSearchPreview(
    item: GoogleBookPayload
  ): Promise<BookSearchResult> {
    const info = item.volumeInfo || {}
    const titlePrimary = info.title || "Unknown Book"
    const titleSecondary = info.subtitle || null
    const coverImage =
      info.imageLinks?.extraLarge ||
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
    if (existing) return existing

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

    return created
  }

  /**
   * Upserts a lightweight search preview stub for Game and returns the search result record.
   */
  async upsertGameSearchPreview(item: any): Promise<GameSearchResult> {
    const titlePrimary = item.name || "Unknown Game"
    const coverImage = item.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${item.cover.image_id}.jpg`
      : null
    let releaseDateYear: number | undefined
    if (item.first_release_date) {
      releaseDateYear = new Date(
        item.first_release_date * 1000
      ).getUTCFullYear()
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
    if (existing) return existing

    const created = await prisma.game.create({
      data: {
        igdbId: item.id,
        titlePrimary,
        coverImage,
        releaseDateYear,
        description: item.summary,
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

    return created
  }

  /**
   * Upserts a lightweight search preview stub for Music Album and returns the search result record.
   */
  /**
   * Upserts a lightweight search preview stub for Music Album and returns the search result record.
   */
  async upsertMusicAlbumSearchPreview(item: {
    titlePrimary: string
    artistName?: string | null
    coverImage?: string | null
    deezerId?: string | number | null
    lastFmUrl?: string | null
    musicBrainzId?: string | null
  }): Promise<MusicSearchResult> {
    const titlePrimary = item.titlePrimary.trim() || "Unknown Album"
    const artist = item.artistName?.trim() || null
    const deezerIdStr = item.deezerId ? String(item.deezerId) : item.musicBrainzId || null

    let existing: any = null
    if (deezerIdStr) {
      existing = await prisma.music.findUnique({
        where: { deezerId: deezerIdStr },
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          artistName: true,
          coverImage: true,
          duration: true,
          nbTracks: true,
        },
      })
    }
    if (!existing && artist) {
      existing = await prisma.music.findFirst({
        where: {
          titlePrimary: { equals: titlePrimary, mode: "insensitive" },
          artistName: { equals: artist, mode: "insensitive" },
          type: "ALBUM",
        },
        select: {
          id: true,
          titlePrimary: true,
          titleSecondary: true,
          artistName: true,
          coverImage: true,
          duration: true,
          nbTracks: true,
        },
      })
    }
    if (existing) {
      return {
        id: existing.id,
        itemType: "ALBUM",
        titlePrimary: existing.titlePrimary,
        titleSecondary: existing.titleSecondary,
        artist: existing.artistName,
        artistName: existing.artistName,
        coverImage: existing.coverImage,
        duration: existing.duration,
        totalTracks: existing.nbTracks,
      }
    }

    const created = deezerIdStr
      ? await prisma.music.upsert({
          where: { deezerId: deezerIdStr },
          update: {
            titlePrimary,
            artistName: artist,
            coverImage: item.coverImage,
          },
          create: {
            type: "ALBUM",
            deezerId: deezerIdStr,
            titlePrimary,
            artistName: artist,
            coverImage: item.coverImage,
            deezerUpdatedAt: null,
          },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            artistName: true,
            coverImage: true,
            duration: true,
            nbTracks: true,
          },
        })
      : await prisma.music.create({
          data: {
            type: "ALBUM",
            titlePrimary,
            artistName: artist,
            coverImage: item.coverImage,
            deezerUpdatedAt: null,
          },
          select: {
            id: true,
            titlePrimary: true,
            titleSecondary: true,
            artistName: true,
            coverImage: true,
            duration: true,
            nbTracks: true,
          },
        })

    if (artist) {
      const person = await this.upsertArtist({ namePrimary: artist })
      await prisma.mediaStaff.upsert({
        where: {
          mediaType_mediaId_personId_role: {
            mediaType: "MUSIC",
            mediaId: created.id,
            personId: person.id,
            role: "ARTIST",
          },
        },
        update: { musicId: created.id },
        create: {
          mediaType: "MUSIC",
          mediaId: created.id,
          musicId: created.id,
          personId: person.id,
          role: "ARTIST",
        },
      }).catch(() => {})
    }

    return {
      id: created.id,
      itemType: "ALBUM",
      titlePrimary: created.titlePrimary,
      titleSecondary: created.titleSecondary,
      artist: created.artistName,
      artistName: created.artistName,
      coverImage: created.coverImage,
      duration: created.duration,
      totalTracks: created.nbTracks,
    }
  }

  /**
   * Upserts a lightweight search preview stub for Music Track and returns the search result record.
   */
  async upsertMusicTrackSearchPreview(item: {
    titlePrimary: string
    artistName?: string | null
    albumTitle?: string | null
    coverImage?: string | null
    deezerId?: string | number | null
    lastFmUrl?: string | null
    musicBrainzId?: string | null
    duration?: number | null
    audioPreviewUrl?: string | null
  }): Promise<MusicSearchResult> {
    const titlePrimary = item.titlePrimary.trim() || "Unknown Track"
    const artist = item.artistName?.trim() || null
    const deezerIdStr = item.deezerId ? String(item.deezerId) : item.musicBrainzId || null

    const selectFields = {
      id: true,
      titlePrimary: true,
      titleSecondary: true,
      artistName: true,
      coverImage: true,
      duration: true,
      audioPreviewUrl: true,
      albumId: true,
      album: { select: { id: true, titlePrimary: true } },
    } as const satisfies Prisma.MusicSelect

    let existing: Prisma.MusicGetPayload<{ select: typeof selectFields }> | null = null
    if (deezerIdStr) {
      existing = await prisma.music.findUnique({
        where: { deezerId: deezerIdStr },
        select: selectFields,
      })
    }
    if (!existing && artist) {
      existing = await prisma.music.findFirst({
        where: {
          titlePrimary: { equals: titlePrimary, mode: "insensitive" },
          artistName: { equals: artist, mode: "insensitive" },
          type: "TRACK",
        },
        select: selectFields,
      })
    }
    if (existing) {
      return {
        id: existing.id,
        itemType: "TRACK",
        titlePrimary: existing.titlePrimary,
        titleSecondary: existing.titleSecondary,
        artist: existing.artistName,
        artistName: existing.artistName,
        coverImage: existing.coverImage,
        duration: existing.duration,
        audioPreviewUrl: existing.audioPreviewUrl,
        albumId: existing.albumId,
        albumTitle: existing.album?.titlePrimary || null,
      }
    }

    const created = deezerIdStr
      ? await prisma.music.upsert({
          where: { deezerId: deezerIdStr },
          update: {
            titlePrimary,
            artistName: artist,
            coverImage: item.coverImage,
            duration: item.duration,
            audioPreviewUrl: item.audioPreviewUrl,
          },
          create: {
            type: "TRACK",
            deezerId: deezerIdStr,
            titlePrimary,
            artistName: artist,
            coverImage: item.coverImage,
            duration: item.duration,
            audioPreviewUrl: item.audioPreviewUrl,
            deezerUpdatedAt: null,
          },
          select: selectFields,
        })
      : await prisma.music.create({
          data: {
            type: "TRACK",
            titlePrimary,
            artistName: artist,
            coverImage: item.coverImage,
            duration: item.duration,
            audioPreviewUrl: item.audioPreviewUrl,
            deezerUpdatedAt: null,
          },
          select: selectFields,
        })

    if (artist) {
      const person = await this.upsertArtist({ namePrimary: artist })
      await prisma.mediaStaff.upsert({
        where: {
          mediaType_mediaId_personId_role: {
            mediaType: "MUSIC",
            mediaId: created.id,
            personId: person.id,
            role: "ARTIST",
          },
        },
        update: { musicId: created.id },
        create: {
          mediaType: "MUSIC",
          mediaId: created.id,
          musicId: created.id,
          personId: person.id,
          role: "ARTIST",
        },
      }).catch(() => {})
    }

    return {
      id: created.id,
      itemType: "TRACK",
      titlePrimary: created.titlePrimary,
      titleSecondary: created.titleSecondary,
      artist: created.artistName,
      artistName: created.artistName,
      coverImage: created.coverImage,
      duration: created.duration,
      audioPreviewUrl: created.audioPreviewUrl,
      albumId: created.albumId,
      albumTitle: item.albumTitle || null,
    }
  }

  /**
   * Search preview stub for Deezer track.
   */
  async upsertDeezerTrackSearchPreview(
    item: DeezerTrackPayload
  ): Promise<MusicSearchResult> {
    return await this.upsertMusicTrackSearchPreview({
      deezerId: item.id,
      titlePrimary: item.title,
      artistName: item.artist?.name,
      albumTitle: item.album?.title,
      coverImage: item.album?.cover_medium || item.album?.cover,
      duration: item.duration,
      audioPreviewUrl: item.preview,
    })
  }

  /**
   * Search preview stub for Deezer album.
   */
  async upsertDeezerAlbumSearchPreview(
    item: DeezerAlbumPayload
  ): Promise<MusicSearchResult> {
    return await this.upsertMusicAlbumSearchPreview({
      deezerId: item.id,
      titlePrimary: item.title,
      artistName: item.artist?.name,
      coverImage: item.cover_medium || item.cover,
    })
  }

  /**
   * Legacy wrapper: upserts a lightweight search preview stub from MusicBrainz recording.
   */
  async upsertMusicSearchPreview(
    item: MusicBrainzRecordingPayload
  ): Promise<MusicSearchResult> {
    const titlePrimary = item.title || "Unknown Track"
    const artist = item["artist-credit"]?.map((a) => a.name).join(", ") || null
    const duration = item.length ? Math.round(item.length / 1000) : null

    return await this.upsertMusicTrackSearchPreview({
      titlePrimary,
      artistName: artist,
      albumTitle: item.releases?.[0]?.title,
      coverImage: item.coverImageUrl,
      musicBrainzId: item.id,
      duration,
    })
  }

  /**
   * Upserts Genre records by name, generating URL-friendly slugs.
   */
  private async upsertGenres(names?: string[]): Promise<{ id: number }[]> {
    if (!names || names.length === 0) return []
    const results: { id: number }[] = []
    const seen = new Set<string>()

    for (const rawName of names) {
      const name = rawName?.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const slug = key.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      try {
        const genre = await prisma.genre.upsert({
          where: { name },
          update: { slug },
          create: { name, slug },
          select: { id: true },
        })
        results.push({ id: genre.id })
      } catch {
        const existing = await prisma.genre.findUnique({ where: { name } })
        if (existing) results.push({ id: existing.id })
      }
    }
    return results
  }

  /**
   * Upserts Tag records by tag object or name, generating URL-friendly slugs.
   */
  private async upsertTags(
    tags?: Array<
      string | { name: string; category?: string; description?: string }
    >
  ): Promise<{ id: number }[]> {
    if (!tags || tags.length === 0) return []
    const results: { id: number }[] = []
    const seen = new Set<string>()

    for (const item of tags) {
      const name = (typeof item === "string" ? item : item.name)?.trim()
      if (!name || !isNaN(Number(name))) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const slug = key.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      const category =
        typeof item === "object" ? item.category?.trim() : undefined
      const description =
        typeof item === "object" ? item.description?.trim() : undefined

      try {
        const tag = await prisma.tag.upsert({
          where: { name },
          update: {
            slug,
            category: category || undefined,
            description: description || undefined,
          },
          create: {
            name,
            slug,
            category,
            description,
          },
          select: { id: true },
        })
        results.push({ id: tag.id })
      } catch {
        const existing = await prisma.tag.findUnique({ where: { name } })
        if (existing) results.push({ id: existing.id })
      }
    }
    return results
  }

  /**
   * Upserts or finds a Person record using local ID.
   */
  private async upsertPerson(data: {
    anilistId?: number
    malId?: number
    tvDBId?: number
    namePrimary: string
    nameNative?: string
    nameAlternative?: string[]
    image?: string
    description?: string
    language?: string
  }): Promise<{ id: number }> {
    // 1. Try to find by unique provider IDs
    if (data.anilistId) {
      const existing = await prisma.person.findUnique({
        where: { anilistId: data.anilistId },
      })
      if (existing) {
        if (data.language && !existing.language) {
          await prisma.person.update({
            where: { id: existing.id },
            data: { language: data.language },
          })
        }
        return existing
      }
    }
    if (data.malId) {
      const existing = await prisma.person.findUnique({
        where: { malId: data.malId },
      })
      if (existing) {
        if (data.language && !existing.language) {
          await prisma.person.update({
            where: { id: existing.id },
            data: { language: data.language },
          })
        }
        return existing
      }
    }
    if (data.tvDBId) {
      const existing = await prisma.person.findUnique({
        where: { tvDBId: data.tvDBId },
      })
      if (existing) {
        if (data.language && !existing.language) {
          await prisma.person.update({
            where: { id: existing.id },
            data: { language: data.language },
          })
        }
        return existing
      }
    }

    // 2. Fallback to name matching
    if (data.namePrimary) {
      const existing = await prisma.person.findFirst({
        where: {
          namePrimary: { equals: data.namePrimary, mode: "insensitive" },
        },
      })
      if (existing) {
        // Link new IDs if missing
        await prisma.person.update({
          where: { id: existing.id },
          data: {
            anilistId: existing.anilistId || data.anilistId,
            malId: existing.malId || data.malId,
            tvDBId: existing.tvDBId || data.tvDBId,
            image: existing.image || data.image,
            language: existing.language || data.language,
          },
        })
        return existing
      }
    }

    // 3. Create new Person
    return await prisma.person.create({
      data: {
        anilistId: data.anilistId,
        malId: data.malId,
        tvDBId: data.tvDBId,
        namePrimary: data.namePrimary || "Unknown Person",
        nameNative: data.nameNative,
        nameAlternative: data.nameAlternative || [],
        image: data.image,
        description: data.description,
        language: data.language,
      },
    })
  }

  /**
   * Upserts or finds a Person record for a musical Artist.
   */
  public async upsertArtist(data: {
    namePrimary: string
    deezerId?: string | number | null
    spotifyId?: string | null
    lastFmUrl?: string | null
    image?: string | null
    images?: any
    description?: string | null
    nbAlbum?: number | null
    nbFan?: number | null
    hasRadio?: boolean | null
  }): Promise<{ id: number; namePrimary: string }> {
    const name = data.namePrimary?.trim() || "Unknown Artist"
    const deezerIdStr = data.deezerId ? String(data.deezerId) : undefined

    // 1. Try finding by deezerId
    if (deezerIdStr) {
      const existing = await prisma.person.findUnique({
        where: { deezerId: deezerIdStr },
      })
      if (existing) {
        const updated = await prisma.person.update({
          where: { id: existing.id },
          data: {
            spotifyId: existing.spotifyId || data.spotifyId,
            lastFmUrl: existing.lastFmUrl || data.lastFmUrl,
            image: existing.image || data.image,
            images: existing.images || data.images,
            description: existing.description || data.description,
            nbAlbum: data.nbAlbum ?? existing.nbAlbum,
            nbFan: data.nbFan ?? existing.nbFan,
            hasRadio: data.hasRadio ?? existing.hasRadio,
          },
        })
        return { id: updated.id, namePrimary: updated.namePrimary }
      }
    }

    // 2. Match by namePrimary case-insensitively
    const existingByName = await prisma.person.findFirst({
      where: {
        namePrimary: { equals: name, mode: "insensitive" },
      },
    })
    if (existingByName) {
      const updated = await prisma.person.update({
        where: { id: existingByName.id },
        data: {
          deezerId: existingByName.deezerId || deezerIdStr,
          spotifyId: existingByName.spotifyId || data.spotifyId,
          lastFmUrl: existingByName.lastFmUrl || data.lastFmUrl,
          image: existingByName.image || data.image,
          images: existingByName.images || data.images,
          description: existingByName.description || data.description,
          nbAlbum: data.nbAlbum ?? existingByName.nbAlbum,
          nbFan: data.nbFan ?? existingByName.nbFan,
          hasRadio: data.hasRadio ?? existingByName.hasRadio,
        },
      })
      return { id: updated.id, namePrimary: updated.namePrimary }
    }

    // 3. Create new Person
    const created = await prisma.person.create({
      data: {
        namePrimary: name,
        deezerId: deezerIdStr,
        spotifyId: data.spotifyId,
        lastFmUrl: data.lastFmUrl,
        image: data.image,
        images: data.images,
        description: data.description,
        nbAlbum: data.nbAlbum,
        nbFan: data.nbFan,
        hasRadio: data.hasRadio,
        primaryOccupations: ["Artist"],
      },
    })
    return { id: created.id, namePrimary: created.namePrimary }
  }

  /**
   * Upserts or finds a Person record for a Deezer musical artist.
   * Stores visual variants inside images Json and only the primary visual in image.
   */
  public async upsertDeezerArtist(
    artist: DeezerArtistPayload
  ): Promise<{ id: number; namePrimary: string }> {
    if (!artist || !artist.id) {
      throw new Error("Invalid Deezer artist payload")
    }
    const deezerIdStr = String(artist.id)

    // 1. Try finding by deezerId
    let existing = await prisma.person.findUnique({
      where: { deezerId: deezerIdStr },
    })

    // 2. Fallback to namePrimary matching
    if (!existing && artist.name) {
      existing = await prisma.person.findFirst({
        where: {
          namePrimary: { equals: artist.name.trim(), mode: "insensitive" },
        },
      })
    }

    const images = {
      small: artist.picture_small,
      medium: artist.picture_medium,
      big: artist.picture_big,
      xl: artist.picture_xl,
    }
    const mainImage =
      artist.picture_big || artist.picture_medium || artist.picture

    const data: Prisma.PersonCreateInput = {
      deezerId: deezerIdStr,
      namePrimary: artist.name?.trim() || "Unknown Artist",
      image: mainImage,
      images,
      nbAlbum: artist.nb_album,
      nbFan: artist.nb_fan,
      hasRadio: artist.radio,
      primaryOccupations: ["Artist"],
    }

    if (existing) {
      const updated = await prisma.person.update({
        where: { id: existing.id },
        data: {
          deezerId: existing.deezerId || deezerIdStr,
          image: existing.image || data.image,
          images: existing.images || data.images,
          nbAlbum: data.nbAlbum ?? existing.nbAlbum,
          nbFan: data.nbFan ?? existing.nbFan,
          hasRadio: data.hasRadio ?? existing.hasRadio,
        },
      })
      return { id: updated.id, namePrimary: updated.namePrimary }
    } else {
      const created = await prisma.person.create({ data })
      return { id: created.id, namePrimary: created.namePrimary }
    }
  }

  /**
   * Upserts or finds a Character record using local ID.
   */
  public async upsertCharacter(data: {
    anilistId?: number
    malId?: number
    tvDBId?: number
    namePrimary: string
    nameNative?: string
    nameAlternative?: string[]
    nameAlternativeSpoiler?: string[]
    image?: string
    description?: string
    gender?: string
    age?: string
    dateOfBirthYear?: number
    dateOfBirthMonth?: number
    dateOfBirthDay?: number
  }): Promise<{ id: number }> {
    if (data.anilistId) {
      const existing = await prisma.character.findUnique({
        where: { anilistId: data.anilistId },
      })
      if (existing) return existing
    }
    if (data.malId) {
      const existing = await prisma.character.findUnique({
        where: { malId: data.malId },
      })
      if (existing) return existing
    }
    if (data.tvDBId) {
      const existing = await prisma.character.findUnique({
        where: { tvDBId: data.tvDBId },
      })
      if (existing) return existing
    }

    if (data.namePrimary) {
      const existing = await prisma.character.findFirst({
        where: {
          namePrimary: { equals: data.namePrimary, mode: "insensitive" },
        },
      })
      if (existing) {
        await prisma.character.update({
          where: { id: existing.id },
          data: {
            anilistId: existing.anilistId || data.anilistId,
            malId: existing.malId || data.malId,
            tvDBId: existing.tvDBId || data.tvDBId,
            image: existing.image || data.image,
            nameAlternativeSpoiler:
              existing.nameAlternativeSpoiler &&
              existing.nameAlternativeSpoiler.length > 0
                ? existing.nameAlternativeSpoiler
                : data.nameAlternativeSpoiler || [],
          },
        })
        return existing
      }
    }

    return await prisma.character.create({
      data: {
        anilistId: data.anilistId,
        malId: data.malId,
        tvDBId: data.tvDBId,
        namePrimary: data.namePrimary || "Unknown Character",
        nameNative: data.nameNative,
        nameAlternative: data.nameAlternative || [],
        nameAlternativeSpoiler: data.nameAlternativeSpoiler || [],
        image: data.image,
        description: data.description,
        gender: data.gender,
        age: data.age,
        dateOfBirthYear: data.dateOfBirthYear,
        dateOfBirthMonth: data.dateOfBirthMonth,
        dateOfBirthDay: data.dateOfBirthDay,
      },
    })
  }

  /**
   * Upserts Studio record using local ID.
   */
  private async upsertStudio(data: {
    anilistId?: number
    malId?: number
    name: string
    isAnimationStudio?: boolean
    siteUrl?: string
  }): Promise<{ id: number }> {
    if (data.anilistId) {
      const existing = await prisma.studio.findUnique({
        where: { anilistId: data.anilistId },
      })
      if (existing) return existing
    }
    if (data.malId) {
      const existing = await prisma.studio.findUnique({
        where: { malId: data.malId },
      })
      if (existing) return existing
    }

    const existingByName = await prisma.studio.findFirst({
      where: { name: { equals: data.name, mode: "insensitive" } },
    })
    if (existingByName) return existingByName

    return await prisma.studio.create({
      data: {
        anilistId: data.anilistId,
        malId: data.malId,
        name: data.name,
        isAnimationStudio: data.isAnimationStudio || false,
        siteUrl: data.siteUrl,
      },
    })
  }

  /**
   * Upserts Anime with all sub-entities (Episodes, Schedule, Cast, Staff, Studios, Relations) using LOCAL IDs.
   */
  async upsertAnime(
    al: AniListAnimePayload,
    mal?: MalAnimePayload | null,
    malEpisodes?: import("./providers/mal.provider.js").MalScrapedEpisode[],
    mappedIds?: import("./providers/anime-mapping.provider.js").AnimeMappingEntry,
    tvdbImages?: string[],
    skipMap?: Map<
      number,
      import("./providers/aniskip.provider.js").EpisodeSkipTimestamps
    >
  ): Promise<{
    id: number
    discoveredRelations: DiscoveredRelation[]
    characterIds: number[]
  }> {
    const titlePrimary =
      al.title.english ||
      al.title.userPreferred ||
      al.title.romaji ||
      "Unknown Anime"
    const titleSecondary = al.title.romaji || al.title.english
    const titleNative = al.title.native

    const coverImage =
      al.coverImage?.extraLarge || al.coverImage?.large || al.coverImage?.medium
    const bannerImage = al.bannerImage

    const malId = al.idMal || mal?.id

    // Images: all URLs divided by provider
    const anilistImages: string[] = []
    if (al.coverImage?.extraLarge) anilistImages.push(al.coverImage.extraLarge)
    if (al.coverImage?.large && !anilistImages.includes(al.coverImage.large))
      anilistImages.push(al.coverImage.large)
    if (al.coverImage?.medium && !anilistImages.includes(al.coverImage.medium))
      anilistImages.push(al.coverImage.medium)
    if (al.bannerImage && !anilistImages.includes(al.bannerImage))
      anilistImages.push(al.bannerImage)

    const malImages: string[] = []
    if (mal?.main_picture?.large) malImages.push(mal.main_picture.large)
    if (
      mal?.main_picture?.medium &&
      !malImages.includes(mal.main_picture.medium)
    )
      malImages.push(mal.main_picture.medium)
    if (mal?.pictures) {
      for (const pic of mal.pictures) {
        if (pic.large && !malImages.includes(pic.large))
          malImages.push(pic.large)
        if (pic.medium && !malImages.includes(pic.medium))
          malImages.push(pic.medium)
      }
    }

    const images: Record<string, string[]> = {
      anilist: anilistImages,
      mal: malImages,
    }
    if (tvdbImages && tvdbImages.length > 0) {
      images.thetvdb = tvdbImages
    }

    // Sources: structured provider info
    const sources: Record<string, unknown> = {
      anilist: {
        id: al.id,
        url: al.siteUrl || `https://anilist.co/anime/${al.id}`,
        updatedAt: al.updatedAt || Math.floor(Date.now() / 1000),
      },
    }
    if (malId) {
      sources.mal = {
        id: malId,
        url: `https://myanimelist.net/anime/${malId}`,
        updatedAt: mal?.updated_at
          ? Math.floor(new Date(mal.updated_at).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
      }
    }
    if (mappedIds?.anidbId) {
      sources.anidb = {
        id: mappedIds.anidbId,
        url: `https://anidb.net/anime/${mappedIds.anidbId}`,
      }
    }
    if (mappedIds?.tvdbId) {
      sources.thetvdb = {
        id: mappedIds.tvdbId,
        url: `https://thetvdb.com/dereferrer/series/${mappedIds.tvdbId}`,
      }
    }
    if (mappedIds?.bangumiId) {
      sources.bangumi = {
        id: mappedIds.bangumiId,
        url: `https://bgm.tv/subject/${mappedIds.bangumiId}`,
      }
    }
    if (mappedIds?.kitsuId) {
      sources.kitsu = {
        id: mappedIds.kitsuId,
        url: `https://kitsu.app/anime/${mappedIds.kitsuId}`,
      }
    }
    if (mappedIds?.imdbId) {
      sources.imdb = {
        id: mappedIds.imdbId,
        url: `https://www.imdb.com/title/${mappedIds.imdbId}`,
      }
    }
    if (mappedIds?.tmdbId) {
      sources.tmdb = {
        id: mappedIds.tmdbId,
        url: `https://www.themoviedb.org/tv/${mappedIds.tmdbId}`,
      }
    }

    // 1. Upsert base Anime record
    const existing =
      (await prisma.anime.findUnique({ where: { anilistId: al.id } })) ||
      (malId ? await prisma.anime.findUnique({ where: { malId } }) : null)

    const rawGenres = al.genres || mal?.genres?.map((g) => g.name) || []
    const genreRecords = await this.upsertGenres(rawGenres)

    const externalLinks =
      al.externalLinks && al.externalLinks.length > 0
        ? al.externalLinks
        : undefined

    const data: any = {
      anilistId: al.id,
      malId: malId,
      aniDBId: mappedIds?.anidbId,
      tvDBId: mappedIds?.tvdbId,
      bangumiId: mappedIds?.bangumiId,
      kitsuId: mappedIds?.kitsuId,
      titlePrimary,
      titleSecondary,
      titleNative,
      coverImage,
      bannerImage,
      images,
      description: al.description || mal?.synopsis,
      hashtag: al.hashtag,
      countryOfOrigin: al.countryOfOrigin,
      episodeCount: al.episodes || mal?.num_episodes,
      episodeDuration: al.duration || mal?.average_episode_duration,
      startDateYear: al.startDate?.year,
      startDateMonth: al.startDate?.month,
      startDateDay: al.startDate?.day,
      endDateYear: al.endDate?.year,
      endDateMonth: al.endDate?.month,
      endDateDay: al.endDate?.day,
      genres: existing ? { set: genreRecords } : { connect: genreRecords },
      source: this.mapAnimeSource(al.source, mal?.source),
      format: this.mapAnimeFormat(al.format),
      status: this.mapAnimeStatus(al.status),
      seasonSeason: (al.season as any) || "UNKNOWN",
      seasonYear: al.seasonYear || mal?.start_season?.year,
      alAverageScore: al.averageScore,
      alPopularity: al.popularity,
      alFavorites: al.favourites,
      malAverageScore: mal?.mean ? Math.round(mal.mean * 10) : undefined,
      malPopularity: mal?.popularity,
      malFavorites: mal?.num_list_users,
      isAdult: al.isAdult || false,
      synonyms: al.synonyms || mal?.alternative_titles?.synonyms || [],
      siteUrl: al.siteUrl,
      externalLinks,
      sources,
      ageRating: mal?.rating,
      nextAiringEpisodeNumber: al.nextAiringEpisode?.episode,
      nextAiringAt: al.nextAiringEpisode
        ? new Date(al.nextAiringEpisode.airingAt * 1000)
        : undefined,
      trailers: al.trailer ? [al.trailer] : undefined,
      themeSongs:
        mal?.opening_themes || mal?.ending_themes
          ? { op: mal.opening_themes, ed: mal.ending_themes }
          : undefined,
      alUpdatedAt: al.updatedAt || Math.floor(Date.now() / 1000),
      malUpdatedAt: mal?.updated_at
        ? Math.floor(new Date(mal.updated_at).getTime() / 1000)
        : mal
          ? Math.floor(Date.now() / 1000)
          : undefined,
    }

    let anime: { id: number }
    if (existing) {
      anime = await prisma.anime.update({
        where: { id: existing.id },
        data,
      })
    } else {
      anime = await prisma.anime.create({
        data,
      })
    }

    const localAnimeId = anime.id

    // 2. Airing Schedule (Local animeId) with Episode 1 backfill
    const scheduleMap = new Map<number, { id?: number; airingAt: Date }>()
    if (al.airingSchedule?.nodes && al.airingSchedule.nodes.length > 0) {
      for (const node of al.airingSchedule.nodes) {
        scheduleMap.set(node.episode, {
          id: node.id,
          airingAt: new Date(node.airingAt * 1000),
        })
      }

      // If episode 1 is not in schedule, backfill from earliest episode or startDate
      if (!scheduleMap.has(1)) {
        const sortedEpisodes = [...scheduleMap.entries()].sort(
          (a, b) => a[0] - b[0]
        )
        if (sortedEpisodes.length > 0) {
          const firstRecorded = sortedEpisodes[0]!
          const epNum = firstRecorded[0]
          const epTime = firstRecorded[1].airingAt.getTime()
          // Backfill 7 days per episode difference
          const ep1Time = new Date(
            epTime - (epNum - 1) * 7 * 24 * 60 * 60 * 1000
          )
          scheduleMap.set(1, { airingAt: ep1Time })
        } else if (
          al.startDate?.year &&
          al.startDate?.month &&
          al.startDate?.day
        ) {
          scheduleMap.set(1, {
            airingAt: new Date(
              Date.UTC(
                al.startDate.year,
                al.startDate.month - 1,
                al.startDate.day
              )
            ),
          })
        }
      }

      for (const [epNum, item] of scheduleMap.entries()) {
        await prisma.animeAiringSchedule.upsert({
          where: {
            animeId_episodeNumber: {
              animeId: localAnimeId,
              episodeNumber: epNum,
            },
          },
          update: {
            airingAt: item.airingAt,
            anilistAiringId: item.id,
          },
          create: {
            animeId: localAnimeId,
            episodeNumber: epNum,
            airingAt: item.airingAt,
            anilistAiringId: item.id,
          },
        })
      }
    }

    // 3. AnimeEpisode: create/upsert all episodes with MAL titles, subtitles, air dates, fillers, and recaps
    const malEpMap = new Map<
      number,
      import("./providers/mal.provider.js").MalScrapedEpisode
    >()
    if (malEpisodes) {
      for (const me of malEpisodes) {
        malEpMap.set(me.number, me)
      }
    }

    const maxSchedEp =
      scheduleMap.size > 0 ? Math.max(...Array.from(scheduleMap.keys())) : 0
    const maxMalEp =
      malEpMap.size > 0 ? Math.max(...Array.from(malEpMap.keys())) : 0
    const totalEpisodes =
      al.episodes ||
      mal?.num_episodes ||
      maxSchedEp ||
      maxMalEp ||
      (al.streamingEpisodes?.length ?? 0)

    const streamingMap = new Map<
      number,
      { title?: string; thumbnail?: string; url?: string; site?: string }
    >()
    if (al.streamingEpisodes) {
      for (let i = 0; i < al.streamingEpisodes.length; i++) {
        const se = al.streamingEpisodes[i]!
        const match =
          se.title?.match(/Episode\s*(\d+)/i) || se.title?.match(/#(\d+)/i)
        const epNum = match ? parseInt(match[1]!, 10) : i + 1
        streamingMap.set(epNum, se)
      }
    }

    if (totalEpisodes > 0) {
      for (let epNum = 1; epNum <= totalEpisodes; epNum++) {
        const malEp = malEpMap.get(epNum)
        const streamInfo = streamingMap.get(epNum)
        const sched = scheduleMap.get(epNum)
        const airDate =
          malEp?.airDate ||
          sched?.airingAt ||
          (epNum === 1 &&
          al.startDate?.year &&
          al.startDate?.month &&
          al.startDate?.day
            ? new Date(
                Date.UTC(
                  al.startDate.year,
                  al.startDate.month - 1,
                  al.startDate.day
                )
              )
            : undefined)

        const titlePrimary =
          malEp?.titlePrimary || streamInfo?.title || `Episode ${epNum}`
        const titleSecondary = malEp?.titleSecondary || undefined
        const titleNative = malEp?.titleNative || undefined
        const description = malEp?.description || undefined
        const duration =
          malEp?.duration || al.duration || mal?.average_episode_duration
        const malEpisodeId = malEp?.malEpisodeId || (malId ? epNum : undefined)
        const isFiller = malEp?.isFiller || false
        const isRecap = malEp?.isRecap || false

        const skipTimes = skipMap?.get(epNum)
        const opStart = skipTimes?.opStart
        const opEnd = skipTimes?.opEnd
        const edStart = skipTimes?.edStart
        const edEnd = skipTimes?.edEnd
        const recapStart = skipTimes?.recapStart
        const recapEnd = skipTimes?.recapEnd
        const skipTimestamps = skipTimes?.rawResults
          ? (skipTimes.rawResults as any)
          : undefined

        await prisma.animeEpisode.upsert({
          where: {
            animeId_number_type: {
              animeId: localAnimeId,
              number: epNum,
              type: "REGULAR",
            },
          },
          update: {
            titlePrimary,
            titleSecondary,
            titleNative,
            description,
            duration,
            isFiller,
            isRecap,
            thumbnail: streamInfo?.thumbnail,
            airDate,
            streamingLinks: streamInfo
              ? [{ site: streamInfo.site, url: streamInfo.url }]
              : undefined,
            opStart,
            opEnd,
            edStart,
            edEnd,
            recapStart,
            recapEnd,
            skipTimestamps,
          },
          create: {
            animeId: localAnimeId,
            number: epNum,
            type: "REGULAR",
            titlePrimary,
            titleSecondary,
            titleNative,
            description,
            duration,
            isFiller,
            isRecap,
            thumbnail: streamInfo?.thumbnail,
            airDate,
            streamingLinks: streamInfo
              ? [{ site: streamInfo.site, url: streamInfo.url }]
              : undefined,
            opStart,
            opEnd,
            edStart,
            edEnd,
            recapStart,
            recapEnd,
            skipTimestamps,
          },
        })
      }
    }

    // 3. Characters & Voice Actors (Local animeId, characterId, actorId)
    const characterIds: number[] = []
    if (al.characters?.edges) {
      for (const edge of al.characters.edges) {
        const char = await this.upsertCharacter({
          anilistId: edge.node.id,
          namePrimary: edge.node.name.full,
          nameNative: edge.node.name.native,
          nameAlternative: edge.node.name.alternative,
          nameAlternativeSpoiler: edge.node.name.alternativeSpoiler,
          image: edge.node.image?.large || edge.node.image?.medium,
          description: edge.node.description,
          gender: edge.node.gender,
          age: edge.node.age,
          dateOfBirthYear: edge.node.dateOfBirth?.year,
          dateOfBirthMonth: edge.node.dateOfBirth?.month,
          dateOfBirthDay: edge.node.dateOfBirth?.day,
        })
        characterIds.push(char.id)

        const role =
          edge.role === "MAIN"
            ? "MAIN"
            : edge.role === "SUPPORTING"
              ? "SUPPORTING"
              : "BACKGROUND"

        if (edge.voiceActors && edge.voiceActors.length > 0) {
          for (const va of edge.voiceActors) {
            const actor = await this.upsertPerson({
              anilistId: va.id,
              namePrimary: va.name.full,
              nameNative: va.name.native,
              nameAlternative: va.name.alternative,
              image: va.image?.large || va.image?.medium,
              description: va.description,
              language: va.languageV2,
            })

            await prisma.mediaCharacter
              .upsert({
                where: {
                  mediaType_mediaId_characterId_actorId: {
                    mediaType: "ANIME",
                    mediaId: localAnimeId,
                    characterId: char.id,
                    actorId: actor.id,
                  },
                },
                update: {
                  animeId: localAnimeId,
                  role,
                },
                create: {
                  mediaType: "ANIME",
                  mediaId: localAnimeId,
                  animeId: localAnimeId,
                  characterId: char.id,
                  actorId: actor.id,
                  role,
                },
              })
              .catch(() => {})
          }
        } else {
          const existingMC = await prisma.mediaCharacter.findFirst({
            where: {
              mediaType: "ANIME",
              mediaId: localAnimeId,
              characterId: char.id,
              actorId: null,
            },
          })
          if (existingMC) {
            await prisma.mediaCharacter.update({
              where: { id: existingMC.id },
              data: { role, animeId: localAnimeId },
            })
          } else {
            await prisma.mediaCharacter
              .create({
                data: {
                  mediaType: "ANIME",
                  mediaId: localAnimeId,
                  animeId: localAnimeId,
                  characterId: char.id,
                  actorId: null,
                  role,
                },
              })
              .catch(() => {})
          }
        }
      }
    }

    // 4. Staff (Local animeId, personId)
    if (al.staff?.edges) {
      for (const edge of al.staff.edges) {
        const person = await this.upsertPerson({
          anilistId: edge.node.id,
          namePrimary: edge.node.name.full,
          nameNative: edge.node.name.native,
          nameAlternative: edge.node.name.alternative,
          image: edge.node.image?.large || edge.node.image?.medium,
          description: edge.node.description,
        })

        await prisma.mediaStaff
          .upsert({
            where: {
              mediaType_mediaId_personId_role: {
                mediaType: "ANIME",
                mediaId: localAnimeId,
                personId: person.id,
                role: "OTHER",
              },
            },
            update: {
              animeId: localAnimeId,
              customRole: edge.role,
            },
            create: {
              mediaType: "ANIME",
              mediaId: localAnimeId,
              animeId: localAnimeId,
              personId: person.id,
              role: "OTHER",
              customRole: edge.role,
            },
          })
          .catch(() => {})
      }
    }

    // 5. Studios (Local animeId, studioId)
    if (al.studios?.edges) {
      for (const edge of al.studios.edges) {
        const studio = await this.upsertStudio({
          anilistId: edge.node.id,
          name: edge.node.name,
          isAnimationStudio: edge.node.isAnimationStudio,
          siteUrl: edge.node.siteUrl,
        })

        await prisma.mediaStudio
          .upsert({
            where: {
              mediaType_mediaId_studioId: {
                mediaType: "ANIME",
                mediaId: localAnimeId,
                studioId: studio.id,
              },
            },
            update: {
              animeId: localAnimeId,
              isMain: edge.isMain,
            },
            create: {
              mediaType: "ANIME",
              mediaId: localAnimeId,
              animeId: localAnimeId,
              studioId: studio.id,
              isMain: edge.isMain,
            },
          })
          .catch(() => {})
      }
    }

    // 6. Relations (Local sourceId, local targetId)
    const discoveredRelations: DiscoveredRelation[] = []
    if (al.relations?.edges) {
      for (const edge of al.relations.edges) {
        const relType = edge.relationType.toUpperCase()
        if (!VALID_RELATION_TYPES.has(relType)) continue

        const targetType: MediaJobType =
          edge.node.type === "MANGA" ? "MANGA" : "ANIME"
        const targetExternalId = edge.node.id

        // Find or create local stub record for target
        let localTargetId: number
        if (targetType === "ANIME") {
          let targetAnime = await prisma.anime.findUnique({
            where: { anilistId: targetExternalId },
          })
          if (!targetAnime) {
            targetAnime = await prisma.anime.create({
              data: {
                anilistId: targetExternalId,
                titlePrimary:
                  edge.node.title.userPreferred ||
                  edge.node.title.english ||
                  edge.node.title.romaji ||
                  `Anime #${targetExternalId}`,
                coverImage: edge.node.coverImage?.large,
              },
            })
          }
          localTargetId = targetAnime.id
        } else {
          let targetManga = await prisma.manga.findUnique({
            where: { anilistId: targetExternalId },
          })
          if (!targetManga) {
            targetManga = await prisma.manga.create({
              data: {
                anilistId: targetExternalId,
                titlePrimary:
                  edge.node.title.userPreferred ||
                  edge.node.title.english ||
                  edge.node.title.romaji ||
                  `Manga #${targetExternalId}`,
                coverImage: edge.node.coverImage?.large,
              },
            })
          }
          localTargetId = targetManga.id
        }

        // Upsert relation edge using LOCAL IDs
        await prisma.mediaRelation
          .upsert({
            where: {
              sourceType_sourceId_targetType_targetId_type: {
                sourceType: "ANIME",
                sourceId: localAnimeId,
                targetType: targetType === "MANGA" ? "MANGA" : "ANIME",
                targetId: localTargetId,
                type: relType as any,
              },
            },
            update: {},
            create: {
              sourceType: "ANIME",
              sourceId: localAnimeId,
              targetType: targetType === "MANGA" ? "MANGA" : "ANIME",
              targetId: localTargetId,
              type: relType as any,
            },
          })
          .catch(() => {})

        discoveredRelations.push({
          sourceType: "ANIME",
          sourceExternalId: al.id,
          targetType,
          targetExternalId,
          type: relType as any,
        })
      }
    }

    return { id: localAnimeId, discoveredRelations, characterIds }
  }

  /**
   * Upserts Manga with all sub-entities (Characters, Staff, Studios, Relations) using LOCAL IDs.
   */
  async upsertManga(
    al: AniListMangaPayload,
    mal?: MalMangaPayload | null,
    mappedIds?: import("./providers/anime-mapping.provider.js").MangaMappingEntry
  ): Promise<{
    id: number
    discoveredRelations: DiscoveredRelation[]
    characterIds: number[]
  }> {
    const titlePrimary =
      al.title.english ||
      al.title.userPreferred ||
      al.title.romaji ||
      "Unknown Manga"
    const titleSecondary = al.title.romaji || al.title.english
    const titleNative = al.title.native

    const coverImage =
      al.coverImage?.extraLarge || al.coverImage?.large || al.coverImage?.medium
    const bannerImage = al.bannerImage
    const malId = al.idMal || mal?.id

    const existing =
      (await prisma.manga.findUnique({ where: { anilistId: al.id } })) ||
      (malId ? await prisma.manga.findUnique({ where: { malId } }) : null)

    // Images: all URLs divided by provider
    const anilistImages: string[] = []
    if (al.coverImage?.extraLarge) anilistImages.push(al.coverImage.extraLarge)
    if (al.coverImage?.large && !anilistImages.includes(al.coverImage.large))
      anilistImages.push(al.coverImage.large)
    if (al.coverImage?.medium && !anilistImages.includes(al.coverImage.medium))
      anilistImages.push(al.coverImage.medium)
    if (al.bannerImage && !anilistImages.includes(al.bannerImage))
      anilistImages.push(al.bannerImage)

    const malImages: string[] = []
    if (mal?.main_picture?.large) malImages.push(mal.main_picture.large)
    if (
      mal?.main_picture?.medium &&
      !malImages.includes(mal.main_picture.medium)
    )
      malImages.push(mal.main_picture.medium)
    if (mal?.pictures) {
      for (const pic of mal.pictures) {
        if (pic.large && !malImages.includes(pic.large))
          malImages.push(pic.large)
        if (pic.medium && !malImages.includes(pic.medium))
          malImages.push(pic.medium)
      }
    }

    const images = {
      anilist: anilistImages,
      mal: malImages,
    }

    const sources: Record<string, unknown> = {
      anilist: {
        id: al.id,
        url: al.siteUrl || `https://anilist.co/manga/${al.id}`,
        updatedAt: al.updatedAt || Math.floor(Date.now() / 1000),
      },
    }
    if (malId) {
      sources.mal = {
        id: malId,
        url: `https://myanimelist.net/manga/${malId}`,
        updatedAt: mal?.updated_at
          ? Math.floor(new Date(mal.updated_at).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
      }
    }
    if (mappedIds?.mangaUpdatesId) {
      sources.mangaupdates = {
        id: mappedIds.mangaUpdatesId,
        url: `https://www.mangaupdates.com/series/${mappedIds.mangaUpdatesId}`,
      }
    }
    if (mappedIds?.kitsuId) {
      sources.kitsu = {
        id: mappedIds.kitsuId,
        url: `https://kitsu.app/manga/${mappedIds.kitsuId}`,
      }
    }
    if (mappedIds?.bangumiId) {
      sources.bangumi = {
        id: mappedIds.bangumiId,
        url: `https://bgm.tv/subject/${mappedIds.bangumiId}`,
      }
    }

    const rawMangaGenres = al.genres || mal?.genres?.map((g) => g.name) || []
    const mangaGenreRecords = await this.upsertGenres(rawMangaGenres)

    const externalLinks =
      al.externalLinks && al.externalLinks.length > 0
        ? al.externalLinks
        : undefined

    const data: any = {
      anilistId: al.id,
      malId: malId,
      mangaUpdatesId: mappedIds?.mangaUpdatesId,
      kitsuId: mappedIds?.kitsuId,
      bangumiId: mappedIds?.bangumiId,
      titlePrimary,
      titleSecondary,
      titleNative,
      coverImage,
      bannerImage,
      images,
      description: al.description || mal?.synopsis,
      countryOfOrigin: al.countryOfOrigin,
      chapterCount: al.chapters || mal?.num_chapters,
      volumeCount: al.volumes || mal?.num_volumes,
      startDateYear: al.startDate?.year,
      startDateMonth: al.startDate?.month,
      startDateDay: al.startDate?.day,
      endDateYear: al.endDate?.year,
      endDateMonth: al.endDate?.month,
      endDateDay: al.endDate?.day,
      genres: existing
        ? { set: mangaGenreRecords }
        : { connect: mangaGenreRecords },
      source: this.mapAnimeSource(al.source, undefined),
      format: this.mapMangaFormat(al.format),
      status: this.mapMangaStatus(al.status),
      alAverageScore: al.averageScore,
      alPopularity: al.popularity,
      alFavorites: al.favourites,
      malAverageScore: mal?.mean ? Math.round(mal.mean * 10) : undefined,
      malPopularity: mal?.popularity,
      malFavorites: mal?.num_list_users,
      isAdult: al.isAdult || false,
      synonyms: al.synonyms || mal?.alternative_titles?.synonyms || [],
      siteUrl: al.siteUrl,
      externalLinks,
      sources,
      alUpdatedAt: al.updatedAt || Math.floor(Date.now() / 1000),
      malUpdatedAt: mal?.updated_at
        ? Math.floor(new Date(mal.updated_at).getTime() / 1000)
        : mal
          ? Math.floor(Date.now() / 1000)
          : undefined,
    }

    let manga: { id: number }
    if (existing) {
      manga = await prisma.manga.update({ where: { id: existing.id }, data })
    } else {
      manga = await prisma.manga.create({ data })
    }

    const localMangaId = manga.id

    // Characters
    const characterIds: number[] = []
    if (al.characters?.edges) {
      for (const edge of al.characters.edges) {
        const char = await this.upsertCharacter({
          anilistId: edge.node.id,
          namePrimary: edge.node.name.full,
          nameNative: edge.node.name.native,
          nameAlternative: edge.node.name.alternative,
          nameAlternativeSpoiler: edge.node.name.alternativeSpoiler,
          image: edge.node.image?.large || edge.node.image?.medium,
          description: edge.node.description,
          gender: edge.node.gender,
          age: edge.node.age,
          dateOfBirthYear: edge.node.dateOfBirth?.year,
          dateOfBirthMonth: edge.node.dateOfBirth?.month,
          dateOfBirthDay: edge.node.dateOfBirth?.day,
        })
        characterIds.push(char.id)

        const role =
          edge.role === "MAIN"
            ? "MAIN"
            : edge.role === "SUPPORTING"
              ? "SUPPORTING"
              : "BACKGROUND"
        const existingMC = await prisma.mediaCharacter.findFirst({
          where: {
            mediaType: "MANGA",
            mediaId: localMangaId,
            characterId: char.id,
            actorId: null,
          },
        })
        if (existingMC) {
          await prisma.mediaCharacter.update({
            where: { id: existingMC.id },
            data: { mangaId: localMangaId, role },
          })
        } else {
          await prisma.mediaCharacter
            .create({
              data: {
                mediaType: "MANGA",
                mediaId: localMangaId,
                mangaId: localMangaId,
                characterId: char.id,
                actorId: null,
                role,
              },
            })
            .catch(() => {})
        }
      }
    }

    // Staff
    if (al.staff?.edges) {
      for (const edge of al.staff.edges) {
        const person = await this.upsertPerson({
          anilistId: edge.node.id,
          namePrimary: edge.node.name.full,
          nameNative: edge.node.name.native,
          nameAlternative: edge.node.name.alternative,
          image: edge.node.image?.large || edge.node.image?.medium,
          description: edge.node.description,
        })

        await prisma.mediaStaff
          .upsert({
            where: {
              mediaType_mediaId_personId_role: {
                mediaType: "MANGA",
                mediaId: localMangaId,
                personId: person.id,
                role: "OTHER",
              },
            },
            update: { mangaId: localMangaId, customRole: edge.role },
            create: {
              mediaType: "MANGA",
              mediaId: localMangaId,
              mangaId: localMangaId,
              personId: person.id,
              role: "OTHER",
              customRole: edge.role,
            },
          })
          .catch(() => {})
      }
    }

    // Relations
    const discoveredRelations: DiscoveredRelation[] = []
    if (al.relations?.edges) {
      for (const edge of al.relations.edges) {
        const relType = edge.relationType.toUpperCase()
        if (!VALID_RELATION_TYPES.has(relType)) continue

        const targetType: MediaJobType =
          edge.node.type === "ANIME" ? "ANIME" : "MANGA"
        const targetExternalId = edge.node.id

        let localTargetId: number
        if (targetType === "ANIME") {
          let targetAnime = await prisma.anime.findUnique({
            where: { anilistId: targetExternalId },
          })
          if (!targetAnime) {
            targetAnime = await prisma.anime.create({
              data: {
                anilistId: targetExternalId,
                titlePrimary:
                  edge.node.title.userPreferred ||
                  edge.node.title.english ||
                  edge.node.title.romaji ||
                  `Anime #${targetExternalId}`,
                coverImage: edge.node.coverImage?.large,
              },
            })
          }
          localTargetId = targetAnime.id
        } else {
          let targetManga = await prisma.manga.findUnique({
            where: { anilistId: targetExternalId },
          })
          if (!targetManga) {
            targetManga = await prisma.manga.create({
              data: {
                anilistId: targetExternalId,
                titlePrimary:
                  edge.node.title.userPreferred ||
                  edge.node.title.english ||
                  edge.node.title.romaji ||
                  `Manga #${targetExternalId}`,
                coverImage: edge.node.coverImage?.large,
              },
            })
          }
          localTargetId = targetManga.id
        }

        await prisma.mediaRelation
          .upsert({
            where: {
              sourceType_sourceId_targetType_targetId_type: {
                sourceType: "MANGA",
                sourceId: localMangaId,
                targetType: targetType === "ANIME" ? "ANIME" : "MANGA",
                targetId: localTargetId,
                type: relType as any,
              },
            },
            update: {},
            create: {
              sourceType: "MANGA",
              sourceId: localMangaId,
              targetType: targetType === "ANIME" ? "ANIME" : "MANGA",
              targetId: localTargetId,
              type: relType as any,
            },
          })
          .catch(() => {})

        discoveredRelations.push({
          sourceType: "MANGA",
          sourceExternalId: al.id,
          targetType,
          targetExternalId,
          type: relType as any,
        })
      }
    }

    return { id: localMangaId, discoveredRelations, characterIds }
  }

  /**
   * Upserts TV Series with all Seasons, Episodes, and Cast extracted to Person and Character using LOCAL IDs.
   */
  async upsertTv(
    series: TvdbSeriesPayload,
    episodes: TvdbEpisode[],
    characters: TvdbCharacter[],
    tvdbImages?: string[],
    simklData?: import("./providers/simkl.provider.js").SimklTvPayload | null,
    engTranslation?: { name?: string; overview?: string } | null
  ): Promise<{ id: number }> {
    const existing = await prisma.tv.findUnique({
      where: { tvDBId: series.id },
    })

    // Title resolution (English title is ALWAYS primary)
    const titlePrimary =
      engTranslation?.name?.trim() ||
      simklData?.title?.trim() ||
      series.name ||
      "Unknown TV Series"

    const titleSecondary =
      engTranslation?.name && engTranslation.name !== series.name
        ? series.name
        : simklData?.title && simklData.title !== titlePrimary
          ? simklData.title
          : undefined

    const titleNative =
      series.originalLanguage &&
      ["kor", "jpn", "zho", "zhtw", "ko", "ja", "zh"].includes(
        series.originalLanguage.toLowerCase()
      )
        ? series.name
        : undefined

    // Description resolution (English overview is ALWAYS primary)
    const description =
      engTranslation?.overview?.trim() || simklData?.overview || series.overview

    // Date parsing
    let firstAiredYear: number | undefined
    let firstAiredMonth: number | undefined
    let firstAiredDay: number | undefined

    const rawFirstAired = series.firstAired || simklData?.firstAired
    if (rawFirstAired) {
      const datePart = rawFirstAired.split("T")[0] || ""
      const parts = datePart.split("-").map((s) => parseInt(s, 10))
      if (parts[0]) firstAiredYear = parts[0]
      if (parts[1]) firstAiredMonth = parts[1]
      if (parts[2]) firstAiredDay = parts[2]
    } else if (simklData?.year) {
      firstAiredYear = simklData.year
    }

    let lastAiredYear: number | undefined
    let lastAiredMonth: number | undefined
    let lastAiredDay: number | undefined

    if (series.lastAired) {
      const datePart = series.lastAired.split("T")[0] || ""
      const parts = datePart.split("-").map((s) => parseInt(s, 10))
      if (parts[0]) lastAiredYear = parts[0]
      if (parts[1]) lastAiredMonth = parts[1]
      if (parts[2]) lastAiredDay = parts[2]
    }

    // Remote IDs (IMDb, TMDb, Simkl)
    let imdbId: string | undefined = simklData?.imdbId
    let tmdbId: number | undefined = simklData?.tmdbId

    if (series.remoteIds) {
      for (const r of series.remoteIds) {
        if (r.sourceName?.toUpperCase() === "IMDB" || r.type === 2) {
          imdbId = r.id
        } else if (
          r.sourceName?.toLowerCase().includes("themoviedb") ||
          r.type === 12 ||
          r.type === 10
        ) {
          const parsed = parseInt(r.id, 10)
          if (!isNaN(parsed)) tmdbId = parsed
        }
      }
    }

    // Country of Origin
    const countryOfOrigin =
      series.production_countries?.[0]?.name ||
      simklData?.country ||
      (series.originalLanguage
        ? series.originalLanguage.toUpperCase()
        : undefined)

    // Age Rating & Guide
    let ageRating: string | undefined = simklData?.certification
    let ageRatingGuide: string | undefined

    if (series.contentRatings && series.contentRatings.length > 0) {
      const usaRating =
        series.contentRatings.find((r) => r.country?.toLowerCase() === "usa") ||
        series.contentRatings[0]
      if (usaRating) {
        ageRating = usaRating.name || usaRating.fullname || ageRating
        ageRatingGuide = usaRating.description
      }
    }

    const seriesImages: string[] = []
    if (series.image) {
      const norm = normalizeTvdbImageUrl(series.image)
      if (norm) seriesImages.push(norm)
    }
    if (tvdbImages && tvdbImages.length > 0) {
      for (const img of tvdbImages) {
        if (!seriesImages.includes(img)) seriesImages.push(img)
      }
    }

    const images = {
      thetvdb: seriesImages,
    }
    const sources: Record<string, unknown> = {
      thetvdb: {
        id: series.id,
        slug: series.slug,
        url: series.slug
          ? `https://thetvdb.com/series/${series.slug}`
          : `https://thetvdb.com/dereferrer/series/${series.id}`,
      },
    }
    if (imdbId) {
      sources.imdb = { id: imdbId, url: `https://www.imdb.com/title/${imdbId}` }
    }
    if (tmdbId) {
      sources.tmdb = {
        id: tmdbId,
        url: `https://www.themoviedb.org/tv/${tmdbId}`,
      }
    }
    if (simklData?.simklId) {
      sources.simkl = {
        id: simklData.simklId,
        slug: simklData.slug,
        url: simklData.slug
          ? `https://simkl.com/tv/${simklData.simklId}/${simklData.slug}`
          : `https://simkl.com/tv/${simklData.simklId}`,
      }
    }

    // Filter valid non-special episodes (ignore season 0 specials)
    const validEpisodes = episodes.filter((e) => e.seasonNumber > 0)

    // Collect distinct season numbers from non-special seasons/episodes
    const seasonNumbers = new Set<number>()
    if (series.seasons) {
      for (const s of series.seasons) {
        if (s.number > 0) seasonNumbers.add(s.number)
      }
    }
    for (const ep of validEpisodes) {
      seasonNumbers.add(ep.seasonNumber)
    }

    const rawTvGenres =
      series.genres?.map((g) => g.name) || simklData?.genres || []
    const tvGenreRecords = await this.upsertGenres(rawTvGenres)

    // Tags & Subgenres (from TVDB tags and Simkl genres -> Tag table)
    const rawTags: Array<{
      name: string
      category?: string
      description?: string
    }> = []
    if (Array.isArray((series as any).tags)) {
      for (const t of (series as any).tags) {
        if (typeof t === "string" && isNaN(Number(t)) && t.trim()) {
          rawTags.push({ name: t.trim() })
        } else if (t && typeof t === "object") {
          const name = t.name || t.tag || t.tagName
          if (typeof name === "string" && isNaN(Number(name)) && name.trim()) {
            rawTags.push({
              name: name.trim(),
              category: t.tagName || undefined,
              description: t.helpText || undefined,
            })
          }
        }
      }
    }
    if (simklData?.genres) {
      for (const g of simklData.genres) {
        if (typeof g === "string" && isNaN(Number(g)) && g.trim()) {
          rawTags.push({ name: g.trim(), category: "Genre" })
        }
      }
    }
    const tvTagRecords = await this.upsertTags(rawTags)

    // Compute average runtime
    const avgRuntime =
      series.averageRuntime ||
      simklData?.runtime ||
      (validEpisodes.length > 0
        ? Math.round(
            validEpisodes.reduce((acc, e) => acc + (e.runtime || 0), 0) /
              validEpisodes.length
          )
        : undefined)

    // Broadcast days
    const broadcastDays: string[] = []
    if (series.airsDays) {
      for (const [day, active] of Object.entries(series.airsDays)) {
        if (active) {
          const capDay =
            day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()
          if (!broadcastDays.includes(capDay)) broadcastDays.push(capDay)
        }
      }
    }
    if (broadcastDays.length === 0 && (simklData as any)?.airs?.day) {
      broadcastDays.push((simklData as any).airs.day)
    }

    // Show Type / Format (from TVDB tag "TV Type or Format" or series.type)
    const tvFormatTag = Array.isArray((series as any).tags)
      ? (series as any).tags.find((t: any) => t.tagName === "TV Type or Format")
      : undefined
    const showType =
      tvFormatTag?.name ||
      (series as any).type?.name ||
      (series as any).showType ||
      "Scripted"

    // Banner Image fallback (MUST be a background artwork)
    let bannerImage: string | undefined
    const backgroundArtworks = (series.artworks || []).filter(
      (a) => a.type === 3 || (a.image && a.image.includes("/backgrounds/"))
    )
    if (backgroundArtworks.length > 0) {
      const chosen =
        backgroundArtworks[
          Math.floor(Math.random() * backgroundArtworks.length)
        ]
      bannerImage = normalizeTvdbImageUrl(chosen?.image)
    }

    const data: any = {
      tvDBId: series.id,
      imdbId,
      tmdbId,
      simklId: simklData?.simklId,
      titlePrimary,
      titleSecondary,
      titleNative,
      description,
      coverImage: series.image
        ? normalizeTvdbImageUrl(series.image)
        : simklData?.poster,
      bannerImage,
      images,
      sources,
      originalLanguage: series.originalLanguage,
      showType,
      broadcastDays,
      firstAiredYear,
      firstAiredMonth,
      firstAiredDay,
      lastAiredYear,
      lastAiredMonth,
      lastAiredDay,
      episodeCount: validEpisodes.length || simklData?.totalEpisodes,
      seasonCount: seasonNumbers.size,
      averageRuntime: avgRuntime,
      genres: existing ? { set: tvGenreRecords } : { connect: tvGenreRecords },
      tags: existing ? { set: tvTagRecords } : { connect: tvTagRecords },
      networks:
        series.networks?.map((n) => n.name) ||
        (simklData?.network ? [simklData.network] : []),
      status: this.mapTvStatus(series.status?.name),
      imdbRating: simklData?.imdbRating,
      imdbVotes: simklData?.imdbVotes,
      countryOfOrigin,
      ageRating,
      ageRatingGuide,
      trailers: series.trailers as any,
      contentRatings: series.contentRatings as any,
      broadcastTime: series.airsTime || (simklData as any)?.airs?.time,
      tvdbUpdatedAt: Math.floor(Date.now() / 1000),
      imdbUpdatedAt: simklData?.imdbRating
        ? Math.floor(Date.now() / 1000)
        : undefined,
    }

    let tv: { id: number }
    if (existing) {
      tv = await prisma.tv.update({ where: { id: existing.id }, data })
    } else {
      tv = await prisma.tv.create({ data })
    }

    const localTvId = tv.id

    // 1. Upsert Seasons and Episodes (using local tvId and local seasonId, ignoring season 0 specials)
    const seasonMap = new Map<number, number>() // seasonNumber -> local season.id

    for (const sNum of seasonNumbers) {
      const seasonMeta = series.seasons?.find((s) => s.number === sNum)
      const seasonEpisodes = validEpisodes.filter(
        (e) => e.seasonNumber === sNum
      )

      let airDateYear: number | undefined
      let airDateMonth: number | undefined
      let airDateDay: number | undefined

      const firstEp = seasonEpisodes[0]
      if (firstEp?.aired) {
        const parts = firstEp.aired.split("-").map((s) => parseInt(s, 10))
        if (parts[0]) airDateYear = parts[0]
        if (parts[1]) airDateMonth = parts[1]
        if (parts[2]) airDateDay = parts[2]
      } else if (seasonMeta?.year) {
        airDateYear = parseInt(seasonMeta.year, 10) || undefined
      }

      const season = await prisma.tvSeason.upsert({
        where: {
          tvId_seasonNumber: {
            tvId: localTvId,
            seasonNumber: sNum,
          },
        },
        update: {
          tvdbSeasonId: seasonMeta?.id,
          titlePrimary: seasonMeta?.name || `Season ${sNum}`,
          posterImage: seasonMeta?.image
            ? normalizeTvdbImageUrl(seasonMeta.image)
            : undefined,
          airDateYear,
          airDateMonth,
          airDateDay,
          episodeCount: seasonEpisodes.length,
        },
        create: {
          tvId: localTvId,
          seasonNumber: sNum,
          tvdbSeasonId: seasonMeta?.id,
          titlePrimary: seasonMeta?.name || `Season ${sNum}`,
          posterImage: seasonMeta?.image
            ? normalizeTvdbImageUrl(seasonMeta.image)
            : undefined,
          airDateYear,
          airDateMonth,
          airDateDay,
          episodeCount: seasonEpisodes.length,
        },
      })
      seasonMap.set(sNum, season.id)
    }

    // Upsert non-special episodes
    for (const ep of validEpisodes) {
      const localSeasonId = seasonMap.get(ep.seasonNumber) || null
      const episodeSources = { thetvdb: { id: ep.id } }

      await prisma.tvEpisode.upsert({
        where: {
          tvId_seasonNumber_episodeNumber: {
            tvId: localTvId,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.number,
          },
        },
        update: {
          seasonId: localSeasonId,
          titlePrimary: ep.name || `Episode ${ep.number}`,
          description: ep.overview,
          duration: ep.runtime,
          airDate: ep.aired ? new Date(ep.aired) : undefined,
          thumbnail: ep.image ? normalizeTvdbImageUrl(ep.image) : undefined,
          sources: episodeSources,
        },
        create: {
          tvId: localTvId,
          seasonId: localSeasonId,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.number,
          titlePrimary: ep.name || `Episode ${ep.number}`,
          description: ep.overview,
          duration: ep.runtime,
          airDate: ep.aired ? new Date(ep.aired) : undefined,
          thumbnail: ep.image ? normalizeTvdbImageUrl(ep.image) : undefined,
          sources: episodeSources,
        },
      })
    }

    // 2. Cast & Characters + Staff extraction -> Person, Character, MediaCharacter, MediaStaff
    const allCastAndStaff = [
      ...(characters || []),
      ...(series.characters || []),
    ]

    const seenCast = new Set<string>()
    for (const c of allCastAndStaff) {
      const key = `${c.id}_${c.peopleId}_${c.name}_${c.personName}`
      if (seenCast.has(key)) continue
      seenCast.add(key)

      const isActor =
        !c.peopleType ||
        c.peopleType.toLowerCase() === "actor" ||
        c.type === 3 ||
        (c.typeName && c.typeName.toLowerCase() === "actor")

      let localPersonId: number | null = null
      if (c.personName || c.peopleId) {
        const person = await this.upsertPerson({
          tvDBId: c.peopleId,
          namePrimary: c.personName || "Unknown Person",
          image: normalizeTvdbImageUrl(c.personImgURL),
        })
        localPersonId = person.id
      }

      let localCharId: number | null = null
      if (c.name && isActor) {
        const char = await this.upsertCharacter({
          tvDBId: c.id,
          namePrimary: c.name,
          image: normalizeTvdbImageUrl(c.image),
        })
        localCharId = char.id
      }

      if (isActor && localCharId) {
        await prisma.mediaCharacter
          .upsert({
            where: {
              mediaType_mediaId_characterId_actorId: {
                mediaType: "TV",
                mediaId: localTvId,
                characterId: localCharId,
                actorId: localPersonId ?? -1,
              },
            },
            update: {
              tvId: localTvId,
              role: c.isFeatured ? "MAIN" : "SUPPORTING",
            },
            create: {
              mediaType: "TV",
              mediaId: localTvId,
              tvId: localTvId,
              characterId: localCharId,
              actorId: localPersonId,
              role: c.isFeatured ? "MAIN" : "SUPPORTING",
            },
          })
          .catch(() => {})
      } else if (localPersonId) {
        await prisma.mediaStaff
          .upsert({
            where: {
              mediaType_mediaId_personId_role: {
                mediaType: "TV",
                mediaId: localTvId,
                personId: localPersonId,
                role: isActor ? "CAST" : "OTHER",
              },
            },
            update: { tvId: localTvId, customRole: c.peopleType || c.typeName },
            create: {
              mediaType: "TV",
              mediaId: localTvId,
              tvId: localTvId,
              personId: localPersonId,
              role: isActor ? "CAST" : "OTHER",
              customRole: c.peopleType || c.typeName,
            },
          })
          .catch(() => {})
      }
    }

    // 3. Studios & Production Companies / Networks
    const rawCompanies: Array<{ id?: number; name: string }> = []
    if (Array.isArray(series.companies)) {
      for (const comp of series.companies) {
        if (comp.name) rawCompanies.push(comp)
        if (comp.parentCompany?.name) rawCompanies.push(comp.parentCompany)
      }
    } else if (series.companies && typeof series.companies === "object") {
      const compsObj = series.companies as any
      for (const list of [
        compsObj.studio,
        compsObj.production,
        compsObj.network,
        compsObj.distributor,
      ]) {
        if (Array.isArray(list)) {
          for (const comp of list) {
            if (comp.name) rawCompanies.push(comp)
          }
        }
      }
    }
    if (series.networks) {
      for (const net of series.networks) {
        if (net.name) rawCompanies.push(net)
      }
    }
    if (simklData?.network) {
      rawCompanies.push({ name: simklData.network })
    }

    for (const comp of rawCompanies) {
      const studio = await this.upsertStudio({ name: comp.name })
      await prisma.mediaStudio
        .upsert({
          where: {
            mediaType_mediaId_studioId: {
              mediaType: "TV",
              mediaId: localTvId,
              studioId: studio.id,
            },
          },
          update: { tvId: localTvId },
          create: {
            mediaType: "TV",
            mediaId: localTvId,
            tvId: localTvId,
            studioId: studio.id,
          },
        })
        .catch(() => {})
    }

    return { id: localTvId }
  }

  /**
   * Upserts Movie with cast & character extraction using LOCAL IDs.
   */
  async upsertMovie(
    movie: TvdbMoviePayload,
    tvdbImages?: string[],
    simklData?:
      import("./providers/simkl.provider.js").SimklMoviePayload | null,
    engTranslation?: { name?: string; overview?: string } | null
  ): Promise<{ id: number }> {
    const existing = await prisma.movie.findUnique({
      where: { tvDBId: movie.id },
    })

    // Title resolution (English title is ALWAYS primary)
    const titlePrimary =
      engTranslation?.name?.trim() ||
      simklData?.title?.trim() ||
      movie.name ||
      "Unknown Movie"

    const titleSecondary =
      engTranslation?.name && engTranslation.name !== movie.name
        ? movie.name
        : simklData?.title && simklData.title !== titlePrimary
          ? simklData.title
          : undefined

    const titleNative =
      movie.originalLanguage &&
      ["kor", "jpn", "zho", "zhtw", "ko", "ja", "zh"].includes(
        movie.originalLanguage.toLowerCase()
      )
        ? movie.name
        : undefined

    // Description resolution (English overview is ALWAYS primary)
    const description =
      engTranslation?.overview?.trim() || simklData?.overview || movie.overview

    // Release Date extraction
    let releaseDateYear: number | undefined
    let releaseDateMonth: number | undefined
    let releaseDateDay: number | undefined

    const rawReleaseDate =
      movie.first_release?.date ||
      (movie.releases && movie.releases.length > 0
        ? movie.releases[0]?.date
        : undefined) ||
      movie.first_release_date ||
      simklData?.releaseDate

    if (rawReleaseDate) {
      const [y, m, d] = rawReleaseDate.split("-").map((s) => parseInt(s, 10))
      if (y) releaseDateYear = y
      if (m) releaseDateMonth = m
      if (d) releaseDateDay = d
    } else if (simklData?.year) {
      releaseDateYear = simklData.year
    }

    // Remote IDs (IMDb, TMDb, Simkl)
    let imdbId: string | undefined = simklData?.imdbId
    let tmdbId: number | undefined = simklData?.tmdbId

    if (movie.remoteIds) {
      for (const r of movie.remoteIds) {
        if (r.sourceName?.toUpperCase() === "IMDB" || r.type === 2) {
          imdbId = r.id
        } else if (
          r.sourceName?.toLowerCase().includes("themoviedb") ||
          r.type === 10
        ) {
          const parsed = parseInt(r.id, 10)
          if (!isNaN(parsed)) tmdbId = parsed
        }
      }
    }

    // Country of Origin
    const countryOfOrigin =
      movie.production_countries?.[0]?.name ||
      simklData?.country ||
      (movie.originalLanguage
        ? movie.originalLanguage.toUpperCase()
        : undefined)

    // Age Rating & Guide
    let ageRating: string | undefined = simklData?.certification
    let ageRatingGuide: string | undefined

    if (movie.contentRatings && movie.contentRatings.length > 0) {
      const usaRating =
        movie.contentRatings.find((r) => r.country?.toLowerCase() === "usa") ||
        movie.contentRatings[0]
      if (usaRating) {
        ageRating = usaRating.name || usaRating.fullname || ageRating
        ageRatingGuide = usaRating.description
      }
    }

    const movieImages: string[] = []
    if (movie.image) {
      const norm = normalizeTvdbImageUrl(movie.image)
      if (norm) movieImages.push(norm)
    }
    if (tvdbImages && tvdbImages.length > 0) {
      for (const img of tvdbImages) {
        if (!movieImages.includes(img)) movieImages.push(img)
      }
    }

    const images = {
      thetvdb: movieImages,
    }
    const sources: Record<string, unknown> = {
      thetvdb: {
        id: movie.id,
        slug: movie.slug,
        url: movie.slug
          ? `https://thetvdb.com/movies/${movie.slug}`
          : `https://thetvdb.com/dereferrer/movie/${movie.id}`,
      },
    }
    if (imdbId) {
      sources.imdb = {
        id: imdbId,
        url: `https://www.imdb.com/title/${imdbId}`,
      }
    }
    if (tmdbId) {
      sources.tmdb = {
        id: tmdbId,
        url: `https://www.themoviedb.org/movie/${tmdbId}`,
      }
    }
    if (simklData?.simklId) {
      sources.simkl = {
        id: simklData.simklId,
        slug: simklData.slug,
        url: simklData.slug
          ? `https://simkl.com/movies/${simklData.simklId}/${simklData.slug}`
          : `https://simkl.com/movies/${simklData.simklId}`,
      }
    }

    const rawGenres =
      movie.genres?.map((g) => g.name) || simklData?.genres || []
    const genreRecords = await this.upsertGenres(rawGenres)

    // Tags & Subgenres
    const rawTags: Array<{
      name: string
      category?: string
      description?: string
    }> = []
    if (Array.isArray((movie as any).tags)) {
      for (const t of (movie as any).tags) {
        if (typeof t === "string" && isNaN(Number(t)) && t.trim()) {
          rawTags.push({ name: t.trim() })
        } else if (t && typeof t === "object") {
          const name = t.name || t.tag || t.tagName
          if (typeof name === "string" && isNaN(Number(name)) && name.trim()) {
            rawTags.push({
              name: name.trim(),
              category: t.tagName || undefined,
              description: t.helpText || undefined,
            })
          }
        }
      }
    }
    if (simklData?.genres) {
      for (const g of simklData.genres) {
        if (typeof g === "string" && isNaN(Number(g)) && g.trim()) {
          rawTags.push({ name: g.trim(), category: "Genre" })
        }
      }
    }
    const tagRecords = await this.upsertTags(rawTags)

    const data: any = {
      tvDBId: movie.id,
      imdbId,
      tmdbId,
      simklId: simklData?.simklId,
      titlePrimary,
      titleSecondary,
      titleNative,
      description,
      coverImage: movie.image
        ? normalizeTvdbImageUrl(movie.image)
        : simklData?.poster,
      images,
      sources,
      runtime: movie.runtime || simklData?.runtime,
      releaseDateYear,
      releaseDateMonth,
      releaseDateDay,
      genres: existing ? { set: genreRecords } : { connect: genreRecords },
      tags: existing ? { set: tagRecords } : { connect: tagRecords },
      status: this.mapMovieStatus(movie.status?.name),
      imdbRating: simklData?.imdbRating,
      imdbVotes: simklData?.imdbVotes,
      countryOfOrigin,
      ageRating,
      ageRatingGuide,
      budget: movie.budget
        ? BigInt(movie.budget.replace(/[^0-9]/g, "") || 0)
        : undefined,
      revenue: movie.boxOffice
        ? BigInt(movie.boxOffice.replace(/[^0-9]/g, "") || 0)
        : undefined,
      trailers: movie.trailers as any,
      originalLanguage: movie.originalLanguage,
      tvdbUpdatedAt: Math.floor(Date.now() / 1000),
      imdbUpdatedAt: simklData?.imdbRating
        ? Math.floor(Date.now() / 1000)
        : undefined,
    }

    let localMovie: { id: number }
    if (existing) {
      localMovie = await prisma.movie.update({
        where: { id: existing.id },
        data,
      })
    } else {
      localMovie = await prisma.movie.create({ data })
    }

    const localMovieId = localMovie.id

    // Characters & Cast
    if (movie.characters) {
      for (const c of movie.characters) {
        let localPersonId: number | null = null
        if (c.personName || c.peopleId) {
          const person = await this.upsertPerson({
            tvDBId: c.peopleId,
            namePrimary: c.personName || "Unknown Actor",
            image: normalizeTvdbImageUrl(c.personImgURL),
          })
          localPersonId = person.id
        }

        let localCharId: number | null = null
        if (c.name) {
          const char = await this.upsertCharacter({
            tvDBId: c.id,
            namePrimary: c.name,
            image: normalizeTvdbImageUrl(c.image),
          })
          localCharId = char.id
        }

        if (localCharId) {
          await prisma.mediaCharacter
            .upsert({
              where: {
                mediaType_mediaId_characterId_actorId: {
                  mediaType: "MOVIE",
                  mediaId: localMovieId,
                  characterId: localCharId,
                  actorId: localPersonId ?? -1,
                },
              },
              update: {
                movieId: localMovieId,
                role: c.isFeatured ? "MAIN" : "SUPPORTING",
              },
              create: {
                mediaType: "MOVIE",
                mediaId: localMovieId,
                movieId: localMovieId,
                characterId: localCharId,
                actorId: localPersonId,
                role: c.isFeatured ? "MAIN" : "SUPPORTING",
              },
            })
            .catch(() => {})
        } else if (localPersonId) {
          await prisma.mediaStaff
            .upsert({
              where: {
                mediaType_mediaId_personId_role: {
                  mediaType: "MOVIE",
                  mediaId: localMovieId,
                  personId: localPersonId,
                  role: "CAST",
                },
              },
              update: {
                movieId: localMovieId,
                customRole: c.typeName || c.peopleType,
              },
              create: {
                mediaType: "MOVIE",
                mediaId: localMovieId,
                movieId: localMovieId,
                personId: localPersonId,
                role: "CAST",
                customRole: c.typeName || c.peopleType,
              },
            })
            .catch(() => {})
        }
      }
    }

    // Studios / Production companies
    if (movie.companies?.studio || movie.companies?.production) {
      const companies = [
        ...(movie.companies.studio || []),
        ...(movie.companies.production || []),
      ]
      for (const comp of companies) {
        const studio = await this.upsertStudio({ name: comp.name })
        await prisma.mediaStudio
          .upsert({
            where: {
              mediaType_mediaId_studioId: {
                mediaType: "MOVIE",
                mediaId: localMovieId,
                studioId: studio.id,
              },
            },
            update: { movieId: localMovieId },
            create: {
              mediaType: "MOVIE",
              mediaId: localMovieId,
              movieId: localMovieId,
              studioId: studio.id,
            },
          })
          .catch(() => {})
      }
    }

    return { id: localMovieId }
  }

  /**
   * Upserts Book with authors -> Person and publishers -> Studio using LOCAL IDs.
   */
  async upsertBook(book: GoogleBookPayload): Promise<{ id: number }> {
    const info = book.volumeInfo
    const isbn10 = info.industryIdentifiers?.find(
      (i) => i.type === "ISBN_10"
    )?.identifier
    const isbn13 = info.industryIdentifiers?.find(
      (i) => i.type === "ISBN_13"
    )?.identifier

    const existing =
      (await prisma.book.findUnique({ where: { googleBookId: book.id } })) ||
      (isbn13 ? await prisma.book.findFirst({ where: { isbn13 } }) : null) ||
      (isbn10 ? await prisma.book.findFirst({ where: { isbn10 } }) : null)

    const normalizeGoogleBooksUrl = (url?: string) => {
      if (!url) return undefined
      return url.replace(/^http:\/\//i, "https://")
    }

    const coverImage = normalizeGoogleBooksUrl(
      info.imageLinks?.extraLarge ||
        info.imageLinks?.large ||
        info.imageLinks?.medium ||
        info.imageLinks?.small ||
        info.imageLinks?.thumbnail
    )

    const images = {
      googleBooks: [
        info.imageLinks?.extraLarge,
        info.imageLinks?.large,
        info.imageLinks?.medium,
        info.imageLinks?.small,
        info.imageLinks?.thumbnail,
      ]
        .filter(Boolean)
        .map((u) => normalizeGoogleBooksUrl(u as string)!),
    }

    // Clean description
    const description = info.description
      ? info.description
          .replace(/<[^>]*>?/gm, " ")
          .replace(/\s+/g, " ")
          .trim()
      : undefined

    // Date parsing
    let releaseDateYear: number | undefined
    let releaseDateMonth: number | undefined
    let releaseDateDay: number | undefined
    let releaseDate: Date | undefined

    if (info.publishedDate) {
      const parts = info.publishedDate.split("-").map(Number)
      if (parts[0] && !isNaN(parts[0])) releaseDateYear = parts[0]
      if (parts[1] && !isNaN(parts[1])) releaseDateMonth = parts[1]
      if (parts[2] && !isNaN(parts[2])) releaseDateDay = parts[2]
      const parsedD = new Date(info.publishedDate)
      if (!isNaN(parsedD.getTime())) releaseDate = parsedD
    }

    // Split categories into Genres and Tags
    const rawGenres: string[] = []
    const rawTags: Array<{ name: string; category?: string }> = []

    if (info.categories) {
      for (const cat of info.categories) {
        const segments = cat
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean)
        if (segments.length > 0) {
          if (!rawGenres.includes(segments[0]!)) {
            rawGenres.push(segments[0]!)
          }
          for (let i = 1; i < segments.length; i++) {
            rawTags.push({ name: segments[i]!, category: "Subject" })
          }
        }
      }
    }

    const bookGenreRecords = await this.upsertGenres(rawGenres)
    const tagRecords = await this.upsertTags(rawTags)

    const isAdult = info.maturityRating === "MATURE"
    const ageRating = isAdult ? "Mature" : "General"

    const sources: Record<string, unknown> = {
      googleBooks: {
        id: book.id,
        previewLink: info.previewLink,
        infoLink: info.infoLink,
        canonicalVolumeLink: info.canonicalVolumeLink,
        buyLink: book.saleInfo?.buyLink,
      },
    }
    if (isbn13) {
      sources.openLibrary = {
        isbn: isbn13,
        url: `https://openlibrary.org/isbn/${isbn13}`,
      }
    }

    const data: any = {
      googleBookId: book.id,
      isbn10,
      isbn13,
      titlePrimary: info.title || "Unknown Book",
      subtitle: info.subtitle,
      description,
      coverImage,
      bannerImage: coverImage,
      images,
      sources,
      pageCount: info.pageCount,
      genres: existing
        ? { set: bookGenreRecords }
        : { connect: bookGenreRecords },
      tags: existing ? { set: tagRecords } : { connect: tagRecords },
      authors: info.authors || [],
      publishers: info.publisher ? [info.publisher] : [],
      originalLanguage: info.language,
      previewLink: info.previewLink,
      infoLink: info.infoLink,
      buyLink: book.saleInfo?.buyLink,
      isAdult,
      ageRating,
      googleBooksRating: info.averageRating,
      googleBooksRatingsCount: info.ratingsCount,
      releaseDate,
      releaseDateYear,
      releaseDateMonth,
      releaseDateDay,
      retailPrice: book.saleInfo?.retailPrice?.amount,
      retailPriceCurrency: book.saleInfo?.retailPrice?.currencyCode,
      googleBooksUpdatedAt: Math.floor(Date.now() / 1000),
    }

    let localBook: { id: number }
    if (existing) {
      localBook = await prisma.book.update({ where: { id: existing.id }, data })
    } else {
      localBook = await prisma.book.create({ data })
    }

    const localBookId = localBook.id

    // Authors -> Person & MediaStaff
    if (info.authors) {
      for (const authorName of info.authors) {
        const person = await this.upsertPerson({ namePrimary: authorName })
        await prisma.mediaStaff
          .upsert({
            where: {
              mediaType_mediaId_personId_role: {
                mediaType: "BOOK",
                mediaId: localBookId,
                personId: person.id,
                role: "AUTHOR",
              },
            },
            update: { bookId: localBookId },
            create: {
              mediaType: "BOOK",
              mediaId: localBookId,
              bookId: localBookId,
              personId: person.id,
              role: "AUTHOR",
            },
          })
          .catch(() => {})
      }
    }

    // Publisher -> Studio & MediaStudio
    if (info.publisher) {
      const studio = await this.upsertStudio({ name: info.publisher })
      await prisma.mediaStudio
        .upsert({
          where: {
            mediaType_mediaId_studioId: {
              mediaType: "BOOK",
              mediaId: localBookId,
              studioId: studio.id,
            },
          },
          update: { bookId: localBookId, isMain: true },
          create: {
            mediaType: "BOOK",
            mediaId: localBookId,
            bookId: localBookId,
            studioId: studio.id,
            isMain: true,
          },
        })
        .catch(() => {})
    }

    return { id: localBookId }
  }

  /**
   * Helper to parse enum GameStatus from IGDB status code.
   */
  private mapGameStatus(status?: number): any {
    switch (status) {
      case 0:
        return "RELEASED"
      case 2:
      case 3:
        return "IN_DEVELOPMENT"
      case 4:
        return "EARLY_ACCESS"
      case 6:
        return "CANCELLED"
      case 7:
        return "ANNOUNCED"
      default:
        return "RELEASED"
    }
  }

  /**
   * Helper to parse Age Ratings from IGDB.
   */
  private mapIgdbAgeRatings(ageRatings?: IgdbGamePayload["age_ratings"]): {
    esrbRating?: string
    pegiRating?: string
    ageRating?: string
    ageRatingGuide?: string
  } {
    if (!ageRatings || ageRatings.length === 0) return {}

    const esrbMap: Record<number, string> = {
      1: "EC",
      2: "E",
      3: "E10+",
      4: "T",
      5: "M",
      6: "M",
      7: "AO",
      8: "RP",
      9: "E10+",
      10: "T",
      11: "M",
      12: "AO",
    }

    const pegiMap: Record<number, string> = {
      1: "3",
      2: "7",
      3: "12",
      4: "16",
      5: "18",
      8: "3",
      9: "7",
      10: "12",
      11: "16",
      12: "18",
    }

    let esrbRating: string | undefined
    let pegiRating: string | undefined
    let ageRatingGuide: string | undefined

    for (const ar of ageRatings) {
      const org = ar.organization ?? ar.category
      const cat = ar.rating_category ?? ar.rating

      if (org === 1 && cat) {
        esrbRating = esrbMap[cat] || "M"
        if (
          ar.rating_content_descriptions &&
          ar.rating_content_descriptions.length > 0
        ) {
          ageRatingGuide = ar.rating_content_descriptions
            .map((d) => d.description)
            .join(", ")
        } else if (ar.synopsis) {
          ageRatingGuide = ar.synopsis
        }
      } else if (org === 2 && cat) {
        pegiRating = pegiMap[cat] || (cat === 12 ? "18" : String(cat))
      }
    }

    return {
      esrbRating,
      pegiRating,
      ageRating: esrbRating || (pegiRating ? `PEGI ${pegiRating}` : undefined),
      ageRatingGuide,
    }
  }

  /**
   * Upserts Game with studios/developers, genres, tags, platforms, rich IGDB metadata, and Steam details.
   */
  async upsertGame(
    game: IgdbGamePayload,
    steamData?: SteamAppDetailsPayload | null,
    deckData?: SteamDeckCompatibilityReport | null
  ): Promise<{ id: number }> {
    const existing = await prisma.game.findUnique({
      where: { igdbId: game.id },
    })

    // Release date parts
    let releaseDateYear: number | undefined
    let releaseDateMonth: number | undefined
    let releaseDateDay: number | undefined
    let releaseDate: Date | undefined

    if (game.first_release_date) {
      releaseDate = new Date(game.first_release_date * 1000)
      releaseDateYear = releaseDate.getUTCFullYear()
      releaseDateMonth = releaseDate.getUTCMonth() + 1
      releaseDateDay = releaseDate.getUTCDate()
    }

    // Cover and Artworks / Screenshots
    const coverImage = game.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.cover.image_id}.jpg`
      : undefined

    const bannerImage = game.artworks?.[0]?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.artworks[0].image_id}.jpg`
      : game.screenshots?.[0]?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.screenshots[0].image_id}.jpg`
        : undefined

    const screenshots = game.screenshots?.map(
      (s) =>
        `https://images.igdb.com/igdb/image/upload/t_1080p/${s.image_id}.jpg`
    )

    const artworks = game.artworks?.map(
      (a) =>
        `https://images.igdb.com/igdb/image/upload/t_1080p/${a.image_id}.jpg`
    )

    const images = {
      igdb: [coverImage, ...(artworks || []), ...(screenshots || [])].filter(
        Boolean
      ) as string[],
    }

    // External IDs (Steam App ID, GOG, Epic, etc.)
    let steamAppId: number | undefined
    if (game.external_games) {
      const steamExt = game.external_games.find((e) => e.category === 1)
      if (steamExt?.uid) {
        const parsed = parseInt(steamExt.uid, 10)
        if (!isNaN(parsed)) steamAppId = parsed
      }
    }
    if (!steamAppId && game.websites) {
      const steamWeb = game.websites.find((w) =>
        w.url.includes("store.steampowered.com/app/")
      )
      if (steamWeb) {
        const match = steamWeb.url.match(/app\/(\d+)/)
        if (match?.[1]) {
          const parsed = parseInt(match[1], 10)
          if (!isNaN(parsed)) steamAppId = parsed
        }
      }
    }

    // Sources
    const sources: Record<string, unknown> = {
      igdb: {
        id: game.id,
        slug: game.slug,
        url: `https://www.igdb.com/games/${game.slug || game.id}`,
      },
    }
    if (steamAppId) {
      sources.steam = {
        id: steamAppId,
        url: `https://store.steampowered.com/app/${steamAppId}`,
      }
    }
    if (game.websites) {
      for (const w of game.websites) {
        if (w.category === 1) sources.website = { url: w.url }
        else if (w.category === 17) sources.gog = { url: w.url }
        else if (w.category === 16) sources.epic = { url: w.url }
        else if (w.category === 18) sources.discord = { url: w.url }
      }
    }

    // Secondary & Native Titles
    let titleSecondary: string | undefined
    let titleNative: string | undefined

    if (game.alternative_names && game.alternative_names.length > 0) {
      for (const alt of game.alternative_names) {
        if (
          alt.comment &&
          (alt.comment.toLowerCase().includes("japanese") ||
            alt.comment.toLowerCase().includes("korean") ||
            alt.comment.toLowerCase().includes("chinese"))
        ) {
          titleNative = alt.name
        } else if (!titleSecondary && alt.name !== game.name) {
          titleSecondary = alt.name
        }
      }
    }

    // Genres & Tags
    const rawGameGenres = game.genres?.map((g) => g.name) || []
    const gameGenreRecords = await this.upsertGenres(rawGameGenres)

    const rawTags: Array<{ name: string; category?: string }> = []
    if (game.themes) {
      for (const t of game.themes) {
        if (t.name) rawTags.push({ name: t.name, category: "Theme" })
      }
    }
    if (game.keywords) {
      for (const k of game.keywords) {
        if (k.name) rawTags.push({ name: k.name, category: "Keyword" })
      }
    }
    if (game.game_modes) {
      for (const m of game.game_modes) {
        if (m.name) rawTags.push({ name: m.name, category: "Game Mode" })
      }
    }
    if (game.player_perspectives) {
      for (const p of game.player_perspectives) {
        if (p.name)
          rawTags.push({ name: p.name, category: "Player Perspective" })
      }
    }
    const tagRecords = await this.upsertTags(rawTags)

    // Companies / Studios
    const developers: string[] = []
    const publishers: string[] = []
    if (game.involved_companies) {
      for (const comp of game.involved_companies) {
        if (
          comp.developer &&
          comp.company?.name &&
          !developers.includes(comp.company.name)
        ) {
          developers.push(comp.company.name)
        }
        if (
          comp.publisher &&
          comp.company?.name &&
          !publishers.includes(comp.company.name)
        ) {
          publishers.push(comp.company.name)
        }
      }
    }

    // Age ratings
    const { esrbRating, pegiRating, ageRating, ageRatingGuide } =
      this.mapIgdbAgeRatings(game.age_ratings)

    // Franchise
    const franchise =
      game.franchise?.name ||
      game.franchises?.[0]?.name ||
      game.collection?.name

    // Languages
    const languages = Array.from(
      new Set(
        game.language_supports
          ?.map((l) => l.language?.name)
          .filter((n): n is string => Boolean(n)) || []
      )
    )

    // Trailers
    const trailers = game.videos?.map((v) => ({
      id: v.id,
      name: v.name || "Trailer",
      url: `https://www.youtube.com/watch?v=${v.video_id}`,
    }))

    // Steam Requirements
    let requirements: Record<string, unknown> | undefined
    if (steamData) {
      const cleanHtml = (str?: string) =>
        str
          ? str
              .replace(/<[^>]*>?/gm, " ")
              .replace(/\s+/g, " ")
              .trim()
          : undefined
      requirements = {
        pc:
          steamData.pc_requirements && !Array.isArray(steamData.pc_requirements)
            ? {
                minimum: cleanHtml(steamData.pc_requirements.minimum),
                recommended: cleanHtml(steamData.pc_requirements.recommended),
              }
            : undefined,
        mac:
          steamData.mac_requirements &&
          !Array.isArray(steamData.mac_requirements)
            ? {
                minimum: cleanHtml(steamData.mac_requirements.minimum),
                recommended: cleanHtml(steamData.mac_requirements.recommended),
              }
            : undefined,
        linux:
          steamData.linux_requirements &&
          !Array.isArray(steamData.linux_requirements)
            ? {
                minimum: cleanHtml(steamData.linux_requirements.minimum),
                recommended: cleanHtml(
                  steamData.linux_requirements.recommended
                ),
              }
            : undefined,
      }
    }

    // Steam Achievements
    let achievements: Record<string, unknown> | undefined
    if (steamData?.achievements) {
      achievements = {
        total: steamData.achievements.total || 0,
        highlighted: steamData.achievements.highlighted || [],
      }
    }

    // Controller Support
    let controllerSupport: string | undefined
    if (steamData?.controller_support) {
      controllerSupport =
        steamData.controller_support.toLowerCase() === "full"
          ? "Full"
          : steamData.controller_support.toLowerCase() === "partial"
            ? "Partial"
            : steamData.controller_support
    } else if (steamData?.categories) {
      if (steamData.categories.some((c) => c.id === 28))
        controllerSupport = "Full"
      else if (steamData.categories.some((c) => c.id === 18))
        controllerSupport = "Partial"
    }

    // Linux & Steam Deck / Proton Compatibility
    let steamDeckStatus: string | undefined
    let linuxSupport: boolean | undefined
    if (deckData) {
      const statusMap: Record<number, string> = {
        1: "UNSUPPORTED",
        2: "PLAYABLE",
        3: "VERIFIED",
      }
      steamDeckStatus = statusMap[deckData.resolved_category] || "UNKNOWN"
      linuxSupport =
        deckData.resolved_category === 3 ||
        deckData.resolved_category === 2 ||
        Boolean(steamData?.platforms?.linux)
    } else if (steamData?.platforms?.linux) {
      linuxSupport = true
    }

    const data: any = {
      igdbId: game.id,
      steamAppId,
      titlePrimary: game.name || "Unknown Game",
      titleSecondary,
      titleNative,
      slug: game.slug,
      description: game.summary || game.storyline,
      coverImage,
      bannerImage,
      backgroundImage: bannerImage,
      images,
      sources,
      releaseDate,
      releaseDateYear,
      releaseDateMonth,
      releaseDateDay,
      genres: existing
        ? { set: gameGenreRecords }
        : { connect: gameGenreRecords },
      tags: existing ? { set: tagRecords } : { connect: tagRecords },
      platforms: game.platforms?.map((p) => p.name) || [],
      developers,
      publishers,
      franchise,
      gameModes: game.game_modes?.map((m) => m.name) || [],
      playerPerspectives: game.player_perspectives?.map((p) => p.name) || [],
      status: this.mapGameStatus(game.status),
      trailers: trailers as any,
      languages,
      requirements: requirements as any,
      achievements: achievements as any,
      controllerSupport,
      linuxSupport,
      steamDeckStatus,
      steamDeck: deckData as any,
      esrbRating,
      pegiRating,
      ageRating,
      ageRatingGuide,
      contentRatings: game.age_ratings as any,
      igdbRating: game.rating,
      igdbRatingCount: game.rating_count,
      igdbUpdatedAt: game.updated_at || Math.floor(Date.now() / 1000),
      steamUpdatedAt: steamData ? Math.floor(Date.now() / 1000) : undefined,
    }

    let localGame: { id: number }
    if (existing) {
      localGame = await prisma.game.update({ where: { id: existing.id }, data })
    } else {
      localGame = await prisma.game.create({ data })
    }

    const localGameId = localGame.id

    // Involved companies -> Studio & MediaStudio
    if (game.involved_companies) {
      for (const comp of game.involved_companies) {
        if (!comp.company?.name) continue
        const studio = await this.upsertStudio({ name: comp.company.name })
        await prisma.mediaStudio
          .upsert({
            where: {
              mediaType_mediaId_studioId: {
                mediaType: "GAME",
                mediaId: localGameId,
                studioId: studio.id,
              },
            },
            update: { gameId: localGameId, isMain: comp.developer },
            create: {
              mediaType: "GAME",
              mediaId: localGameId,
              gameId: localGameId,
              studioId: studio.id,
              isMain: comp.developer,
            },
          })
          .catch(() => {})
      }
    }

    return { id: localGameId }
  }

  /**
   * Upserts a MusicAlbum record along with its tracks, artist credits via MediaStaff, tags, and genres.
   */
  /**
   * Upserts a unified Music record (ALBUM or TRACK) with Deezer metadata, lyrics, artist credits, tags, and genres.
   */
  async upsertMusic(
    musicData: any,
    lyrics?: LrcLibLyricsPayload | null
  ): Promise<{ id: number; trackIds?: number[] }> {
    // If called with legacy MusicBrainz payload
    if (musicData?.["artist-credit"] || musicData?.releases) {
      const mb = musicData as MusicBrainzRecordingPayload
      const artists = mb["artist-credit"]?.map((a) => a.name) || []
      const artistName = artists.join(", ") || "Unknown Artist"
      const release = mb.releases?.[0]
      const albumName = release?.title
      const durationSeconds = mb.length ? Math.round(mb.length / 1000) : undefined
      const rawGenres = mb.genres?.map((g) => g.name) || []
      const rawTags: Array<{ name: string; category?: string }> = []
      if (mb.tags) {
        for (const t of mb.tags) {
          if (t.name) rawTags.push({ name: t.name, category: "Music Tag" })
        }
      }
      return await this.upsertMusic(
        {
          type: "TRACK",
          titlePrimary: mb.title || "Unknown Track",
          artistName,
          albumTitle: albumName,
          duration: durationSeconds,
          isrc: mb.isrcs?.[0],
          coverImage: mb.coverImageUrl,
          genres: rawGenres,
          tags: rawTags,
          sources: {
            musicBrainz: {
              id: mb.id,
              url: `https://musicbrainz.org/recording/${mb.id}`,
            },
          },
        },
        lyrics
      )
    }

    const musicType = musicData.type || (musicData.totalTracks || musicData.tracks ? "ALBUM" : "TRACK")
    const deezerIdStr = musicData.deezerId ? String(musicData.deezerId) : (musicData.musicBrainzId ? String(musicData.musicBrainzId) : null)

    // 1. Find existing record
    let existing: any = null
    if (musicData.id) {
      existing = await prisma.music.findUnique({
        where: { id: musicData.id },
      })
    }
    if (!existing && deezerIdStr) {
      existing = await prisma.music.findUnique({
        where: { deezerId: deezerIdStr },
      })
    }
    const artistObj = musicData.artist as
      | {
          id?: number | string
          name?: string
          namePrimary?: string
          deezerId?: string
          image?: string
          picture?: string
          picture_small?: string
          picture_medium?: string
          picture_big?: string
          picture_xl?: string
          nb_album?: number
          nb_fan?: number
          radio?: boolean
        }
      | undefined
    const artistObjName = artistObj?.namePrimary || artistObj?.name

    if (!existing && musicData.titlePrimary && (musicData.artistName || artistObjName)) {
      const artName = musicData.artistName || artistObjName || ""
      existing = await prisma.music.findFirst({
        where: {
          titlePrimary: { equals: musicData.titlePrimary.trim(), mode: "insensitive" },
          artistName: { equals: artName.trim(), mode: "insensitive" },
          type: musicType,
        },
      })
    }

    // 2. Resolve artist into Person table
    let resolvedArtistId = musicData.artistId || null
    let resolvedArtistName = musicData.artistName || null
    let resolvedDeezerArtistId = musicData.deezerArtistId ? String(musicData.deezerArtistId) : null

    if (artistObj) {
      const isDeezerPayload = typeof artistObj.id === "number"
      const person = isDeezerPayload
        ? await this.upsertDeezerArtist(artistObj as DeezerArtistPayload)
        : await this.upsertArtist({
            namePrimary: artistObj.namePrimary || artistObj.name || "Unknown Artist",
            deezerId: artistObj.deezerId,
            image: artistObj.image,
          })
      resolvedArtistId = person.id
      resolvedArtistName = person.namePrimary
      if (isDeezerPayload) {
        resolvedDeezerArtistId = String(artistObj.id)
      }
    } else if (resolvedArtistName && !resolvedArtistId) {
      const person = await this.upsertArtist({ namePrimary: resolvedArtistName.trim() })
      resolvedArtistId = person.id
      resolvedArtistName = person.namePrimary
    }

    // 3. Resolve parent album if albumTitle provided but no albumId
    let resolvedAlbumId = musicData.albumId || null
    if (!resolvedAlbumId && musicData.albumTitle && resolvedArtistName) {
      const foundAlbum = await prisma.music.findFirst({
        where: {
          titlePrimary: { equals: musicData.albumTitle.trim(), mode: "insensitive" },
          artistName: { equals: resolvedArtistName.trim(), mode: "insensitive" },
          type: "ALBUM",
        },
        select: { id: true },
      })
      if (foundAlbum) {
        resolvedAlbumId = foundAlbum.id
      }
    }

    // 4. Genres & Tags
    const genreRecords = await this.upsertGenres(musicData.genres)
    const tagRecords = await this.upsertTags(musicData.tags)

    // 5. Lyrics handling (Deezer or LRCLIB fallback)
    let fullPlainLyrics = musicData.lyrics
    let syncedLyrics = musicData.syncedLyrics
    let lyricsSource = musicData.lyricsSource

    if (!fullPlainLyrics && lyrics) {
      fullPlainLyrics =
        lyrics.plainLyrics ||
        (lyrics.syncedLyrics ? lyrics.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, "").trim() : undefined)
      syncedLyrics = lyrics.syncedLyrics || undefined
      lyricsSource = "lrclib"
    }

    const sources: Record<string, unknown> = {
      ...(musicData.sources || {}),
    }
    if (lyrics?.id) {
      sources.lrclib = {
        id: lyrics.id,
        trackName: lyrics.trackName,
        artistName: lyrics.artistName,
      }
    }
    if (deezerIdStr) {
      sources.deezer = {
        id: deezerIdStr,
        link: musicData.link,
      }
    }

    const data: any = {
      type: musicType,
      deezerId: deezerIdStr || undefined,
      isrc: musicData.isrc,
      upc: musicData.upc,
      titlePrimary: musicData.titlePrimary.trim() || "Unknown Title",
      titleSecondary: musicData.titleSecondary,
      titleVersion: musicData.titleVersion,
      titleNative: musicData.titleNative,
      link: musicData.link,
      share: musicData.share,
      coverImage: musicData.coverImage,
      images: musicData.images,
      md5Image: musicData.md5Image,
      duration: musicData.duration,
      trackPosition: musicData.trackPosition,
      diskNumber: musicData.diskNumber || 1,
      rank: musicData.rank,
      releaseDate: musicData.releaseDate,
      releaseDateYear: musicData.releaseDateYear,
      releaseDateMonth: musicData.releaseDateMonth,
      releaseDateDay: musicData.releaseDateDay,
      explicitLyrics: musicData.explicitLyrics ?? false,
      explicitContentLyrics: musicData.explicitContentLyrics ?? 0,
      explicitContentCover: musicData.explicitContentCover ?? 0,
      audioPreviewUrl: musicData.audioPreviewUrl,
      bpm: musicData.bpm,
      gain: musicData.gain,
      availableCountries: musicData.availableCountries || [],
      recordType: musicData.recordType || musicData.albumType,
      label: musicData.label,
      nbTracks: musicData.nbTracks || (musicData.tracks ? musicData.tracks.length : undefined),
      fans: musicData.fans ?? 0,
      lyrics: fullPlainLyrics,
      syncedLyrics,
      lyricsSource,
      description: musicData.description,
      status: musicData.status || "RELEASED",
      sources,
      deezerUpdatedAt: Math.floor(Date.now() / 1000),
      albumId: resolvedAlbumId,
      artistId: resolvedArtistId,
      artistName: resolvedArtistName,
      deezerArtistId: resolvedDeezerArtistId,
      genres: existing ? { set: genreRecords } : { connect: genreRecords },
      tags: existing ? { set: tagRecords } : { connect: tagRecords },
    }

    let music: { id: number }
    if (existing) {
      music = await prisma.music.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      })
    } else if (deezerIdStr) {
      music = await prisma.music.upsert({
        where: { deezerId: deezerIdStr },
        update: data,
        create: data,
        select: { id: true },
      })
    } else {
      music = await prisma.music.create({
        data,
        select: { id: true },
      })
    }

    // 6. MediaStaff entry for Artist
    if (resolvedArtistId) {
      await prisma.mediaStaff
        .upsert({
          where: {
            mediaType_mediaId_personId_role: {
              mediaType: "MUSIC",
              mediaId: music.id,
              personId: resolvedArtistId,
              role: "ARTIST",
            },
          },
          update: {
            musicId: music.id,
          },
          create: {
            mediaType: "MUSIC",
            mediaId: music.id,
            musicId: music.id,
            personId: resolvedArtistId,
            role: "ARTIST",
          },
        })
        .catch(() => {})
    }

    // 7. Child tracks if saving an Album with tracklist
    const trackIds: number[] = []
    if (musicType === "ALBUM" && musicData.tracks && musicData.tracks.length > 0) {
      for (const t of musicData.tracks) {
        const trackDeezerId = t.id ? String(t.id) : (t.deezerId ? String(t.deezerId) : (t.musicBrainzId ? String(t.musicBrainzId) : undefined))
        const trackTitle = t.title || t.titlePrimary
        if (!trackTitle?.trim()) continue

        let existingTrack: { id: number } | null = null
        if (trackDeezerId) {
          existingTrack = await prisma.music.findUnique({
            where: { deezerId: trackDeezerId },
            select: { id: true },
          })
        }
        if (!existingTrack && (t.track_position != null || t.trackNumber != null)) {
          existingTrack = await prisma.music.findFirst({
            where: {
              albumId: music.id,
              trackPosition: t.track_position ?? t.trackNumber,
              type: "TRACK",
            },
            select: { id: true },
          })
        }

        const childArtistName = t.artist?.name || t.artistName || resolvedArtistName
        let childArtistId = resolvedArtistId
        if (t.artist && typeof t.artist === "object" && t.artist.id) {
          const person = await this.upsertDeezerArtist(t.artist).catch(() => null)
          if (person) childArtistId = person.id
        }

        const trackData = {
          type: "TRACK" as const,
          deezerId: trackDeezerId,
          isrc: t.isrc,
          titlePrimary: trackTitle.trim(),
          titleSecondary: t.title_short || t.titleSecondary,
          titleVersion: t.title_version || t.titleVersion,
          duration: t.duration,
          trackPosition: t.track_position ?? t.trackNumber ?? t.trackPosition,
          diskNumber: t.disk_number ?? t.discNumber ?? t.diskNumber ?? 1,
          rank: t.rank,
          link: t.link,
          share: t.share,
          coverImage: musicData.coverImage,
          audioPreviewUrl: t.preview || t.audioPreviewUrl,
          bpm: t.bpm,
          gain: t.gain,
          explicitLyrics: t.explicit_lyrics ?? false,
          albumId: music.id,
          artistId: childArtistId,
          artistName: childArtistName,
          deezerArtistId: resolvedDeezerArtistId,
          status: "RELEASED" as const,
          deezerUpdatedAt: Math.floor(Date.now() / 1000),
        }

        let savedChildTrack: { id: number }
        if (trackDeezerId) {
          savedChildTrack = await prisma.music.upsert({
            where: { deezerId: trackDeezerId },
            update: trackData,
            create: trackData,
            select: { id: true },
          })
        } else if (existingTrack) {
          savedChildTrack = await prisma.music.update({
            where: { id: existingTrack.id },
            data: trackData,
            select: { id: true },
          })
        } else {
          savedChildTrack = await prisma.music.create({
            data: trackData,
            select: { id: true },
          })
        }
        trackIds.push(savedChildTrack.id)

        if (childArtistId) {
          await prisma.mediaStaff
            .upsert({
              where: {
                mediaType_mediaId_personId_role: {
                  mediaType: "MUSIC",
                  mediaId: savedChildTrack.id,
                  personId: childArtistId,
                  role: "ARTIST",
                },
              },
              update: { musicId: savedChildTrack.id },
              create: {
                mediaType: "MUSIC",
                mediaId: savedChildTrack.id,
                musicId: savedChildTrack.id,
                personId: childArtistId,
                role: "ARTIST",
              },
            })
            .catch(() => {})
        }
      }
    }

    return { id: music.id, trackIds }
  }

  /**
   * Compatibility wrapper for albums: maps to upsertMusic with type = ALBUM.
   */
  async upsertMusicAlbum(albumData: any): Promise<{ id: number; trackIds: number[] }> {
    const res = await this.upsertMusic({ ...albumData, type: "ALBUM" })
    return { id: res.id, trackIds: res.trackIds || [] }
  }

  /**
   * Compatibility wrapper for tracks: maps to upsertMusic with type = TRACK.
   */
  async upsertMusicTrack(
    trackData: any,
    lyrics?: LrcLibLyricsPayload | null
  ): Promise<{ id: number }> {
    const res = await this.upsertMusic({ ...trackData, type: "TRACK" }, lyrics)
    return { id: res.id }
  }
}

export const mediaDbSyncer = new MediaDbSyncer()
