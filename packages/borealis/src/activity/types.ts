import {
  DEFAULT_PROFILE_CUSTOMIZATION,
  type UserProfileCustomization,
} from "@NamelessLiberty/shared"

export interface ActivityDiffChange {
  field:
    | "status"
    | "progress"
    | "progressVolumes"
    | "progressPages"
    | "score"
    | "rewatched"
  from?: string | number | null
  to?: string | number | null
}

export interface ActivityUserPreview {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarFrame: string | null
  bannerUrl?: string | null
  bannerOverlayUrl?: string | null
  nameplateUrl?: string | null
  accentColor?: string | null
  bio?: string | null
  statusText?: string | null
  pronouns?: string | null
  displayNameStyle?: any
  showcaseBadgeIds?: number[]
  pinnedSpotlight?: any
  socialLinks?: any[]
}

export interface ActivityItem {
  id: string
  userId: string
  type: string
  mediaType: string | null
  mediaId: number | null
  status: string | null
  progress: number | null
  progressVolumes: number | null
  score: number | null
  title: string | null
  content: string | null
  metadata?: Record<string, any> | null
  isPrivate: boolean
  isSpoiler: boolean
  likeCount: number
  replyCount: number
  isLiked: boolean
  createdAt: string
  user: ActivityUserPreview
  canDelete: boolean
}

export interface ActivityReplyItem {
  id: string
  activityId: string
  userId: string
  content: string
  likeCount: number
  createdAt: string
  updatedAt: string
  user: ActivityUserPreview
  canDelete: boolean
}

export interface ActivityPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export interface ActivityDiffPill {
  key: string
  label: string
  tone: "default" | "success" | "warning" | "danger" | "score" | "info"
}

export function normalizeDisplayScoreValue(score: unknown): number | null {
  if (score === null || score === undefined) return null
  const num = Number(score)
  if (!Number.isFinite(num) || num <= 0) return null
  const normalized = num > 10 ? num / 10 : num
  return Math.round(normalized * 10) / 10
}

