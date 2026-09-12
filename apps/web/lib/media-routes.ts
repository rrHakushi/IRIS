/**
 * Canonical URL slug and link helpers for IRIS List media detail pages (/IRIS-list/[category]/[id]).
 */

/**
 * Maps any media type string (singular, plural, or uppercase enum) to the canonical route slug.
 * e.g. "movie" -> "movies", "game" -> "games", "book" -> "books", "person" -> "people"
 */
export function toMediaCategorySlug(mediaType: string): string {
  const normalized = mediaType.trim().toLowerCase()
  switch (normalized) {
    case "movie":
    case "movies":
      return "movies"
    case "game":
    case "games":
      return "games"
    case "book":
    case "books":
      return "books"
    case "character":
    case "characters":
      return "characters"
    case "person":
    case "people":
      return "people"
    case "studio":
    case "studios":
      return "studios"
    default:
      return normalized
  }
}

export interface MediaDetailHrefOptions {
  format?: string | null
  itemType?: string | null
  trackId?: string | number | null
  albumId?: string | number | null
  queuedForFetch?: boolean
}

/**
 * Constructs the canonical detail page href for any media item in IRIS List.
 * Correctly handles singular media types ("movie" -> "movies", "game" -> "games", "book" -> "books")
 * and resolves music tracks vs albums.
 */
export function getMediaDetailHref(
  mediaType: string,
  mediaId: string | number,
  options?: MediaDetailHrefOptions
): string {
  const category = toMediaCategorySlug(mediaType)
  const query = options?.queuedForFetch ? "?queuedFetch=true" : ""

  if (category === "music") {
    const isTrack =
      options?.format?.toUpperCase() === "TRACK" ||
      options?.itemType?.toUpperCase() === "TRACK" ||
      Boolean(options?.trackId && !options?.albumId)
    const subpath = isTrack ? "tracks" : "albums"
    return `/IRIS-list/music/${subpath}/${mediaId}${query}`
  }

  return `/IRIS-list/${category}/${mediaId}${query}`
}
