import type React from "react"
import {
  IconDeviceTv,
  IconBook2,
  IconMovie,
  IconDeviceGamepad,
  IconBook,
  IconMusic,
} from "@tabler/icons-react"

export type MediaListType =
  | "anime"
  | "manga"
  | "movie"
  | "tv"
  | "game"
  | "book"
  | "music"

export interface MediaCategoryConfig {
  key: MediaListType
  label: string
  href: (username: string) => string
  icon: React.ComponentType<{ className?: string }>
  activeVerb: string // e.g. "Watching", "Reading", "Playing", "Listening"
  progressLabel: string // e.g. "Ep", "Ch", "Vol", "Hrs", "Plays"
  maxUnitLabel?: string
}

export const MEDIA_CATEGORIES: MediaCategoryConfig[] = [
  {
    key: "anime",
    label: "Anime",
    href: (u) => `/IRIS-list/lists/${u}/anime`,
    icon: IconDeviceTv,
    activeVerb: "Watching",
    progressLabel: "Ep",
  },
  {
    key: "manga",
    label: "Manga",
    href: (u) => `/IRIS-list/lists/${u}/manga`,
    icon: IconBook2,
    activeVerb: "Reading",
    progressLabel: "Ch",
  },
  {
    key: "movie",
    label: "Movies",
    href: (u) => `/IRIS-list/lists/${u}/movie`,
    icon: IconMovie,
    activeVerb: "Watching",
    progressLabel: "Watched",
  },
  {
    key: "tv",
    label: "TV Shows",
    href: (u) => `/IRIS-list/lists/${u}/tv`,
    icon: IconDeviceTv,
    activeVerb: "Watching",
    progressLabel: "Ep",
  },
  {
    key: "game",
    label: "Games",
    href: (u) => `/IRIS-list/lists/${u}/game`,
    icon: IconDeviceGamepad,
    activeVerb: "Playing",
    progressLabel: "Hrs",
  },
  {
    key: "book",
    label: "Books",
    href: (u) => `/IRIS-list/lists/${u}/book`,
    icon: IconBook,
    activeVerb: "Reading",
    progressLabel: "Pages",
  },
  {
    key: "music",
    label: "Music",
    href: (u) => `/IRIS-list/lists/${u}/music`,
    icon: IconMusic,
    activeVerb: "Listening",
    progressLabel: "Plays",
  },
]

export type StatusKey =
  | "ALL"
  | "WATCHING"
  | "ON_HOLD"
  | "COMPLETED"
  | "DROPPED"
  | "PLANNING"
  | "ALBUMS"
  | "TRACKS"

export interface StatusOption {
  key: StatusKey
  label: string
  badgeKey?: string
}

export type SortByOption =
  "updatedAt" | "score" | "title" | "progress" | "addedAt"
export type SortOrderOption = "asc" | "desc"
export type ListViewTab = "list" | "comments" | "stats"

export interface ListFilterFacets {
  statuses: Array<{ value: string; count: number }>
  formats: Array<{ value: string; count: number }>
  genres: Array<{ value: string; count: number }>
  years: Array<{ value: number; count: number }>
  mediaStatuses?: Array<{ value: string; count: number }>
  months?: Array<{ value: number; count: number }>
  artists?: Array<{ value: string; count: number }>
}

export interface ListEntryData {
  entry: {
    id: number
    status: string
    progress?: number
    playCount?: number
    chaptersProgress?: number
    volumesProgress?: number
    score: number | null
    notes: string | null
    rewatched?: number
    reread?: number
    private: boolean
    startedAt?: string | null
    completedAt?: string | null
    albumId?: number | null
    trackId?: number | null
    itemType?: string
    connections?: Record<string, any> | null
    createdAt: string
    updatedAt: string
  }
  media: {
    id: number
    titlePrimary?: string
    titleEnglish?: string
    titleRomaji?: string
    titleNative?: string
    title?: string
    name?: string
    artist?: string | null
    artistName?: string | null
    coverImage?: string | null
    posterImage?: string | null
    bannerImage?: string | null
    format?: string | null
    status?: string | null
    episodes?: number | null
    chapters?: number | null
    volumes?: number | null
    startDateYear?: number | null
    year?: number | null
    genres?: Array<{ name: string }> | string[]
    [key: string]: any
  }
}
