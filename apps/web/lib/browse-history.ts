/**
 * Browse history persistence and manipulation utilities.
 * Handles recent search queries (max 5) and visited media items (max 18) per category in localStorage.
 */

export type BrowseCategory =
  | "anime"
  | "manga"
  | "movies"
  | "tv"
  | "games"
  | "books"
  | "music"
  | "characters"
  | "people"
  | "studios"

export const BROWSE_CATEGORIES: {
  key: BrowseCategory
  label: string
  singularLabel: string
  tag: string
}[] = [
  { key: "anime", label: "Anime", singularLabel: "Anime", tag: "@anime" },
  { key: "manga", label: "Manga", singularLabel: "Manga", tag: "@manga" },
  { key: "movies", label: "Movies", singularLabel: "Movie", tag: "@movie" },
  { key: "tv", label: "TV Shows", singularLabel: "TV", tag: "@tv" },
  { key: "games", label: "Games", singularLabel: "Game", tag: "@game" },
  { key: "books", label: "Books", singularLabel: "Book", tag: "@book" },
  { key: "music", label: "Music", singularLabel: "Music", tag: "@music" },
  {
    key: "characters",
    label: "Characters",
    singularLabel: "Character",
    tag: "@character",
  },
  { key: "people", label: "People", singularLabel: "Person", tag: "@person" },
  { key: "studios", label: "Studios", singularLabel: "Studio", tag: "@studio" },
]

export const CATEGORY_TAG_MAP: Record<string, BrowseCategory> = {
  anime: "anime",
  manga: "manga",
  movie: "movies",
  movies: "movies",
  tv: "tv",
  tvshow: "tv",
  tvshows: "tv",
  show: "tv",
  shows: "tv",
  game: "games",
  games: "games",
  book: "books",
  books: "books",
  music: "music",
  character: "characters",
  characters: "characters",
  person: "people",
  people: "people",
  studio: "studios",
  studios: "studios",
}

/**
 * Checks an input query for @category commands (case-insensitive).
 * Returns the matching category, the cleaned query string, and whether a tag was matched.
 */
export function parseCategoryTag(input: string): {
  category: BrowseCategory | null
  cleanQuery: string
  hasTag: boolean
} {
  if (!input.includes("@")) {
    return { category: null, cleanQuery: input, hasTag: false }
  }

  // Check word-bounded @tag e.g. "@anime attack", "attack @movie", or "@tv "
  const tagRegex = /(?:^|\s)@([a-zA-Z0-9]+)(?:\s|$)/i
  const match = input.match(tagRegex)
  if (match) {
    const tag = match[1]!.toLowerCase()
    const category = CATEGORY_TAG_MAP[tag]
    if (category) {
      const cleanQuery = input.replace(tagRegex, " ").trim()
      return { category, cleanQuery, hasTag: true }
    }
  }

  // Also check exact tag match before trailing space e.g. "@anime"
  const exactMatch = input.trim().match(/^@([a-zA-Z0-9]+)$/i)
  if (exactMatch) {
    const tag = exactMatch[1]!.toLowerCase()
    const category = CATEGORY_TAG_MAP[tag]
    if (category) {
      return { category, cleanQuery: "", hasTag: true }
    }
  }

  return { category: null, cleanQuery: input, hasTag: false }
}

export interface VisitedMediaItem {
  id: number | string
  title: string
  coverImage?: string | null
  format?: string | null
  year?: number | string | null
  visitedAt: number
}

export interface CategoryBrowseHistory {
  recentBrowseQueries: string[]
  recentBrowseVisits: VisitedMediaItem[]
}

export type BrowseHistoryStore = Record<BrowseCategory, CategoryBrowseHistory>

export const MAX_RECENT_QUERIES = 5
export const MAX_RECENT_VISITS = 18
export const BROWSE_HISTORY_STORAGE_KEY = "iris_browse_history_v1"
export const BROWSE_HISTORY_EVENT = "iris-browse-history-updated"

export function createEmptyCategoryHistory(): CategoryBrowseHistory {
  return {
    recentBrowseQueries: [],
    recentBrowseVisits: [],
  }
}

export function createInitialBrowseHistory(): BrowseHistoryStore {
  return {
    anime: createEmptyCategoryHistory(),
    manga: createEmptyCategoryHistory(),
    movies: createEmptyCategoryHistory(),
    tv: createEmptyCategoryHistory(),
    games: createEmptyCategoryHistory(),
    books: createEmptyCategoryHistory(),
    music: createEmptyCategoryHistory(),
    characters: createEmptyCategoryHistory(),
    people: createEmptyCategoryHistory(),
    studios: createEmptyCategoryHistory(),
  }
}

// Module-level immutable server snapshot
export const SERVER_BROWSE_HISTORY_SNAPSHOT: BrowseHistoryStore = Object.freeze(
  createInitialBrowseHistory()
)

/**
 * Safely reads the browse history store from localStorage.
 */
