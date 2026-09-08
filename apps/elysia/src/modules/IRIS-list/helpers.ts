import { t } from "@/router"
import type { PrismaClient, MediaType } from "@IRIS/database"
import { NotFound, Forbidden, Unauthorized, BadRequest } from "@/utils/errors"
import { recordMediaListActivity } from "@/services/activity.service.js"

// ============================================================================
// Shared Validation Schemas
// ============================================================================

export const ScoreSchema = t.Optional(
  t.Nullable(
    t.Number({
      minimum: 0,
      maximum: 10,
      description: "User rating float from 0 to 10",
    })
  )
)

export const ConnectionItemSchema = t.Object(
  {
    id: t.Union([t.String(), t.Number()]),
    sync: t.Optional(t.Boolean()),
    progressOffset: t.Optional(t.Number()),
    title: t.Optional(t.Nullable(t.String())),
    cover: t.Optional(t.Nullable(t.String())),
    coverImage: t.Optional(t.Nullable(t.String())),
    year: t.Optional(t.Nullable(t.Number())),
    format: t.Optional(t.Nullable(t.String())),
    externalUrl: t.Optional(t.Nullable(t.String())),
    overrideStatus: t.Optional(t.Boolean()),
    status: t.Optional(t.Nullable(t.String())),
    overrideProgress: t.Optional(t.Boolean()),
    progress: t.Optional(t.Nullable(t.Number())),
    overrideDates: t.Optional(t.Boolean()),
    startedAt: t.Optional(t.Nullable(t.String())),
    completedAt: t.Optional(t.Nullable(t.String())),
    extra: t.Optional(t.Any()),
  },
  { additionalProperties: true }
)

export const ConnectionsSchema = t.Optional(
  t.Nullable(
    t.Record(t.String(), ConnectionItemSchema, {
      description:
        "External provider connections e.g. { simkl: { id: '123', title: '...', cover: '...' } }",
    })
  )
)

export const HistoryEntrySchema = t.Object({
  startedAt: t.Optional(t.Nullable(t.String())),
  completedAt: t.Optional(t.Nullable(t.String())),
  notes: t.Optional(t.Nullable(t.String())),
})

export const HistoryArraySchema = t.Optional(
  t.Nullable(
    t.Array(HistoryEntrySchema, {
      description:
        "History records containing multiple start and completion dates",
    })
  )
)

export const ListQuerySchema = t.Object({
  cursor: t.Optional(
    t.Number({ description: "Entry ID cursor for pagination" })
  ),
  limit: t.Optional(t.Number({ default: 50, minimum: 1, maximum: 100 })),
  status: t.Optional(
    t.String({
      description: "Comma-separated status filter e.g. WATCHING,COMPLETED",
    })
  ),
  mediaFormat: t.Optional(
    t.String({ description: "Comma-separated format filter e.g. TV,MOVIE" })
  ),
  mediaStatus: t.Optional(
    t.String({
      description:
        "Comma-separated release status filter e.g. FINISHED,RELEASING",
    })
  ),
  genres: t.Optional(
    t.String({ description: "Comma-separated genre names or IDs" })
  ),
  year: t.Optional(
    t.String({ description: "Comma-separated release years e.g. 2023,2024" })
  ),
  month: t.Optional(
    t.String({ description: "Comma-separated release months e.g. 1,2,12" })
  ),
  artist: t.Optional(t.String({ description: "Comma-separated artist names" })),
  sortBy: t.Optional(
    t.Union(
      [
        t.Literal("title"),
        t.Literal("score"),
        t.Literal("progress"),
        t.Literal("addedAt"),
        t.Literal("updatedAt"),
      ],
      { default: "updatedAt" }
    )
  ),
  order: t.Optional(
    t.Union([t.Literal("asc"), t.Literal("desc")], { default: "desc" })
  ),
})

export const CustomWatchlistQuerySchema = t.Object({
  cursor: t.Optional(
    t.String({ description: "Entry UUID cursor for pagination" })
  ),
  limit: t.Optional(t.Number({ default: 50, minimum: 1, maximum: 100 })),
  mediaType: t.Optional(
    t.String({ description: "Comma-separated media types e.g. ANIME,MOVIE" })
  ),
  genres: t.Optional(t.String({ description: "Comma-separated genre names" })),
  year: t.Optional(t.String({ description: "Comma-separated release years" })),
  sortBy: t.Optional(
    t.Union([t.Literal("title"), t.Literal("order"), t.Literal("addedAt")], {
      default: "order",
    })
  ),
  order: t.Optional(
    t.Union([t.Literal("asc"), t.Literal("desc")], { default: "asc" })
  ),
})

