export type CanonicalMediaCategory =
  | "anime"
  | "manga"
  | "movie"
  | "tv"
  | "game"
  | "book"
  | "music"
  | "other"

export type MediaListStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ON_HOLD"
  | "DROPPED"

export interface StatusConfig {
  value: MediaListStatus
  label: string
  color: string
  badgeClass: string
}

export function toCanonicalCategory(
  rawCategory: string
): CanonicalMediaCategory {
  const normalized = rawCategory.toLowerCase()
  if (normalized === "movies") return "movie"
  if (normalized === "games") return "game"
  if (normalized === "books") return "book"
  if (normalized === "other") return "other"
  if (
    normalized === "music_album" ||
    normalized === "music_track" ||
    normalized === "album" ||
    normalized === "track" ||
    normalized.startsWith("music")
  ) {
    return "music"
  }
  if (
    normalized === "anime" ||
    normalized === "manga" ||
    normalized === "movie" ||
    normalized === "tv" ||
    normalized === "game" ||
    normalized === "book" ||
    normalized === "other"
  ) {
    return normalized
  }
  return "anime"
}

export function toBackendMediaType(category: CanonicalMediaCategory): string {
  switch (category) {
    case "anime":
      return "ANIME"
    case "manga":
      return "MANGA"
    case "movie":
      return "MOVIE"
    case "tv":
      return "TV"
    case "game":
      return "GAME"
    case "book":
      return "BOOK"
    case "music":
      return "MUSIC"
    case "other":
      return "OTHER"
  }
}

export function getInProgressStatus(
  _category?: CanonicalMediaCategory
): MediaListStatus {
  return "IN_PROGRESS"
}

export function getInProgressLabel(category: CanonicalMediaCategory): string {
  switch (category) {
    case "anime":
    case "movie":
    case "tv":
      return "Watching"
    case "other":
      return "Tracking"
    case "manga":
    case "book":
      return "Reading"
    case "game":
      return "Playing"
    case "music":
      return "Listening"
  }
}

export function getAvailableStatuses(
  category: CanonicalMediaCategory
): StatusConfig[] {
  const inProgressLabel = getInProgressLabel(category)

  return [
    {
      value: "PLANNED",
      label: "Planning",
      color: "secondary",
      badgeClass: "border-border bg-muted/60 text-muted-foreground",
    },
    {
      value: "IN_PROGRESS",
      label: inProgressLabel,
      color: "primary",
      badgeClass: "border-primary/40 bg-primary/10 text-primary",
    },
    {
      value: "COMPLETED",
      label: "Completed",
      color: "primary",
      badgeClass: "border-primary/40 bg-primary/10 text-primary",
    },
    {
      value: "ON_HOLD",
      label: "On Hold",
      color: "secondary",
      badgeClass: "border-border bg-muted/60 text-muted-foreground",
    },
    {
      value: "DROPPED",
      label: "Dropped",
      color: "destructive",
      badgeClass: "border-destructive/40 bg-destructive/10 text-destructive",
    },
  ]
}

export function getProgressUnitLabel(category: CanonicalMediaCategory): string {
  switch (category) {
    case "anime":
    case "tv":
      return "Episodes"
    case "manga":
      return "Chapters"
    case "movie":
      return "Views"
    case "game":
      return "Hours"
    case "book":
      return "Pages"
    case "music":
      return "Plays"
    case "other":
      return "Progress"
  }
}

export interface MediaListEntryData {
  id?: number
  status: MediaListStatus
  progress: number
  score: number | null
  notes: string | null
  rewatched: number
  private: boolean
  startedAt: string | Date | null
  completedAt: string | Date | null
  rewatchHistory?: Array<{
    startedAt?: string | Date | null
    completedAt?: string | Date | null
    notes?: string | null
  }> | null
  connections?: Record<string, any> | null
  seasons?: Array<{
    id?: number
    seasonNumber: number
    status: string
    progress: number
    score: number | null
    notes: string | null
    rewatched: number
  }>
  watchedEpisodes?: Array<{
    seasonNumber: number
    episodeNumber: number
    watchedAt: string
  }>
  chaptersProgress?: number
  volumesProgress?: number
  reread?: number
  replayed?: number
  rereadHistory?: Array<{
    startedAt?: string | Date | null
    completedAt?: string | Date | null
    notes?: string | null
  }> | null
  replayHistory?: Array<{
    startedAt?: string | Date | null
    completedAt?: string | Date | null
    notes?: string | null
  }> | null
  progressValues?: Record<string, number> | null
  updatedAt?: string | Date | null
}

export function formatDateToYmd(val: unknown): string {
  if (!val) return ""
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10)
    try {
      const d = new Date(val)
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    } catch {
      // ignore
    }
    return val.slice(0, 10)
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }
  try {
    const d = new Date(val as any)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch {
    // ignore
  }
  return ""
}

export function parseRewatchHistory(raw: unknown): Array<{
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  notes?: string | null
}> {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === "string") {
    try {
      let parsed = JSON.parse(raw)
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed)
        } catch {
          // ignore
        }
      }
      if (Array.isArray(parsed)) return parsed
    } catch {
      return []
    }
  }
  return []
}
