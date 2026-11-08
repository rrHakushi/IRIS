export type MediaStatus =
  | "RELEASED"
  | "RELEASING"
  | "UPCOMING"
  | "CANCELLED"
  | "HIATUS"
  | "UNKNOWN"

/**
 * Direct canonical English mapping for media release status
 */
export const MediaStatusText: Record<MediaStatus, string> = {
  RELEASED: "Released",
  RELEASING: "Releasing",
  UPCOMING: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
  UNKNOWN: "Unknown",
}

/**
 * Normalizes any raw status string into a canonical MediaStatus key.
 */
export function normalizeMediaStatus(
  status?: string | null
): MediaStatus {
  if (!status) return "UNKNOWN"
  const norm = String(status).toUpperCase().trim().replace(/[\s-]+/g, "_")

  switch (norm) {
    case "RELEASED":
    case "FINISHED":
    case "COMPLETED":
      return "RELEASED"
    case "RELEASING":
    case "AIRING":
    case "PUBLISHING":
    case "CURRENT":
      return "RELEASING"
    case "UPCOMING":
    case "NOT_YET_RELEASED":
    case "NOT_YET_AIRED":
    case "PLANNED":
      return "UPCOMING"
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED"
    case "HIATUS":
    case "ON_HIATUS":
      return "HIATUS"
    case "UNKNOWN":
    default:
      return "UNKNOWN"
  }
}

/**
 * Returns the localized or formatted text for a given MediaStatus.
 * Supports translation lookup under `borealis.components.media.status.<STATUS>`
 *
 * @param status Raw status string or canonical MediaStatus
 * @param t Optional i18n translation function
 */
export function getMediaStatusText(
  status?: string | null,
  t?: (key: string) => string
): string {
  const canonical = normalizeMediaStatus(status)

  if (typeof t === "function") {
    const key = `borealis.components.media.status.${canonical}`
    const translated = t(key)
    if (translated && translated !== key) {
      return translated
    }
  }

  return MediaStatusText[canonical] ?? "Unknown"
}