export function formatScoreNumber(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

export function formatScoreDisplay(score: unknown): string | null {
  const val = normalizeDisplayScoreValue(score)
  if (val === null) return null
  return `${formatScoreNumber(val)}/10`
}

export function normalizeListStatusValue(status?: string | null): string | null {
  if (!status) return null
  const upper = status.trim().toUpperCase()
  switch (upper) {
    case "CURRENT":
    case "WATCHING":
    case "READING":
    case "PLAYING":
    case "LISTENING":
      return "IN_PROGRESS"
    case "PAUSED":
      return "ON_HOLD"
    case "PLANNING":
      return "PLANNED"
    default:
      return upper
  }
}

export function formatStatusLabel(
  status?: string | null,
  mediaType?: string | null
): string {
  const normalized = normalizeListStatusValue(status)
  if (!normalized) return "Updated"
  const mt = mediaType?.toUpperCase()

  switch (normalized) {
    case "IN_PROGRESS":
      if (mt === "MANGA" || mt === "BOOK") return "Reading"
      if (mt === "GAME") return "Playing"
      if (mt === "MUSIC" || mt === "MUSIC_ALBUM" || mt === "MUSIC_TRACK") return "Listening"
      if (mt === "ANIME" || mt === "TV" || mt === "MOVIE") return "Watching"
      return "In Progress"
    case "COMPLETED":
      return "Completed"
    case "ON_HOLD":
      return "On Hold"
    case "DROPPED":
      return "Dropped"
    case "PLANNED":
      if (mt === "MANGA" || mt === "BOOK") return "Plan to Read"
      if (mt === "GAME") return "Plan to Play"
      if (mt === "MUSIC" || mt === "MUSIC_ALBUM" || mt === "MUSIC_TRACK") return "Plan to Listen"
      if (mt === "ANIME" || mt === "TV" || mt === "MOVIE") return "Plan to Watch"
      return "Planned"
    case "MAYBE":
      return "Maybe"
    case "REPEATING":
      if (mt === "MANGA" || mt === "BOOK") return "Rereading"
      if (mt === "GAME") return "Replaying"
      if (mt === "MUSIC" || mt === "MUSIC_ALBUM" || mt === "MUSIC_TRACK") return "Relistening"
      if (mt === "ANIME" || mt === "TV" || mt === "MOVIE") return "Rewatching"
      return "Re-experiencing"
    default:
      return normalized.charAt(0) + normalized.slice(1).toLowerCase().replace(/_/g, " ")
  }
}

export function getProgressUnitInfo(
  mediaType?: string | null,
  metadata?: Record<string, any> | null
): { short: string; suffix?: string } {
  const mt = mediaType?.toUpperCase()
  switch (mt) {
    case "ANIME":
    case "TV":
    case "MOVIE":
      return { short: "Ep" }
    case "MANGA":
    case "BOOK":
      return { short: "Ch" }
    case "GAME":
      return { short: "hrs", suffix: "hrs" }
    case "MUSIC":
    case "MUSIC_ALBUM":
    case "MUSIC_TRACK":
      return { short: "Track" }
    case "OTHER": {
      const custom =
        typeof metadata?.unitLabel === "string" && metadata.unitLabel.trim()
          ? metadata.unitLabel.trim()
          : "Units"
      return { short: custom, suffix: custom }
    }
    default:
      return { short: "Progress" }
  }
}

function getStatusTone(
  status?: string | null
): ActivityDiffPill["tone"] {
  const norm = normalizeListStatusValue(status)
  if (norm === "COMPLETED") return "success"
  if (norm === "DROPPED") return "danger"
  if (norm === "ON_HOLD") return "warning"
  return "info"
}

export function buildActivityDiffs(item: ActivityItem): ActivityDiffPill[] {
  const pills: ActivityDiffPill[] = []
  const mt = item.mediaType
  const meta = item.metadata ?? null
  const changes = Array.isArray(meta?.changes)
    ? (meta.changes as ActivityDiffChange[])
    : null
  const unitInfo = getProgressUnitInfo(mt, meta)

  const formatProgressPill = (
    fromVal: number | null | undefined,
    toVal: number | null | undefined
  ): string => {
    const toNum = Number(toVal ?? 0)
    const fromNum =
      fromVal !== null && fromVal !== undefined ? Number(fromVal) : null
    const hasDiff = fromNum !== null && fromNum !== toNum && fromNum > 0
    const totalUnits =
      typeof meta?.totalUnits === "number" && meta.totalUnits > 0
        ? meta.totalUnits
        : null

    if (unitInfo.suffix) {
      const core = hasDiff ? `${fromNum} → ${toNum}` : `${toNum}`
      return `${core} ${unitInfo.suffix}`
    }

    const core = hasDiff ? `${fromNum} → ${toNum}` : `${toNum}`
    const totalStr = totalUnits ? ` / ${totalUnits}` : ""
    return `${unitInfo.short} ${core}${totalStr}`
  }

  if (changes && changes.length > 0) {
    changes.forEach((change, idx) => {
      switch (change.field) {
        case "status": {
          const fromStatus = change.from ? String(change.from) : null
          const toStatus = change.to ? String(change.to) : null
          if (!toStatus) break
          const fromLabel = fromStatus ? formatStatusLabel(fromStatus, mt) : null
          const toLabel = formatStatusLabel(toStatus, mt)
          pills.push({
            key: `status-${idx}`,
            label:
              fromLabel && fromStatus !== toStatus
                ? `${fromLabel} → ${toLabel}`
                : toLabel,
            tone: getStatusTone(toStatus),
          })
          break
        }
        case "progress": {
          const toNum = Number(change.to ?? 0)
          const fromNum =
            change.from !== null && change.from !== undefined
              ? Number(change.from)
              : null
          pills.push({
            key: `progress-${idx}`,
            label: formatProgressPill(fromNum, toNum),
            tone: "default",
          })
          break
        }
        case "progressVolumes": {
          const toNum = Number(change.to ?? 0)
          const fromNum =
            change.from !== null && change.from !== undefined
              ? Number(change.from)
              : null
          const totalVols =
            typeof meta?.totalVolumes === "number" && meta.totalVolumes > 0
              ? ` / ${meta.totalVolumes}`
              : ""
          pills.push({
            key: `vol-${idx}`,
            label:
              fromNum !== null && fromNum > 0 && fromNum !== toNum
                ? `Vol ${fromNum} → ${toNum}${totalVols}`
                : `Vol ${toNum}${totalVols}`,
            tone: "default",
          })
          break
        }
        case "progressPages": {
          const toNum = Number(change.to ?? 0)
          const fromNum =
            change.from !== null && change.from !== undefined
              ? Number(change.from)
              : null
          const totalPages =
            typeof meta?.totalPages === "number" && meta.totalPages > 0
              ? ` / ${meta.totalPages}`
              : ""
          pills.push({
            key: `pages-${idx}`,
            label:
              fromNum !== null && fromNum > 0 && fromNum !== toNum
                ? `${fromNum} → ${toNum}${totalPages} p.`
                : `${toNum}${totalPages} p.`,
            tone: "default",
          })
          break
        }
        case "score": {
          const fromNum = normalizeDisplayScoreValue(change.from)
          const toNum = normalizeDisplayScoreValue(change.to)
          if (toNum === null) {
            if (fromNum !== null) {
              pills.push({
                key: `score-${idx}`,
                label: "Rating cleared",
                tone: "default",
              })
            }
          } else {
            const label =
              fromNum !== null && fromNum !== toNum
                ? `★ ${formatScoreNumber(fromNum)} → ${formatScoreNumber(toNum)}`
                : `★ ${formatScoreNumber(toNum)}/10`
            pills.push({
              key: `score-${idx}`,
              label,
              tone: "score",
            })
          }
          break
        }
        case "rewatched": {
          const count = Number(change.to ?? 0)
          const verb =
            mt === "MANGA" || mt === "BOOK"
              ? "Reread"
              : mt === "GAME"
                ? "Replayed"
                : "Rewatched"
          pills.push({
            key: `rewatched-${idx}`,
            label: count > 0 ? `${verb} #${count}` : verb,
            tone: "info",
          })
          break
        }
      }
    })
    return pills
  }

  // Legacy fallback for historical rows stored before metadata.changes
  const normalizedType = item.type
  if (
    item.status &&
    (normalizedType === "LIST_ITEM_ADDED" ||
      normalizedType === "LIST_STATUS_UPDATED" ||
      normalizedType === "LIST_COMPLETED" ||
      normalizedType === "LIST_REWATCH_STARTED")
  ) {
    const prevStatus = meta?.prevStatus ? String(meta.prevStatus) : null
    const prevLabel = prevStatus ? formatStatusLabel(prevStatus, mt) : null
    const nextLabel = formatStatusLabel(item.status, mt)
    pills.push({
      key: "legacy-status",
      label:
        prevLabel && prevStatus !== item.status
          ? `${prevLabel} → ${nextLabel}`
          : nextLabel,
      tone: getStatusTone(item.status),
    })
  }

  if (
    item.progress !== null &&
    item.progress !== undefined &&
    item.progress > 0 &&
    normalizedType !== "LIST_SCORE_UPDATED" &&
    normalizedType !== "LIST_ITEM_REMOVED"
  ) {
    pills.push({
      key: "legacy-progress",
      label: formatProgressPill(meta?.prevProgress, item.progress),
      tone: "default",
    })
  }

  if (
    item.progressVolumes !== null &&
    item.progressVolumes !== undefined &&
    item.progressVolumes > 0 &&
    normalizedType !== "LIST_SCORE_UPDATED" &&
    normalizedType !== "LIST_ITEM_REMOVED"
  ) {
    const prevVol =
      meta?.prevProgressVolumes !== null && meta?.prevProgressVolumes !== undefined
        ? Number(meta.prevProgressVolumes)
        : null
    pills.push({
      key: "legacy-vol",
      label:
        prevVol !== null && prevVol > 0 && prevVol !== item.progressVolumes
          ? `Vol ${prevVol} → ${item.progressVolumes}`
          : `Vol ${item.progressVolumes}`,
      tone: "default",
    })
  }

  if (
    typeof meta?.progressPages === "number" &&
    meta.progressPages > 0 &&
    normalizedType !== "LIST_SCORE_UPDATED"
  ) {
    const prevPages =
      typeof meta?.prevProgressPages === "number" ? meta.prevProgressPages : null
    pills.push({
      key: "legacy-pages",
      label:
        prevPages !== null && prevPages > 0 && prevPages !== meta.progressPages
          ? `${prevPages} → ${meta.progressPages} p.`
          : `${meta.progressPages} p.`,
      tone: "default",
    })
  }

  const scoreVal = normalizeDisplayScoreValue(meta?.exactScore ?? item.score)
  if (
    scoreVal !== null &&
    (normalizedType === "LIST_SCORE_UPDATED" ||
      normalizedType === "LIST_COMPLETED" ||
      normalizedType === "LIST_ITEM_ADDED" ||
      normalizedType === "REVIEW_POSTED")
  ) {
    const prevScoreVal = normalizeDisplayScoreValue(meta?.prevScore)
    pills.push({
      key: "legacy-score",
      label:
        prevScoreVal !== null && prevScoreVal !== scoreVal
          ? `★ ${formatScoreNumber(prevScoreVal)} → ${formatScoreNumber(scoreVal)}`
          : `★ ${formatScoreNumber(scoreVal)}/10`,
      tone: "score",
    })
  }

  return pills
}

export function buildAuthorProfile(
  user: ActivityUserPreview
): UserProfileCustomization {
  return {
    ...DEFAULT_PROFILE_CUSTOMIZATION,
    displayName: user.displayName || "",
    displayNameStyle:
      user.displayNameStyle || DEFAULT_PROFILE_CUSTOMIZATION.displayNameStyle,
    pronouns: user.pronouns || "",
    statusText: user.statusText || "",
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || null,
    avatarFrame: user.avatarFrame || null,
    bannerUrl: user.bannerUrl || null,
    bannerOverlayUrl: user.bannerOverlayUrl || null,
    nameplateUrl: user.nameplateUrl || null,
    sidebarBannerUrl: user.nameplateUrl || null,
    accentColor: user.accentColor || null,
    showcaseBadgeIds: Array.isArray(user.showcaseBadgeIds)
      ? user.showcaseBadgeIds
      : [],
    pinnedSpotlight: user.pinnedSpotlight || null,
    socialLinks: Array.isArray(user.socialLinks) ? user.socialLinks : [],
  }
}

export function isValidFrameUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false
  const trimmed = url.trim()
  return (
    trimmed !== "" &&
    trimmed !== "none" &&
    (trimmed.startsWith("/") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:"))
  )
}

export function formatRelativeTime(dateInput: string): string {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return ""
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSeconds < 60) return "Just now"
  const diffMins = Math.floor(diffSeconds / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(diffDays > 365 ? { year: "numeric" } : {}),
  })
}

export function formatExactTimestamp(dateInput: string): string {
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

export function resolveCoverUrl(
  coverImage?: string | null,
  apiUrl?: string
): string | null {
  if (!coverImage || typeof coverImage !== "string") return null
  const trimmed = coverImage.trim()
  if (!trimmed || trimmed === "none") return null
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed
  }
  return apiUrl ? `${apiUrl}/${trimmed}` : `/${trimmed}`
}

export function formatMediaTypeBadge(mediaType?: string | null): string | null {
  if (!mediaType) return null
  switch (mediaType.toUpperCase()) {
    case "ANIME":
      return "Anime"
    case "MANGA":
      return "Manga"
    case "MOVIE":
      return "Movie"
    case "TV":
      return "TV"
    case "GAME":
      return "Game"
    case "BOOK":
      return "Book"
    case "MUSIC":
    case "MUSIC_ALBUM":
    case "MUSIC_TRACK":
      return "Music"
    case "OTHER":
      return "Custom"
    default:
      return mediaType
  }
}

