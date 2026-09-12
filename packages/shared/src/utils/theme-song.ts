export interface ParsedThemeSong {
  index?: number
  title: string
  titleClean: string
  titleNative?: string
  artist: string
  artistClean: string
  artistNative?: string
  artistList: string[]
  episodes?: string
  isTvSize: boolean
}

export interface EnrichedThemeSongItem {
  id?: number | null
  text: string
  anime_id?: number | null
  musicId?: number | null
  title?: string | null
  titleNative?: string | null
  artist?: string | null
  episodes?: string | null
  deezerId?: number | null
  deezerUrl?: string | null
  previewUrl?: string | null
  isDirectMatch?: boolean | null
}

/**
 * Parses raw MyAnimeList/AniList theme song strings into clean, structured components.
 * Example inputs:
 * - '#1: "Inori (祈り)" by Chiai Fujikawa (藤川千愛) (eps 2-3, 5, 8-10)'
 * - '#2: "Breathe" by Machico, LIN (ep 4)'
 * - '#4: "¬Ersterbend" by LIN (ep 11)'
 * - '#1: "B no Revenge (Bのリベンジ)" by B-Komachi [Ruby (CV: Yurie Igoma), Kana Arima (CV: Megumi Han), Mem-Cho (CV: Rumi Ookubo)] (ep 1)'
 */
export function parseMalThemeSong(rawText: string): ParsedThemeSong {
  let cleaned = (rawText || "").trim()
  let index: number | undefined

  // 1. Extract and strip leading index (#1:, 1:, OP 1:, ED 2:, OP:, ED:)
  const indexMatch = cleaned.match(/^(?:#?(\d+)|op\s*(\d*)|ed\s*(\d*))\s*:\s*/i)
  if (indexMatch) {
    index = Number(indexMatch[1] || indexMatch[2] || indexMatch[3]) || undefined
    cleaned = cleaned.replace(/^(?:#?\d+|op\s*\d*|ed\s*\d*)\s*:\s*/i, "").trim()
  }

  // 2. Extract and strip trailing episode spans: (eps 2-3, 5, 8-10), [ep 4], (ep 1)
  let episodes: string | undefined
  const epMatch = cleaned.match(
    /\s*(\((?:eps?|episodes?)[^)]*\)|\[(?:eps?|episodes?)[^\]]*\])\s*$/i
  )
  if (epMatch && epMatch[1] !== undefined && epMatch.index !== undefined) {
    episodes = epMatch[1].replace(/^[([)]|[)\]]$/g, "").trim()
    cleaned = cleaned.slice(0, epMatch.index).trim()
  }

  // Check for TV size notation
  const isTvSize = /\b(?:tv\s*size|tv\s*edit|tv\s*ver\.?)\b/i.test(cleaned)

  // 3. Separate Title and Artist: "Title" by Artist
  let title = ""
  let artist = ""

  const quotedMatch = cleaned.match(/^["“「](.+?)["”」]\s*(?:by\s+(.+))?$/i)
  if (quotedMatch && quotedMatch[1] !== undefined) {
    title = quotedMatch[1].trim()
    artist = quotedMatch[2]?.trim() || ""
  } else {
    const byIndex = cleaned.toLowerCase().indexOf(" by ")
    if (byIndex !== -1) {
      title = cleaned
        .substring(0, byIndex)
        .replace(/^["“「]|["”」]$/g, "")
        .trim()
      artist = cleaned.substring(byIndex + 4).trim()
    } else {
      title = cleaned.replace(/^["“「]|["”」]$/g, "").trim()
    }
  }

  // 4. Strip decorative leading symbols (e.g. "¬Ersterbend" -> "Ersterbend")
  const strippedTitle = title.replace(/^[¬~*#\s]+/, "").trim()

  // 5. Bilingual Title: "Inori (祈り)" -> clean: "Inori", native: "祈り"
  const titleParen = strippedTitle.match(/^([^(（]+)[(（]([^)）]+)[)）]$/)
  const titleClean = (titleParen?.[1] || strippedTitle).trim()
  const titleNative = titleParen?.[2]?.trim()

  // 6. Clean artist: strip bracketed cast lists e.g. B-Komachi [Ruby (CV: ...), ...] -> "B-Komachi"
  let artistBase = artist.replace(/\[[^\]]*\]/g, "").trim()

  // Bilingual Artist: "CHANMINA (ちゃんみな)" -> clean: "CHANMINA", native: "ちゃんみな"
  const artistParen = artistBase.match(/^([^(（]+)[(（]([^)）]+)[)）]$/)
  const artistClean = (artistParen?.[1] || artistBase).trim()
  const artistNative = artistParen?.[2]?.trim()

  // 7. Split multiple collaborators ("Machico, LIN" or "feat." / "with" / "&")
  const artistList = artistClean
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bwith\b/i)
    .map((a) => a.replace(/CV\s*:\s*/i, "").trim())
    .filter(Boolean)

  return {
    index,
    title,
    titleClean,
    titleNative,
    artist,
    artistClean,
    artistNative,
    artistList,
    episodes,
    isTvSize,
  }
}

/**
 * Generates an official Deezer web search URL pre-filled for a song and artist.
 */
export function getDeezerFallbackSearchUrl(
  artist?: string | null,
  title?: string | null
): string {
  const query = `${artist || ""} ${title || ""}`.trim()
  return `https://www.deezer.com/search/${encodeURIComponent(query)}`
}