export const FilterFacetsResponseSchema = t.Object({
  success: t.Boolean(),
  statuses: t.Array(t.Object({ value: t.String(), count: t.Number() })),
  formats: t.Array(t.Object({ value: t.String(), count: t.Number() })),
  genres: t.Array(t.Object({ value: t.String(), count: t.Number() })),
  years: t.Array(t.Object({ value: t.Number(), count: t.Number() })),
  mediaStatuses: t.Optional(
    t.Array(t.Object({ value: t.String(), count: t.Number() }))
  ),
  months: t.Optional(
    t.Array(t.Object({ value: t.Number(), count: t.Number() }))
  ),
  artists: t.Optional(
    t.Array(t.Object({ value: t.String(), count: t.Number() }))
  ),
})

export const QuickAddResponseSchema = t.Object({
  success: t.Boolean(),
  alreadyExists: t.Boolean(),
  message: t.String(),
  entry: t.Optional(t.Nullable(t.Any())),
})

export const IncrementBodySchema = t.Optional(
  t.Object({
    count: t.Optional(t.Number({ default: 1, minimum: 1 })),
    connections: ConnectionsSchema,
  })
)

// ============================================================================
// Authorization & Access Control Helpers
// ============================================================================

export async function resolveTargetUserAndAccess(
  prisma: PrismaClient,
  username: string | undefined,
  session: any
) {
  if (!username) {
    throw new BadRequest("Username is required")
  }

  const dbUser = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, username: true },
  })

  if (!dbUser) {
    throw new NotFound(`User "${username}" not found`)
  }

  const currentUser = session?.isAuthenticated ? session.getUser() : null
  const isOwner = Boolean(
    currentUser &&
    currentUser.username?.toLowerCase() === dbUser.username.toLowerCase()
  )

  return { dbUser, isOwner, currentUser }
}

export function assertIsOwner(isOwner: boolean, username?: string) {
  if (!isOwner) {
    throw new Forbidden(
      `Cannot modify list for user "${username || "unknown"}"`
    )
  }
}

export function requireAuth(session: any) {
  if (!session?.isAuthenticated) {
    throw new Unauthorized("Authentication required to modify list")
  }
}

// ============================================================================
// Query Parsing Helpers
// ============================================================================

export function parseCommaSeparated(val?: unknown): string[] {
  if (!val || typeof val !== "string") return []
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function parseYears(val?: unknown): number[] {
  return parseCommaSeparated(val)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n))
}

export function parseMonths(val?: unknown): number[] {
  return parseCommaSeparated(val)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 12)
}

// ============================================================================
// Media Presentation Select Objects
// ============================================================================

export const animeSelect = {
  id: true,
  titlePrimary: true,
  titleSecondary: true,
  titleNative: true,
  coverImage: true,
  bannerImage: true,
  format: true,
  status: true,
  episodeCount: true,
  averageScore: true,
  startDateYear: true,
  genres: { select: { id: true, name: true } },
  episodes: {
    where: { type: "REGULAR" as const },
    orderBy: { number: "asc" as const },
    select: {
      id: true,
      number: true,
      titlePrimary: true,
      titleSecondary: true,
    },
  },
}

export const mangaSelect = {
  id: true,
  titlePrimary: true,
  titleSecondary: true,
  titleNative: true,
  coverImage: true,
  bannerImage: true,
  format: true,
  status: true,
  chapterCount: true,
  volumeCount: true,
  averageScore: true,
  startDateYear: true,
  genres: { select: { id: true, name: true } },
}

export const movieSelect = {
  id: true,
  titlePrimary: true,
  titleSecondary: true,
  titleNative: true,
  coverImage: true,
  bannerImage: true,
  status: true,
  runtime: true,
  averageScore: true,
  releaseDateYear: true,
  genres: { select: { id: true, name: true } },
}

export const tvSelect = {
  id: true,
  titlePrimary: true,
  titleSecondary: true,
  titleNative: true,
  coverImage: true,
  bannerImage: true,
  status: true,
  episodeCount: true,
  seasonCount: true,
  averageScore: true,
  firstAiredYear: true,
  genres: { select: { id: true, name: true } },
  seasons: {
    orderBy: { seasonNumber: "asc" as const },
    select: {
      id: true,
      seasonNumber: true,
      titlePrimary: true,
      titleSecondary: true,
      episodeCount: true,
    },
  },
}

