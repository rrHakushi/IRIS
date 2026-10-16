import { elysia } from "@/lib/elysia"
import type { BrowseCategory } from "@/lib/browse-history"
import type { SearchResultItem } from "@/components/browse/browse-search-results"
import type { MediaTitleLanguage } from "@IRIS/shared"

export type MusicFilterType = "all" | "tracks" | "albums"

/**
 * Searches the Elysia backend for media matching the query in the given category.
 * Maps varying backend schemas into a normalized SearchResultItem list.
 */
export async function searchCategoryMedia(
  category: BrowseCategory,
  query: string,
  signal?: AbortSignal,
  titlePreference: MediaTitleLanguage = "primary",
  musicType?: MusicFilterType,
  external?: boolean
): Promise<SearchResultItem[]> {
  const cleanQuery = query.trim()
  if (!cleanQuery || cleanQuery.length < 2) {
    return []
  }

  try {
    const { data, error } = await elysia.borealis.search.get({
      query: {
        q: cleanQuery,
        category: category as any,
        limit: 20,
        ...(external ? { external: true } : {}),
      },
      fetch: {
        signal,
        credentials: "include",
      },
    })

    const results = (data as any)?.results ?? (Array.isArray(data) ? data : [])
    if (!error && Array.isArray(results)) {
      return normalizeSearchResults(results, category, titlePreference)
    }

    return []
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return []
    }
    console.error(`[BrowseSearch] Error searching category ${category}:`, err)
    return []
  }
}

export interface FormattableMediaTitle {
  id?: number | string
  titlePrimary?: string | null
  titleSecondary?: string | null
  titleNative?: string | null
  namePrimary?: string | null
  nameNative?: string | null
  name?: string | null
}

export interface RawSearchResult extends FormattableMediaTitle {
  id?: number | string
  coverImage?: string | null
  image?: string | null
  bannerImage?: string | null
  format?: string | null
  type?: "TRACK" | "ALBUM" | string | null
  itemType?: "TRACK" | "ALBUM" | string | null
  artist?: string | null
  artistName?: string | null
  album?: string | null
  albumTitle?: string | null
  albumId?: number | null
  duration?: number | null
  audioPreviewUrl?: string | null
  preview?: string | null
  explicitLyrics?: boolean | null
  explicit_lyrics?: boolean | null
  seasonYear?: number | null
  startDateYear?: number | null
  releaseDateYear?: number | null
  firstAiredYear?: number | null
  queuedForFetch?: boolean
  isAnimationStudio?: boolean
  gender?: string | null
  language?: string | null
  authors?: string[] | null
}

export function formatMediaTitle(
  item: FormattableMediaTitle,
  preference: MediaTitleLanguage = "primary"
): string {
  if (preference === "secondary") {
    return (
      item.titleSecondary ||
      item.titlePrimary ||
      item.namePrimary ||
      item.name ||
      "Untitled"
    )
  }
  if (preference === "native") {
    return (
      item.titleNative ||
      item.nameNative ||
      item.titlePrimary ||
      item.namePrimary ||
      item.name ||
      "Untitled"
    )
  }
  return (
    item.titlePrimary ||
    item.namePrimary ||
    item.name ||
    item.titleSecondary ||
    "Untitled"
  )
}

function normalizeSearchResults(
  items: RawSearchResult[],
  category: BrowseCategory,
  titlePreference: MediaTitleLanguage = "primary"
): SearchResultItem[] {
  return items.map((item) => {
    const title = formatMediaTitle(item, titlePreference)

    const coverImage = item.coverImage || item.image || item.bannerImage || null

    let format: string | null = item.format || null
    let type: "TRACK" | "ALBUM" | undefined = undefined

    if (category === "music") {
      const rawType = String(item.type || item.itemType || "").toUpperCase()
      type = rawType === "ALBUM" ? "ALBUM" : "TRACK"
      if (!format) {
        format = type === "ALBUM" ? "Album" : "Track"
      }
    } else if (!format) {
      if (category === "studios") {
        format = item.isAnimationStudio ? "Anime Studio" : "Studio"
      } else if (category === "characters") {
        format = item.gender || "Character"
      } else if (category === "people") {
        format = item.language || "Person"
      } else if (category === "books" && item.authors?.length) {
        format = item.authors[0] ?? null
      } else if (category === "other") {
        format = "Custom Item"
      }
    }

    const year =
      item.seasonYear ??
      item.startDateYear ??
      item.releaseDateYear ??
      item.firstAiredYear ??
      (item.startDate ? new Date(item.startDate).getFullYear() : null) ??
      null

    return {
      id: item.id ?? 0,
      title,
      coverImage,
      format,
      year,
      queuedForFetch: Boolean(item.queuedForFetch),
      type,
      artist: item.artist || item.artistName || null,
      album: item.album || item.albumTitle || null,
      duration: item.duration ?? null,
      audioPreviewUrl: item.audioPreviewUrl || item.preview || null,
      explicitLyrics: Boolean(item.explicitLyrics || item.explicit_lyrics),
    }
  })
}
