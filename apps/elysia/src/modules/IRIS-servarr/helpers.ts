import { t } from "@/router"
import type {
  AnimeFormat,
  AnimeListStatus,
  AnimeStatus,
  MovieListStatus,
  MovieStatus,
  TvListStatus,
  TvStatus,
} from "@IRIS/database"

export interface SonarrAnimeConfig {
  enabled: boolean
  monitored: boolean
  listStatuses: AnimeListStatus[]
  animeStatuses: AnimeStatus[]
  animeFormats: AnimeFormat[]
}

export interface SonarrTvConfig {
  enabled: boolean
  monitored: boolean
  listStatuses: TvListStatus[]
  tvStatuses: TvStatus[]
}

export interface RadarrMovieConfig {
  enabled: boolean
  monitored: boolean
  listStatuses: MovieListStatus[]
  movieStatuses: MovieStatus[]
}

export interface RadarrAnimeConfig {
  enabled: boolean
  monitored: boolean
  listStatuses: AnimeListStatus[]
  animeStatuses: AnimeStatus[]
  animeMovieFormats: AnimeFormat[]
}

export const SERVARR_QUALITY_PROFILES = [
  {
    id: 1,
    name: "Any",
  },
]

export const SERVARR_SYSTEM_STATUS = {
  version: "3.0.0",
  appName: "IRIS",
}

export const QualityProfileSchema = t.Array(
  t.Object({
    id: t.Number(),
    name: t.String(),
  })
)

export const SystemStatusSchema = t.Object({
  version: t.String(),
  appName: t.String(),
})

export const SonarrSeriesItemSchema = t.Object({
  title: t.String(),
  tvdbId: t.Number(),
  imdbId: t.Optional(t.String()),
  year: t.Optional(t.Number()),
  monitored: t.Boolean(),
  seriesType: t.Union([t.Literal("anime"), t.Literal("standard")]),
  seasonFolder: t.Boolean(),
})

export const RadarrMovieItemSchema = t.Object({
  title: t.String(),
  tmdbId: t.Optional(t.Number()),
  imdbId: t.Optional(t.String()),
  year: t.Optional(t.Number()),
  monitored: t.Boolean(),
  hasFile: t.Boolean(),
})

/**
 * Extracts external source ID from a Prisma JSON array of sources
 */
export function getSourceExternalId(
  sources: unknown,
  providerName: string
): string | undefined {
  if (!Array.isArray(sources)) return undefined
  const match = sources.find(
    (s: any) =>
      typeof s?.provider === "string" &&
      s.provider.toUpperCase() === providerName.toUpperCase()
  )
  return match?.externalId ? String(match.externalId) : undefined
}

/**
 * Resolves TVDB ID for an Anime record
 */