export const gameSelect = {
  id: true,
  titlePrimary: true,
  titleSecondary: true,
  titleNative: true,
  coverImage: true,
  bannerImage: true,
  status: true,
  averageScore: true,
  releaseDateYear: true,
  genres: { select: { id: true, name: true } },
}

export const bookSelect = {
  id: true,
  titlePrimary: true,
  titleSecondary: true,
  coverImage: true,
  bannerImage: true,
  status: true,
  pageCount: true,
  chapterCount: true,
  volumeCount: true,
  averageScore: true,
  releaseDateYear: true,
  genres: { select: { id: true, name: true } },
}

export const musicSelect = {
  id: true,
  type: true,
  titlePrimary: true,
  titleSecondary: true,
  artistName: true,
  coverImage: true,
  duration: true,
  releaseDateYear: true,
  releaseDateMonth: true,
  recordType: true,
  albumId: true,
  genres: { select: { id: true, name: true } },
  album: {
    select: {
      id: true,
      titlePrimary: true,
      artistName: true,
      coverImage: true,
      releaseDateYear: true,
      releaseDateMonth: true,
      genres: { select: { name: true } },
    },
  },
}

export const musicAlbumSelect = musicSelect
export const musicTrackSelect = musicSelect

// ============================================================================
// Filter Aggregation Helper
// ============================================================================

export function aggregateFacetsFromItems(
  items: Array<{
    status?: string | null
    media?: {
      format?: string | null
      showType?: string | null
      type?: string | null
      status?: string | null
      genres?: Array<{ name: string }> | null
      startDateYear?: number | null
      releaseDateYear?: number | null
      firstAiredYear?: number | null
      releaseDateMonth?: number | null
      startDateMonth?: number | null
      artistName?: string | null
      artist?: string | { name?: string } | null
    } | null
    [key: string]: any
  }>
) {
  const statusCounts = new Map<string, number>()
  const mediaStatusCounts = new Map<string, number>()
  const formatCounts = new Map<string, number>()
  const genreCounts = new Map<string, number>()
  const yearCounts = new Map<number, number>()
  const monthCounts = new Map<number, number>()
  const artistCounts = new Map<string, number>()

  for (const item of items) {
    if (item.status) {
      statusCounts.set(item.status, (statusCounts.get(item.status) || 0) + 1)
    }

    const media =
      (item as any).media ??
      (item as any).anime ??
      (item as any).manga ??
      (item as any).movie ??
      (item as any).tv ??
      (item as any).game ??
      (item as any).book ??
      (item as any).album ??
      (item as any).track ??
      (item as any).music

    if (media) {
      const format =
        media.format || media.showType || media.type || (item as any).itemType
      if (format) {
        formatCounts.set(format, (formatCounts.get(format) || 0) + 1)
      }

      if (media.status) {
        mediaStatusCounts.set(
          media.status,
          (mediaStatusCounts.get(media.status) || 0) + 1
        )
      }

      const itemGenres = [
        ...(media.genres || []),
        ...(media.album?.genres || []),
      ]
      const seenGenresForThisItem = new Set<string>()
      for (const g of itemGenres) {
        if (g?.name && !seenGenresForThisItem.has(g.name)) {
          seenGenresForThisItem.add(g.name)
          genreCounts.set(g.name, (genreCounts.get(g.name) || 0) + 1)
        }
      }

      const yr =
        media.startDateYear ??
        media.releaseDateYear ??
        media.firstAiredYear ??
        media.album?.releaseDateYear

      if (typeof yr === "number" && yr > 0) {
        yearCounts.set(yr, (yearCounts.get(yr) || 0) + 1)
      }

      const mo =
        media.startDateMonth ??
        media.releaseDateMonth ??
        media.album?.releaseDateMonth

      if (typeof mo === "number" && mo >= 1 && mo <= 12) {
        monthCounts.set(mo, (monthCounts.get(mo) || 0) + 1)
      }

      const rawArtist =
        media.artistName ||
        (typeof media.artist === "string"
          ? media.artist
          : media.artist?.name) ||
        media.album?.artistName

      if (
        rawArtist &&
        typeof rawArtist === "string" &&
        rawArtist.trim().length > 0
      ) {
        const trimmed = rawArtist.trim()
        artistCounts.set(trimmed, (artistCounts.get(trimmed) || 0) + 1)
      }
    }
  }

  const statuses = Array.from(statusCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)

  const mediaStatuses = Array.from(mediaStatusCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)

  const formats = Array.from(formatCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)

  const genres = Array.from(genreCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)

  const years = Array.from(yearCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.value - a.value)

  const months = Array.from(monthCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value - b.value)

  const artists = Array.from(artistCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))

  return { statuses, formats, genres, years, mediaStatuses, months, artists }
}

