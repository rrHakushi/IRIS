"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
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
  userId?: string
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

  const [targetUserId, setTargetUserId] = useState<string | undefined>(resolvedUserId)

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
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Data States
  // ---------------------------------------------------------------------------
  const [items, setItems] = useState<ListEntryData[]>([])
  const [facets, setFacets] = useState<ListFilterFacets>(DEFAULT_FACETS)
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

  // ---------------------------------------------------------------------------
  // 1. Fetch Filter Facets & Counts (Guarded against double-fetching on mount)
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
            months: [],
            artists: [],
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
  // 2. Fetch Initial / Filtered Items (Guarded against double-fetching on mount)
  // ---------------------------------------------------------------------------
  const fetchItems = useCallback(
    async (force = false) => {
      if (!username || !mediaType) return

      // Format query parameters
      const isMusic = mediaType === "music"
      let statusParam: string | undefined = undefined

      if (!isMusic) {
        statusParam = activeStatus === "ALL" ? undefined : activeStatus
      }

      const formatsParam =
        selectedFormats.length > 0 ? selectedFormats.join(",") : undefined
      const mediaStatusesParam =
        selectedMediaStatuses.length > 0 ? selectedMediaStatuses.join(",") : undefined
      const genresParam =
        selectedGenres.length > 0 ? selectedGenres.join(",") : undefined
      const yearsParam =
        selectedYears.length > 0 ? selectedYears.join(",") : undefined
      const cleanSearch = debouncedSearch.trim()
      const queryKey = `${username}:${targetUserId || ""}:${mediaType}:${activeStatus}:${statusParam}:${formatsParam}:${mediaStatusesParam}:${genresParam}:${yearsParam}:${sortBy}:${sortOrder}:${cleanSearch}`

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
            sortBy,
            order: sortOrder,
            q: cleanSearch || undefined,
            userId: targetUserId,
          },
        })

        if (!error && data && data.success) {
          setItems((data.items as ListEntryData[]) || [])
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
      activeStatus,
      selectedFormats,
      selectedMediaStatuses,
      selectedGenres,
      selectedYears,
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
    if (!hasMore || isFetchingMoreRef.current || isLoading)
      return
    isFetchingMoreRef.current = true
    setIsLoadingMore(true)

    try {
      const resource = getListResource(mediaType)

      const isMusic = mediaType === "music"
      let statusParam: string | undefined = undefined

      if (!isMusic) {
        statusParam = activeStatus === "ALL" ? undefined : activeStatus
      }

      const formatsParam =
        selectedFormats.length > 0 ? selectedFormats.join(",") : undefined
      const mediaStatusesParam =
        selectedMediaStatuses.length > 0 ? selectedMediaStatuses.join(",") : undefined
      const genresParam =
        selectedGenres.length > 0 ? selectedGenres.join(",") : undefined
      const yearsParam =
        selectedYears.length > 0 ? selectedYears.join(",") : undefined
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
          sortBy,
          order: sortOrder,
          q: cleanSearch || undefined,
          userId: targetUserId,
        },
      })

      if (!error && data && data.success) {
        const newItems = (data.items as ListEntryData[]) || []
        setItems((prev) => [...prev, ...newItems])
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
    activeStatus,
    selectedFormats,
    selectedMediaStatuses,
    selectedGenres,
    selectedYears,
    debouncedSearch,
    page,
    sortBy,
    sortOrder,
    targetUserId,
  ])

  // ---------------------------------------------------------------------------
  // 3b. Eager Background Pre-fetching for Personal Lists
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Only eager prefetch when on "ALL" status and not actively typing/searching
    if (activeStatus !== "ALL" || debouncedSearch.trim()) return
    if (!hasMore || isLoading || isLoadingMore || isFetchingMoreRef.current)
      return

    // Safety guard: cap continuous eager pre-fetching at 1000 items
    if (items.length >= 1000) return

    const timer = setTimeout(() => {
      handleLoadMore()
    }, 60)

    return () => clearTimeout(timer)
  }, [
    activeStatus,
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
        if (mediaType === "anime") {
          const isOngoing =
            (item.media as any)?.status === "RELEASING" ||
            !(item.media as any)?.episodeCount
          if (isOngoing) {
            return null
          }
          if (
            typeof (item.media as any).episodeCount === "number" &&
            (item.media as any).episodeCount > 0
          ) {
            return (item.media as any).episodeCount
          }
          return null
        }
        if (mediaType === "tv") {
          const isOngoing =
            (item.media as any)?.status === "RELEASING" ||
            (item.media as any)?.status === "RETURNING_SERIES" ||
            !(item.media as any)?.episodeCount
          if (isOngoing) {
            return null
          }
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
          if (
            typeof (item.media as any).pageCount === "number" &&
            (item.media as any).pageCount > 0
          ) {
            return (item.media as any).pageCount
          }
          return null
        }
        if (mediaType === "other") {
          const otherMedia = item.media as any
          const incKey = otherMedia?.incrementFieldKey
          if (!incKey) {
            toast.error("No incrementable field configured for this item")
            return null
          }
          const fieldDef = Array.isArray(otherMedia?.progressFields)
            ? otherMedia.progressFields.find((f: any) => f.key === incKey)
            : null
          if (typeof fieldDef?.max === "number" && fieldDef.max > 0) {
            return fieldDef.max
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
            if (mediaType === "other") {
              const otherMedia = it.media as any
              const incKey = otherMedia?.incrementFieldKey || "progress"
              const existingProgValues = (it.entry as any).progressValues || {}
              const currentVal = Number(existingProgValues[incKey] ?? it.entry.progress ?? 0)
              const rawNext = currentVal + count
              const nextProg = maxCount && maxCount > 0 ? Math.min(rawNext, maxCount) : rawNext
              const isCompleted = maxCount && maxCount > 0 && nextProg >= maxCount
              const updatedProgValues = {
                ...existingProgValues,
                [incKey]: nextProg,
              }
              return {
                ...it,
                entry: {
                  ...it.entry,
                  progress: nextProg,
                  progressValues: updatedProgValues,
                  status: isCompleted ? "COMPLETED" : it.entry.status,
                  completedAt: isCompleted ? it.entry.completedAt || nowIso : it.entry.completedAt,
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
        const numMediaId = Number(mediaId)
        switch (mediaType) {
          case "anime": {
            const { error } = await elysia.borealis.lists.anime({ animeId: numMediaId }).increment.post({ count })
            if (error) throw new Error("Failed to update anime progress")
            break
          }
          case "manga": {
            const { error } = await elysia.borealis.lists.manga({ mangaId: numMediaId }).increment.post({ count, type: "chapter" })
            if (error) throw new Error("Failed to update manga progress")
            break
          }
          case "movie": {
            const { error } = await elysia.borealis.lists.movies({ movieId: numMediaId }).increment.post({ count })
            if (error) throw new Error("Failed to update movie progress")
            break
          }
          case "tv": {
            const { error } = await elysia.borealis.lists.tv({ tvId: numMediaId }).increment.post({ count })
            if (error) throw new Error("Failed to update TV progress")
            break
          }
          case "game": {
            const { error } = await elysia.borealis.lists.games({ gameId: numMediaId }).increment.post({ count })
            if (error) throw new Error("Failed to update game progress")
            break
          }
          case "book": {
            const { error } = await elysia.borealis.lists.books({ bookId: numMediaId }).increment.post({ count, type: "chapter" })
            if (error) throw new Error("Failed to update book progress")
            break
          }
          case "music": {
            const { error } = await elysia.borealis.lists.music({ musicId: numMediaId }).increment.post({ count })
            if (error) throw new Error("Failed to update music progress")
            break
          }
          case "other": {
            const { error } = await elysia.borealis.lists.other({ otherId: numMediaId }).increment.post({ count })
            if (error) throw new Error("Failed to update other progress")
            break
          }
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
              const rewatchedCount =
                updatedEntry.rewatched ??
                updatedEntry.reread ??
                (updatedEntry as any).replayed ??
                0
              const history =
                updatedEntry.rewatchHistory ??
                updatedEntry.rereadHistory ??
                (updatedEntry as any).replayHistory ??
                null
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
                  rewatched: rewatchedCount,
                  reread: updatedEntry.reread ?? rewatchedCount,
                  replayed: (updatedEntry as any).replayed ?? rewatchedCount,
                  rewatchHistory: history,
                  rereadHistory: updatedEntry.rereadHistory ?? history,
                  replayHistory: (updatedEntry as any).replayHistory ?? history,
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
                ((upperActive === "IN_PROGRESS" ||
                  upperActive === "WATCHING" ||
                  upperActive === "READING" ||
                  upperActive === "PLAYING" ||
                  upperActive === "LISTENING" ||
                  upperActive === "TRACKING") &&
                  (upperStatus === "IN_PROGRESS" ||
                    upperStatus === "WATCHING" ||
                    upperStatus === "READING" ||
                    upperStatus === "PLAYING" ||
                    upperStatus === "LISTENING" ||
                    upperStatus === "TRACKING")) ||
                ((upperActive === "PLANNED" || upperActive === "PLANNING") &&
                  (upperStatus === "PLANNED" || upperStatus === "PLANNING"))
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
    let result = items

    // Filter by Formats
    if (selectedFormats.length > 0) {
      const lower = new Set(selectedFormats.map((f) => f.toLowerCase()))
      result = result.filter(({ media }) => {
        const fmt = ((media as any)?.format || (media as any)?.type)?.toLowerCase()
        return fmt && lower.has(fmt)
      })
    }

    // Filter by Media Statuses
    if (selectedMediaStatuses.length > 0) {
      const upper = new Set(selectedMediaStatuses.map((s) => s.toUpperCase()))
      result = result.filter(({ media }) => {
        const st = (media as any)?.status?.toUpperCase()
        return st && upper.has(st)
      })
    }

    // Filter by Genres
    if (selectedGenres.length > 0) {
      const lowerGenres = new Set(selectedGenres.map((g) => g.toLowerCase()))
      result = result.filter(({ media }) => {
        const rawGenres = (media as any)?.genres
        if (!Array.isArray(rawGenres)) return false
        return rawGenres.some((g: any) => {
          const name = (typeof g === "string" ? g : g?.name)?.toLowerCase()
          return name && lowerGenres.has(name)
        })
      })
    }

    // Filter by Years
    if (selectedYears.length > 0) {
      const yearSet = new Set(selectedYears.map(Number))
      result = result.filter(({ media }) => {
        let yr: number | null = null
        if ((media as any)?.startDateYear) yr = Number((media as any).startDateYear)
        else if ((media as any)?.releaseDateYear) yr = Number((media as any).releaseDateYear)
        else if ((media as any)?.firstAiredYear) yr = Number((media as any).firstAiredYear)
        else if ((media as any)?.year) yr = Number((media as any).year)
        else if ((media as any)?.startDate) {
          const parsed = new Date((media as any).startDate).getFullYear()
          if (!isNaN(parsed)) yr = parsed
        }
        return yr !== null && yearSet.has(yr)
      })
    }

    if (!normalizedSearch) return result

    // If server results have already settled for this search query, items are authoritative
    if (debouncedSearch.toLowerCase() === normalizedSearch) {
      return result
    }

    // While user is typing (prior to 300ms debounce response), optimistically filter loaded items
    return result.filter(({ media }) =>
      matchesMediaSearch(media, normalizedSearch)
    )
  }, [
    items,
    selectedFormats,
    selectedMediaStatuses,
    selectedGenres,
    selectedYears,
    normalizedSearch,
    debouncedSearch,
  ])

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
      <main className="w-full flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
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
          action={
            mediaType === "other" && isOwner ? (
              <Button
                variant="outline"
                size="sm"
                onPress={() => setIsCreateDialogOpen(true)}
                className="h-7 gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                <IconPlus className="size-3.5" />
                <span>Create Item</span>
              </Button>
            ) : undefined
          }
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
            facets={facets}
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
