"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
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
  IconChevronDown,
  IconCompass,
  IconLogin,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
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
import { MEDIA_CATEGORIES } from "@/components/lists/types"

const MediaListModal = dynamic(
  () =>
    import("@/components/media/list/media-list-modal").then(
      (m) => m.MediaListModal
    ),
  { ssr: false }
)

type WatchingMediaListType = Exclude<MediaListType, "music">

interface ActiveCategorySection {
  type: WatchingMediaListType
  label: string
  activeVerb: string
  progressUnit: string
  icon: React.ComponentType<{ className?: string }>
  items: ListEntryData[]
}

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

export function WatchingDashboard(): React.JSX.Element {
  const { data: session, status: authStatus } = useSession()
  const { user: currentUser } = useUser()
  const username = session?.user?.username || currentUser?.username

  const mediaTitlePreference =
    getMediaPreferences(currentUser?.customization).title || "primary"

  // ---------------------------------------------------------------------------
  // Data States
  // ---------------------------------------------------------------------------
  const [sections, setSections] = useState<ActiveCategorySection[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const isFetchingRef = useRef<boolean>(false)
  const lastFetchedUserRef = useRef<string | null>(null)

  const INITIAL_SECTION_LIMIT = 16

  // Progressive Disclosure State (expand/collapse when > 16 items)
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({})

  const toggleSectionExpanded = useCallback((type: WatchingMediaListType) => {
    setExpandedSections((prev) => ({ ...prev, [type]: !prev[type] }))
  }, [])

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<{
    item: ListEntryData
    mediaType: WatchingMediaListType
  } | null>(null)

  // Stable callback for opening the edit modal across memoized cards
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
  // Fetch All In-Progress Media Concurrently via Eden Treaty (Guarded)
  // ---------------------------------------------------------------------------
  const fetchActiveMedia = useCallback(
    async (force = false) => {
      if (!username) return
      if (
        !force &&
        (lastFetchedUserRef.current === username || isFetchingRef.current)
      ) {
        return
      }
      lastFetchedUserRef.current = username
      isFetchingRef.current = true
      setIsLoading(true)

      try {
        const userLists = elysia.user({ username }).lists

      // Parallel guarded requests using allSettled
      const [animeRes, tvRes, movieRes, mangaRes, gameRes, bookRes] =
        await Promise.allSettled([
          userLists.anime.get({
            query: {
              status: CATEGORY_META.anime.statusParam,
              limit: 100,
              sortBy: "updatedAt",
              order: "desc",
            },
          }),
          userLists.tv.get({
            query: {
              status: CATEGORY_META.tv.statusParam,
              limit: 100,
              sortBy: "updatedAt",
              order: "desc",
            },
          }),
          userLists.movie.get({
            query: {
              status: CATEGORY_META.movie.statusParam,
              limit: 100,
              sortBy: "updatedAt",
              order: "desc",
            },
          }),
          userLists.manga.get({
            query: {
              status: CATEGORY_META.manga.statusParam,
              limit: 100,
              sortBy: "updatedAt",
              order: "desc",
            },
          }),
          userLists.game.get({
            query: {
              status: CATEGORY_META.game.statusParam,
              limit: 100,
              sortBy: "updatedAt",
              order: "desc",
            },
          }),
          userLists.book.get({
            query: {
              status: CATEGORY_META.book.statusParam,
              limit: 100,
              sortBy: "updatedAt",
              order: "desc",
            },
          }),
        ])

      const extractItems = (
        res: PromiseSettledResult<any>
      ): ListEntryData[] => {
        if (res.status === "fulfilled" && res.value?.data?.success) {
          return (res.value.data.items as ListEntryData[]) || []
        }
        return []
      }

      const activeSections: ActiveCategorySection[] = []

      // In-order list of categories
      const categoryOrder: WatchingMediaListType[] = [
        "anime",
        "tv",
        "movie",
        "manga",
        "game",
        "book",
      ]

      const resultsMap: Record<WatchingMediaListType, ListEntryData[]> = {
        anime: extractItems(animeRes),
        tv: extractItems(tvRes),
        movie: extractItems(movieRes),
        manga: extractItems(mangaRes),
        game: extractItems(gameRes),
        book: extractItems(bookRes),
      }

      for (const type of categoryOrder) {
        const items = resultsMap[type]
        if (items.length > 0) {
          const meta = CATEGORY_META[type]
          activeSections.push({
            type,
            label: meta.label,
            activeVerb: meta.activeVerb,
            progressUnit: meta.progressUnit,
            icon: meta.icon,
            items,
          })
        }
      }

      setSections(activeSections)
    } catch (err) {
      console.error("[WatchingDashboard] Failed to fetch active media:", err)
      toast.error("Failed to load active watching media")
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [username])

  useEffect(() => {
    if (authStatus === "authenticated" && username) {
      fetchActiveMedia()
    } else if (authStatus === "unauthenticated") {
      setIsLoading(false)
    }
  }, [authStatus, username, fetchActiveMedia])

  // ---------------------------------------------------------------------------
  // Debounced Increment Handler (600ms) - Stable reference for memoized cards
  // ---------------------------------------------------------------------------
  const handleIncrementProgress = useCallback(
    async (item: ListEntryData, count: number, mediaType?: MediaListType) => {
      if (!username || !mediaType) return

      const entryId = item.entry.id
      const mediaId = item.media.id
      const nowIso = new Date().toISOString()

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

      // Optimistic update in section items
      setSections((prev) =>
        prev.map((sec) => {
          if (sec.type !== mediaType) return sec
          const updatedItems = sec.items
            .map((it) => {
              if (it.entry.id === entryId) {
                if (mediaType === "manga") {
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

                if (mediaType === "movie") {
                  return null
                }

                const rawNext = (it.entry.progress ?? 0) + count
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
                    progress: nextProg,
                    updatedAt: nowIso,
                  },
                }
              }
              return it
            })
            .filter(Boolean) as ListEntryData[]
          return { ...sec, items: updatedItems }
        })
      )

      try {
        const client = elysia.user({ username }).lists

        if (mediaType === "anime") {
          const { error } = await client.anime({ id: mediaId }).increment.post({
            count,
          })
          if (error) throw new Error("Failed to increment anime progress")
        } else if (mediaType === "tv") {
          for (let i = 0; i < count; i++) {
            const { error } = await client.tv({ id: mediaId }).increment.post()
            if (error) throw new Error("Failed to increment TV progress")
          }
        } else if (mediaType === "movie") {
          const { error } = await client.movie({ id: mediaId }).increment.post({
            count,
          })
          if (error) throw new Error("Failed to increment movie progress")
        } else if (mediaType === "manga") {
          const { error } = await client.manga({ id: mediaId }).increment.post({
            count,
          })
          if (error) throw new Error("Failed to increment manga progress")
        } else if (mediaType === "game") {
          const { error } = await client.game({ id: mediaId }).increment.post({
            count,
          })
          if (error) throw new Error("Failed to increment game progress")
        } else if (mediaType === "book") {
          const { error } = await client.book({ id: mediaId }).increment.post({
            count,
          })
          if (error) throw new Error("Failed to increment book progress")
        }

        toast.success(`Progress updated (+${count})`)
      } catch {
        toast.error("Failed to update progress")
        // Re-synchronize state on error
        fetchActiveMedia(true)
      }
    },
    [username, fetchActiveMedia]
  )

  // ---------------------------------------------------------------------------
  // Entry Edit / Modal Update
  // ---------------------------------------------------------------------------
  const handleEntryUpdated = useCallback(
    (entryId: number, updatedEntry: any) => {
      if (!editingItem) return

      setSections((prev) =>
        prev
          .map((sec) => {
            if (sec.type !== editingItem.mediaType) return sec

            // If entry was deleted or status is no longer active in-progress
            const activeStatus = CATEGORY_META[sec.type].statusParam
            if (
              !updatedEntry ||
              (updatedEntry.status &&
                updatedEntry.status.toUpperCase() !== activeStatus)
            ) {
              return {
                ...sec,
                items: sec.items.filter((i) => i.entry.id !== entryId),
              }
            }

            return {
              ...sec,
              items: sec.items.map((i) => {
                if (i.entry.id === entryId) {
                  return {
                    ...i,
                    entry: {
                      ...i.entry,
                      ...updatedEntry,
                      updatedAt: new Date().toISOString(),
                    },
                  }
                }
                return i
              }),
            }
          })
          .filter((sec) => sec.items.length > 0)
      )

      setEditingItem(null)
    },
    [editingItem]
  )

  // ---------------------------------------------------------------------------
  // Unauthenticated State
  // ---------------------------------------------------------------------------
  if (authStatus === "unauthenticated" || (!session && !isLoading)) {
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
  // Loading State
  // ---------------------------------------------------------------------------
  if (isLoading || authStatus === "loading") {
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
  // Empty State ("Start Watching Media")
  // ---------------------------------------------------------------------------
  const totalActiveItems = sections.reduce(
    (acc, sec) => acc + sec.items.length,
    0
  )

  if (totalActiveItems === 0) {
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
  // Active In-Progress Watching Sections (8 in a row desktop, 3 on phone)
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-8 pb-12">
      {sections.map((section, secIdx) => {
        const SectionIcon = section.icon
        const isExpanded = Boolean(expandedSections[section.type])
        const hasOverflow = section.items.length > INITIAL_SECTION_LIMIT
        const visibleItems =
          hasOverflow && !isExpanded
            ? section.items.slice(0, INITIAL_SECTION_LIMIT)
            : section.items

        return (
          <section
            key={section.type}
            aria-label={`${section.label} in progress`}
            className="flex flex-col gap-3"
          >
            {/* Section Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
              <div className="flex items-center gap-2">
                <SectionIcon className="size-4.5 shrink-0 text-primary" />
                <h2 className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {section.label}
                </h2>
                <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                  {section.items.length}
                </span>
              </div>
            </div>

            {/* 8-Card Responsive Grid (3 on mobile, 8 on desktop) */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-8">
              {visibleItems.map((item, idx) => (
                <MediaListCard
                  key={`${item.entry.id}-${item.media.id}`}
                  item={item}
                  mediaType={section.type}
                  mediaTitlePreference={mediaTitlePreference}
                  progressUnit={section.progressUnit}
                  onOpenEditModal={handleOpenEditModal}
                  onIncrementProgress={handleIncrementProgress}
                  priority={secIdx === 0 && idx === 0}
                />
              ))}
            </div>

            {/* Expand / Collapse Button if category has > 16 items */}
            {hasOverflow && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => toggleSectionExpanded(section.type)}
                  className="gap-1.5 rounded-xl border-border/60 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
                >
                  <span>
                    {isExpanded
                      ? "Show less"
                      : `Show all ${section.items.length} ${section.label.toLowerCase()}`}
                  </span>
                  <IconChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </Button>
              </div>
            )}
          </section>
        )
      })}

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
