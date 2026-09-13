"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useSession, signIn } from "next-auth/react"
import {
  IconDeviceTv,
  IconMovie,
  IconBook2,
  IconDeviceGamepad,
  IconBook,
  IconEye,
  IconPlayerPlay,
  IconCompass,
  IconLogin,
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
  IconRotateClockwise,
  IconChevronDown,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { useUser } from "@/context/user-context"
import { getMediaPreferences } from "@IRIS/shared"
import { MediaListCard } from "@/components/lists/media-list-card"
import {
  toNormalizedMedia,
  toMediaListEntry,
} from "@/components/lists/media-list-grid"
import type { MediaListType, ListEntryData } from "@/components/lists/types"

const MediaListModal = dynamic(
  () =>
    import("@/components/media/list/media-list-modal").then(
      (m) => m.MediaListModal
    ),
  { ssr: false }
)

export type WatchingMediaListType = Exclude<MediaListType, "music">

const DEFAULT_CATEGORY_ORDER: WatchingMediaListType[] = [
  "anime",
  "tv",
  "movie",
  "manga",
  "game",
  "book",
]

const CATEGORY_META: Record<
  WatchingMediaListType,
  {
    statusParam: string
    label: string
    activeVerb: string
    progressUnit: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  anime: {
    statusParam: "WATCHING",
    label: "Anime",
    activeVerb: "Watching",
    progressUnit: "Ep",
    icon: IconDeviceTv,
  },
  tv: {
    statusParam: "WATCHING",
    label: "TV Shows",
    activeVerb: "Watching",
    progressUnit: "Ep",
    icon: IconDeviceTv,
  },
  movie: {
    statusParam: "WATCHING",
    label: "Movies",
    activeVerb: "Watching",
    progressUnit: "Movie",
    icon: IconMovie,
  },
  manga: {
    statusParam: "READING",
    label: "Manga",
    activeVerb: "Reading",
    progressUnit: "Ch",
    icon: IconBook2,
  },
  game: {
    statusParam: "PLAYING",
    label: "Games",
    activeVerb: "Playing",
    progressUnit: "Hrs",
    icon: IconDeviceGamepad,
  },
  book: {
    statusParam: "READING",
    label: "Books",
    activeVerb: "Reading",
    progressUnit: "Pages",
    icon: IconBook,
  },
}

const STORAGE_ORDER_KEY = "iris-watching-section-order"
const STORAGE_COLLAPSED_KEY = "iris-watching-collapsed-sections"

function getInitialCategoryOrder(
  customization?: unknown
): WatchingMediaListType[] {
  // 1. Check user customization
  const saved = (customization as any)?.watchingDashboard?.sectionOrder
  if (Array.isArray(saved) && saved.length > 0) {
    const valid = saved.filter((k): k is WatchingMediaListType =>
      DEFAULT_CATEGORY_ORDER.includes(k)
    )
    const rest = DEFAULT_CATEGORY_ORDER.filter((k) => !valid.includes(k))
    return [...valid, ...rest]
  }

  // 2. Check localStorage fallback
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_ORDER_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((k): k is WatchingMediaListType =>
            DEFAULT_CATEGORY_ORDER.includes(k)
          )
          const rest = DEFAULT_CATEGORY_ORDER.filter((k) => !valid.includes(k))
          return [...valid, ...rest]
        }
      }
    } catch {
      // ignore storage error
    }
  }

  return DEFAULT_CATEGORY_ORDER
}

function getInitialCollapsedSections(): Record<string, boolean> {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_COLLAPSED_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed
        }
      }
    } catch {
      // ignore
    }
  }
  return {}
}

function useGridColumns(): number {
  const [cols, setCols] = useState(8)
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth
      if (w < 640) setCols(3)
      else if (w < 768) setCols(4)
      else if (w < 1024) setCols(5)
      else if (w < 1280) setCols(6)
      else setCols(8)
    }
    updateCols()
    window.addEventListener("resize", updateCols, { passive: true })
    return () => window.removeEventListener("resize", updateCols)
  }, [])
  return cols
}

// -----------------------------------------------------------------------------
// Row Virtualization: only render visible rows + 1 row buffer
// -----------------------------------------------------------------------------
interface VirtualRowProps {
  items: ListEntryData[]
  mediaType: WatchingMediaListType
  mediaTitlePreference: "primary" | "secondary" | "native"
  progressUnit: string
  onOpenEditModal: (item: ListEntryData, mediaType?: MediaListType) => void
  onIncrementProgress: (
    item: ListEntryData,
    count: number,
    mediaType?: MediaListType
  ) => Promise<void>
  priority?: boolean
}