// ============================================================================
// Activity Logging Helper for Entry Mutations
// ============================================================================

export function recordEntryMutationActivity({
  userId,
  mediaType,
  mediaId,
  media,
  existing,
  result,
  payload,
}: {
  userId: string
  mediaType: MediaType
  mediaId: number
  media: {
    titlePrimary?: string | null
    titleSecondary?: string | null
    coverImage?: string | null
    bannerImage?: string | null
    format?: string | null
  } | null
  existing: {
    status?: string | null
    progress?: number | null
    chaptersProgress?: number | null
    score?: number | null
    private?: boolean | null
  } | null
  result: {
    status: string
    progress?: number | null
    chaptersProgress?: number | null
    score?: number | null
    private?: boolean | null
  }
  payload?: any
}) {
  const title =
    media?.titlePrimary || media?.titleSecondary || String(mediaType)
  const isPrivate = result.private ?? false
  const currentProgress = result.progress ?? result.chaptersProgress ?? null
  const oldProgress = existing
    ? (existing.progress ?? existing.chaptersProgress ?? null)
    : null

  if (!existing) {
    recordMediaListActivity({
      userId,
      mediaType,
      mediaId,
      action: "ADDED",
      title,
      coverImage: media?.coverImage,
      bannerImage: media?.bannerImage,
      format: media?.format,
      status: result.status,
      progress: currentProgress,
      score: result.score,
      isPrivate,
    })
    return
  }

  const statusChanged = Boolean(
    payload?.status && payload.status !== existing.status
  )
  const progressChanged = Boolean(
    (payload?.progress !== undefined && payload.progress !== oldProgress) ||
    (payload?.chaptersProgress !== undefined &&
      payload.chaptersProgress !== oldProgress)
  )
  const scoreChanged = Boolean(
    payload?.score !== undefined && payload.score !== existing.score
  )

  if (statusChanged && result.status === "COMPLETED") {
    recordMediaListActivity({
      userId,
      mediaType,
      mediaId,
      action: "COMPLETED",
      title,
      coverImage: media?.coverImage,
      bannerImage: media?.bannerImage,
      format: media?.format,
      status: result.status,
      progress: currentProgress,
      score: result.score,
      prevStatus: existing.status,
      prevProgress: oldProgress,
      prevScore: existing.score,
      isPrivate,
    })
  } else if (statusChanged) {
    recordMediaListActivity({
      userId,
      mediaType,
      mediaId,
      action: "STATUS_CHANGED",
      title,
      coverImage: media?.coverImage,
      bannerImage: media?.bannerImage,
      format: media?.format,
      status: result.status,
      progress: currentProgress,
      score: result.score,
      prevStatus: existing.status,
      prevProgress: oldProgress,
      prevScore: existing.score,
      isPrivate,
    })
  } else if (progressChanged) {
    recordMediaListActivity({
      userId,
      mediaType,
      mediaId,
      action: "PROGRESS_CHANGED",
      title,
      coverImage: media?.coverImage,
      bannerImage: media?.bannerImage,
      format: media?.format,
      status: result.status,
      progress: currentProgress,
      score: result.score,
      prevStatus: existing.status,
      prevProgress: oldProgress,
      prevScore: existing.score,
      isPrivate,
    })
  } else if (scoreChanged) {
    recordMediaListActivity({
      userId,
      mediaType,
      mediaId,
      action: "SCORE_CHANGED",
      title,
      coverImage: media?.coverImage,
      bannerImage: media?.bannerImage,
      format: media?.format,
      status: result.status,
      progress: currentProgress,
      score: result.score,
      prevStatus: existing.status,
      prevProgress: oldProgress,
      prevScore: existing.score,
      isPrivate,
    })
  }
}
