"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useSession } from "@/context/session-context"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { resolveUserId } from "@/lib/user-profile"
import { useUser } from "@/context/user-context"
import dynamic from "next/dynamic"
import {
  getMediaPreferences,
  type UserProfileCustomization,
} from "@IRIS/shared"
import {
  UserListBanner,
  UserListToolbar,
  UserListFilterSheet,
  type UserListFilterState,
  DEFAULT_USER_LIST_FILTER_STATE,
  type UserListFilterFacets,
  type ListStatus,
  type ListViewTab,
  type SortByOption,
  type SortOrderOption,
  getMediaListStatusText,
} from "@Runa/borealis"
import { MediaListGrid } from "./media-list-grid"

const ListCommentsTab = dynamic(
  () => import("./list-comments-tab").then((m) => m.ListCommentsTab),
  { ssr: false }
)
const ListActivityTab = dynamic(
  () => import("./list-activity-tab").then((m) => m.ListActivityTab),
  { ssr: false }
)
const MediaStatsTab = dynamic(
  () => import("./stats/media-stats-tab").then((m) => m.MediaStatsTab),
  { ssr: false }
)
const CreateOtherItemDialog = dynamic(
  () =>
    import("./other/create-other-item-dialog").then(
      (m) => m.CreateOtherItemDialog
    ),
  { ssr: false }
)
import { IconPlus } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { invalidateClientStats } from "./stats/media-stats-tab"
import { useEncryption } from "@/context/encryption-context"
import { deriveVaultKey, safeDecryptText } from "@/lib/client-encryption"
import type {
  MediaListType,
  StatusKey,
  ListEntryData,
} from "./types"

export interface UserListViewProps {
  username: string
  userId?: string
  mediaType: MediaListType
  initialProfile?: UserProfileCustomization | null
}

const DEFAULT_FACETS: UserListFilterFacets = {
  statuses: [],
  formats: [],
  genres: [],
  years: [],
  mediaStatuses: [],
  priorities: [],
  connections: [],
  companies: [],
  seasons: [],
  countries: [],
}

function matchesMediaSearch(
  media: ListEntryData["media"],
  query: string
): boolean {
  if (!query) return true

  // Direct checks across all titles, Romanizations, and names
  if (media.titlePrimary && media.titlePrimary.toLowerCase().includes(query))
    return true
  if (
    media.titleSecondary &&
    media.titleSecondary.toLowerCase().includes(query)
  )
    return true
  if (media.titleNative && media.titleNative.toLowerCase().includes(query))
    return true
  if (media.titleEnglish && media.titleEnglish.toLowerCase().includes(query))
    return true
  if (media.titleRomaji && media.titleRomaji.toLowerCase().includes(query))
    return true
  if (media.subtitle && media.subtitle.toLowerCase().includes(query))
    return true
  if (media.title && media.title.toLowerCase().includes(query)) return true
  if (media.name && media.name.toLowerCase().includes(query)) return true
  if (media.artist && media.artist.toLowerCase().includes(query)) return true
  if (media.artistName && media.artistName.toLowerCase().includes(query))
    return true
  if (
    Array.isArray(media.synonyms) &&
    media.synonyms.some(
      (s: string) => typeof s === "string" && s.toLowerCase().includes(query)
    )
  ) {
    return true
  }

  return false
}

/**
 * Type-safe dispatcher for Elysia list routes.
 */
function getListResource(mediaType: MediaListType) {
  switch (mediaType) {
    case "anime":
      return elysia.borealis.lists.anime
    case "manga":
      return elysia.borealis.lists.manga
    case "movie":
      return elysia.borealis.lists.movies
    case "tv":
      return elysia.borealis.lists.tv
    case "game":
      return elysia.borealis.lists.games
    case "book":
      return elysia.borealis.lists.books
    case "music":
      return elysia.borealis.lists.music
    case "other":
      return elysia.borealis.lists.other
  }
}

const STATUS_PRIORITY_ORDER: Record<string, number> = {
  IN_PROGRESS: 1,
  WATCHING: 1,
  READING: 1,
  PLAYING: 1,
  LISTENING: 1,
  CURRENT: 1,
  TRACKING: 1,
  ON_HOLD: 2,
  HOLD: 2,
  PAUSED: 2,
  COMPLETED: 3,
  FINISHED: 3,
  DROPPED: 4,
  PLANNED: 5,
  PLANNING: 5,
  MAYBE: 6,
  CONSIDERING: 6,
}

function getStatusOrder(status?: string): number {
  if (!status) return 99
  return STATUS_PRIORITY_ORDER[status.toUpperCase()] ?? 99
}

