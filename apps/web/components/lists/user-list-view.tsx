"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { useUser } from "@/context/user-context"
import dynamic from "next/dynamic"
import {
  getMediaPreferences,
  type UserProfileCustomization,
} from "@IRIS/shared"
import { UserListBanner } from "./user-list-banner"
import { ListStatusCard } from "./list-status-card"
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
import { invalidateClientStats } from "./stats/media-stats-tab"
import type {
  MediaListType,
  StatusKey,
  SortByOption,
  SortOrderOption,
  ListFilterFacets,
  ListEntryData,
  ListViewTab,
} from "./types"

export interface UserListViewProps {
  username: string
  mediaType: MediaListType
  initialProfile?: UserProfileCustomization | null
}

const DEFAULT_FACETS: ListFilterFacets = {
  statuses: [],
  formats: [],
  genres: [],
  years: [],
  mediaStatuses: [],
  months: [],
  artists: [],
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
 * Golden Rule: Never cast with (elysia as any).
 */
function getListResource(username: string, mediaType: MediaListType) {
  const client = elysia.user({ username }).lists
  switch (mediaType) {
    case "anime":
      return client.anime
    case "manga":
      return client.manga
    case "movie":
      return client.movie
    case "tv":
      return client.tv
    case "game":
      return client.game
    case "book":
      return client.book
    case "music":
      return client.music
  }
}

const STATUS_PRIORITY_ORDER: Record<string, number> = {
  WATCHING: 1,
  READING: 1,
  PLAYING: 1,
  LISTENING: 1,
  CURRENT: 1,
  ON_HOLD: 2,
  HOLD: 2,
  PAUSED: 2,
  COMPLETED: 3,
  FINISHED: 3,
  DROPPED: 4,
  PLANNING: 5,
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
      case "addedAt": {
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
  mediaType,
  initialProfile,
}: UserListViewProps): React.JSX.Element {
  const { data: session } = useSession()
  const { user: currentUser } = useUser()

  const isOwner = Boolean(
    session?.user?.username &&
    session.user.username.toLowerCase() === username.toLowerCase()
  )

  // Use current user's profile if owner for reactive live updates, else SSR profile
  const profileToDisplay =
    isOwner && currentUser?.profile ? currentUser.profile : initialProfile

  const mediaTitlePreference =
    getMediaPreferences(currentUser?.customization).title || "primary"

  // ---------------------------------------------------------------------------
  // Filter States
  // ---------------------------------------------------------------------------
  const [activeStatus, setActiveStatus] = useState<StatusKey>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedFormats, setSelectedFormats] = useState<string[]>([])
  const [selectedMediaStatuses, setSelectedMediaStatuses] = useState<string[]>(
    []
  )
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedYears, setSelectedYears] = useState<string[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedArtists, setSelectedArtists] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortByOption>("updatedAt")
  const [sortOrder, setSortOrder] = useState<SortOrderOption>("desc")
  const [activeTab, setActiveTab] = useState<ListViewTab>("list")

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
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Data States
  // ---------------------------------------------------------------------------
  const [items, setItems] = useState<ListEntryData[]>([])
  const [facets, setFacets] = useState<ListFilterFacets>(DEFAULT_FACETS)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [nextCursor, setNextCursor] = useState<string | number | null>(null)
  const [hasMore, setHasMore] = useState<boolean>(false)

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)

  // Request deduplication refs (React 19 StrictMode safety)
  const isFetchingRef = useRef(false)
  const isFetchingMoreRef = useRef(false)
  const lastFetchedItemsKeyRef = useRef<string | null>(null)
  const lastFetchedFacetsKeyRef = useRef<string | null>(null)
  const isFetchingFacetsRef = useRef(false)

  // ---------------------------------------------------------------------------
  // 1. Fetch Filter Facets & Counts (Guarded against double-fetching on mount)
  // ---------------------------------------------------------------------------
  const fetchFacets = useCallback(
    async (force = false) => {
      if (!username || !mediaType) return

      const facetsKey = `${username}:${mediaType}`
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
        const resource = getListResource(username, mediaType)
        const { data, error } = await resource.filters.get()
        if (!error && data && data.success) {
          setFacets({
            statuses: data.statuses || [],
            formats: data.formats || [],
            genres: data.genres || [],
            years: data.years || [],
            mediaStatuses: data.mediaStatuses || [],
            months: data.months || [],
            artists: data.artists || [],
          })
        }
      } catch {
        // Graceful fallback
      } finally {
        isFetchingFacetsRef.current = false
      }
    },
    [username, mediaType]
  )

  useEffect(() => {
    fetchFacets()
  }, [fetchFacets])

  // ---------------------------------------------------------------------------
  // 2. Fetch Initial / Filtered Items (Guarded against double-fetching on mount)
  // ---------------------------------------------------------------------------
  const fetchItems = useCallback(
    async (force = false) => {
      if (!username || !mediaType) return

      // Format query parameters
      const isMusic = mediaType === "music"
      let statusParam: string | undefined = undefined
      let formatsParam: string | undefined =
        selectedFormats.length > 0 ? selectedFormats.join(",") : undefined

      if (isMusic) {
        if (activeStatus === "ALBUMS") {
          formatsParam = "ALBUM"
        } else if (activeStatus === "TRACKS") {
          formatsParam = "TRACK"
        }
      } else {
        statusParam = activeStatus === "ALL" ? undefined : activeStatus
      }

      const mediaStatusParam =
        selectedMediaStatuses.length > 0
          ? selectedMediaStatuses.join(",")
          : undefined
      const genresParam =
        selectedGenres.length > 0 ? selectedGenres.join(",") : undefined
      const yearsParam =
        selectedYears.length > 0 ? selectedYears.join(",") : undefined
      const monthsParam =
        selectedMonths.length > 0 ? selectedMonths.join(",") : undefined
      const artistsParam =
        selectedArtists.length > 0 ? selectedArtists.join(",") : undefined

      const cleanSearch = debouncedSearch.trim()
      const queryKey = `${username}:${mediaType}:${activeStatus}:${statusParam}:${formatsParam}:${mediaStatusParam}:${genresParam}:${yearsParam}:${monthsParam}:${artistsParam}:${sortBy}:${sortOrder}:${cleanSearch}`

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
        const resource = getListResource(username, mediaType)

        const { data, error } = await resource.get({
          query: {
            limit: 30,
            status: statusParam,
            mediaFormat: formatsParam,
            mediaStatus: mediaStatusParam,
            genres: genresParam,
            year: yearsParam,
            month: monthsParam,
            artist: artistsParam,
            sortBy,
            order: sortOrder,
            q: cleanSearch || undefined,
          },
        })

        if (!error && data && data.success) {
          setItems((data.items as ListEntryData[]) || [])
          setNextCursor(data.pagination?.nextCursor ?? null)
          setHasMore(Boolean(data.pagination?.hasMore))
          setTotalCount(data.pagination?.total ?? 0)
        } else {
          setItems([])
          setNextCursor(null)
          setHasMore(false)
        }
      } catch (err) {
        console.error(`[UserListView] Error fetching items:`, err)
        setItems([])
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [
      username,
      mediaType,
      activeStatus,
      selectedFormats,
      selectedMediaStatuses,
      selectedGenres,
      selectedYears,
      selectedMonths,
      selectedArtists,
      sortBy,
      sortOrder,
      debouncedSearch,
    ]
  )

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // ---------------------------------------------------------------------------
  // 3. Infinite Scrolling (Fetch Next Page)
  // ---------------------------------------------------------------------------
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isFetchingMoreRef.current || isLoading)
      return
    isFetchingMoreRef.current = true
    setIsLoadingMore(true)

    try {
      const resource = getListResource(username, mediaType)

      const isMusic = mediaType === "music"
      let statusParam: string | undefined = undefined
      let formatsParam: string | undefined =
        selectedFormats.length > 0 ? selectedFormats.join(",") : undefined

      if (isMusic) {
        if (activeStatus === "ALBUMS") {
          formatsParam = "ALBUM"
        } else if (activeStatus === "TRACKS") {
          formatsParam = "TRACK"
        }
      } else {
        statusParam = activeStatus === "ALL" ? undefined : activeStatus
      }

      const mediaStatusParam =
        selectedMediaStatuses.length > 0
          ? selectedMediaStatuses.join(",")
          : undefined
      const genresParam =
        selectedGenres.length > 0 ? selectedGenres.join(",") : undefined
      const yearsParam =
        selectedYears.length > 0 ? selectedYears.join(",") : undefined
      const monthsParam =
        selectedMonths.length > 0 ? selectedMonths.join(",") : undefined
      const artistsParam =
        selectedArtists.length > 0 ? selectedArtists.join(",") : undefined

      const cleanSearch = debouncedSearch.trim()
      const { data, error } = await resource.get({
        query: {
          limit: 30,
          cursor: nextCursor ?? undefined,
          status: statusParam,
          mediaFormat: formatsParam,
          mediaStatus: mediaStatusParam,
          genres: genresParam,
          year: yearsParam,
          month: monthsParam,
          artist: artistsParam,
          sortBy,
          order: sortOrder,
          q: cleanSearch || undefined,
        },
      })

      if (!error && data && data.success) {
        const newItems = (data.items as ListEntryData[]) || []
        setItems((prev) => [...prev, ...newItems])
        setNextCursor(data.pagination?.nextCursor ?? null)
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
    username,
    mediaType,
    hasMore,
    nextCursor,
    isLoading,
    activeStatus,
    selectedFormats,
    selectedMediaStatuses,
    selectedGenres,
    selectedYears,
    selectedMonths,
    selectedArtists,
    sortBy,
    sortOrder,
    debouncedSearch,
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
        if (mediaType === "anime") {
          if (
            typeof (item.media as any).episodeCount === "number" &&
            (item.media as any).episodeCount > 0
          ) {
            return (item.media as any).episodeCount
          }
          if (
            Array.isArray((item.media as any).episodes) &&
            (item.media as any).episodes.length > 0
          ) {
            return (item.media as any).episodes.length
          }
          if (
            typeof (item.media as any).episodes === "number" &&
            (item.media as any).episodes > 0
          ) {
            return (item.media as any).episodes
          }
          return null
        }
        if (mediaType === "tv") {
          if (
            typeof (item.media as any).episodeCount === "number" &&
            (item.media as any).episodeCount > 0
          ) {
            return (item.media as any).episodeCount
          }
          if (
            Array.isArray((item.media as any).episodes) &&
            (item.media as any).episodes.length > 0
          ) {
            return (item.media as any).episodes.length
          }
          if (
            typeof (item.media as any).episodes === "number" &&
            (item.media as any).episodes > 0
          ) {
            return (item.media as any).episodes
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
          if (
            typeof (item.media as any).pageCount === "number" &&
            (item.media as any).pageCount > 0
          ) {
            return (item.media as any).pageCount
          }
          return null
        }
        return null
      })()

      const currentProgress =
        mediaType === "manga"
          ? (item.entry.chaptersProgress ?? 0)
          : (item.entry.progress ?? 0)

      if (maxCount !== null && currentProgress >= maxCount) {
        toast.error("Already at maximum progress")
        return
      }

      const nowIso = new Date().toISOString()

      // Optimistic update
      setItems((prev) => {
        const next = prev.map((it) => {
          if (it.entry.id === entryId) {
            if (mediaType === "manga") {
              const rawNext = (it.entry.chaptersProgress ?? 0) + count
              const nextProg =
                maxCount && maxCount > 0 ? Math.min(rawNext, maxCount) : rawNext
              const isCompleted =
                maxCount && maxCount > 0 && nextProg >= maxCount
              return {
                ...it,
                entry: {
                  ...it.entry,
                  chaptersProgress: nextProg,
                  status: isCompleted ? "COMPLETED" : it.entry.status,
                  completedAt: isCompleted
                    ? it.entry.completedAt || nowIso
                    : it.entry.completedAt,
                  updatedAt: nowIso,
                },
              }
            }
            const rawNext = (it.entry.progress ?? 0) + count
            const nextProg =
              maxCount && maxCount > 0 ? Math.min(rawNext, maxCount) : rawNext
            const isCompleted = maxCount && maxCount > 0 && nextProg >= maxCount
            return {
              ...it,
              entry: {
                ...it.entry,
                progress: nextProg,
                status: isCompleted ? "COMPLETED" : it.entry.status,
                completedAt: isCompleted
                  ? it.entry.completedAt || nowIso
                  : it.entry.completedAt,
                updatedAt: nowIso,
              },
            }
          }
          return it
        })
        return sortListItems(next, sortBy, sortOrder, activeStatus === "ALL")
      })

      try {
        if (mediaType === "tv") {
          for (let i = 0; i < count; i++) {
            const { error } = await elysia
              .user({ username })
              .lists.tv({ id: mediaId })
              .increment.post()
            if (error) throw new Error("Failed to update TV progress")
          }
        } else if (mediaType === "music") {
          const isTrack =
            item.entry.itemType === "TRACK" ||
            Boolean(item.entry.trackId && !item.entry.albumId)
          const { error } = await elysia
            .user({ username })
            .lists.music({ id: mediaId })
            .increment.post(
              { count },
              { query: { type: isTrack ? "TRACK" : "ALBUM" } }
            )
          if (error) throw new Error("Failed to update music progress")
        } else {
          const resource = getListResource(username, mediaType)
          const { error } = await (resource as any)({
            id: mediaId,
          }).increment.post({
            count,
          })
          if (error) throw new Error("Failed to update progress")
        }

        toast.success(`Progress updated (+${count})`)
        invalidateClientStats(username, mediaType)
      } catch {
        toast.error("Failed to update progress")
        fetchItems(true)
      }
    },
    [username, mediaType, sortBy, sortOrder, fetchItems]
  )

  // ---------------------------------------------------------------------------
  // 5. Update / Delete Entry from Edit Modal
  // ---------------------------------------------------------------------------
  const handleItemUpdated = useCallback(
    (entryId: number, updatedEntry: any) => {
      invalidateClientStats(username, mediaType)
      if (!updatedEntry) {
        setItems((prev) => prev.filter((i) => i.entry.id !== entryId))
        setTotalCount((prev) => Math.max(0, prev - 1))
        fetchFacets(true)
      } else {
        const nowIso = new Date().toISOString()
        const updatedTimestamp = updatedEntry.updatedAt
          ? String(updatedEntry.updatedAt)
          : nowIso

        setItems((prev) => {
          let next = prev.map((i) => {
            if (i.entry.id === entryId) {
              return {
                ...i,
                entry: {
                  ...i.entry,
                  status: updatedEntry.status,
                  progress: updatedEntry.progress,
                  chaptersProgress:
                    updatedEntry.chaptersProgress ?? updatedEntry.progress,
                  volumesProgress: updatedEntry.volumesProgress,
                  score: updatedEntry.score,
                  notes: updatedEntry.notes,
                  rewatched: updatedEntry.rewatched,
                  private: updatedEntry.private,
                  startedAt: updatedEntry.startedAt
                    ? String(updatedEntry.startedAt)
                    : null,
                  completedAt: updatedEntry.completedAt
                    ? String(updatedEntry.completedAt)
                    : null,
                  updatedAt: updatedTimestamp,
                },
              }
            }
            return i
          })

          // If a specific status tab is active, remove item if its status/format no longer matches
          if (activeStatus !== "ALL") {
            if (mediaType === "music") {
              const itemType = (
                updatedEntry.itemType ||
                (updatedEntry.albumId ? "ALBUM" : "TRACK")
              ).toUpperCase()
              if (activeStatus === "ALBUMS" && itemType !== "ALBUM") {
                next = next.filter((i) => i.entry.id !== entryId)
              } else if (activeStatus === "TRACKS" && itemType !== "TRACK") {
                next = next.filter((i) => i.entry.id !== entryId)
              }
            } else {
              const upperStatus = (updatedEntry.status || "").toUpperCase()
              const upperActive = activeStatus.toUpperCase()
              const isMatch =
                upperStatus === upperActive ||
                ((upperActive === "WATCHING" ||
                  upperActive === "READING" ||
                  upperActive === "PLAYING" ||
                  upperActive === "LISTENING") &&
                  (upperStatus === "WATCHING" ||
                    upperStatus === "READING" ||
                    upperStatus === "PLAYING" ||
                    upperStatus === "LISTENING"))
              if (!isMatch) {
                next = next.filter((i) => i.entry.id !== entryId)
              }
            }
          }

          // Re-sort items by active sortBy (e.g. updatedAt) and sortOrder
          return sortListItems(next, sortBy, sortOrder, activeStatus === "ALL")
        })
        fetchFacets(true)
      }
    },
    [activeStatus, sortBy, sortOrder, fetchFacets]
  )

  // ---------------------------------------------------------------------------
  // 6. Optimistic Client Filtering & Server Search State
  // ---------------------------------------------------------------------------
  const normalizedSearch = searchQuery.trim().toLowerCase()

  const filteredItems = React.useMemo(() => {
    if (!normalizedSearch) return items

    // If server results have already settled for this search query, items are authoritative
    if (debouncedSearch.toLowerCase() === normalizedSearch) {
      return items
    }

    // While user is typing (prior to 300ms debounce response), optimistically filter loaded items
    return items.filter(({ media }) =>
      matchesMediaSearch(media, normalizedSearch)
    )
  }, [items, normalizedSearch, debouncedSearch])

  const isSearching = Boolean(
    searchQuery.trim() &&
    (isLoading ||
      isFetchingRef.current ||
      searchQuery.trim() !== debouncedSearch)
  )

  return (
    <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
      {/* 1. Header Banner with Avatar and User Info */}
      <UserListBanner
        username={username}
        profile={profileToDisplay}
        currentMediaType={mediaType}
      />

      {/* 2. Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Status Card Matching Reference Screenshot */}
        <ListStatusCard
          mediaType={mediaType}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSearching={isSearching}
          facets={facets}
          selectedFormats={selectedFormats}
          onFormatsChange={setSelectedFormats}
          selectedMediaStatuses={selectedMediaStatuses}
          onMediaStatusesChange={setSelectedMediaStatuses}
          selectedGenres={selectedGenres}
          onGenresChange={setSelectedGenres}
          selectedYears={selectedYears}
          onYearsChange={setSelectedYears}
          selectedMonths={selectedMonths}
          onMonthsChange={setSelectedMonths}
          selectedArtists={selectedArtists}
          onArtistsChange={setSelectedArtists}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          totalCount={totalCount}
        />

        {/* Media Grid when List is selected */}
        {activeTab === "list" && (
          <MediaListGrid
            mediaType={mediaType}
            activeStatus={activeStatus}
            items={filteredItems}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            isOwner={isOwner}
            onItemUpdated={handleItemUpdated}
            onIncrementProgress={isOwner ? handleIncrementProgress : undefined}
            mediaTitlePreference={mediaTitlePreference}
            searchQuery={searchQuery.trim()}
          />
        )}

        {/* Comments Tab */}
        {activeTab === "comments" && (
          <ListCommentsTab
            username={username}
            mediaType={mediaType}
            isOwner={isOwner}
          />
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <ListActivityTab
            username={username}
            mediaType={mediaType}
            isOwner={isOwner}
          />
        )}

        {/* Detailed Media Stats Tab */}
        {activeTab === "stats" && (
          <MediaStatsTab username={username} mediaType={mediaType} />
        )}
      </main>
    </div>
  )
}
