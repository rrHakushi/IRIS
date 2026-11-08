import type { ReactNode } from "react"
import type { ListStatus } from "./media-list-status-text"

export type BorealisEntityType =
  | "anime"
  | "manga"
  | "movies"
  | "movie"
  | "tv"
  | "books"
  | "book"
  | "games"
  | "game"
  | "music"
  | "character"
  | "characters"
  | "staff"
  | "people"
  | "studio"
  | "studios"
  | "episode"
  | "episodes"
  | "other"

export type BorealisAspectRatio = "poster" | "square" | "video"
export type BorealisCardSize = "sm" | "md" | "lg"

export interface BorealisBadge {
  label: string
  variant?: "default" | "secondary" | "outline" | "destructive"
  className?: string
}

export interface BorealisActor {
  id: number | string
  namePrimary: string
  nameNative?: string | null
  image?: string | null
  language?: string | null
}

export interface BorealisProgressInfo {
  current: number
  max?: number | null
  unit?: string
  seasonNumber?: number | null
  episodeNumber?: number | null
  seasonEpisodeCount?: number | null
  nextSeasonNumber?: number | null
  nextSeasonEpisodeCount?: number | null
  hasMoreSeasons?: boolean
  volumeCurrent?: number | null
  volumeMax?: number | null
  chapterCurrent?: number | null
  chapterMax?: number | null
}

export interface BorealisCardSavePayload {
  status: ListStatus
  score: number | null
  progress: number
  chaptersProgress?: number
  volumesProgress?: number
  startedAt?: string | null
  completedAt?: string | null
  rewatched?: number
  rewatchHistory?: any[] | null
  rereadHistory?: any[] | null
  watchedEpisodes?: any[] | null
  connections?: any | null
  isPrivate?: boolean
  notes?: string | null
}

export interface BorealisHoverDetails {
  bannerImage?: string | null
  coverImage?: string | null
  description?: string | null
  score?: number | string | null
  scoreFormatted?: string | null // e.g. "7.1"
  userScore?: number | null
  status?: string | null
  listStatus?: string | null
  listStatusText?: string | null
  format?: string | null
  year?: number | string | null
  airDate?: string | null
  duration?: number | string | null
  season?: string | null
  episodeCount?: number | null
  chapterCount?: number | null
  volumeCount?: number | null
  studios?: string[]
  genres?: string[]
  tags?: string[]
  gender?: string | null
  age?: string | null
  dateOfBirth?: string | null
  primaryOccupations?: string[]
  roles?: string[]
  actor?: BorealisActor | null
  extraStats?: Array<{ label: string; value: string | number }>
  isQueued?: boolean
  relations?: any[]
  recommendations?: any[]
  similar?: any[]
  connections?: Record<string, any> | null
  episodes?: any[]
  seasons?: any[]
}

export interface BorealisNormalizedData {
  id: number | string
  type: BorealisEntityType
  href: string
  title: string
  titleNative?: string | null
  titleSecondary?: string | null
  description?: string | null
  image?: string | null
  aspectRatio: BorealisAspectRatio
  badges: BorealisBadge[]
  actor?: BorealisActor | null
  subtext?: string | null
  metaPills?: string[]
  progress?: BorealisProgressInfo | null
  connectedCount?: number
  listStatus?: string | null
  hoverDetails: BorealisHoverDetails
  raw: any
}

export interface BorealisCardConfig {
  /** Whether to render the card in expanded horizontal layout */
  expanded?: boolean
  /** Placement of the image in expanded mode: 'left' (default) or 'right' */
  imagePosition?: "left" | "right" | "start" | "end"
  showExtras?: boolean
  showBadges?: boolean
  showSubtitle?: boolean
  showHoverSubtitle?: boolean
  showTabNav?: boolean
  showDescription?: boolean
  showHoverCard?: boolean
  showProgress?: boolean
  statusIconOnly?: boolean
  canEdit?: boolean
  onStatusChange?: (status: ListStatus) => Promise<void> | void
  onScoreChange?: (score: number | null) => Promise<void> | void
  onSaveEntry?: (payload: BorealisCardSavePayload) => Promise<void> | void
  onEdit?: () => void
  onIncrement?: (count: number) => Promise<void> | void
  onIncrementVolume?: (count: number) => Promise<void> | void
  isIncrementDisabled?: boolean
  aspectRatio?: BorealisAspectRatio
  size?: BorealisCardSize
  hoverPlacement?: "top" | "bottom" | "left" | "right"
  hoverDelay?: number
  className?: string
}

export interface BorealisCardProps extends BorealisCardConfig {
  type: BorealisEntityType
  data: any
  href?: string
  priority?: boolean
  titlePreference?: "primary" | "secondary" | "native"
  progress?: BorealisProgressInfo | null
  children?: ReactNode
}

export interface BorealisCardRootProps extends BorealisCardConfig {
  data: BorealisNormalizedData
  className?: string
  children: ReactNode
}

export interface BorealisCardImageProps {
  className?: string
  aspectRatio?: BorealisAspectRatio
  priority?: boolean
  showBadges?: boolean
  onScoreChange?: (score: number | null) => Promise<void> | void
  children?: ReactNode
}

export interface BorealisCardTitleProps {
  className?: string
  showSubtitle?: boolean
  showDescription?: boolean
  titleClassName?: string
  subtitleClassName?: string
  descriptionClassName?: string
}

export interface BorealisCardExtrasProps {
  className?: string
  showActor?: boolean
  showMetaPills?: boolean
  showSubtext?: boolean
  showProgress?: boolean
  statusIconOnly?: boolean
  onStatusChange?: (status: ListStatus) => Promise<void> | void
  onIncrementVolume?: (count: number) => Promise<void> | void
}

export interface BorealisCardHoverContentProps {
  className?: string
  placement?: "top" | "bottom" | "left" | "right"
  offset?: number
}

export interface BorealisCardExpandedContentProps {
  imagePosition?: "left" | "right" | "start" | "end"
  priority?: boolean
  showHoverCard?: boolean
  className?: string
}

