import {
  prisma,
  and,
  toDate,
  normalizeListStatus,
  normalizeMediaStatus,
  type AnimeFormat,
  type ListStatus,
  type MediaStatus,
} from '@Iris/db'
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionCredentials,
} from '@IRIS/connections'
import {
  SERVARR_QUALITY_PROFILES,
  SERVARR_SYSTEM_STATUS,
} from '../../api/models/servarr/servarr.model'

export type ServarrApp = 'radarr' | 'sonarr'

export interface ServarrConnectionContext {
  connected: boolean
  provider: 'RADARR' | 'SONARR'
  adapter?: any
  credentials?: ConnectionCredentials
  hostUrl?: string
  error?: string
}

export interface SonarrAnimeConfig {
  enabled: boolean
  monitored: boolean
  listStatuses: ListStatus[]
  animeStatuses: MediaStatus[]
  animeFormats: AnimeFormat[]
}

export interface SonarrTvConfig {
  enabled: boolean
  monitored: boolean
  listStatuses: ListStatus[]
  tvStatuses: MediaStatus[]
}

export interface RadarrMovieConfig {
  enabled: boolean
  monitored: boolean
  listStatuses: ListStatus[]
  movieStatuses: MediaStatus[]
}

export interface RadarrAnimeConfig {
  enabled: boolean
  monitored: boolean
  listStatuses: ListStatus[]
  animeStatuses: MediaStatus[]
  animeMovieFormats: AnimeFormat[]
}

/** Normalises a stored status array (tolerates pre-unification values), falling back when empty. */
function listStatusesOr(raw: unknown, fallback: ListStatus[]): ListStatus[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return [...new Set(raw.map((s) => normalizeListStatus(s)))]
}

function mediaStatusesOr(raw: unknown, fallback: MediaStatus[]): MediaStatus[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  return [...new Set(raw.map((s) => normalizeMediaStatus(s)))]
}

export function getSourceExternalId(
  sources: unknown,
  providerName: string
): string | undefined {
  if (!Array.isArray(sources)) return undefined
  const match = sources.find(
    (s: any) =>
      typeof s?.provider === 'string' &&
      s.provider.toUpperCase() === providerName.toUpperCase()
  )
  return match?.externalId ? String(match.externalId) : undefined
}

