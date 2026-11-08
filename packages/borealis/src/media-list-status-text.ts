export type ListStatus =
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "DROPPED"
  | "COMPLETED"
  | "PLANNED"
  | "MAYBE"

/**
 * Direct canonical English mapping for user list status.
 * Note: IN_PROGRESS maps dynamically via getMediaListStatusText based on mediaType
 * (Watching, Playing, Reading, Listening).
 */
export const MediaListStatusText: Record<ListStatus, string> = {
  IN_PROGRESS: "Watching",
  ON_HOLD: "Paused",
  DROPPED: "Dropped",
  COMPLETED: "Finished",
  PLANNED: "Planning",
  MAYBE: "Considering",
}

/**
 * Normalizes any raw user list status string into a canonical ListStatus key.
 */
export function normalizeListStatus(
  status?: string | null
): ListStatus | null {
  if (!status) return null
  const norm = String(status).toUpperCase().trim().replace(/[\s-]+/g, "_")

  switch (norm) {
    case "IN_PROGRESS":
    case "WATCHING":
    case "READING":
    case "PLAYING":
    case "LISTENING":
    case "CURRENT":
      return "IN_PROGRESS"
    case "ON_HOLD":
    case "PAUSED":
    case "HOLD":
      return "ON_HOLD"
    case "DROPPED":
    case "STOPPED":
      return "DROPPED"
    case "COMPLETED":
    case "FINISHED":
    case "DONE":
      return "COMPLETED"
    case "PLANNED":
    case "PLAN_TO_WATCH":
    case "PLANNING":
      return "PLANNED"
    case "MAYBE":
    case "CONSIDERING":
      return "MAYBE"
    default:
      return null
  }
}

/**
 * Returns the contextual action verb for IN_PROGRESS based on mediaType.
 */
export function getInProgressVerb(
  mediaType?: string | null
): { text: string; i18nKey: string } {
  const normType = (mediaType || "").toLowerCase().trim()

  if (
    normType === "manga" ||
    normType === "book" ||
    normType === "books" ||
    normType === "novel" ||
    normType === "light_novel"
  ) {
    return { text: "Reading", i18nKey: "READING" }
  }

  if (normType === "game" || normType === "games") {
    return { text: "Playing", i18nKey: "PLAYING" }
  }

  if (
    normType === "music" ||
    normType === "music_track" ||
    normType === "music_album" ||
    normType === "track" ||
    normType === "album"
  ) {
    return { text: "Listening", i18nKey: "LISTENING" }
  }

  // Anime, TV, Movie, Movies, default
  return { text: "Watching", i18nKey: "WATCHING" }
}

/**
 * Returns the localized or formatted text for a user ListStatus.
 *
 * Mappings:
 * - IN_PROGRESS => Watching, Playing, Reading, Listening (based on mediaType)
 * - ON_HOLD => Paused
 * - DROPPED => Dropped
 * - COMPLETED => Finished
 * - PLANNED => Planning
 * - MAYBE => Considering
 *
 * Supports translations under `borealis.components.media.list.status.<KEY>`
 */
export function getMediaListStatusText(
  status?: string | null,
  mediaType?: string | null,
  t?: (key: string) => string
): string {
  const canonical = normalizeListStatus(status)
  if (!canonical) return ""

  let defaultText = MediaListStatusText[canonical]
  let subKey: string = canonical

  if (canonical === "IN_PROGRESS") {
    const verb = getInProgressVerb(mediaType)
    defaultText = verb.text
    subKey = verb.i18nKey
  }

  if (typeof t === "function") {
    const key = `borealis.components.media.list.status.${subKey}`
    const translated = t(key)
    if (translated && translated !== key) {
      return translated
    }

    // Fallback to general canonical key if specific action verb translation doesn't exist
    if (subKey !== canonical) {
      const fallbackKey = `borealis.components.media.list.status.${canonical}`
      const fallbackTrans = t(fallbackKey)
      if (fallbackTrans && fallbackTrans !== fallbackKey) {
        return fallbackTrans
      }
    }
  }

  return defaultText
}

