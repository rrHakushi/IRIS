export type CalendarViewMode = "month" | "week" | "agenda"

export type CalendarMediaType =
  "anime" | "manga" | "movie" | "tv" | "game" | "book" | "music"

export type CalendarMediaTypeFilter = "all" | CalendarMediaType

export interface CalendarItem {
  id: string
  mediaType: CalendarMediaType
  mediaId: number
  title: string
  titleSecondary?: string | null
  titleNative?: string | null
  coverImage?: string | null
  bannerImage?: string | null
  releaseDate: string | Date
  detail?: string | null
  format?: string | null
  status?: string | null
  episodeNumber?: number | null
  seasonNumber?: number | null
  episodeTitle?: string | null
  eventKind?: string | null
  inUserList?: boolean
}

export interface CalendarResponseMeta {
  start: string
  end: string
  total: number
  counts: Record<string, number>
}