export function resolveAnimeTvdbId(anime: {
  tvDBId?: number | null
  sources?: unknown
}): number | undefined {
  if (anime.tvDBId && anime.tvDBId > 0) return anime.tvDBId
  const rawId =
    getSourceExternalId(anime.sources, "TVDB") ??
    getSourceExternalId(anime.sources, "THETVDB")
  if (rawId) {
    const parsed = parseInt(rawId, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return undefined
}

/**
 * Resolves IMDB ID for an Anime record
 */
export function resolveAnimeImdbId(anime: {
  sources?: unknown
}): string | undefined {
  return getSourceExternalId(anime.sources, "IMDB")
}

/**
 * Resolves TMDB ID for an Anime record
 */
export function resolveAnimeTmdbId(anime: {
  sources?: unknown
}): number | undefined {
  const rawId = getSourceExternalId(anime.sources, "TMDB")
  if (rawId) {
    const parsed = parseInt(rawId, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return undefined
}

/**
 * Resolves TVDB ID for a Tv record
 */
export function resolveTvTvdbId(tv: {
  tvDBId?: number | null
  sources?: unknown
}): number | undefined {
  if (tv.tvDBId && tv.tvDBId > 0) return tv.tvDBId
  const rawId =
    getSourceExternalId(tv.sources, "TVDB") ??
    getSourceExternalId(tv.sources, "THETVDB")
  if (rawId) {
    const parsed = parseInt(rawId, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return undefined
}

/**
 * Resolves TMDB ID for a Movie record
 */
export function resolveMovieTmdbId(movie: {
  tmdbId?: number | null
  sources?: unknown
}): number | undefined {
  if (movie.tmdbId && movie.tmdbId > 0) return movie.tmdbId
  const rawId = getSourceExternalId(movie.sources, "TMDB")
  if (rawId) {
    const parsed = parseInt(rawId, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return undefined
}

/**
 * Checks if the Sonarr app group is enabled in user settings
 */
export function isSonarrEnabled(userSettings: unknown): boolean {
  const servarr = (userSettings as any)?.servarr
  if (!servarr) return true
  if (typeof servarr.sonarrEnabled === "boolean") return servarr.sonarrEnabled
  if (typeof servarr.sonarr?.enabled === "boolean")
    return servarr.sonarr.enabled
  return true
}

/**
 * Checks if the Radarr app group is enabled in user settings
 */
export function isRadarrEnabled(userSettings: unknown): boolean {
  const servarr = (userSettings as any)?.servarr
  if (!servarr) return true
  if (typeof servarr.radarrEnabled === "boolean") return servarr.radarrEnabled
  if (typeof servarr.radarr?.enabled === "boolean")
    return servarr.radarr.enabled
  return true
}

/**
 * Parses user's servarr settings for Sonarr Anime
 */
export function parseSonarrAnimeConfig(
  userSettings: unknown
): SonarrAnimeConfig {
  const servarr = (userSettings as any)?.servarr
  const cfg = servarr?.sonarrAnime ?? servarr?.sonarr?.anime
  return {
    enabled: cfg?.enabled ?? true,
    monitored: cfg?.monitored ?? true,
    listStatuses:
      Array.isArray(cfg?.listStatuses) && cfg.listStatuses.length > 0
        ? cfg.listStatuses
        : (["PLANNING", "WATCHING"] as AnimeListStatus[]),
    animeStatuses:
      Array.isArray(cfg?.animeStatuses) && cfg.animeStatuses.length > 0
        ? cfg.animeStatuses
        : (["FINISHED", "RELEASING"] as AnimeStatus[]),
    animeFormats:
      Array.isArray(cfg?.animeFormats) && cfg.animeFormats.length > 0
        ? cfg.animeFormats
        : (["TV", "TV_SHORT"] as AnimeFormat[]),
  }
}

/**
 * Parses user's servarr settings for Sonarr TV
 */
export function parseSonarrTvConfig(userSettings: unknown): SonarrTvConfig {
  const servarr = (userSettings as any)?.servarr
  const cfg = servarr?.sonarrTv ?? servarr?.sonarr?.tv
  return {
    enabled: cfg?.enabled ?? true,
    monitored: cfg?.monitored ?? true,
    listStatuses:
      Array.isArray(cfg?.listStatuses) && cfg.listStatuses.length > 0
        ? cfg.listStatuses
        : (["PLANNING", "WATCHING"] as TvListStatus[]),
    tvStatuses:
      Array.isArray(cfg?.tvStatuses) && cfg.tvStatuses.length > 0
        ? cfg.tvStatuses
        : (["RETURNING_SERIES", "ENDED"] as TvStatus[]),
  }
}

/**
 * Parses user's servarr settings for Radarr Movie
 */
export function parseRadarrMovieConfig(
  userSettings: unknown
): RadarrMovieConfig {
  const servarr = (userSettings as any)?.servarr
  const cfg = servarr?.radarrMovie ?? servarr?.radarr?.movie
  return {
    enabled: cfg?.enabled ?? true,
    monitored: cfg?.monitored ?? true,
    listStatuses:
      Array.isArray(cfg?.listStatuses) && cfg.listStatuses.length > 0
        ? cfg.listStatuses
        : (["PLANNING"] as MovieListStatus[]),
    movieStatuses:
      Array.isArray(cfg?.movieStatuses) && cfg.movieStatuses.length > 0
        ? cfg.movieStatuses
        : (["RELEASED"] as MovieStatus[]),
  }
}

/**
 * Parses user's servarr settings for Radarr Anime Movie
 */
export function parseRadarrAnimeConfig(
  userSettings: unknown
): RadarrAnimeConfig {
  const servarr = (userSettings as any)?.servarr
  const cfg = servarr?.radarrAnime ?? servarr?.radarr?.anime
  return {
    enabled: cfg?.enabled ?? true,
    monitored: cfg?.monitored ?? true,
    listStatuses:
      Array.isArray(cfg?.listStatuses) && cfg.listStatuses.length > 0
        ? cfg.listStatuses
        : (["PLANNING"] as AnimeListStatus[]),
    animeStatuses:
      Array.isArray(cfg?.animeStatuses) && cfg.animeStatuses.length > 0
        ? cfg.animeStatuses
        : (["FINISHED", "RELEASING"] as AnimeStatus[]),
    animeMovieFormats:
      Array.isArray(cfg?.animeMovieFormats) && cfg.animeMovieFormats.length > 0
        ? cfg.animeMovieFormats
        : (["MOVIE"] as AnimeFormat[]),
  }
}
