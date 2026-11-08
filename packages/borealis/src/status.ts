export type { MediaStatus } from "./media-status-text"
export type { ListStatus } from "./media-list-status-text"

export {
  MediaStatusText,
  getMediaStatusText,
  normalizeMediaStatus,
} from "./media-status-text"

export {
  MediaListStatusText,
  getMediaListStatusText,
  normalizeListStatus,
  getInProgressVerb,
} from "./media-list-status-text"

/**
 * Returns Tailwind text color class for a given MediaStatus.
 *
 * Mappings:
 * - RELEASED => text-emerald-400
 * - RELEASING / AIRING => text-white (User explicitly requested white for airing)
 * - UPCOMING => text-amber-400
 * - CANCELLED => text-rose-400
 * - HIATUS => text-orange-400
 * - UNKNOWN => text-zinc-400
 */
export function getMediaStatusColor(
  status?: string | null
): string {
  const norm = String(status || "").toUpperCase().replace(/[\s-]+/g, "_")
  switch (norm) {
    case "RELEASED":
    case "FINISHED":
      return "text-emerald-400"
    case "RELEASING":
    case "AIRING":
    case "PUBLISHING":
    case "CURRENT":
      return "text-white"
    case "UPCOMING":
    case "NOT_YET_RELEASED":
    case "NOT_YET_AIRED":
      return "text-amber-400"
    case "CANCELLED":
    case "CANCELED":
      return "text-rose-400"
    case "HIATUS":
    case "ON_HIATUS":
      return "text-orange-400"
    case "UNKNOWN":
    default:
      return "text-zinc-400"
  }
}

/**
 * Returns Tailwind dot background class for pulse indicator
 */
export function getMediaStatusDotBg(
  status?: string | null
): string {
  const norm = String(status || "").toUpperCase().replace(/[\s-]+/g, "_")
  switch (norm) {
    case "RELEASED":
    case "FINISHED":
      return "bg-emerald-400"
    case "RELEASING":
    case "AIRING":
    case "PUBLISHING":
    case "CURRENT":
      return "bg-white"
    case "UPCOMING":
    case "NOT_YET_RELEASED":
    case "NOT_YET_AIRED":
      return "bg-amber-400"
    case "CANCELLED":
    case "CANCELED":
      return "bg-rose-400"
    case "HIATUS":
    case "ON_HIATUS":
      return "bg-orange-400"
    default:
      return "bg-zinc-400"
  }
}

/**
 * Returns Tailwind text color class for a given user ListStatus.
 *
 * Mappings:
 * - IN_PROGRESS => text-cyan-400
 * - COMPLETED => text-emerald-400
 * - ON_HOLD => text-amber-400
 * - DROPPED => text-rose-400
 * - PLANNED => text-zinc-300
 * - MAYBE => text-purple-400
 */
export function getMediaListStatusColor(
  status?: string | null
): string {
  const norm = String(status || "").toUpperCase().replace(/[\s-]+/g, "_")
  switch (norm) {
    case "IN_PROGRESS":
    case "WATCHING":
    case "READING":
    case "PLAYING":
    case "LISTENING":
      return "text-cyan-400"
    case "COMPLETED":
    case "FINISHED":
      return "text-emerald-400"
    case "ON_HOLD":
    case "PAUSED":
      return "text-amber-400"
    case "DROPPED":
      return "text-rose-400"
    case "PLANNED":
    case "PLANNING":
      return "text-zinc-300"
    case "MAYBE":
    case "CONSIDERING":
      return "text-purple-400"
    default:
      return "text-zinc-400"
  }
}

/**
 * Returns Tailwind dot background class for user ListStatus
 */
export function getMediaListStatusDotBg(
  status?: string | null
): string {
  const norm = String(status || "").toUpperCase().replace(/[\s-]+/g, "_")
  switch (norm) {
    case "IN_PROGRESS":
    case "WATCHING":
    case "READING":
    case "PLAYING":
    case "LISTENING":
      return "bg-cyan-400"
    case "COMPLETED":
    case "FINISHED":
      return "bg-emerald-400"
    case "ON_HOLD":
    case "PAUSED":
      return "bg-amber-400"
    case "DROPPED":
      return "bg-rose-400"
    case "PLANNED":
    case "PLANNING":
      return "bg-zinc-300"
    case "MAYBE":
    case "CONSIDERING":
      return "bg-purple-400"
    default:
      return "bg-zinc-400"
  }
}
