/**
 * Media release status enum matching database schema
 */
export type MediaStatus =
  | "RELEASED"
  | "RELEASING"
  | "UPCOMING"
  | "CANCELLED"
  | "HIATUS"
  | "UNKNOWN"

/**
 * User personal list status enum matching database schema
 */
export type ListStatus =
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "DROPPED"
  | "COMPLETED"
  | "PLANNED"
  | "MAYBE"

/**
 * Returns Tailwind text color class for a given MediaStatus
 *
 * @param status MediaStatus enum or string value
 * @returns Tailwind CSS color class (e.g. "text-emerald-400")
 */
export function getMediaStatusColor(
  status?: MediaStatus | string | null
): string {
  const norm = String(status || "").toUpperCase().replace(/\s+/g, "_")
  switch (norm) {
    case "RELEASED":
      return "text-emerald-400"
    case "RELEASING":
    case "AIRING":
      return "text-white"
    case "UPCOMING":
    case "NOT_YET_RELEASED":
      return "text-amber-400"
    case "CANCELLED":
      return "text-rose-400"
    case "HIATUS":
      return "text-orange-400"
    case "UNKNOWN":
    default:
      return "text-zinc-400"
  }
}

/**
 * Returns Tailwind text color class for a given user ListStatus
 *
 * @param status ListStatus enum or string value
 * @returns Tailwind CSS color class (e.g. "text-cyan-400")
 */
export function getMediaListStatusColor(
  status?: ListStatus | string | null
): string {
  const norm = String(status || "").toUpperCase().replace(/\s+/g, "_")
  switch (norm) {
    case "IN_PROGRESS":
      return "text-cyan-400"
    case "COMPLETED":
      return "text-emerald-400"
    case "ON_HOLD":
      return "text-amber-400"
    case "DROPPED":
      return "text-rose-400"
    case "PLANNED":
      return "text-zinc-300"
    case "MAYBE":
      return "text-purple-400"
    default:
      return "text-zinc-400"
  }
}

/**
 * Returns Tailwind dot background class for user ListStatus
 */
export function getMediaListStatusDotBg(
  status?: ListStatus | string | null
): string {
  const norm = String(status || "").toUpperCase().replace(/\s+/g, "_")
  switch (norm) {
    case "IN_PROGRESS":
      return "bg-cyan-400"
    case "COMPLETED":
      return "bg-emerald-400"
    case "ON_HOLD":
      return "bg-amber-400"
    case "DROPPED":
      return "bg-rose-400"
    case "PLANNED":
      return "bg-zinc-300"
    case "MAYBE":
      return "bg-purple-400"
    default:
      return "bg-zinc-400"
  }
}

/**
 * Returns an object with ListStatus as keys and media-specific user-facing labels as values.
 *
 * Examples:
 * - Anime / TV / Movie: IN_PROGRESS => "Watching", ON_HOLD => "Paused", PLANNED => "Planning", etc.
 * - Manga / Book: IN_PROGRESS => "Reading", ON_HOLD => "Paused", PLANNED => "Planning", etc.
 * - Game: IN_PROGRESS => "Playing", ON_HOLD => "Paused", PLANNED => "Planning", etc.
 * - Music: IN_PROGRESS => "Listening", ON_HOLD => "Paused", PLANNED => "Planning", etc.
 * - Other / Default: IN_PROGRESS => "In Progress", ON_HOLD => "Paused", PLANNED => "Planning", etc.
 *
 * @param mediaType media category / type e.g. "ANIME", "anime", "manga", "movie", "tv", "game", "book", "music"
 * @returns Object mapping ListStatus enum keys to status label strings
 */
export function getMediaListStatusText(
  mediaType?: string | null
): Record<ListStatus, string> {
  const norm = (mediaType || "").toLowerCase().trim()
  let inProgressLabel = "In Progress"
  if (
    norm === "anime" ||
    norm === "tv" ||
    norm === "movie" ||
    norm === "movies"
  ) {
    inProgressLabel = "Watching"
  } else if (norm === "manga" || norm === "book" || norm === "books") {
    inProgressLabel = "Reading"
  } else if (norm === "game" || norm === "games") {
    inProgressLabel = "Playing"
  } else if (
    norm === "music" ||
    norm === "music_album" ||
    norm === "music_track" ||
    norm === "track" ||
    norm === "album"
  ) {
    inProgressLabel = "Listening"
  }

  return {
    IN_PROGRESS: inProgressLabel,
    ON_HOLD: "Paused",
    DROPPED: "Dropped",
    COMPLETED: "Finished",
    PLANNED: "Planning",
    MAYBE: "Considering",
  }
}

