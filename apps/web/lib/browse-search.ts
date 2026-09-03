import { elysia, API_URL } from "@/lib/elysia"
import type { BrowseCategory } from "@/lib/browse-history"
import type { SearchResultItem } from "@/components/browse/browse-search-results"
import type { MediaTitleLanguage } from "@IRIS/shared"

/**
 * Searches the Elysia backend for media matching the query in the given category.
 * Maps varying backend schemas into a normalized SearchResultItem list.
 */
export async function searchCategoryMedia(
  category: BrowseCategory,
  query: string,
  signal?: AbortSignal,
  titlePreference: MediaTitleLanguage = "primary"
): Promise<SearchResultItem[]> {
  const cleanQuery = query.trim()
  if (!cleanQuery || cleanQuery.length < 2) {
    return []
  }

  try {
    // Attempt via Eden Treaty client first
    const client = elysia as any
    if (client.search && client.search[category]) {
      const { data, error } = await client.search[category].get({
        query: { q: cleanQuery },
        fetch: {
          signal,
          credentials: "include",
        },
      })

      if (!error && Array.isArray(data)) {
        return normalizeSearchResults(data, category, titlePreference)
      }
    }

    // Direct fetch fallback
    const res = await fetch(
      `${API_URL}/search/${category}?q=${encodeURIComponent(cleanQuery)}`,
      {
        signal,
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      }
    )

    if (!res.ok) {
      return []
    }

    const json = await res.json()
    const items = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : []

    return normalizeSearchResults(items, category, titlePreference)
  } catch (err: any) {
    if (err.name === "AbortError") {
      return []
    }
    console.error(`[BrowseSearch] Error searching category ${category}:`, err)
    return []
  }
}

export function formatMediaTitle(
  item: any,
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
  items: any[],
  category: BrowseCategory,
  titlePreference: MediaTitleLanguage = "primary"
): SearchResultItem[] {
  return items.map((item) => {
    const title = formatMediaTitle(item, titlePreference)

    const coverImage = item.coverImage || item.image || item.bannerImage || null

    let format: string | null = item.format || null
    if (!format) {
      if (category === "studios") {
        format = item.isAnimationStudio ? "Anime Studio" : "Studio"
      } else if (category === "characters") {
        format = item.gender || "Character"
      } else if (category === "people") {
        format = item.language || "Person"
      } else if (category === "music") {
        format = item.artist || "Track"
      } else if (category === "books" && item.authors?.length) {
        format = item.authors[0]
      }
    }

    const year =
      item.seasonYear ??
      item.startDateYear ??
      item.releaseDateYear ??
      item.firstAiredYear ??
      null

    return {
      id: item.id,
      title,
      coverImage,
      format,
      year,
    }
  })
}
