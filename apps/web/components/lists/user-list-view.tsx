"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { useUser } from "@/context/user-context"
import {
  getMediaPreferences,
  type UserProfileCustomization,
} from "@IRIS/shared"
import { UserListBanner } from "./user-list-banner"
import { ListStatusCard } from "./list-status-card"
import { MediaListGrid } from "./media-list-grid"
import type {
  MediaListType,
  StatusKey,
  SortByOption,
  SortOrderOption,
  ListFilterFacets,
  ListEntryData,
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
  }
}

function sortListItems(
  items: ListEntryData[],
  sortBy: SortByOption,
  sortOrder: SortOrderOption
): ListEntryData[] {
  const isAsc = sortOrder === "asc"

  return [...items].sort((a, b) => {
    let diff = 0

    switch (sortBy) {
      case "updatedAt": {
        const timeA = new Date(a.entry.updatedAt || a.entry.createdAt || 0).getTime()
        const timeB = new Date(b.entry.updatedAt || b.entry.createdAt || 0).getTime()
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
        const timeA = new Date(a.entry.updatedAt || a.entry.createdAt || 0).getTime()
        const timeB = new Date(b.entry.updatedAt || b.entry.createdAt || 0).getTime()
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
  const [selectedMediaStatuses, setSelectedMediaStatuses] = useState<string[]>([])
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedYears, setSelectedYears] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortByOption>("updatedAt")
  const [sortOrder, setSortOrder] = useState<SortOrderOption>("desc")

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim().toLowerCase())
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ---------------------------------------------------------------------------
  // Data States
  // ---------------------------------------------------------------------------
  const [items, setItems] = useState<ListEntryData[]>([])
  const [facets, setFacets] = useState<ListFilterFacets>(DEFAULT_FACETS)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState<boolean>(false)

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)

  // Request deduplication refs (React 19 StrictMode safety)
  const isFetchingRef = useRef(false)
  const isFetchingMoreRef = useRef(false)

  // ---------------------------------------------------------------------------
  // 1. Fetch Filter Facets & Counts
  // ---------------------------------------------------------------------------
  const fetchFacets = useCallback(async () => {
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
        })
      }
    } catch {
      // Graceful fallback
    }
  }, [username, mediaType])

  useEffect(() => {
    fetchFacets()
  }, [fetchFacets])

  // ---------------------------------------------------------------------------
  // 2. Fetch Initial / Filtered Items
  // ---------------------------------------------------------------------------
  const fetchItems = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    setIsLoading(true)

    try {
      const resource = getListResource(username, mediaType)

      // Format query parameters
      const statusParam =
        activeStatus === "ALL" ? undefined : activeStatus
      const formatsParam =
        selectedFormats.length > 0 ? selectedFormats.join(",") : undefined
      const mediaStatusParam =
        selectedMediaStatuses.length > 0
          ? selectedMediaStatuses.join(",")
          : undefined
      const genresParam =
        selectedGenres.length > 0 ? selectedGenres.join(",") : undefined
      const yearsParam =
        selectedYears.length > 0 ? selectedYears.join(",") : undefined

      const { data, error } = await resource.get({
        query: {
          limit: activeStatus === "ALL" ? 100 : 36,
          status: statusParam,
          mediaFormat: formatsParam,
          mediaStatus: mediaStatusParam,
          genres: genresParam,
          year: yearsParam,
          sortBy,
          order: sortOrder,
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
  }, [
    username,
    mediaType,
    activeStatus,
    selectedFormats,
    selectedMediaStatuses,
    selectedGenres,
    selectedYears,
    sortBy,
    sortOrder,
  ])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // ---------------------------------------------------------------------------
  // 3. Infinite Scrolling (Fetch Next Page)
  // ---------------------------------------------------------------------------
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isFetchingMoreRef.current || isLoading) return
    isFetchingMoreRef.current = true
    setIsLoadingMore(true)

    try {
      const resource = getListResource(username, mediaType)

      const statusParam =
        activeStatus === "ALL" ? undefined : activeStatus
      const formatsParam =
        selectedFormats.length > 0 ? selectedFormats.join(",") : undefined
      const mediaStatusParam =
        selectedMediaStatuses.length > 0
          ? selectedMediaStatuses.join(",")
          : undefined
      const genresParam =
        selectedGenres.length > 0 ? selectedGenres.join(",") : undefined
      const yearsParam =
        selectedYears.length > 0 ? selectedYears.join(",") : undefined

      const { data, error } = await resource.get({
        query: {
          limit: activeStatus === "ALL" ? 100 : 36,
          cursor: nextCursor,
          status: statusParam,
          mediaFormat: formatsParam,
          mediaStatus: mediaStatusParam,
          genres: genresParam,
          year: yearsParam,
          sortBy,
          order: sortOrder,
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
    sortBy,
    sortOrder,
  ])

  // ---------------------------------------------------------------------------
  // 4. Quick Increment (+1) Handler for Owner
  // ---------------------------------------------------------------------------
  const handleIncrementProgress = useCallback(
    async (entryId: number, mediaId: number) => {
      const nowIso = new Date().toISOString()
      // Optimistic update
      setItems((prev) => {
        const next = prev.map((item) => {
          if (item.entry.id === entryId) {
            if (mediaType === "manga") {
              return {
                ...item,
                entry: {
                  ...item.entry,
                  chaptersProgress: (item.entry.chaptersProgress ?? 0) + 1,
                  updatedAt: nowIso,
                },
              }
            }
            return {
              ...item,
              entry: {
                ...item.entry,
                progress: (item.entry.progress ?? 0) + 1,
                updatedAt: nowIso,
              },
            }
          }
          return item
        })
        return sortListItems(next, sortBy, sortOrder)
      })

      try {
        const resource = getListResource(username, mediaType)
        const { error } = await (resource as any)({ id: entryId }).increment.post({
          count: 1,
        })

        if (error) {
          toast.error("Failed to update progress")
          // Re-fetch to synchronize state
          fetchItems()
        } else {
          toast.success("Progress updated (+1)")
        }
      } catch {
        toast.error("Failed to update progress")
        fetchItems()
      }
    },
    [username, mediaType, sortBy, sortOrder, fetchItems]
  )

  // ---------------------------------------------------------------------------
  // 5. Update / Delete Entry from Edit Modal
  // ---------------------------------------------------------------------------
  const handleItemUpdated = useCallback(
    (entryId: number, updatedEntry: any) => {
      if (!updatedEntry) {
        setItems((prev) => prev.filter((i) => i.entry.id !== entryId))
        setTotalCount((prev) => Math.max(0, prev - 1))
        fetchFacets()
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

          // If a specific status tab is active, remove item if its status no longer matches
          if (activeStatus !== "ALL") {
            const upperStatus = (updatedEntry.status || "").toUpperCase()
            const upperActive = activeStatus.toUpperCase()
            const isMatch =
              upperStatus === upperActive ||
              ((upperActive === "WATCHING" ||
                upperActive === "READING" ||
                upperActive === "PLAYING") &&
                (upperStatus === "WATCHING" ||
                  upperStatus === "READING" ||
                  upperStatus === "PLAYING"))
            if (!isMatch) {
              next = next.filter((i) => i.entry.id !== entryId)
            }
          }

          // Re-sort items by active sortBy (e.g. updatedAt) and sortOrder
          return sortListItems(next, sortBy, sortOrder)
        })
        fetchFacets()
      }
    },
    [activeStatus, sortBy, sortOrder, fetchFacets]
  )

  // ---------------------------------------------------------------------------
  // 6. Client-side Search Filter over Loaded Items
  // ---------------------------------------------------------------------------
  const filteredItems = React.useMemo(() => {
    if (!debouncedSearch) return items

    return items.filter(({ media }) => {
      const titles = [
        media.titlePrimary,
        media.titleEnglish,
        media.titleRomaji,
        media.titleNative,
        media.title,
        media.name,
      ]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase())

      return titles.some((t) => t.includes(debouncedSearch))
    })
  }, [items, debouncedSearch])

  return (
    <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
      {/* 1. Header Banner with Avatar and User Info */}
      <UserListBanner
        username={username}
        profile={profileToDisplay}
        currentMediaType={mediaType}
      />

      {/* 2. Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Status Card Matching Reference Screenshot */}
        <ListStatusCard
          mediaType={mediaType}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          facets={facets}
          selectedFormats={selectedFormats}
          onFormatsChange={setSelectedFormats}
          selectedMediaStatuses={selectedMediaStatuses}
          onMediaStatusesChange={setSelectedMediaStatuses}
          selectedGenres={selectedGenres}
          onGenresChange={setSelectedGenres}
          selectedYears={selectedYears}
          onYearsChange={setSelectedYears}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          totalCount={totalCount}
        />

        {/* Media Grid with Infinite Scroll */}
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
          mediaTitlePreference={mediaTitlePreference}
        />
      </main>
    </div>
  )
}