function sortListItems(
  items: ListEntryData[],
  sortBy: SortByOption,
  sortOrder: SortOrderOption,
  preserveStatusPriority = false
): ListEntryData[] {
  const isAsc = sortOrder === "asc"

  return [...items].sort((a, b) => {
    if (preserveStatusPriority) {
      const orderA = getStatusOrder(a.entry.status)
      const orderB = getStatusOrder(b.entry.status)
      if (orderA !== orderB) {
        return orderA - orderB
      }
    }

    let diff = 0

    switch (sortBy) {
      case "updatedAt": {
        const timeA = new Date(
          a.entry.updatedAt || a.entry.createdAt || 0
        ).getTime()
        const timeB = new Date(
          b.entry.updatedAt || b.entry.createdAt || 0
        ).getTime()
        diff = timeA - timeB
        break
      }
      case "addedAt":
      case "createdAt": {
        const timeA = new Date(a.entry.createdAt || 0).getTime()
        const timeB = new Date(b.entry.createdAt || 0).getTime()
        diff = timeA - timeB
        break
      }
      case "score": {
        const scoreA = a.entry.score ?? -1
        const scoreB = b.entry.score ?? -1
        diff = scoreA - scoreB
        break
      }
      case "progress": {
        const progA = a.entry.progress ?? 0
        const progB = b.entry.progress ?? 0
        diff = progA - progB
        break
      }
      case "priority": {
        const priorityOrder: Record<string, number> = {
          ULTRA: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        }
        const rankA =
          priorityOrder[(a.entry.priority || "LOW").toUpperCase()] ?? 1
        const rankB =
          priorityOrder[(b.entry.priority || "LOW").toUpperCase()] ?? 1
        diff = rankA - rankB
        break
      }
      case "title": {
        const titleA = (
          a.media.titlePrimary ||
          a.media.titleEnglish ||
          a.media.titleRomaji ||
          a.media.title ||
          a.media.name ||
          ""
        ).toLowerCase()
        const titleB = (
          b.media.titlePrimary ||
          b.media.titleEnglish ||
          b.media.titleRomaji ||
          b.media.title ||
          b.media.name ||
          ""
        ).toLowerCase()
        diff = titleA.localeCompare(titleB)
        return isAsc ? diff : -diff
      }
      default: {
        const timeA = new Date(
          a.entry.updatedAt || a.entry.createdAt || 0
        ).getTime()
        const timeB = new Date(
          b.entry.updatedAt || b.entry.createdAt || 0
        ).getTime()
        diff = timeA - timeB
        break
      }
    }

    if (diff !== 0) {
      return isAsc ? diff : -diff
    }

    return isAsc ? a.entry.id - b.entry.id : b.entry.id - a.entry.id
  })
}