export function getStoredBrowseHistory(): BrowseHistoryStore {
  if (typeof window === "undefined" || !window.localStorage) {
    return SERVER_BROWSE_HISTORY_SNAPSHOT
  }

  try {
    const raw = window.localStorage.getItem(BROWSE_HISTORY_STORAGE_KEY)
    if (!raw) return createInitialBrowseHistory()

    const parsed = JSON.parse(raw) as Partial<BrowseHistoryStore>
    const initial = createInitialBrowseHistory()

    for (const cat of BROWSE_CATEGORIES) {
      const storedCat = parsed[cat.key]
      if (storedCat) {
        initial[cat.key] = {
          recentBrowseQueries: Array.isArray(storedCat.recentBrowseQueries)
            ? storedCat.recentBrowseQueries.slice(0, MAX_RECENT_QUERIES)
            : [],
          recentBrowseVisits: Array.isArray(storedCat.recentBrowseVisits)
            ? storedCat.recentBrowseVisits.slice(0, MAX_RECENT_VISITS)
            : [],
        }
      }
    }

    return initial
  } catch (err) {
    console.warn(
      "[BrowseHistory] Failed to read history from localStorage:",
      err
    )
    return createInitialBrowseHistory()
  }
}

/**
 * Persists the browse history to localStorage and emits an update event.
 */
export function persistBrowseHistory(store: BrowseHistoryStore): void {
  if (typeof window === "undefined" || !window.localStorage) return

  try {
    window.localStorage.setItem(
      BROWSE_HISTORY_STORAGE_KEY,
      JSON.stringify(store)
    )
    window.dispatchEvent(
      new CustomEvent(BROWSE_HISTORY_EVENT, { detail: store })
    )
  } catch (err) {
    console.warn(
      "[BrowseHistory] Failed to persist history to localStorage:",
      err
    )
  }
}

/**
 * Adds a search query to the category history (max 5, deduplicated, latest first).
 */
export function addBrowseQueryToStore(
  category: BrowseCategory,
  query: string
): BrowseHistoryStore {
  const clean = query.trim()
  const store = getStoredBrowseHistory()
  if (!clean) return store

  const catHistory = store[category] || createEmptyCategoryHistory()
  const existing = catHistory.recentBrowseQueries.filter(
    (q) => q.toLowerCase() !== clean.toLowerCase()
  )

  const updatedQueries = [clean, ...existing].slice(0, MAX_RECENT_QUERIES)

  const newStore: BrowseHistoryStore = {
    ...store,
    [category]: {
      ...catHistory,
      recentBrowseQueries: updatedQueries,
    },
  }

  persistBrowseHistory(newStore)
  return newStore
}

/**
 * Adds a visited media item to the category history (max 18, deduplicated by id, latest first).
 */
export function addBrowseVisitToStore(
  category: BrowseCategory,
  item: Omit<VisitedMediaItem, "visitedAt"> & { visitedAt?: number }
): BrowseHistoryStore {
  const store = getStoredBrowseHistory()
  const catHistory = store[category] || createEmptyCategoryHistory()
  const visitedItem: VisitedMediaItem = {
    id: item.id,
    title: item.title || "Untitled",
    coverImage: item.coverImage ?? null,
    format: item.format ?? null,
    year: item.year ?? null,
    visitedAt: item.visitedAt ?? Date.now(),
  }

  const existing = catHistory.recentBrowseVisits.filter(
    (v) => String(v.id) !== String(visitedItem.id)
  )

  const updatedVisits = [visitedItem, ...existing].slice(0, MAX_RECENT_VISITS)

  const newStore: BrowseHistoryStore = {
    ...store,
    [category]: {
      ...catHistory,
      recentBrowseVisits: updatedVisits,
    },
  }

  persistBrowseHistory(newStore)
  return newStore
}

/**
 * Removes a single search query from a category's history.
 */
export function removeBrowseQueryFromStore(
  category: BrowseCategory,
  query: string
): BrowseHistoryStore {
  const store = getStoredBrowseHistory()
  const catHistory = store[category] || createEmptyCategoryHistory()
  const updatedQueries = catHistory.recentBrowseQueries.filter(
    (q) => q.toLowerCase() !== query.trim().toLowerCase()
  )

  const newStore: BrowseHistoryStore = {
    ...store,
    [category]: {
      ...catHistory,
      recentBrowseQueries: updatedQueries,
    },
  }

  persistBrowseHistory(newStore)
  return newStore
}

/**
 * Removes a single visited media item from a category's history.
 */
export function removeBrowseVisitFromStore(
  category: BrowseCategory,
  id: number | string
): BrowseHistoryStore {
  const store = getStoredBrowseHistory()
  const catHistory = store[category] || createEmptyCategoryHistory()
  const updatedVisits = catHistory.recentBrowseVisits.filter(
    (v) => String(v.id) !== String(id)
  )

  const newStore: BrowseHistoryStore = {
    ...store,
    [category]: {
      ...catHistory,
      recentBrowseVisits: updatedVisits,
    },
  }

  persistBrowseHistory(newStore)
  return newStore
}

/**
 * Clears both recent queries and recent visits for a single category.
 */
export function clearCategoryHistoryFromStore(
  category: BrowseCategory
): BrowseHistoryStore {
  const store = getStoredBrowseHistory()
  const newStore: BrowseHistoryStore = {
    ...store,
    [category]: createEmptyCategoryHistory(),
  }

  persistBrowseHistory(newStore)
  return newStore
}

/**
 * Clears browse history across all categories.
 */
export function clearAllBrowseHistoryFromStore(): BrowseHistoryStore {
  const newStore = createInitialBrowseHistory()
  persistBrowseHistory(newStore)
  return newStore
}