export function resolveAnimeTvdbId(anime: {
  tvDBId?: number | null
  sources?: unknown
}): number | undefined {
  if (anime.tvDBId && anime.tvDBId > 0) return anime.tvDBId
  const rawId =
    getSourceExternalId(anime.sources, 'TVDB') ??
    getSourceExternalId(anime.sources, 'THETVDB')
  if (rawId) {
    const parsed = parseInt(rawId, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return undefined
}

export function resolveAnimeImdbId(anime: {
  sources?: unknown
}): string | undefined {
  return getSourceExternalId(anime.sources, 'IMDB')
}

export function resolveAnimeTmdbId(anime: {
  sources?: unknown
}): number | undefined {
  const rawId = getSourceExternalId(anime.sources, 'TMDB')
  if (rawId) {
    const parsed = parseInt(rawId, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return undefined
}

export function resolveTvTvdbId(tv: {
  tvDBId?: number | null
  sources?: unknown
}): number | undefined {
  if (tv.tvDBId && tv.tvDBId > 0) return tv.tvDBId
  const rawId =
    getSourceExternalId(tv.sources, 'TVDB') ??
    getSourceExternalId(tv.sources, 'THETVDB')
  if (rawId) {
    const parsed = parseInt(rawId, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return undefined
}

export function resolveMovieTmdbId(movie: {
  tmdbId?: number | null
  sources?: unknown
}): number | undefined {
  if (movie.tmdbId && movie.tmdbId > 0) return movie.tmdbId
  const rawId = getSourceExternalId(movie.sources, 'TMDB')
  if (rawId) {
    const parsed = parseInt(rawId, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return undefined
}

export function isSonarrEnabled(userSettings: unknown): boolean {
  const servarr = (userSettings as any)?.servarr
  if (!servarr) return true
  if (typeof servarr.sonarrEnabled === 'boolean') return servarr.sonarrEnabled
  if (typeof servarr.sonarr?.enabled === 'boolean')
    return servarr.sonarr.enabled
  return true
}

export function isRadarrEnabled(userSettings: unknown): boolean {
  const servarr = (userSettings as any)?.servarr
  if (!servarr) return true
  if (typeof servarr.radarrEnabled === 'boolean') return servarr.radarrEnabled
  if (typeof servarr.radarr?.enabled === 'boolean')
    return servarr.radarr.enabled
  return true
}

export function parseSonarrAnimeConfig(
  userSettings: unknown
): SonarrAnimeConfig {
  const servarr = (userSettings as any)?.servarr
  const cfg = servarr?.sonarrAnime ?? servarr?.sonarr?.anime
  return {
    enabled: cfg?.enabled ?? true,
    monitored: cfg?.monitored ?? true,
    listStatuses: listStatusesOr(cfg?.listStatuses, ['PLANNED', 'IN_PROGRESS']),
    animeStatuses: mediaStatusesOr(cfg?.animeStatuses, ['RELEASED', 'RELEASING']),
    animeFormats:
      Array.isArray(cfg?.animeFormats) && cfg.animeFormats.length > 0
        ? cfg.animeFormats
        : (['TV', 'TV_SHORT'] as AnimeFormat[]),
  }
}

export function parseSonarrTvConfig(userSettings: unknown): SonarrTvConfig {
  const servarr = (userSettings as any)?.servarr
  const cfg = servarr?.sonarrTv ?? servarr?.sonarr?.tv
  return {
    enabled: cfg?.enabled ?? true,
    monitored: cfg?.monitored ?? true,
    listStatuses: listStatusesOr(cfg?.listStatuses, ['PLANNED', 'IN_PROGRESS']),
    tvStatuses: mediaStatusesOr(cfg?.tvStatuses, ['RELEASING', 'RELEASED']),
  }
}

export function parseRadarrMovieConfig(
  userSettings: unknown
): RadarrMovieConfig {
  const servarr = (userSettings as any)?.servarr
  const cfg = servarr?.radarrMovie ?? servarr?.radarr?.movie
  return {
    enabled: cfg?.enabled ?? true,
    monitored: cfg?.monitored ?? true,
    listStatuses: listStatusesOr(cfg?.listStatuses, ['PLANNED']),
    movieStatuses: mediaStatusesOr(cfg?.movieStatuses, ['RELEASED']),
  }
}

export function parseRadarrAnimeConfig(
  userSettings: unknown
): RadarrAnimeConfig {
  const servarr = (userSettings as any)?.servarr
  const cfg = servarr?.radarrAnime ?? servarr?.radarr?.anime
  return {
    enabled: cfg?.enabled ?? true,
    monitored: cfg?.monitored ?? true,
    listStatuses: listStatusesOr(cfg?.listStatuses, ['PLANNED']),
    animeStatuses: mediaStatusesOr(cfg?.animeStatuses, ['RELEASED', 'RELEASING']),
    animeMovieFormats:
      Array.isArray(cfg?.animeMovieFormats) && cfg.animeMovieFormats.length > 0
        ? cfg.animeMovieFormats
        : (['MOVIE'] as AnimeFormat[]),
  }
}

export class ServarrServ {
  /**
   * Resolves active connection credentials and adapter for a given servarr app and user.
   */
  public static async getConnectionContext(
    app: ServarrApp,
    userId: string
  ): Promise<ServarrConnectionContext> {
    const provider = app.toUpperCase() as 'RADARR' | 'SONARR'

    const connection = await prisma.orm.public.Connection.where((c) =>
      and(
        c.userId.eq(userId),
        c.provider.eq(provider),
        c.status.eq('CONNECTED')
      )
    ).first()

    if (!connection) {
      return {
        connected: false,
        provider,
        error: `No active ${provider} connection found`,
      }
    }

    try {
      const credentials = decryptConnectionData<ConnectionCredentials>(
        connection.encryptedData,
        userId
      )
      const adapter = getConnectionAdapter(provider) as any
      const hostUrl =
        credentials.hostUrl ||
        (connection.settings as any)?.hostUrl ||
        connection.profileUrl ||
        ''

      return {
        connected: true,
        provider,
        adapter,
        credentials,
        hostUrl,
      }
    } catch {
      return {
        connected: true,
        provider,
        error: `Failed to decrypt ${provider} connection credentials`,
      }
    }
  }

  // ===========================================================================
  // 1. Blocklist
  // ===========================================================================
  public static async getBlocklist(
    app: ServarrApp,
    userId: string,
    query?: {
      page?: number
      pageSize?: number
      sortKey?: string
      sortDirection?: 'ascending' | 'descending'
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }

    try {
      const page = query?.page ? Number(query.page) : 1
      const pageSize = query?.pageSize ? Number(query.pageSize) : 50
      const sortKey = query?.sortKey || 'date'
      const sortDirection = query?.sortDirection || 'descending'

      const data = await ctx.adapter.getBlocklist(ctx.credentials, {
        page,
        pageSize,
        sortKey,
        sortDirection,
      })

      const records = Array.isArray(data) ? data : data?.records || []
      const totalRecords =
        typeof data?.totalRecords === 'number'
          ? data.totalRecords
          : records.length

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
        page,
        pageSize,
        totalRecords,
        records,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: err.message || `Failed to fetch blocklist from ${ctx.provider}`,
      }
    }
  }

  public static async deleteBlocklist(
    app: ServarrApp,
    userId: string,
    query?: { id?: number } | null,
    body?: { ids?: number[] } | null
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: !!ctx.connected,
        provider: ctx.provider,
        message: ctx.error,
      }
    }

    try {
      if (body?.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        await ctx.adapter.deleteBlocklistBulk(ctx.credentials, body.ids)
      } else if (query?.id) {
        await ctx.adapter.deleteBlocklist(ctx.credentials, Number(query.id))
      } else {
        return {
          success: false,
          connected: true,
          provider: ctx.provider,
          message: 'No blocklist ID or ids array provided',
        }
      }

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        message: err.message || 'Failed to remove item from blocklist',
      }
    }
  }

  // ===========================================================================
  // 2. Command
  // ===========================================================================
  public static async executeCommand(
    app: ServarrApp,
    userId: string,
    body: {
      command?: 'refresh' | 'rssSync' | 'searchMissing' | 'custom'
      name?: string
      movieId?: number
      movieIds?: number[]
      seriesId?: number
      seriesIds?: number[]
      files?: number[]
      body?: Record<string, any>
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    const commandName =
      body.name ||
      (app === 'radarr' ? 'RefreshMovie' : 'RefreshSeries')

    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        provider: ctx.provider,
        command: body.command || commandName,
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    let payload: { name: string; [key: string]: unknown } = {
      name: commandName,
      ...body,
    }

    if (body.command === 'refresh') {
      payload = { name: app === 'radarr' ? 'RefreshMovie' : 'RefreshSeries' }
    } else if (body.command === 'rssSync') {
      payload = { name: 'RssSync' }
    } else if (body.command === 'searchMissing') {
      payload = {
        name: app === 'radarr' ? 'MissingMoviesSearch' : 'MissingEpisodeSearch',
      }
    } else if (body.command === 'custom' && body.name) {
      payload = { name: body.name, ...(body.body || {}) }
    }

    try {
      const result = await ctx.adapter.executeCommand(ctx.credentials, payload)
      return {
        success: true,
        provider: ctx.provider,
        command: payload.name,
        message: `${ctx.provider} command '${payload.name}' executed successfully`,
        data: result,
      }
    } catch (err: any) {
      return {
        success: false,
        provider: ctx.provider,
        command: payload.name,
        message: err?.message || `Failed to execute command on ${ctx.provider}`,
      }
    }
  }

  // ===========================================================================
  // 3. Files
  // ===========================================================================
  public static async getFiles(
    app: ServarrApp,
    userId: string,
    query?: { movieId?: number; seriesId?: number }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    const movieId = query?.movieId ? Number(query.movieId) : undefined
    const seriesId = query?.seriesId ? Number(query.seriesId) : undefined

    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        provider: ctx.provider,
        movieId,
        seriesId,
        files: [],
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    try {
      let files: any[] = []
      if (app === 'radarr') {
        if (!movieId) {
          return {
            success: false,
            provider: ctx.provider,
            movieId,
            seriesId,
            files: [],
            message: 'movieId query parameter is required for Radarr',
          }
        }
        files = await ctx.adapter.getMovieFiles(ctx.credentials, movieId)
      } else {
        if (!seriesId) {
          return {
            success: false,
            provider: ctx.provider,
            movieId,
            seriesId,
            files: [],
            message: 'seriesId query parameter is required for Sonarr',
          }
        }
        files = await ctx.adapter.getEpisodeFiles(ctx.credentials, seriesId)
      }

      return {
        success: true,
        provider: ctx.provider,
        movieId,
        seriesId,
        files: Array.isArray(files) ? files : [],
      }
    } catch (err: any) {
      return {
        success: false,
        provider: ctx.provider,
        movieId,
        seriesId,
        files: [],
        message: err?.message || 'Failed to fetch media files',
      }
    }
  }

  public static async deleteFile(
    app: ServarrApp,
    userId: string,
    query?: { fileId?: number } | null,
    body?: { fileId?: number } | null
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    const rawFileId = query?.fileId ?? body?.fileId
    const fileId = rawFileId ? Number(rawFileId) : NaN
    if (!fileId || isNaN(fileId)) {
      return {
        success: false,
        message: 'A valid fileId is required',
      }
    }

    try {
      if (app === 'radarr') {
        await ctx.adapter.deleteMovieFile(ctx.credentials, fileId)
      } else {
        await ctx.adapter.deleteEpisodeFile(ctx.credentials, fileId)
      }

      return {
        success: true,
        message: 'Media file deleted successfully',
      }
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to delete media file',
      }
    }
  }

  // ===========================================================================
  // 4. History
  // ===========================================================================
  public static async getHistory(
    app: ServarrApp,
    userId: string,
    query?: {
      page?: number
      pageSize?: number
      sortKey?: string
      sortDirection?: 'ascending' | 'descending'
      eventType?: number
      movieId?: number
      seriesId?: number
      episodeId?: number
      downloadId?: string
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }

    try {
      const page = query?.page ? Number(query.page) : 1
      const pageSize = query?.pageSize ? Number(query.pageSize) : 50
      const sortKey = query?.sortKey || 'date'
      const sortDirection = query?.sortDirection || 'descending'

      const data = await ctx.adapter.getHistory(ctx.credentials, {
        page,
        pageSize,
        sortKey,
        sortDirection,
        eventType: query?.eventType ? Number(query.eventType) : undefined,
        movieId: query?.movieId ? Number(query.movieId) : undefined,
        seriesId: query?.seriesId ? Number(query.seriesId) : undefined,
        episodeId: query?.episodeId ? Number(query.episodeId) : undefined,
        downloadId: query?.downloadId || undefined,
      })

      const records = Array.isArray(data) ? data : data?.records || []
      const totalRecords =
        typeof data?.totalRecords === 'number'
          ? data.totalRecords
          : records.length

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
        page,
        pageSize,
        totalRecords,
        records,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: err.message || `Failed to fetch history from ${ctx.provider}`,
      }
    }
  }

  // ===========================================================================
  // 5. Indexer
  // ===========================================================================
  public static async getIndexers(app: ServarrApp, userId: string) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        provider: ctx.provider,
        indexers: [],
        message: ctx.error || `${ctx.provider} not connected`,
      }
    }

    try {
      const indexers = await ctx.adapter.getIndexers(ctx.credentials)
      return {
        success: true,
        provider: ctx.provider,
        indexers: Array.isArray(indexers) ? indexers : [],
      }
    } catch (err: any) {
      return {
        success: false,
        provider: ctx.provider,
        indexers: [],
        message: err?.message || 'Failed to fetch indexers',
      }
    }
  }

  // ===========================================================================
  // 6. Library (With Local DB Fallback)
  // ===========================================================================
  public static async getLibrary(app: ServarrApp, userId: string) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: ctx.provider,
        items: [],
        totalCount: 0,
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        items: [],
        totalCount: 0,
        message: ctx.error,
      }
    }

    try {
      if (app === 'radarr') {
        const [rawMovies, rawProfiles] = await Promise.all([
          ctx.adapter.getMovies(ctx.credentials).catch(() => null),
          ctx.adapter.getQualityProfiles?.(ctx.credentials).catch(() => null),
        ])

        const profileMap = new Map<number, string>()
        if (Array.isArray(rawProfiles)) {
          rawProfiles.forEach((p: any) => {
            if (p?.id && p?.name) profileMap.set(p.id, p.name)
          })
        }

        if (Array.isArray(rawMovies)) {
          const mapped = rawMovies.map((m: any) => {
            const poster =
              m.images?.find((img: any) => img.coverType === 'poster')
                ?.remoteUrl ||
              m.images?.find((img: any) => img.coverType === 'poster')?.url ||
              null
            const fanart =
              m.images?.find((img: any) => img.coverType === 'fanart')
                ?.remoteUrl ||
              m.images?.find((img: any) => img.coverType === 'fanart')?.url ||
              null

            const qualityName =
              (m.qualityProfileId
                ? profileMap.get(m.qualityProfileId)
                : null) ||
              m.qualityProfile?.name ||
              'Any'

            return {
              id: m.id || m.tmdbId || m.title,
              title: m.title || 'Unknown Movie',
              originalTitle: m.originalTitle || null,
              year: m.year || null,
              overview: m.overview || null,
              monitored: Boolean(m.monitored),
              hasFile: Boolean(m.hasFile),
              qualityProfile: qualityName,
              qualityProfileId: m.qualityProfileId || null,
              sizeOnDisk: m.sizeOnDisk || m.statistics?.sizeOnDisk || null,
              status: m.hasFile
                ? 'Downloaded'
                : m.monitored
                  ? 'Wanted'
                  : 'Unmonitored',
              added: m.added || null,
              posterUrl: poster,
              fanartUrl: fanart,
              tmdbId: m.tmdbId || null,
              imdbId: m.imdbId || null,
              path: m.path || null,
              genres: m.genres || null,
            }
          })

          return {
            success: true,
            connected: true,
            provider: ctx.provider,
            hostUrl: ctx.hostUrl,
            items: mapped,
            totalCount: mapped.length,
          }
        }
      } else {
        // Sonarr library
        const [rawSeries, rawProfiles] = await Promise.all([
          ctx.adapter.getSeries(ctx.credentials).catch(() => null),
          ctx.adapter.getQualityProfiles?.(ctx.credentials).catch(() => null),
        ])

        const profileMap = new Map<number, string>()
        if (Array.isArray(rawProfiles)) {
          rawProfiles.forEach((p: any) => {
            if (p?.id && p?.name) profileMap.set(p.id, p.name)
          })
        }

        if (Array.isArray(rawSeries)) {
          const mapped = rawSeries.map((s: any) => {
            const poster =
              s.images?.find((img: any) => img.coverType === 'poster')
                ?.remoteUrl ||
              s.images?.find((img: any) => img.coverType === 'poster')?.url ||
              null
            const fanart =
              s.images?.find((img: any) => img.coverType === 'fanart')
                ?.remoteUrl ||
              s.images?.find((img: any) => img.coverType === 'fanart')?.url ||
              null

            const qualityName =
              (s.qualityProfileId
                ? profileMap.get(s.qualityProfileId)
                : null) || 'Any'

            const epCount =
              s.statistics?.episodeCount ?? s.statistics?.totalEpisodeCount
            const epFileCount = s.statistics?.episodeFileCount ?? 0
            const hasAllFiles = epCount > 0 && epFileCount >= epCount

            return {
              id: s.id || s.tvdbId || s.title,
              title: s.title || 'Unknown Series',
              originalTitle: s.originalTitle || null,
              year: s.year || null,
              overview: s.overview || null,
              monitored: Boolean(s.monitored),
              hasFile: hasAllFiles,
              qualityProfile: qualityName,
              qualityProfileId: s.qualityProfileId || null,
              sizeOnDisk: s.statistics?.sizeOnDisk || null,
              status: hasAllFiles
                ? 'Downloaded'
                : s.monitored
                  ? 'Wanted'
                  : 'Unmonitored',
              added: s.added || null,
              posterUrl: poster,
              fanartUrl: fanart,
              tvdbId: s.tvdbId || null,
              imdbId: s.imdbId || null,
              path: s.path || null,
              genres: s.genres || null,
              episodeCount: epCount || null,
              episodeFileCount: epFileCount || null,
              seasonCount: s.statistics?.seasonCount || null,
            }
          })

          return {
            success: true,
            connected: true,
            provider: ctx.provider,
            hostUrl: ctx.hostUrl,
            items: mapped,
            totalCount: mapped.length,
          }
        }
      }
    } catch (err) {
      console.warn(`[Servarr] Live ${ctx.provider} fetch failed, falling back to local database:`, err)
    }

    // Fallback to local database lists
    if (app === 'radarr') {
      const localList = await prisma.orm.public.MovieList.where((m) => m.userId.eq(userId))
        .include('movie')
        .orderBy((m) => m.createdAt.desc())
        .limit(100)
        .all()

      const fallbackItems = localList.map((entry: any) => ({
        id: entry.movie.id,
        title: entry.movie.titlePrimary,
        originalTitle: entry.movie.titleSecondary || null,
        year: entry.movie.releaseDateYear || null,
        overview: entry.movie.description || null,
        monitored: true,
        hasFile: entry.status === 'COMPLETED',
        qualityProfile: 'Any',
        qualityProfileId: 1,
        sizeOnDisk: null,
        status: entry.status === 'COMPLETED' ? 'Downloaded' : 'Wanted',
        added: toDate(entry.createdAt).toISOString(),
        posterUrl: entry.movie.coverImage || null,
        fanartUrl: entry.movie.bannerImage || null,
        tmdbId: entry.movie.id,
        imdbId: entry.movie.imdbId || null,
        path: null,
        genres: entry.movie.genres || null,
      }))

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
        hostUrl: ctx.hostUrl,
        isLocalFallback: true,
        items: fallbackItems,
        totalCount: fallbackItems.length,
      }
    } else {
      const localList = await prisma.orm.public.TvList.where((t) => t.userId.eq(userId))
        .include('tv')
        .orderBy((t) => t.createdAt.desc())
        .limit(100)
        .all()

      const fallbackItems = localList.map((entry: any) => ({
        id: entry.tv.id,
        title: entry.tv.titlePrimary,
        originalTitle: entry.tv.titleSecondary || null,
        year: entry.tv.releaseDateYear || null,
        overview: entry.tv.description || null,
        monitored: true,
        hasFile: entry.status === 'COMPLETED',
        qualityProfile: 'Any',
        qualityProfileId: 1,
        sizeOnDisk: null,
        status: entry.status === 'COMPLETED' ? 'Downloaded' : 'Wanted',
        added: toDate(entry.createdAt).toISOString(),
        posterUrl: entry.tv.coverImage || null,
        fanartUrl: entry.tv.bannerImage || null,
        tvdbId: entry.tv.tvDBId || null,
        imdbId: entry.tv.imdbId || null,
        path: null,
        genres: entry.tv.genres || null,
      }))

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
        hostUrl: ctx.hostUrl,
        isLocalFallback: true,
        items: fallbackItems,
        totalCount: fallbackItems.length,
      }
    }
  }

  // ===========================================================================
  // 7. Lookup
  // ===========================================================================
  public static async lookup(
    app: ServarrApp,
    userId: string,
    query?: { term?: string }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: ctx.provider,
        records: [],
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        message: ctx.error,
      }
    }

    try {
      const [rootFolders, qualityProfiles] = await Promise.all([
        ctx.adapter.getRootFolders(ctx.credentials).catch(() => []),
        ctx.adapter.getQualityProfiles(ctx.credentials).catch(() => []),
      ])

      let records: any[] = []
      if (query?.term && query.term.trim()) {
        const term = query.term.trim()
        records =
          app === 'radarr'
            ? await ctx.adapter.lookupMovies(ctx.credentials, term)
            : await ctx.adapter.lookupSeries(ctx.credentials, term)
      }

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
        records: Array.isArray(records) ? records : [],
        rootFolders: Array.isArray(rootFolders) ? rootFolders : [],
        qualityProfiles: Array.isArray(qualityProfiles) ? qualityProfiles : [],
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        message: err.message || `Failed to lookup items in ${ctx.provider}`,
      }
    }
  }

  public static async addMedia(app: ServarrApp, userId: string, body: any) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: !!ctx.connected,
        provider: ctx.provider,
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    try {
      if (app === 'radarr') {
        const movie = await ctx.adapter.addMovie(ctx.credentials, body)
        return {
          success: true,
          connected: true,
          provider: ctx.provider,
          movie,
          data: movie,
        }
      } else {
        const series = await ctx.adapter.addSeries(ctx.credentials, body)
        return {
          success: true,
          connected: true,
          provider: ctx.provider,
          series,
          data: series,
        }
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        message: err.message || `Failed to add media in ${ctx.provider}`,
      }
    }
  }

  // ===========================================================================
  // 8. Manage (Batch Update / Delete)
  // ===========================================================================
  public static async bulkUpdate(
    app: ServarrApp,
    userId: string,
    body: {
      movieIds?: number[]
      seriesIds?: number[]
      ids?: number[]
      monitored?: boolean
      qualityProfileId?: number
      minimumAvailability?: string
      seriesType?: 'standard' | 'daily' | 'anime'
      seasonFolder?: boolean
      rootFolderPath?: string
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    try {
      if (app === 'radarr') {
        const movieIds = body.movieIds || body.ids || []
        const result = await ctx.adapter.bulkUpdateMovies(ctx.credentials, {
          movieIds,
          monitored: body.monitored,
          qualityProfileId: body.qualityProfileId,
          minimumAvailability: body.minimumAvailability,
          rootFolderPath: body.rootFolderPath,
        })
        return {
          success: true,
          message: `Successfully updated ${movieIds.length} movies`,
          data: result,
        }
      } else {
        const seriesIds = body.seriesIds || body.ids || []
        const result = await ctx.adapter.bulkUpdateSeries(ctx.credentials, {
          seriesIds,
          monitored: body.monitored,
          qualityProfileId: body.qualityProfileId,
          seriesType: body.seriesType,
          seasonFolder: body.seasonFolder,
          rootFolderPath: body.rootFolderPath,
        })
        return {
          success: true,
          message: `Successfully updated ${seriesIds.length} series`,
          data: result,
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to update library items',
      }
    }
  }

  public static async bulkDelete(
    app: ServarrApp,
    userId: string,
    body: {
      movieIds?: number[]
      seriesIds?: number[]
      ids?: number[]
      deleteFiles?: boolean
      addImportListExclusion?: boolean
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    try {
      if (app === 'radarr') {
        const movieIds = body.movieIds || body.ids || []
        await ctx.adapter.bulkDeleteMovies(ctx.credentials, {
          movieIds,
          deleteFiles: body.deleteFiles ?? false,
          addImportListExclusion: body.addImportListExclusion ?? false,
        })
        return {
          success: true,
          message: `Successfully deleted ${movieIds.length} movies`,
        }
      } else {
        const seriesIds = body.seriesIds || body.ids || []
        await ctx.adapter.bulkDeleteSeries(ctx.credentials, {
          seriesIds,
          deleteFiles: body.deleteFiles ?? false,
          addImportListExclusion: body.addImportListExclusion ?? false,
        })
        return {
          success: true,
          message: `Successfully deleted ${seriesIds.length} series`,
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to delete library items',
      }
    }
  }

  // ===========================================================================
  // 9. Manual Import
  // ===========================================================================
  public static async getManualImport(
    app: ServarrApp,
    userId: string,
    query?: {
      folder?: string
      downloadId?: string
      movieId?: number
      seriesId?: number
      filterExistingFiles?: boolean
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        provider: ctx.provider,
        items: [],
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    try {
      const items = await ctx.adapter.getManualImport(ctx.credentials, {
        folder: query?.folder,
        downloadId: query?.downloadId,
        movieId: query?.movieId ? Number(query.movieId) : undefined,
        seriesId: query?.seriesId ? Number(query.seriesId) : undefined,
        filterExistingFiles: query?.filterExistingFiles,
      })

      return {
        success: true,
        provider: ctx.provider,
        items: Array.isArray(items) ? items : [],
      }
    } catch (err: any) {
      return {
        success: false,
        provider: ctx.provider,
        items: [],
        message: err?.message || 'Failed to scan manual import',
      }
    }
  }

  public static async executeManualImport(
    app: ServarrApp,
    userId: string,
    body: { files: Array<Record<string, unknown>> }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    try {
      const result = await ctx.adapter.executeManualImport(
        ctx.credentials,
        body.files
      )
      return {
        success: true,
        message: 'Manual import initiated successfully',
        data: result,
      }
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to execute manual import',
      }
    }
  }

  // ===========================================================================
  // 10. Queue
  // ===========================================================================
  public static async getQueue(
    app: ServarrApp,
    userId: string,
    query?: {
      page?: number
      pageSize?: number
      sortKey?: string
      sortDirection?: 'ascending' | 'descending'
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }

    try {
      const page = query?.page ? Number(query.page) : 1
      const pageSize = query?.pageSize ? Number(query.pageSize) : 50
      const sortKey = query?.sortKey
      const sortDirection = query?.sortDirection

      const data = await ctx.adapter.getQueue(ctx.credentials, {
        page,
        pageSize,
        sortKey,
        sortDirection,
        includeMovie: app === 'radarr',
        includeSeries: app === 'sonarr',
        includeEpisode: app === 'sonarr',
      })

      const records = Array.isArray(data) ? data : data?.records || []
      const totalRecords =
        typeof data?.totalRecords === 'number'
          ? data.totalRecords
          : records.length

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
        page,
        pageSize,
        totalRecords,
        records,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: err?.message || `Failed to fetch ${ctx.provider} queue`,
      }
    }
  }

  public static async deleteQueue(
    app: ServarrApp,
    userId: string,
    query?: {
      id?: number
      removeFromClient?: boolean | string
      blocklist?: boolean | string
      skipRedownload?: boolean | string
    } | null,
    body?: {
      id?: number
      removeFromClient?: boolean
      blocklist?: boolean
      skipRedownload?: boolean
    } | null
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    const rawId = query?.id ?? body?.id
    const itemId = rawId ? Number(rawId) : NaN
    if (!itemId || isNaN(itemId)) {
      return {
        success: false,
        message: 'A valid queue item ID is required',
      }
    }

    const removeFromClient =
      query?.removeFromClient === 'true' ||
      query?.removeFromClient === true ||
      body?.removeFromClient === true ||
      (query?.removeFromClient === undefined && body?.removeFromClient === undefined)
    const blocklist =
      query?.blocklist === 'true' ||
      query?.blocklist === true ||
      body?.blocklist === true
    const skipRedownload =
      query?.skipRedownload === 'true' ||
      query?.skipRedownload === true ||
      body?.skipRedownload === true

    try {
      await ctx.adapter.deleteQueueItem(ctx.credentials, itemId, {
        removeFromClient,
        blocklist,
        skipRedownload,
      })

      return {
        success: true,
        message: 'Download removed from queue successfully',
      }
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to remove item from queue',
      }
    }
  }

  // ===========================================================================
  // 11. Release
  // ===========================================================================
  public static async getReleases(
    app: ServarrApp,
    userId: string,
    query?: {
      movieId?: number
      seriesId?: number
      seasonNumber?: number
      episodeId?: number
      term?: string
      indexerId?: number
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        provider: ctx.provider,
        releases: [],
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    try {
      const releases = await ctx.adapter.getReleases(ctx.credentials, {
        movieId: query?.movieId ? Number(query.movieId) : undefined,
        seriesId: query?.seriesId ? Number(query.seriesId) : undefined,
        seasonNumber:
          query?.seasonNumber !== undefined
            ? Number(query.seasonNumber)
            : undefined,
        episodeId: query?.episodeId ? Number(query.episodeId) : undefined,
        term: query?.term || undefined,
        indexerId: query?.indexerId ? Number(query.indexerId) : undefined,
      })

      return {
        success: true,
        provider: ctx.provider,
        releases: Array.isArray(releases) ? releases : [],
      }
    } catch (err: any) {
      return {
        success: false,
        provider: ctx.provider,
        releases: [],
        message: err?.message || 'Failed to fetch releases',
      }
    }
  }

  public static async grabRelease(
    app: ServarrApp,
    userId: string,
    body: {
      guid?: string
      indexerId?: number
      title?: string
      downloadUrl?: string
      protocol?: string
      publishDate?: string
      [key: string]: unknown
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        message: ctx.error || `No active ${ctx.provider} connection found`,
      }
    }

    try {
      const result = await ctx.adapter.downloadRelease(ctx.credentials, body)
      return {
        success: true,
        message: 'Release grabbed and queued for download',
        data: result,
      }
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to grab release',
      }
    }
  }

  // ===========================================================================
  // 12. Rename
  // ===========================================================================
  public static async getRenamePreview(
    app: ServarrApp,
    userId: string,
    query?: { movieId?: number; seriesId?: number; seasonNumber?: number }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: ctx.provider,
        records: [],
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        message: ctx.error,
      }
    }

    try {
      const records = await ctx.adapter.getRenamePreview(ctx.credentials, {
        movieId: query?.movieId ? Number(query.movieId) : undefined,
        seriesId: query?.seriesId ? Number(query.seriesId) : undefined,
        seasonNumber:
          query?.seasonNumber !== undefined
            ? Number(query.seasonNumber)
            : undefined,
      })

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
        records: Array.isArray(records) ? records : [],
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        message: err.message || `Failed to preview ${ctx.provider} file rename`,
      }
    }
  }

  public static async executeRename(
    app: ServarrApp,
    userId: string,
    body: { movieId?: number; seriesId?: number; files: number[] }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: !!ctx.connected,
        provider: ctx.provider,
        message: ctx.error,
      }
    }

    try {
      await ctx.adapter.executeCommand(ctx.credentials, {
        name: 'RenameFiles',
        movieId: body.movieId ? Number(body.movieId) : undefined,
        seriesId: body.seriesId ? Number(body.seriesId) : undefined,
        files: body.files,
      })

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        message: err.message || `Failed to execute ${ctx.provider} file rename`,
      }
    }
  }

  // ===========================================================================
  // 13. Wanted (Cutoff & Missing)
  // ===========================================================================
  public static async getWantedCutoff(
    app: ServarrApp,
    userId: string,
    query?: {
      page?: number
      pageSize?: number
      sortKey?: string
      sortDirection?: 'ascending' | 'descending'
      monitored?: boolean | string
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }

    try {
      const page = query?.page ? Number(query.page) : 1
      const pageSize = query?.pageSize ? Number(query.pageSize) : 50
      const sortKey = query?.sortKey || 'title'
      const sortDirection = query?.sortDirection || 'ascending'
      const monitored =
        query?.monitored !== undefined
          ? query.monitored === 'true' || query.monitored === true
          : true

      const data = await ctx.adapter.getWantedCutoff(ctx.credentials, {
        page,
        pageSize,
        sortKey,
        sortDirection,
        monitored,
      })

      const records = Array.isArray(data) ? data : data?.records || []
      const totalRecords =
        typeof data?.totalRecords === 'number'
          ? data.totalRecords
          : records.length

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
        page,
        pageSize,
        totalRecords,
        records,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message:
          err.message || `Failed to fetch cutoff unmet items from ${ctx.provider}`,
      }
    }
  }

  public static async getWantedMissing(
    app: ServarrApp,
    userId: string,
    query?: {
      page?: number
      pageSize?: number
      sortKey?: string
      sortDirection?: 'ascending' | 'descending'
      monitored?: boolean | string
    }
  ) {
    const ctx = await this.getConnectionContext(app, userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message: ctx.error,
      }
    }

    try {
      const page = query?.page ? Number(query.page) : 1
      const pageSize = query?.pageSize ? Number(query.pageSize) : 50
      const sortKey = query?.sortKey || 'title'
      const sortDirection = query?.sortDirection || 'ascending'
      const monitored =
        query?.monitored !== undefined
          ? query.monitored === 'true' || query.monitored === true
          : true

      const data = await ctx.adapter.getWantedMissing(ctx.credentials, {
        page,
        pageSize,
        sortKey,
        sortDirection,
        monitored,
      })

      const records = Array.isArray(data) ? data : data?.records || []
      const totalRecords =
        typeof data?.totalRecords === 'number'
          ? data.totalRecords
          : records.length

      return {
        success: true,
        connected: true,
        provider: ctx.provider,
        page,
        pageSize,
        totalRecords,
        records,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: ctx.provider,
        records: [],
        totalRecords: 0,
        message:
          err.message || `Failed to fetch missing items from ${ctx.provider}`,
      }
    }
  }

  // ===========================================================================
  // 14. Radarr Specific (Movies & Feeds)
  // ===========================================================================
  public static async getRadarrMoviesFeed(userId: string) {
    const user = await prisma.orm.public.User.where((u) => u.id.eq(userId)).first()

    const config = parseRadarrMovieConfig(user?.settings)

    if (!isRadarrEnabled(user?.settings) || !config.enabled) {
      return []
    }

    const movieEntries = await prisma.orm.public.MovieList.where((m) =>
      and(
        m.userId.eq(userId),
        m.status.in(config.listStatuses)
      )
    )
      .include('movie')
      .all()

    const filteredEntries = movieEntries.filter((e) =>
      config.movieStatuses.includes(e.movie.status)
    )

    const results: Array<{
      title: string
      tmdbId: number
      imdbId?: string
      year?: number
      monitored: boolean
      hasFile: boolean
    }> = []

    for (const entry of filteredEntries) {
      const tmdbId = resolveMovieTmdbId(entry.movie)
      if (!tmdbId) continue

      results.push({
        title: entry.movie.titlePrimary,
        tmdbId,
        imdbId: entry.movie.imdbId || undefined,
        year: entry.movie.releaseDateYear || undefined,
        monitored: config.monitored,
        hasFile: entry.status === 'COMPLETED',
      })
    }

    return results
  }

  public static async getRadarrAnimeMoviesFeed(userId: string) {
    const user = await prisma.orm.public.User.where((u) => u.id.eq(userId)).first()

    const config = parseRadarrAnimeConfig(user?.settings)

    if (!isRadarrEnabled(user?.settings) || !config.enabled) {
      return []
    }

    const animeEntries = await prisma.orm.public.AnimeList.where((a) =>
      and(
        a.userId.eq(userId),
        a.status.in(config.listStatuses)
      )
    )
      .include('anime')
      .all()

    const filteredEntries = animeEntries.filter(
      (e) =>
        config.animeMovieFormats.includes(e.anime.format) &&
        config.animeStatuses.includes(e.anime.status)
    )

    const results: Array<{
      title: string
      tmdbId?: number
      imdbId?: string
      year?: number
      monitored: boolean
      hasFile: boolean
    }> = []

    for (const entry of filteredEntries) {
      const tmdbId = resolveAnimeTmdbId(entry.anime)
      const imdbId = resolveAnimeImdbId(entry.anime)

      if (!tmdbId && !imdbId) continue

      results.push({
        title: entry.anime.titlePrimary,
        tmdbId: tmdbId || undefined,
        imdbId: imdbId || undefined,
        year: entry.anime.startDateYear || undefined,
        monitored: config.monitored,
        hasFile: entry.status === 'COMPLETED',
      })
    }

    return results
  }

  public static async getRadarrMovieById(userId: string, id: number) {
    const ctx = await this.getConnectionContext('radarr', userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: 'RADARR',
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: 'RADARR',
        message: ctx.error,
      }
    }

    try {
      const movieId = Number(id)
      const [movie, files] = await Promise.all([
        ctx.adapter.getMovieById(ctx.credentials, movieId),
        ctx.adapter.getMovieFiles(ctx.credentials, movieId).catch(() => []),
      ])

      return {
        success: true,
        connected: true,
        provider: 'RADARR',
        movie,
        files: Array.isArray(files) ? files : [],
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: 'RADARR',
        message: err.message || 'Failed to fetch Radarr movie details',
      }
    }
  }

  public static async updateRadarrMovie(userId: string, id: number, body: any) {
    const ctx = await this.getConnectionContext('radarr', userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: !!ctx.connected,
        provider: 'RADARR',
        message: ctx.error,
      }
    }

    try {
      const movieId = Number(id)
      const updated = await ctx.adapter.updateMovie(ctx.credentials, {
        ...body,
        id: movieId,
      })
      return {
        success: true,
        connected: true,
        provider: 'RADARR',
        movie: updated,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: 'RADARR',
        message: err.message || 'Failed to update Radarr movie',
      }
    }
  }

  public static async deleteRadarrMovie(
    userId: string,
    id: number,
    options?: { deleteFiles?: boolean; addImportListExclusion?: boolean }
  ) {
    const ctx = await this.getConnectionContext('radarr', userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: !!ctx.connected,
        provider: 'RADARR',
        message: ctx.error,
      }
    }

    try {
      const movieId = Number(id)
      await ctx.adapter.deleteMovie(
        ctx.credentials,
        movieId,
        options?.deleteFiles ?? false,
        options?.addImportListExclusion ?? false
      )
      return {
        success: true,
        connected: true,
        provider: 'RADARR',
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: 'RADARR',
        message: err.message || 'Failed to delete Radarr movie',
      }
    }
  }

  public static getQualityProfiles() {
    return SERVARR_QUALITY_PROFILES
  }

  public static getSystemStatus() {
    return SERVARR_SYSTEM_STATUS
  }

  // ===========================================================================
  // 15. Sonarr Specific (Series, Episodes & Feeds)
  // ===========================================================================
  public static async getSonarrAnimeFeed(userId: string) {
    const user = await prisma.orm.public.User.where((u) => u.id.eq(userId)).first()

    const config = parseSonarrAnimeConfig(user?.settings)

    if (!isSonarrEnabled(user?.settings) || !config.enabled) {
      return []
    }

    const animeEntries = await prisma.orm.public.AnimeList.where((a) =>
      and(
        a.userId.eq(userId),
        a.status.in(config.listStatuses)
      )
    )
      .include('anime')
      .all()

    const filteredEntries = animeEntries.filter(
      (e) =>
        config.animeFormats.includes(e.anime.format) &&
        config.animeStatuses.includes(e.anime.status)
    )

    const results: Array<{
      title: string
      tvdbId: number
      imdbId?: string
      year?: number
      monitored: boolean
      seriesType: 'anime' | 'standard'
      seasonFolder: boolean
    }> = []

    for (const entry of filteredEntries) {
      const tvdbId = resolveAnimeTvdbId(entry.anime)
      if (!tvdbId) continue

      const imdbId = resolveAnimeImdbId(entry.anime)

      results.push({
        title: entry.anime.titlePrimary,
        tvdbId,
        imdbId: imdbId || undefined,
        year: entry.anime.startDateYear || undefined,
        monitored: config.monitored,
        seriesType: 'anime',
        seasonFolder: true,
      })
    }

    return results
  }

  public static async getSonarrTvFeed(userId: string) {
    const user = await prisma.orm.public.User.where((u) => u.id.eq(userId)).first()

    const config = parseSonarrTvConfig(user?.settings)

    if (!isSonarrEnabled(user?.settings) || !config.enabled) {
      return []
    }

    const tvEntries = await prisma.orm.public.TvList.where((t) =>
      and(
        t.userId.eq(userId),
        t.status.in(config.listStatuses)
      )
    )
      .include('tv')
      .all()

    const filteredEntries = tvEntries.filter((e) =>
      config.tvStatuses.includes(e.tv.status)
    )

    const results: Array<{
      title: string
      tvdbId: number
      imdbId?: string
      year?: number
      monitored: boolean
      seriesType: 'anime' | 'standard'
      seasonFolder: boolean
    }> = []

    for (const entry of filteredEntries) {
      const tvdbId = resolveTvTvdbId(entry.tv)
      if (!tvdbId) continue

      results.push({
        title: entry.tv.titlePrimary,
        tvdbId,
        imdbId: entry.tv.imdbId || undefined,
        year: entry.tv.firstAiredYear || undefined,
        monitored: config.monitored,
        seriesType: 'standard',
        seasonFolder: true,
      })
    }

    return results
  }

  public static async getSonarrSeriesById(userId: string, id: number) {
    const ctx = await this.getConnectionContext('sonarr', userId)
    if (!ctx.connected) {
      return {
        success: true,
        connected: false,
        provider: 'SONARR',
        message: ctx.error,
      }
    }
    if (ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: true,
        provider: 'SONARR',
        message: ctx.error,
      }
    }

    try {
      const seriesId = Number(id)
      const [series, episodes, files] = await Promise.all([
        ctx.adapter.getSeriesById(ctx.credentials, seriesId),
        ctx.adapter.getEpisodes(ctx.credentials, seriesId).catch(() => []),
        ctx.adapter.getEpisodeFiles(ctx.credentials, seriesId).catch(() => []),
      ])

      return {
        success: true,
        connected: true,
        provider: 'SONARR',
        series,
        episodes: Array.isArray(episodes) ? episodes : [],
        files: Array.isArray(files) ? files : [],
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: 'SONARR',
        message: err.message || 'Failed to fetch Sonarr series details',
      }
    }
  }

  public static async updateSonarrSeries(userId: string, id: number, body: any) {
    const ctx = await this.getConnectionContext('sonarr', userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: !!ctx.connected,
        provider: 'SONARR',
        message: ctx.error,
      }
    }

    try {
      const seriesId = Number(id)
      const updated = await ctx.adapter.updateSeries(ctx.credentials, {
        ...body,
        id: seriesId,
      })
      return {
        success: true,
        connected: true,
        provider: 'SONARR',
        series: updated,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: 'SONARR',
        message: err.message || 'Failed to update Sonarr series',
      }
    }
  }

  public static async deleteSonarrSeries(
    userId: string,
    id: number,
    options?: { deleteFiles?: boolean; addImportListExclusion?: boolean }
  ) {
    const ctx = await this.getConnectionContext('sonarr', userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: !!ctx.connected,
        provider: 'SONARR',
        message: ctx.error,
      }
    }

    try {
      const seriesId = Number(id)
      await ctx.adapter.deleteSeries(
        ctx.credentials,
        seriesId,
        options?.deleteFiles ?? false,
        options?.addImportListExclusion ?? false
      )
      return {
        success: true,
        connected: true,
        provider: 'SONARR',
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: 'SONARR',
        message: err.message || 'Failed to delete Sonarr series',
      }
    }
  }

  public static async updateSonarrEpisode(userId: string, id: number, body: any) {
    const ctx = await this.getConnectionContext('sonarr', userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: !!ctx.connected,
        provider: 'SONARR',
        message: ctx.error,
      }
    }

    try {
      const episodeId = Number(id)
      const updated = await ctx.adapter.updateEpisode(ctx.credentials, {
        ...body,
        id: episodeId,
      })
      return {
        success: true,
        connected: true,
        provider: 'SONARR',
        episode: updated,
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: 'SONARR',
        message: err.message || 'Failed to update Sonarr episode',
      }
    }
  }

  public static async setEpisodeMonitoring(
    userId: string,
    episodeIds: number[],
    monitored: boolean
  ) {
    const ctx = await this.getConnectionContext('sonarr', userId)
    if (!ctx.connected || ctx.error || !ctx.adapter || !ctx.credentials) {
      return {
        success: false,
        connected: !!ctx.connected,
        provider: 'SONARR',
        message: ctx.error,
      }
    }

    try {
      await ctx.adapter.setEpisodeMonitoring(
        ctx.credentials,
        episodeIds,
        monitored
      )
      return {
        success: true,
        connected: true,
        provider: 'SONARR',
      }
    } catch (err: any) {
      return {
        success: false,
        connected: true,
        provider: 'SONARR',
        message: err.message || 'Failed to update episode monitoring',
      }
    }
  }
}