export function UserListView({
  username,
  userId,
  mediaType,
  initialProfile,
}: UserListViewProps): React.JSX.Element {
  const { data: session } = useSession()
  const { user: currentUser } = useUser()

  const isOwner = Boolean(
    session?.user?.username &&
      session.user.username.toLowerCase() === username.toLowerCase()
  )

  const resolvedUserId =
    userId ||
    (isOwner
      ? currentUser?.id || (session?.user as any)?.id
      : undefined)

  const [targetUserId, setTargetUserId] = useState<string | undefined>(
    resolvedUserId
  )

  useEffect(() => {
    if (resolvedUserId) {
      setTargetUserId(resolvedUserId)
      return
    }
    let ignore = false
    resolveUserId(username).then((id) => {
      if (!ignore && id) {
        setTargetUserId(id)
      }
    })
    return () => {
      ignore = true
    }
  }, [resolvedUserId, username])

  // Use current user's profile if owner for reactive live updates, else SSR profile
  const profileToDisplay =
    isOwner && currentUser?.profile ? currentUser.profile : initialProfile

  const mediaTitlePreference =
    getMediaPreferences(currentUser?.customization).title || "primary"

  // ---------------------------------------------------------------------------
  // Filter States
  // ---------------------------------------------------------------------------
  const [filterState, setFilterState] = useState<UserListFilterState>(
    DEFAULT_USER_LIST_FILTER_STATE
  )
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortByOption>("updatedAt")
  const [sortOrder, setSortOrder] = useState<SortOrderOption>("desc")
  const [activeTab, setActiveTab] = useState<ListViewTab>("list")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Sync initial tab and search query from URL search parameters (?tab=list & ?q=...)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get("tab")
      if (
        tabParam === "list" ||
        tabParam === "comments" ||
        tabParam === "stats" ||
        tabParam === "activity"
      ) {
        setActiveTab(tabParam)
      }
      const qParam = params.get("q")
      if (qParam) {
        const clean = qParam.trim()
        setSearchQuery(clean)
        setDebouncedSearch(clean)
      }
    }
  }, [])

  // Listen to browser popstate (back/forward) navigation
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get("tab")
      if (
        tabParam === "list" ||
        tabParam === "comments" ||
        tabParam === "stats" ||
        tabParam === "activity"
      ) {
        setActiveTab(tabParam)
      } else {
        setActiveTab("list")
      }
      const qParam = params.get("q") || ""
      setSearchQuery(qParam)
      setDebouncedSearch(qParam.trim())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Debounce search query changes (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Sync debounced search to URL query parameter (?q=...) without full reload
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      const currentQ = url.searchParams.get("q") || ""
      if (debouncedSearch !== currentQ) {
        if (debouncedSearch) {
          url.searchParams.set("q", debouncedSearch)
        } else {
          url.searchParams.delete("q")
        }
        window.history.replaceState({}, "", url.toString())
      }
    }
  }, [debouncedSearch])

  // Update activeTab and sync to URL search params (?tab=list | comments | stats)
  const handleTabChange = useCallback((newTab: ListViewTab) => {
    setActiveTab(newTab)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("tab", newTab)
      if (newTab !== "comments") {
        url.searchParams.delete("page")
      }
      window.history.replaceState({}, "", url.toString())
      const scrollParent = document.querySelector('[data-slot="sidebar-inset"]')
      if (scrollParent) {
        scrollParent.scrollTop = 0
      }
      window.scrollTo(0, 0)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Data States
  // ---------------------------------------------------------------------------
  const [items, setItems] = useState<ListEntryData[]>([])
  const [facets, setFacets] = useState<UserListFilterFacets>(DEFAULT_FACETS)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(false)

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)

  // Request deduplication refs (React 19 StrictMode safety)
  const isFetchingRef = useRef(false)
  const isFetchingMoreRef = useRef(false)
  const lastFetchedItemsKeyRef = useRef<string | null>(null)
  const lastFetchedFacetsKeyRef = useRef<string | null>(null)
  const isFetchingFacetsRef = useRef(false)

  // Client-side zero-knowledge decryption
  const { secretKey, isActive: isVaultActive } = useEncryption()
  const vaultKey = useMemo(
    () => (isVaultActive && secretKey ? deriveVaultKey(secretKey) : null),
    [isVaultActive, secretKey]
  )

  const decryptListItems = useCallback(
    (rawItems: ListEntryData[]): ListEntryData[] => {
      if (!vaultKey) return rawItems
      return rawItems.map((item) => {
        if (item.entry?.notes) {
          const decrypted = safeDecryptText(item.entry.notes, vaultKey)
          if (decrypted !== item.entry.notes) {
            return {
              ...item,
              entry: {
                ...item.entry,
                notes: decrypted,
              },
            }
          }
        }
        return item
      })
    },
    [vaultKey]
  )

  // Re-decrypt items if vault is unlocked after data was already fetched
  useEffect(() => {
    if (vaultKey && items.length > 0) {
      setItems((prev) => decryptListItems(prev))
    }
  }, [vaultKey, decryptListItems])

  // ---------------------------------------------------------------------------
  // 1. Fetch Filter Facets & Counts
  // ---------------------------------------------------------------------------
  const fetchFacets = useCallback(
    async (force = false) => {
      if (!username || !mediaType) return

      const facetsKey = `${username}:${targetUserId || ""}:${mediaType}`
      if (
        !force &&
        (lastFetchedFacetsKeyRef.current === facetsKey ||
          isFetchingFacetsRef.current)
      ) {
        return
      }

      lastFetchedFacetsKeyRef.current = facetsKey
      isFetchingFacetsRef.current = true

      try {
        const resource = getListResource(mediaType)
        const query = targetUserId ? { userId: targetUserId } : undefined
        const { data, error } = await resource.filters.get({ query })
        if (!error && data && data.success) {
          setFacets({
            statuses: data.statuses || [],
            formats: data.formats || [],
            genres: data.genres || [],
            years: data.years || [],
            mediaStatuses: (data as any).mediaStatuses || [],
            priorities: (data as any).priorities || [],
            connections: (data as any).connections || [],
            companies: (data as any).companies || [],
            seasons: (data as any).seasons || [],
            countries: (data as any).countries || [],
            privacyCounts: (data as any).privacyCounts,
            notesCounts: (data as any).notesCounts,
            adultCounts: (data as any).adultCounts,
          })
        }
      } catch {
        // Graceful fallback
      } finally {
        isFetchingFacetsRef.current = false
      }
    },
    [username, targetUserId, mediaType]
  )

  useEffect(() => {
    fetchFacets()
  }, [fetchFacets])

  // ---------------------------------------------------------------------------
  // 2. Fetch Initial / Filtered Items
  // ---------------------------------------------------------------------------
  const fetchItems = useCallback(
    async (force = false) => {
      if (!username || !mediaType) return

      const isMusic = mediaType === "music"
      let statusParam: string | undefined = undefined

      if (!isMusic && filterState.statuses.length > 0) {
        statusParam = filterState.statuses.join(",")
      }

      const formatsParam =
        filterState.formats.length > 0
          ? filterState.formats.join(",")
          : undefined
      const mediaStatusesParam =
        filterState.mediaStatuses.length > 0
          ? filterState.mediaStatuses.join(",")
          : undefined
      const genresParam =
        filterState.genres.length > 0
          ? filterState.genres.join(",")
          : undefined
      const yearsParam =
        filterState.years.length > 0
          ? filterState.years.join(",")
          : undefined
      const prioritiesParam =
        filterState.priorities.length > 0
          ? filterState.priorities.join(",")
          : undefined

      const cleanSearch = debouncedSearch.trim()
      const queryKey = `${username}:${targetUserId || ""}:${mediaType}:${statusParam}:${formatsParam}:${mediaStatusesParam}:${genresParam}:${yearsParam}:${prioritiesParam}:${sortBy}:${sortOrder}:${cleanSearch}`

      if (
        !force &&
        (lastFetchedItemsKeyRef.current === queryKey || isFetchingRef.current)
      ) {
        return
      }

      lastFetchedItemsKeyRef.current = queryKey
      isFetchingRef.current = true
      setIsLoading(true)

      try {
        const resource = getListResource(mediaType)

        const { data, error } = await resource.get({
          query: {
            page: 1,
            limit: 100,
            status: statusParam,
            format: formatsParam,
            mediaStatus: mediaStatusesParam,
            genre: genresParam,
            year: yearsParam,
            priority: prioritiesParam,
            sortBy,
            order: sortOrder,
            q: cleanSearch || undefined,
            userId: targetUserId,
          },
        })

        if (!error && data && data.success) {
          const rawItems = (data.items as ListEntryData[]) || []
          setItems(decryptListItems(rawItems))
          setPage(1)
          setHasMore(Boolean(data.pagination?.hasMore))
          setTotalCount(data.pagination?.total ?? 0)
        } else {
          setItems([])
          setHasMore(false)
        }
      } catch (err) {
        console.error(`[UserListView] Error fetching items:`, err)
        setItems([])
        setHasMore(false)
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [
      username,
      targetUserId,
      mediaType,
      filterState.statuses,
      filterState.formats,
      filterState.mediaStatuses,
      filterState.genres,
      filterState.years,
      filterState.priorities,
      sortBy,
      sortOrder,
      debouncedSearch,
      decryptListItems,
    ]
  )

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // ---------------------------------------------------------------------------
  // 3. Infinite Scrolling (Fetch Next Page)
  // ---------------------------------------------------------------------------
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isFetchingMoreRef.current || isLoading) return
    isFetchingMoreRef.current = true
    setIsLoadingMore(true)

    try {
      const resource = getListResource(mediaType)

      const isMusic = mediaType === "music"
      let statusParam: string | undefined = undefined

      if (!isMusic && filterState.statuses.length > 0) {
        statusParam = filterState.statuses.join(",")
      }

      const formatsParam =
        filterState.formats.length > 0
          ? filterState.formats.join(",")
          : undefined
      const mediaStatusesParam =
        filterState.mediaStatuses.length > 0
          ? filterState.mediaStatuses.join(",")
          : undefined
      const genresParam =
        filterState.genres.length > 0
          ? filterState.genres.join(",")
          : undefined
      const yearsParam =
        filterState.years.length > 0
          ? filterState.years.join(",")
          : undefined
      const prioritiesParam =
        filterState.priorities.length > 0
          ? filterState.priorities.join(",")
          : undefined

      const cleanSearch = debouncedSearch.trim()
      const nextPage = page + 1
      const { data, error } = await resource.get({
        query: {
          page: nextPage,
          limit: 100,
          status: statusParam,
          format: formatsParam,
          mediaStatus: mediaStatusesParam,
          genre: genresParam,
          year: yearsParam,
          priority: prioritiesParam,
          sortBy,
          order: sortOrder,
          q: cleanSearch || undefined,
          userId: targetUserId,
        },
      })

      if (!error && data && data.success) {
        const newItems = (data.items as ListEntryData[]) || []
        setItems((prev) => [...prev, ...decryptListItems(newItems)])
        setPage(nextPage)
        setHasMore(Boolean(data.pagination?.hasMore))
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
      isFetchingMoreRef.current = false
    }
  }, [
    hasMore,
    isLoading,
    mediaType,
    filterState.statuses,
    filterState.formats,
    filterState.mediaStatuses,
    filterState.genres,
    filterState.years,
    filterState.priorities,
    debouncedSearch,
    page,
    sortBy,
    sortOrder,
    targetUserId,
    decryptListItems,
  ])

  // ---------------------------------------------------------------------------
  // 3b. Background Pre-fetching for Personal Lists
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (filterState.statuses.length > 0 || debouncedSearch.trim()) return
    if (!hasMore || isLoading || isLoadingMore || isFetchingMoreRef.current)
      return
    if (items.length >= 1000) return

    const timer = setTimeout(() => {
      handleLoadMore()
    }, 60)

    return () => clearTimeout(timer)
  }, [
    filterState.statuses,
    debouncedSearch,
    hasMore,
    isLoading,
    isLoadingMore,
    items.length,
    handleLoadMore,
  ])

  // ---------------------------------------------------------------------------
  // 4. Quick Increment (+1) Handler for Owner
  // ---------------------------------------------------------------------------
  const handleIncrementProgress = useCallback(
    async (item: ListEntryData, count: number) => {
      const entryId = item.entry.id
      const mediaId = item.media.id
      const maxCount: number | null = (() => {
        if (mediaType === "manga") {
          if (
            typeof (item.media as any).chapterCount === "number" &&
            (item.media as any).chapterCount > 0
          ) {
            return (item.media as any).chapterCount
          }
          if (
            typeof (item.media as any).chapters === "number" &&
            (item.media as any).chapters > 0
          ) {
            return (item.media as any).chapters
          }
          return null
        }
        if (mediaType === "anime" || mediaType === "tv") {
          const isOngoing =
            (item.media as any)?.status === "RELEASING" ||
            !(item.media as any)?.episodeCount
          if (isOngoing) return null
          if (
            typeof (item.media as any).episodeCount === "number" &&
            (item.media as any).episodeCount > 0
          ) {
            return (item.media as any).episodeCount
          }
          return null
        }
        if (mediaType === "book") {
          if (
            typeof (item.media as any).chapterCount === "number" &&
            (item.media as any).chapterCount > 0
          ) {
            return (item.media as any).chapterCount
          }
          return null
        }
        return null
      })()

      const currentProgress = item.entry.progress ?? 0
      const nextProgress = currentProgress + count

      if (maxCount !== null && nextProgress > maxCount) {
        toast.info(`Already at maximum progress (${maxCount})`)
        return
      }

      const willComplete = maxCount !== null && nextProgress >= maxCount
      const nextStatus = willComplete ? "COMPLETED" : item.entry.status

      handleItemUpdated(entryId, {
        ...item.entry,
        progress: nextProgress,
        status: nextStatus,
        completedAt: willComplete
          ? new Date().toISOString()
          : item.entry.completedAt,
      })

      try {
        const numMediaId = Number(mediaId)
        let res: { data?: any; error?: any }

        switch (mediaType) {
          case "anime":
            res = await elysia.borealis.lists
              .anime({ animeId: numMediaId })
              .increment.post({ count })
            break
          case "manga":
            res = await elysia.borealis.lists
              .manga({ mangaId: numMediaId })
              .increment.post({ count, type: "chapter" })
            break
          case "tv":
            res = await elysia.borealis.lists
              .tv({ tvId: numMediaId })
              .increment.post({ count })
            break
          case "game":
            res = await elysia.borealis.lists
              .games({ gameId: numMediaId })
              .increment.post({ count })
            break
          case "book":
            res = await elysia.borealis.lists
              .books({ bookId: numMediaId })
              .increment.post({ count, type: "chapter" })
            break
          case "music":
            res = await elysia.borealis.lists
              .music({ musicId: numMediaId })
              .increment.post({ count })
            break
          default:
            res = await elysia.borealis.lists
              .other({ otherId: numMediaId })
              .increment.post({ count })
            break
        }

        if (res?.error) {
          throw new Error(
            res.error.value?.message || "Failed to update progress"
          )
        }

        toast.success(`Progress updated (+${count})`)
        invalidateClientStats(username, mediaType)
        fetchFacets(true)
      } catch (err) {
        console.error("[UserListView] Failed to increment progress:", err)
        toast.error("Failed to update progress")
        fetchItems(true)
      }
    },
    [mediaType, username, fetchFacets, fetchItems]
  )

  // ---------------------------------------------------------------------------
  // 5. Update / Edit Entry Handlers
  // ---------------------------------------------------------------------------
  const handleItemUpdated = useCallback(
    (entryId: number, updatedEntry: any | null) => {
      setItems((prevItems) => {
        if (!updatedEntry) {
          return prevItems.filter((i) => i.entry.id !== entryId)
        }
        return prevItems.map((item) => {
          if (item.entry.id === entryId) {
            return {
              ...item,
              entry: {
                ...item.entry,
                ...updatedEntry,
              },
            }
          }
          return item
        })
      })
    },
    []
  )

  const handleScoreChange = useCallback(
    async (item: ListEntryData, newScore: number | null) => {
      const entryId = item.entry.id
      const numMediaId = Number(
        item.media?.id ||
          (item.entry as any)?.animeId ||
          (item.entry as any)?.mangaId ||
          (item.entry as any)?.tvId ||
          (item.entry as any)?.movieId ||
          (item.entry as any)?.gameId ||
          (item.entry as any)?.bookId
      )

      handleItemUpdated(entryId, {
        ...item.entry,
        score: newScore,
      })

      try {
        let res: { error?: any }
        switch (mediaType) {
          case "anime":
            res = await elysia.borealis.lists
              .anime({ animeId: numMediaId })
              .post({ score: newScore })
            break
          case "manga":
            res = await elysia.borealis.lists
              .manga({ mangaId: numMediaId })
              .post({ score: newScore })
            break
          case "movie":
            res = await elysia.borealis.lists
              .movies({ movieId: numMediaId })
              .post({ score: newScore })
            break
          case "tv":
            res = await elysia.borealis.lists
              .tv({ tvId: numMediaId })
              .post({ score: newScore })
            break
          case "game":
            res = await elysia.borealis.lists
              .games({ gameId: numMediaId })
              .post({ score: newScore })
            break
          case "book":
            res = await elysia.borealis.lists
              .books({ bookId: numMediaId })
              .post({ score: newScore })
            break
          case "music":
            res = await elysia.borealis.lists
              .music({ musicId: numMediaId })
              .post({ score: newScore })
            break
          case "other":
            res = await elysia.borealis.lists
              .other({ otherId: numMediaId })
              .post({ score: newScore })
            break
          default:
            res = {}
            break
        }

        if (res?.error) {
          throw new Error(
            res.error.value?.message || "Failed to update score"
          )
        }
        toast.success(
          newScore !== null ? `Score updated to ${newScore}/10` : "Rating cleared"
        )
        invalidateClientStats(username, mediaType)
      } catch (err) {
        console.error("[UserListView] Failed to update score:", err)
        toast.error("Failed to update score")
        fetchItems(true)
      }
    },
    [handleItemUpdated, mediaType, username, fetchItems]
  )

  const handleStatusChange = useCallback(
    async (item: ListEntryData, newStatus: ListStatus) => {
      const entryId = item.entry.id
      const numMediaId = Number(
        item.media?.id ||
          (item.entry as any)?.animeId ||
          (item.entry as any)?.mangaId ||
          (item.entry as any)?.tvId ||
          (item.entry as any)?.movieId ||
          (item.entry as any)?.gameId ||
          (item.entry as any)?.bookId
      )

      handleItemUpdated(entryId, {
        ...item.entry,
        status: newStatus,
      })

      try {
        let res: { error?: any }
        switch (mediaType) {
          case "anime":
            res = await elysia.borealis.lists
              .anime({ animeId: numMediaId })
              .post({ status: newStatus })
            break
          case "manga":
            res = await elysia.borealis.lists
              .manga({ mangaId: numMediaId })
              .post({ status: newStatus })
            break
          case "movie":
            res = await elysia.borealis.lists
              .movies({ movieId: numMediaId })
              .post({ status: newStatus })
            break
          case "tv":
            res = await elysia.borealis.lists
              .tv({ tvId: numMediaId })
              .post({ status: newStatus })
            break
          case "game":
            res = await elysia.borealis.lists
              .games({ gameId: numMediaId })
              .post({ status: newStatus })
            break
          case "book":
            res = await elysia.borealis.lists
              .books({ bookId: numMediaId })
              .post({ status: newStatus })
            break
          case "other":
            res = await elysia.borealis.lists
              .other({ otherId: numMediaId })
              .post({ status: newStatus })
            break
          default:
            res = {}
            break
        }

        if (res?.error) {
          throw new Error(
            res.error.value?.message || "Failed to update status"
          )
        }
        toast.success(
          `Status changed to ${getMediaListStatusText(newStatus, mediaType)}`
        )
        invalidateClientStats(username, mediaType)
        fetchFacets(true)
      } catch (err) {
        console.error("[UserListView] Failed to update status:", err)
        toast.error("Failed to update status")
        fetchItems(true)
      }
    },
    [handleItemUpdated, mediaType, username, fetchFacets, fetchItems]
  )

  const handleIncrementVolume = useCallback(
    async (item: ListEntryData, count: number) => {
      const entryId = item.entry.id
      const mediaId = Number(item.media.id)
      const currentVol = item.entry.volumesProgress ?? 0
      const nextVol = currentVol + count

      handleItemUpdated(entryId, {
        ...item.entry,
        volumesProgress: nextVol,
      })

      try {
        if (mediaType === "manga") {
          const { error } = await elysia.borealis.lists
            .manga({ mangaId: mediaId })
            .increment.post({ count, type: "volume" })
          if (error) throw new Error("Failed to increment volume")
        } else if (mediaType === "book") {
          const { error } = await elysia.borealis.lists
            .books({ bookId: mediaId })
            .increment.post({ count, type: "volume" })
          if (error) throw new Error("Failed to increment volume")
        }
        toast.success(`Volume updated (+${count})`)
        invalidateClientStats(username, mediaType)
      } catch {
        toast.error("Failed to update volume")
        fetchItems(true)
      }
    },
    [handleItemUpdated, mediaType, username, fetchItems]
  )

  // ---------------------------------------------------------------------------
  // 6. Comprehensive Client Filtering
  // ---------------------------------------------------------------------------
  const normalizedSearch = searchQuery.trim().toLowerCase()

  const filteredItems = useMemo(() => {
    let result = items

    // 1. Statuses
    if (filterState.statuses.length > 0) {
      const selected = new Set(
        filterState.statuses.map((s) => s.toUpperCase())
      )
      result = result.filter(({ entry }) =>
        selected.has((entry.status || "").toUpperCase())
      )
    }

    // 2. Progress Min / Max
    if (filterState.progressMin !== null && filterState.progressMin !== undefined) {
      result = result.filter(
        ({ entry }) => (entry.progress ?? 0) >= filterState.progressMin!
      )
    }
    if (filterState.progressMax !== null && filterState.progressMax !== undefined) {
      result = result.filter(
        ({ entry }) => (entry.progress ?? 0) <= filterState.progressMax!
      )
    }

    // 3. Secondary Progress (Volumes / Chapters) Min / Max
    if (
      filterState.secondaryProgressMin !== null &&
      filterState.secondaryProgressMin !== undefined
    ) {
      result = result.filter(
        ({ entry }) =>
          (entry.volumesProgress ?? entry.chaptersProgress ?? 0) >=
          filterState.secondaryProgressMin!
      )
    }
    if (
      filterState.secondaryProgressMax !== null &&
      filterState.secondaryProgressMax !== undefined
    ) {
      result = result.filter(
        ({ entry }) =>
          (entry.volumesProgress ?? entry.chaptersProgress ?? 0) <=
          filterState.secondaryProgressMax!
      )
    }

    // 4. Rewatch / Reread / Replay Min / Max
    if (filterState.rewatchMin !== null && filterState.rewatchMin !== undefined) {
      result = result.filter(({ entry }) => {
        const count =
          entry.rewatched ??
          entry.reread ??
          entry.replayed ??
          entry.playCount ??
          0
        return count >= filterState.rewatchMin!
      })
    }
    if (filterState.rewatchMax !== null && filterState.rewatchMax !== undefined) {
      result = result.filter(({ entry }) => {
        const count =
          entry.rewatched ??
          entry.reread ??
          entry.replayed ??
          entry.playCount ??
          0
        return count <= filterState.rewatchMax!
      })
    }

    // 5. Rating / Score Min / Max
    if (filterState.ratingMin !== null && filterState.ratingMin !== undefined) {
      result = result.filter(
        ({ entry }) => (entry.score ?? 0) >= filterState.ratingMin!
      )
    }
    if (filterState.ratingMax !== null && filterState.ratingMax !== undefined) {
      result = result.filter(
        ({ entry }) => (entry.score ?? 0) <= filterState.ratingMax!
      )
    }

    // 6. Priority
    if (filterState.priorities.length > 0) {
      const selectedPriorities = new Set(
        filterState.priorities.map((p) => p.toUpperCase())
      )
      result = result.filter(({ entry }) =>
        selectedPriorities.has((entry.priority || "LOW").toUpperCase())
      )
    }

    // 7. Dates (Started / Completed)
    if (filterState.startedAfter) {
      const afterTime = new Date(filterState.startedAfter).getTime()
      result = result.filter(({ entry }) => {
        if (!entry.startedAt) return false
        return new Date(entry.startedAt).getTime() >= afterTime
      })
    }
    if (filterState.startedBefore) {
      const beforeTime = new Date(filterState.startedBefore).getTime()
      result = result.filter(({ entry }) => {
        if (!entry.startedAt) return false
        return new Date(entry.startedAt).getTime() <= beforeTime
      })
    }
    if (filterState.completedAfter) {
      const afterTime = new Date(filterState.completedAfter).getTime()
      result = result.filter(({ entry }) => {
        if (!entry.completedAt) return false
        return new Date(entry.completedAt).getTime() >= afterTime
      })
    }
    if (filterState.completedBefore) {
      const beforeTime = new Date(filterState.completedBefore).getTime()
      result = result.filter(({ entry }) => {
        if (!entry.completedAt) return false
        return new Date(entry.completedAt).getTime() <= beforeTime
      })
    }

    // 8. Privacy
    if (filterState.privacy === "public") {
      result = result.filter(({ entry }) => !entry.private)
    } else if (filterState.privacy === "private") {
      result = result.filter(({ entry }) => Boolean(entry.private))
    }

    // 9. Notes
    if (filterState.notes === "withNotes") {
      result = result.filter(
        ({ entry }) => Boolean(entry.notes && entry.notes.trim())
      )
    } else if (filterState.notes === "withoutNotes") {
      result = result.filter(
        ({ entry }) => !entry.notes || !entry.notes.trim()
      )
    }

    // 10. Connections
    if (filterState.connections.length > 0) {
      const connSet = new Set(
        filterState.connections.map((c) => c.toLowerCase())
      )
      result = result.filter(({ entry }) => {
        if (!entry.connections || typeof entry.connections !== "object") {
          return false
        }
        return Object.entries(entry.connections).some(
          ([k, v]) => connSet.has(k.toLowerCase()) && Boolean(v)
        )
      })
    }

    // 11. Formats
    if (filterState.formats.length > 0) {
      const lower = new Set(
        filterState.formats.map((f) => f.toLowerCase())
      )
      result = result.filter(({ media }) => {
        const fmt = (
          (media as any)?.format ||
          (media as any)?.type ||
          ""
        ).toLowerCase()
        return fmt && lower.has(fmt)
      })
    }

    // 12. Media Statuses
    if (filterState.mediaStatuses.length > 0) {
      const upper = new Set(
        filterState.mediaStatuses.map((s) => s.toUpperCase())
      )
      result = result.filter(({ media }) => {
        const st = (media as any)?.status?.toUpperCase()
        return st && upper.has(st)
      })
    }

    // 13. Genres
    if (filterState.genres.length > 0) {
      const lowerGenres = new Set(
        filterState.genres.map((g) => g.toLowerCase())
      )
      result = result.filter(({ media }) => {
        const rawGenres = (media as any)?.genres
        if (!Array.isArray(rawGenres)) return false
        return rawGenres.some((g: any) => {
          const name = (typeof g === "string" ? g : g?.name)?.toLowerCase()
          return name && lowerGenres.has(name)
        })
      })
    }

    // 14. Companies (Studios / Publishers / Developers / Label)
    if (filterState.companies.length > 0) {
      const lowerCompanies = new Set(
        filterState.companies.map((c) => c.toLowerCase())
      )
      result = result.filter(({ media }) => {
        const m = media as any
        const studioList: string[] = []
        if (Array.isArray(m.studios)) {
          m.studios.forEach((s: any) => {
            const name = typeof s === "string" ? s : s?.studio?.name || s?.name
            if (name) studioList.push(name.toLowerCase())
          })
        }
        if (m.publisher) studioList.push(String(m.publisher).toLowerCase())
        if (m.developer) studioList.push(String(m.developer).toLowerCase())
        if (m.label) studioList.push(String(m.label).toLowerCase())
        return studioList.some((c) => lowerCompanies.has(c))
      })
    }

    // 15. Series Progress (Episodes / Chapters) Min / Max
    if (
      filterState.seriesProgressMin !== null &&
      filterState.seriesProgressMin !== undefined
    ) {
      result = result.filter(({ media }) => {
        const units =
          (media as any)?.episodes ??
          (media as any)?.episodeCount ??
          (media as any)?.chapters ??
          (media as any)?.chapterCount ??
          0
        return units >= filterState.seriesProgressMin!
      })
    }
    if (
      filterState.seriesProgressMax !== null &&
      filterState.seriesProgressMax !== undefined
    ) {
      result = result.filter(({ media }) => {
        const units =
          (media as any)?.episodes ??
          (media as any)?.episodeCount ??
          (media as any)?.chapters ??
          (media as any)?.chapterCount ??
          0
        return units <= filterState.seriesProgressMax!
      })
    }

    // 15b. Series Secondary Progress (Volumes / Seasons) Min / Max
    if (
      filterState.seriesSecondaryProgressMin !== null &&
      filterState.seriesSecondaryProgressMin !== undefined
    ) {
      result = result.filter(({ media }) => {
        const units =
          (media as any)?.volumes ??
          (media as any)?.volumeCount ??
          (media as any)?.seasons?.length ??
          (media as any)?.seasonCount ??
          0
        return units >= filterState.seriesSecondaryProgressMin!
      })
    }
    if (
      filterState.seriesSecondaryProgressMax !== null &&
      filterState.seriesSecondaryProgressMax !== undefined
    ) {
      result = result.filter(({ media }) => {
        const units =
          (media as any)?.volumes ??
          (media as any)?.volumeCount ??
          (media as any)?.seasons?.length ??
          (media as any)?.seasonCount ??
          0
        return units <= filterState.seriesSecondaryProgressMax!
      })
    }

    // 16. Adult (SFW / NSFW)
    if (filterState.adult === "sfw") {
      result = result.filter(({ media }) => !(media as any)?.isAdult)
    } else if (filterState.adult === "nsfw") {
      result = result.filter(({ media }) => Boolean((media as any)?.isAdult))
    }

    // 16b. Series Rating Min / Max
    if (
      filterState.seriesScoreMin !== null &&
      filterState.seriesScoreMin !== undefined
    ) {
      result = result.filter(({ media }) => {
        const score = Number(
          (media as any)?.score ??
            (media as any)?.averageScore ??
            (media as any)?.meanScore ??
            0
        )
        return score >= filterState.seriesScoreMin!
      })
    }
    if (
      filterState.seriesScoreMax !== null &&
      filterState.seriesScoreMax !== undefined
    ) {
      result = result.filter(({ media }) => {
        const score = Number(
          (media as any)?.score ??
            (media as any)?.averageScore ??
            (media as any)?.meanScore ??
            0
        )
        return score <= filterState.seriesScoreMax!
      })
    }

    // 16c. Has Anime
    if (filterState.hasAnime === "yes") {
      result = result.filter(
        ({ media }) =>
          Boolean((media as any)?.hasAnime || (media as any)?.animeId)
      )
    } else if (filterState.hasAnime === "no") {
      result = result.filter(
        ({ media }) =>
          !Boolean((media as any)?.hasAnime || (media as any)?.animeId)
      )
    }

    // 16d. Licensed
    if (filterState.licensed === "yes") {
      result = result.filter(({ media }) => Boolean((media as any)?.isLicensed))
    } else if (filterState.licensed === "no") {
      result = result.filter(({ media }) => !(media as any)?.isLicensed)
    }

    // 16e. Staff
    if (filterState.staff && filterState.staff.length > 0) {
      const staffQueries = filterState.staff.map((s) => s.toLowerCase())
      result = result.filter(({ media }) => {
        const staffList = (media as any)?.staff
        if (!Array.isArray(staffList)) return false
        return staffQueries.every((q) =>
          staffList.some((st: any) => {
            const name = (
              st.name ||
              st.person?.name ||
              st.person?.nameNative ||
              ""
            ).toLowerCase()
            return name.includes(q)
          })
        )
      })
    }

    // 17. Years
    if (filterState.years.length > 0) {
      const yearSet = new Set(filterState.years.map(Number))
      result = result.filter(({ media }) => {
        let yr: number | null = null
        if ((media as any)?.startDateYear)
          yr = Number((media as any).startDateYear)
        else if ((media as any)?.releaseDateYear)
          yr = Number((media as any).releaseDateYear)
        else if ((media as any)?.firstAiredYear)
          yr = Number((media as any).firstAiredYear)
        else if ((media as any)?.year) yr = Number((media as any).year)
        else if ((media as any)?.startDate) {
          const parsed = new Date((media as any).startDate).getFullYear()
          if (!isNaN(parsed)) yr = parsed
        }
        return yr !== null && yearSet.has(yr)
      })
    }

    // 18. Seasons
    if (filterState.seasons.length > 0) {
      const seasonSet = new Set(
        filterState.seasons.map((s) => s.toUpperCase())
      )
      result = result.filter(({ media }) => {
        const season = (media as any)?.season?.toUpperCase()
        return season && seasonSet.has(season)
      })
    }

    // 19. Countries
    if (filterState.countries.length > 0) {
      const countrySet = new Set(
        filterState.countries.map((c) => c.toUpperCase())
      )
      result = result.filter(({ media }) => {
        const country = (
          (media as any)?.countryOfOrigin ||
          (media as any)?.country ||
          ""
        ).toUpperCase()
        return country && countrySet.has(country)
      })
    }

    // 20. Search Query Filter
    if (normalizedSearch) {
      result = result.filter(({ media }) =>
        matchesMediaSearch(media, normalizedSearch)
      )
    }

    // 21. Sorting
    return sortListItems(result, sortBy, sortOrder)
  }, [
    items,
    filterState,
    normalizedSearch,
    sortBy,
    sortOrder,
  ])

  const isSearching = Boolean(
    searchQuery.trim() &&
      (isLoading ||
        isFetchingRef.current ||
        searchQuery.trim() !== debouncedSearch)
  )

  const activeGridStatus = useMemo<StatusKey>(() => {
    if (filterState.statuses.length === 1) {
      return filterState.statuses[0] as StatusKey
    }
    return "ALL"
  }, [filterState.statuses])

  return (
    <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
      {/* 1. Header Banner with Avatar and User Info */}
      <UserListBanner
        username={username || "User"}
        profile={profileToDisplay}
        currentMediaType={mediaType}
        className="shrink-0"
      />

      {/* 2. Main Content Area */}
      <main className="w-full flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Sleek Glassmorphic Toolbar */}
        <UserListToolbar
          className="sticky top-2 z-30"
          mediaType={mediaType}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSearching={isSearching}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          filters={filterState}
          onFiltersChange={setFilterState}
          onOpenFilterSheet={() => setIsFilterSheetOpen(true)}
          action={
            mediaType === "other" && isOwner ? (
              <Button
                variant="outline"
                size="sm"
                onPress={() => setIsCreateDialogOpen(true)}
                className="h-8 gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                <IconPlus className="size-3.5" />
                <span>Create Item</span>
              </Button>
            ) : undefined
          }
        />

        {/* Right-sliding Filter Sheet */}
        <UserListFilterSheet
          isOpen={isFilterSheetOpen}
          onOpenChange={setIsFilterSheetOpen}
          filters={filterState}
          onFiltersChange={setFilterState}
          facets={facets}
          mediaType={mediaType}
        />

        {/* Media Grid when List is selected */}
        {activeTab === "list" && (
          <MediaListGrid
            mediaType={mediaType}
            activeStatus={activeGridStatus}
            items={filteredItems}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            isOwner={isOwner}
            onItemUpdated={handleItemUpdated}
            onIncrementProgress={isOwner ? handleIncrementProgress : undefined}
            onIncrementVolume={isOwner ? handleIncrementVolume : undefined}
            onStatusChange={isOwner ? handleStatusChange : undefined}
            onScoreChange={isOwner ? handleScoreChange : undefined}
            mediaTitlePreference={mediaTitlePreference}
            searchQuery={searchQuery.trim()}
            facets={facets as any}
            totalCount={totalCount}
          />
        )}

        {/* Comments Tab */}
        {activeTab === "comments" && (
          <ListCommentsTab
            username={username}
            userId={targetUserId}
            mediaType={mediaType}
            isOwner={isOwner}
          />
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <ListActivityTab
            username={username}
            userId={targetUserId}
            mediaType={mediaType}
            isOwner={isOwner}
          />
        )}

        {/* Detailed Media Stats Tab */}
        {activeTab === "stats" && (
          <MediaStatsTab
            username={username}
            userId={targetUserId}
            mediaType={mediaType}
          />
        )}

        {/* Create Custom Item Modal */}
        {mediaType === "other" && isOwner && (
          <CreateOtherItemDialog
            isOpen={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onSuccess={() => {
              fetchItems(true)
              fetchFacets(true)
            }}
          />
        )}
      </main>
    </div>
  )
}
