export type MediaJobType =
  "ANIME" | "MANGA" | "TV" | "MOVIE" | "BOOK" | "GAME" | "MUSIC"

export type MediaJobStatus =
  "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"

export interface MediaJob {
  id: string // Unique job ID (e.g. "ANIME:16498")
  type: MediaJobType
  externalId: string | number // Primary provider ID
  status: MediaJobStatus
  depth?: number // Traversal depth for relations (defaults to 0)
  maxDepth?: number
  priority?: number // Lower number = higher priority
  retries?: number
  maxRetries?: number
  error?: string
  createdAt: string // ISO string
  updatedAt: string // ISO string
  startedAt?: string
  completedAt?: string
  metadata?: Record<string, unknown>
}

export interface QueueJobOptions {
  priority?: number
  maxDepth?: number
  maxRetries?: number
  forceRefresh?: boolean
  metadata?: Record<string, unknown>
}

export interface QueueSearchOptions extends QueueJobOptions {
  limit?: number
}

export interface AnimeSearchResult {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  titleNative?: string | null
  coverImage?: string | null
  isAdult?: boolean
  format?: string
  seasonYear?: number | null
  seasonSeason?: string
}

export interface MangaSearchResult {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  titleNative?: string | null
  coverImage?: string | null
  isAdult?: boolean
  format?: string
  startDateYear?: number | null
}

export interface TvSearchResult {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  titleNative?: string | null
  coverImage?: string | null
  bannerImage?: string | null
  firstAiredYear?: number | null
  status?: string
}

export interface MovieSearchResult {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  titleNative?: string | null
  coverImage?: string | null
  bannerImage?: string | null
  releaseDateYear?: number | null
  status?: string
}

export interface BookSearchResult {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  coverImage?: string | null
  authors?: string[]
  releaseDateYear?: number | null
}

export interface GameSearchResult {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  coverImage?: string | null
  releaseDateYear?: number | null
}

export interface MusicSearchResult {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  artist?: string | null
  coverImage?: string | null
  duration?: number | null
}

// Relation model
export type RelationKind =
  | "ADAPTATION"
  | "SEQUEL"
  | "PREQUEL"
  | "PARENT"
  | "SIDE_STORY"
  | "CHARACTER"
  | "SUMMARY"
  | "ALTERNATIVE"
  | "SPIN_OFF"
  | "OTHER"

export interface DiscoveredRelation {
  sourceType: MediaJobType
  sourceExternalId: number | string
  targetType: MediaJobType
  targetExternalId: number | string
  type: RelationKind
}

export interface ProviderCastMember {
  personName: string
  personNativeName?: string
  personImage?: string
  personTvdbId?: number
  personAnilistId?: number
  personMalId?: number
  personGender?: string
  characterName?: string
  characterNativeName?: string
  characterImage?: string
  characterTvdbId?: number
  characterAnilistId?: number
  characterMalId?: number
  role?: "MAIN" | "SUPPORTING" | "BACKGROUND"
  staffRole?: string
  order?: number
}