function VirtualRow({
  items,
  mediaType,
  mediaTitlePreference,
  progressUnit,
  onOpenEditModal,
  onIncrementProgress,
  priority = false,
}: VirtualRowProps) {
  const [isVisible, setIsVisible] = useState(priority)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (priority) return
    const el = rowRef.current
    if (!el) return

    // 350px rootMargin gives approximately 1 row buffer above and below the viewport
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) {
          setIsVisible(entry.isIntersecting)
        }
      },
      { rootMargin: "350px 0px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [priority])

  return (
    <div
      ref={rowRef}
      className="grid min-h-[220px] grid-cols-3 gap-2 sm:min-h-[260px] sm:grid-cols-4 sm:gap-2.5 md:min-h-[300px] md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-8"
    >
      {isVisible
        ? items.map((item, idx) => (
            <MediaListCard
              key={`${item.entry.id}-${item.media.id}`}
              item={item}
              mediaType={mediaType}
              mediaTitlePreference={mediaTitlePreference}
              progressUnit={progressUnit}
              onOpenEditModal={onOpenEditModal}
              onIncrementProgress={onIncrementProgress}
              priority={priority && idx === 0}
            />
          ))
        : items.map((item) => (
            <div
              key={`placeholder-${item.entry.id}-${item.media.id}`}
              aria-hidden="true"
              className="pointer-events-none flex flex-col gap-2"
            >
              <div className="aspect-2/3 w-full rounded-2xl border border-border/20 bg-muted/20" />
              <div className="h-3 w-3/4 rounded bg-muted/20" />
              <div className="h-2.5 w-1/2 rounded bg-muted/15" />
            </div>
          ))}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Category Section with Sentinel for Progressive Fetching & Collapse
// -----------------------------------------------------------------------------
interface WatchingCategorySectionProps {
  type: WatchingMediaListType
  data: {
    items: ListEntryData[]
    isLoaded: boolean
    isLoading: boolean
  }
  meta: (typeof CATEGORY_META)[WatchingMediaListType]
  cols: number
  isCollapsed: boolean
  onToggleCollapse: (type: WatchingMediaListType) => void
  onFetch: (type: WatchingMediaListType) => void
  mediaTitlePreference: "primary" | "secondary" | "native"
  onOpenEditModal: (item: ListEntryData, mediaType?: MediaListType) => void
  onIncrementProgress: (
    item: ListEntryData,
    count: number,
    mediaType?: MediaListType
  ) => Promise<void>
  prioritySection?: boolean
}

function WatchingCategorySection({
  type,
  data,
  meta,
  cols,
  isCollapsed,
  onToggleCollapse,
  onFetch,
  mediaTitlePreference,
  onOpenEditModal,
  onIncrementProgress,
  prioritySection = false,
}: WatchingCategorySectionProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const SectionIcon = meta.icon

  // Viewport trigger to fetch data for this section when near viewport
  useEffect(() => {
    if (data.isLoaded || data.isLoading) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          onFetch(type)
        }
      },
      { rootMargin: "350px 0px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [data.isLoaded, data.isLoading, onFetch, type])

  // Not loaded yet: render sentinel / skeleton while loading
  if (!data.isLoaded) {
    return (
      <div ref={sentinelRef} className="min-h-[40px] w-full">
        {data.isLoading && (
          <div className="flex animate-pulse flex-col gap-3 py-4">
            <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
              <SectionIcon className="size-4.5 text-primary" />
              <div className="h-5 w-28 rounded bg-muted/40" />
            </div>
            {!isCollapsed && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8">
                {Array.from({ length: cols }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-2/3 rounded-2xl border border-border/20 bg-muted/20"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Loaded but 0 items: collapse completely
  if (data.items.length === 0) {
    return null
  }

  // Chunk items into rows based on column count
  const rows: ListEntryData[][] = []
  for (let i = 0; i < data.items.length; i += cols) {
    rows.push(data.items.slice(i, i + cols))
  }

  return (
    <section
      aria-label={`${meta.label} in progress`}
      className="flex flex-col gap-3"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5 select-none">
        <div className="flex items-center gap-2">
          {/* Clicking icon will hide/show section */}
          <button
            type="button"
            onClick={() => onToggleCollapse(type)}
            className="-m-1 flex cursor-pointer items-center justify-center rounded-lg p-1 transition-colors hover:bg-muted/60"
            title={isCollapsed ? `Show ${meta.label}` : `Hide ${meta.label}`}
            aria-label={
              isCollapsed ? `Show ${meta.label}` : `Hide ${meta.label}`
            }
          >
            <SectionIcon
              className={cn(
                "size-4.5 shrink-0 transition-all",
                isCollapsed
                  ? "text-muted-foreground/60 opacity-60"
                  : "text-primary"
              )}
            />
          </button>
          <button
            type="button"
            onClick={() => onToggleCollapse(type)}
            className="cursor-pointer text-start font-heading text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary sm:text-lg"
          >
            {meta.label}
          </button>
          <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
            {data.items.length}
          </span>
        </div>

        {/* Chevron toggle indicator */}
        <button
          type="button"
          onClick={() => onToggleCollapse(type)}
          className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={isCollapsed ? `Show ${meta.label}` : `Hide ${meta.label}`}
        >
          <IconChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              isCollapsed && "-rotate-90"
            )}
          />
        </button>
      </div>

      {/* Row-virtualized items: only visible rows + 1 row buffer are rendered with images */}
      {!isCollapsed && (
        <div className="flex flex-col gap-2 sm:gap-2.5 md:gap-3">
          {rows.map((row, rIdx) => (
            <VirtualRow
              key={rIdx}
              items={row}
              mediaType={type}
              mediaTitlePreference={mediaTitlePreference}
              progressUnit={meta.progressUnit}
              onOpenEditModal={onOpenEditModal}
              onIncrementProgress={onIncrementProgress}
              priority={prioritySection && rIdx === 0}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// -----------------------------------------------------------------------------
// Reorder Sections Dialog
// -----------------------------------------------------------------------------
interface ReorderSectionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryOrder: WatchingMediaListType[]
  categoryData: Record<
    WatchingMediaListType,
    { items: ListEntryData[]; isLoaded: boolean }
  >
  onSaveOrder: (newOrder: WatchingMediaListType[]) => void
  onResetOrder: () => void
}

function ReorderSectionsDialog({
  open,
  onOpenChange,
  categoryOrder,
  categoryData,
  onSaveOrder,
  onResetOrder,
}: ReorderSectionsDialogProps) {
  const [localOrder, setLocalOrder] =
    useState<WatchingMediaListType[]>(categoryOrder)

  useEffect(() => {
    if (open) {
      setLocalOrder(categoryOrder)
    }
  }, [open, categoryOrder])

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= localOrder.length) return
    const next = [...localOrder]
    const [removed] = next.splice(index, 1)
    if (!removed) return
    next.splice(targetIdx, 0, removed)
    setLocalOrder(next)
  }

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      const isSame =
        localOrder.length === categoryOrder.length &&
        localOrder.every((v, i) => v === categoryOrder[i])
      if (!isSame) {
        onSaveOrder(localOrder)
      }
    }
    onOpenChange(newOpen)
  }

  const handleReset = () => {
    setLocalOrder(DEFAULT_CATEGORY_ORDER)
    const isSame =
      DEFAULT_CATEGORY_ORDER.length === categoryOrder.length &&
      DEFAULT_CATEGORY_ORDER.every((v, i) => v === categoryOrder[i])
    if (!isSame) {
      onResetOrder()
    }
    onOpenChange(false)
  }

  return (
    <Dialog isOpen={open} onOpenChange={handleClose} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base font-semibold">
          <IconArrowsSort className="size-5 text-primary" />
          <span>Reorder Watching Sections</span>
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-2 py-1">
        <div className="flex flex-col gap-1.5 pt-1">
          {localOrder.map((type, idx) => {
            const meta = CATEGORY_META[type]
            const Icon = meta.icon
            const count = categoryData[type]?.isLoaded
              ? categoryData[type].items.length
              : null

            return (
              <div
                key={type}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/60 px-3 py-2.5 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[10px] font-semibold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    {meta.label}
                  </span>
                  {count !== null && (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1.5 text-[10px] font-medium"
                    >
                      {count} active
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    isDisabled={idx === 0}
                    onPress={() => handleMove(idx, -1)}
                    className="size-7 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label={`Move ${meta.label} up`}
                  >
                    <IconArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    isDisabled={idx === localOrder.length - 1}
                    onPress={() => handleMove(idx, 1)}
                    className="size-7 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label={`Move ${meta.label} down`}
                  >
                    <IconArrowDown className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <DialogFooter className="flex items-center justify-between gap-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onPress={handleReset}
          className="gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
        >
          <IconRotateClockwise className="size-3.5" />
          <span>Reset Default</span>
        </Button>
        <Button
          variant="default"
          size="sm"
          onPress={() => handleClose(false)}
          className="rounded-xl px-4 text-xs font-medium"
        >
          <span>Done</span>
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

// -----------------------------------------------------------------------------
// Main WatchingDashboard
// -----------------------------------------------------------------------------
interface CategoryState {
  items: ListEntryData[]
  isLoaded: boolean
  isLoading: boolean
}

export function WatchingDashboard(): React.JSX.Element {
  const { data: session, status: authStatus } = useSession()
  const { user: currentUser, updateUser } = useUser()
  const username = session?.user?.username || currentUser?.username
  const cols = useGridColumns()

  const mediaTitlePreference =
    getMediaPreferences(currentUser?.customization).title || "primary"

  // ---------------------------------------------------------------------------
  // Category Order & Customization State
  // ---------------------------------------------------------------------------
  const [categoryOrder, setCategoryOrder] = useState<WatchingMediaListType[]>(
    () => getInitialCategoryOrder(currentUser?.customization)
  )
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >(getInitialCollapsedSections)
  const [isReorderOpen, setIsReorderOpen] = useState(false)

  // Sync categoryOrder if currentUser customization updates from server
  useEffect(() => {
    if (currentUser?.customization) {
      const savedOrder = (currentUser.customization as any)?.watchingDashboard
        ?.sectionOrder
      if (Array.isArray(savedOrder) && savedOrder.length > 0) {
        const nextOrder = getInitialCategoryOrder(currentUser.customization)
        setCategoryOrder((prev) => {
          const isSame =
            prev.length === nextOrder.length &&
            prev.every((val, idx) => val === nextOrder[idx])
          return isSame ? prev : nextOrder
        })
      }
    }
  }, [currentUser?.customization])

  const saveCategoryOrder = useCallback(
    async (newOrder: WatchingMediaListType[]) => {
      const isSame =
        newOrder.length === categoryOrder.length &&
        newOrder.every((val, idx) => val === categoryOrder[idx])
      if (isSame) return

      setCategoryOrder(newOrder)

      // 1. Instant local persistence
      try {
        localStorage.setItem(STORAGE_ORDER_KEY, JSON.stringify(newOrder))
      } catch {
        // ignore
      }

      // 2. Persist to DB user customization
      try {
        const existing =
          (currentUser?.customization as Record<string, unknown>) || {}
        const updatedCustomization = {
          ...existing,
          watchingDashboard: {
            ...((existing.watchingDashboard as Record<string, unknown>) || {}),
            sectionOrder: newOrder,
          },
        }
        await updateUser({ customization: updatedCustomization })
        toast.success("Section order saved")
      } catch (err) {
        console.error("Failed to save section order:", err)
        toast.error("Failed to save section order")
      }
    },
    [categoryOrder, currentUser?.customization, updateUser]
  )

  const handleResetOrder = useCallback(() => {
    saveCategoryOrder(DEFAULT_CATEGORY_ORDER)
  }, [saveCategoryOrder])

  // Toggle hiding / collapsing a section on icon click (pure client-side state, zero API calls)
  const handleToggleCollapse = useCallback((type: WatchingMediaListType) => {
    setCollapsedSections((prev) => {
      const next = {
        ...prev,
        [type]: !prev[type],
      }
      try {
        localStorage.setItem(STORAGE_COLLAPSED_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Progressive Category Data State
  // ---------------------------------------------------------------------------
  const [categoryData, setCategoryData] = useState<
    Record<WatchingMediaListType, CategoryState>
  >({
    anime: { items: [], isLoaded: false, isLoading: false },
    tv: { items: [], isLoaded: false, isLoading: false },
    movie: { items: [], isLoaded: false, isLoading: false },
    manga: { items: [], isLoaded: false, isLoading: false },
    game: { items: [], isLoaded: false, isLoading: false },
    book: { items: [], isLoaded: false, isLoading: false },
  })

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<{
    item: ListEntryData
    mediaType: WatchingMediaListType
  } | null>(null)

  const handleOpenEditModal = useCallback(
    (item: ListEntryData, mediaType?: MediaListType) => {
      setEditingItem({
        item,
        mediaType: (mediaType as WatchingMediaListType) || "anime",
      })
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Fetch a Single Category On-Demand (Guaranteed at-most-once fetch per category)
  // ---------------------------------------------------------------------------
  const loadedCategoriesRef = useRef<Set<WatchingMediaListType>>(new Set())
  const inFlightCategoriesRef = useRef<Set<WatchingMediaListType>>(new Set())

  // Reset tracking if active user changes
  useEffect(() => {
    loadedCategoriesRef.current.clear()
    inFlightCategoriesRef.current.clear()
  }, [username])

  const fetchCategory = useCallback(
    async (type: WatchingMediaListType) => {
      if (!username) return
      if (
        loadedCategoriesRef.current.has(type) ||
        inFlightCategoriesRef.current.has(type)
      ) {
        return
      }

      inFlightCategoriesRef.current.add(type)
      setCategoryData((prev) => ({
        ...prev,
        [type]: { ...prev[type], isLoading: true },
      }))

      try {
        const userLists = elysia.user({ username }).lists
        const meta = CATEGORY_META[type]
        const res = await userLists[type].get({
          query: {
            status: meta.statusParam,
            limit: 100,
            sortBy: "updatedAt",
            order: "desc",
          },
        })

        const items =
          res?.data?.success && Array.isArray(res.data.items)
            ? (res.data.items as ListEntryData[])
            : []

        loadedCategoriesRef.current.add(type)
        setCategoryData((prev) => ({
          ...prev,
          [type]: { items, isLoaded: true, isLoading: false },
        }))
      } catch (err) {
        console.error(`[WatchingDashboard] Failed to fetch ${type}:`, err)
        loadedCategoriesRef.current.add(type)
        setCategoryData((prev) => ({
          ...prev,
          [type]: { items: [], isLoaded: true, isLoading: false },
        }))
      } finally {
        inFlightCategoriesRef.current.delete(type)
      }
    },
    [username]
  )

  // Fetch the first category in order immediately when authenticated
  useEffect(() => {
    const first = categoryOrder[0]
    if (authStatus === "authenticated" && username && first) {
      fetchCategory(first)
    }
  }, [authStatus, username, categoryOrder, fetchCategory])

  // Pre-fetch remaining categories when reorder dialog is opened so counts are accurate
  useEffect(() => {
    if (isReorderOpen && authStatus === "authenticated" && username) {
      for (const type of DEFAULT_CATEGORY_ORDER) {
        if (!categoryData[type].isLoaded && !categoryData[type].isLoading) {
          fetchCategory(type)
        }
      }
    }
  }, [isReorderOpen, authStatus, username, categoryData, fetchCategory])

  // ---------------------------------------------------------------------------
  // Debounced Increment Handler (Optimistic Update)
  // ---------------------------------------------------------------------------
  const handleIncrementProgress = useCallback(
    async (item: ListEntryData, count: number, mediaType?: MediaListType) => {
      if (!username || !mediaType) return

      const type = mediaType as WatchingMediaListType
      const entryId = item.entry.id
      const nowIso = new Date().toISOString()

      const maxCount: number | null = (() => {
        if (type === "manga") {
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
        if (type === "anime") {
          if (
            typeof (item.media as any).episodesCount === "number" &&
            (item.media as any).episodesCount > 0
          ) {
            return (item.media as any).episodesCount
          }
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
        if (type === "tv") {
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
        if (type === "book") {
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
        type === "manga"
          ? (item.entry.chaptersProgress ?? 0)
          : (item.entry.progress ?? 0)

      if (maxCount !== null && currentProgress >= maxCount) {
        toast.error("Already at maximum progress")
        return
      }

      // Optimistic state update in categoryData
      setCategoryData((prev) => {
        const cat = prev[type]
        const updatedItems = cat.items
          .map((it) => {
            if (it.entry.id === entryId) {
              if (type === "manga") {
                const rawNext = (it.entry.chaptersProgress ?? 0) + count
                const nextProg =
                  maxCount && maxCount > 0
                    ? Math.min(rawNext, maxCount)
                    : rawNext
                const isCompleted =
                  maxCount && maxCount > 0 && nextProg >= maxCount
                if (isCompleted) return null
                return {
                  ...it,
                  entry: {
                    ...it.entry,
                    chaptersProgress: nextProg,
                    updatedAt: nowIso,
                  },
                }
              }

              if (type === "movie") {
                return null
              }

              const rawNext = (it.entry.progress ?? 0) + count
              const nextProg =
                maxCount && maxCount > 0 ? Math.min(rawNext, maxCount) : rawNext
              const isCompleted =
                maxCount && maxCount > 0 && nextProg >= maxCount
              if (isCompleted) return null
              return {
                ...it,
                entry: {
                  ...it.entry,
                  progress: nextProg,
                  updatedAt: nowIso,
                },
              }
            }
            return it
          })
          .filter(Boolean) as ListEntryData[]

        return {
          ...prev,
          [type]: { ...cat, items: updatedItems },
        }
      })

      try {
        const client = elysia.user({ username }).lists

        if (type === "anime") {
          const rawNext = (item.entry.progress ?? 0) + count
          const nextProg =
            maxCount && maxCount > 0 ? Math.min(rawNext, maxCount) : rawNext
          const isCompleted = maxCount && maxCount > 0 && nextProg >= maxCount

          await client.anime({ id: entryId }).patch({
            progress: nextProg,
            ...(isCompleted ? { status: "COMPLETED" } : {}),
          })
          toast.success(
            isCompleted
              ? "Completed anime!"
              : `Episode ${nextProg} marked as watched`
          )
        } else if (type === "tv") {
          const rawNext = (item.entry.progress ?? 0) + count
          const nextProg =
            maxCount && maxCount > 0 ? Math.min(rawNext, maxCount) : rawNext
          const isCompleted = maxCount && maxCount > 0 && nextProg >= maxCount

          await client.tv({ id: entryId }).patch({
            progress: nextProg,
            ...(isCompleted ? { status: "COMPLETED" } : {}),
          })
          toast.success(
            isCompleted
              ? "Completed TV show!"
              : `Episode ${nextProg} marked as watched`
          )
        } else if (type === "manga") {
          const rawNext = (item.entry.chaptersProgress ?? 0) + count
          const nextProg =
            maxCount && maxCount > 0 ? Math.min(rawNext, maxCount) : rawNext
          const isCompleted = maxCount && maxCount > 0 && nextProg >= maxCount

          await client.manga({ id: entryId }).patch({
            chaptersProgress: nextProg,
            ...(isCompleted ? { status: "COMPLETED" } : {}),
          })
          toast.success(
            isCompleted
              ? "Completed manga!"
              : `Chapter ${nextProg} marked as read`
          )
        } else if (type === "movie") {
          await client.movie({ id: entryId }).patch({
            status: "COMPLETED",
          })
          toast.success("Movie marked as watched!")
        } else if (type === "game") {
          const nextProg = (item.entry.progress ?? 0) + count
          await client.game({ id: entryId }).patch({
            progress: nextProg,
          })
          toast.success(`Logged +${count} hrs`)
        } else if (type === "book") {
          const rawNext = (item.entry.progress ?? 0) + count
          const nextProg =
            maxCount && maxCount > 0 ? Math.min(rawNext, maxCount) : rawNext
          const isCompleted = maxCount && maxCount > 0 && nextProg >= maxCount

          await client.book({ id: entryId }).patch({
            progressPages: nextProg,
            ...(isCompleted ? { status: "COMPLETED" as const } : {}),
          } as any)
          toast.success(
            isCompleted ? "Completed book!" : `Page ${nextProg} marked as read`
          )
        }
      } catch (err) {
        console.error("[WatchingDashboard] Failed to increment progress:", err)
        toast.error("Failed to update progress")
      }
    },
    [username]
  )

  const handleEntryUpdated = useCallback((entryId: number, updated: any) => {
    setCategoryData((prev) => {
      const next = { ...prev }
      let changed = false
      for (const type of DEFAULT_CATEGORY_ORDER) {
        const cat = next[type]
        if (!cat.isLoaded) continue
        const idx = cat.items.findIndex((it) => it.entry.id === entryId)
        if (idx !== -1) {
          changed = true
          const targetStatus = CATEGORY_META[type].statusParam
          if (updated.status && updated.status !== targetStatus) {
            next[type] = {
              ...cat,
              items: cat.items.filter((it) => it.entry.id !== entryId),
            }
          } else {
            next[type] = {
              ...cat,
              items: cat.items.map((it) =>
                it.entry.id === entryId
                  ? {
                      ...it,
                      entry: { ...it.entry, ...updated },
                      media: updated.media
                        ? { ...it.media, ...updated.media }
                        : it.media,
                    }
                  : it
              ),
            }
          }
        }
      }
      return changed ? next : prev
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Unauthenticated State
  // ---------------------------------------------------------------------------
  if (
    authStatus === "unauthenticated" ||
    (!session && authStatus !== "loading")
  ) {
    return (
      <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-4">
        <div className="flex max-w-md flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/60 p-8 text-center shadow-xs backdrop-blur-md">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <IconEye className="size-7" />
          </div>
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Login to Manage Watched Media
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sign in to track what you&apos;re watching, reading, or playing,
            update your episode progress, and organize your media lists.
          </p>
          <Button
            onPress={() => signIn()}
            className="mt-6 gap-2 rounded-2xl px-5 text-sm font-medium shadow-xs"
          >
            <IconLogin className="size-4" />
            <span>Sign In</span>
          </Button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Initial Loading State (before first category is checked)
  // ---------------------------------------------------------------------------
  const firstCategory: WatchingMediaListType = categoryOrder[0] ?? "anime"
  const firstCatState = categoryData[firstCategory]
  if (!firstCatState?.isLoaded && firstCatState?.isLoading) {
    return (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3">
        <Spinner className="size-6 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">
          Loading watching media…
        </span>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Total items calculation & Empty State
  // ---------------------------------------------------------------------------
  const totalActiveItems = Object.values(categoryData).reduce(
    (sum, d) => sum + d.items.length,
    0
  )
  const allCategoriesChecked = Object.values(categoryData).every(
    (d) => d.isLoaded
  )

  if (allCategoriesChecked && totalActiveItems === 0) {
    return (
      <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-4">
        <div className="flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center backdrop-blur-md">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <IconPlayerPlay className="size-7 opacity-75" />
          </div>
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Start Watching Media
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You aren&apos;t tracking any active media right now. Browse our
            library and add titles to your watching, reading, or playing lists.
          </p>
          <Link
            href="/IRIS-list/browse"
            className={buttonVariants({
              className:
                "mt-6 gap-2 rounded-2xl px-5 text-sm font-medium shadow-xs",
            })}
          >
            <IconCompass className="size-4" />
            <span>Browse Media</span>
          </Link>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Active In-Progress Dashboard
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Ordered Category Sections */}
      <div className="flex flex-col gap-8">
        {categoryOrder.map((type, idx) => (
          <WatchingCategorySection
            key={type}
            type={type}
            data={categoryData[type]}
            meta={CATEGORY_META[type]}
            cols={cols}
            isCollapsed={Boolean(collapsedSections[type])}
            onToggleCollapse={handleToggleCollapse}
            onFetch={fetchCategory}
            mediaTitlePreference={mediaTitlePreference}
            onOpenEditModal={handleOpenEditModal}
            onIncrementProgress={handleIncrementProgress}
            prioritySection={idx === 0}
          />
        ))}
      </div>

      {/* Dashboard Footer with Reorder Action */}
      <div className="flex items-center justify-center border-t border-border/40 pt-8 pb-4">
        <Button
          variant="outline"
          size="sm"
          onPress={() => setIsReorderOpen(true)}
          className="gap-2 rounded-2xl border-border/60 px-4 py-2 text-xs font-medium shadow-xs hover:border-primary/40 hover:bg-card"
        >
          <IconArrowsSort className="size-4 text-muted-foreground" />
          <span>Reorder Sections</span>
        </Button>
      </div>

      {/* Reorder Sections Modal */}
      <ReorderSectionsDialog
        open={isReorderOpen}
        onOpenChange={setIsReorderOpen}
        categoryOrder={categoryOrder}
        categoryData={categoryData}
        onSaveOrder={saveCategoryOrder}
        onResetOrder={handleResetOrder}
      />

      {/* Entry Edit Modal */}
      {editingItem && (
        <MediaListModal
          isOpen={Boolean(editingItem)}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null)
          }}
          media={toNormalizedMedia(
            editingItem.item.media,
            editingItem.mediaType
          )}
          initialEntry={toMediaListEntry(editingItem.item.entry)}
          onEntryUpdated={(updated) => {
            handleEntryUpdated(editingItem.item.entry.id, updated)
          }}
        />
      )}
    </div>
  )
}
