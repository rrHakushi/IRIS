"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import { IconInbox } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import type { NormalizedMediaData } from "@/components/media/media-types"

const MediaListModal = dynamic(
  () =>
    import("@/components/media/list/media-list-modal").then(
      (m) => m.MediaListModal
    ),
  { ssr: false }
)
import {
  type MediaListEntryData,
  type MediaListStatus,
  parseRewatchHistory,
} from "@/components/media/list/types"
import {
  type ListEntryData,
  type MediaListType,
  type StatusKey,
  type ListFilterFacets,
  MEDIA_CATEGORIES,
} from "./types"
import { MediaListCard } from "./media-list-card"

export function MediaListCardSkeleton({
  isMusic = false,
}: {
  isMusic?: boolean
}): React.JSX.Element {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card/60 animate-pulse">
      <div
        className={cn(
          "w-full bg-muted/60",
          isMusic ? "aspect-square" : "aspect-2/3"
        )}
      />
      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="h-3.5 w-3/4 rounded bg-muted/70" />
        <div className="h-2.5 w-1/2 rounded bg-muted/40" />
      </div>
    </div>
  )
}

export interface MediaListGridProps {
  mediaType: MediaListType
  activeStatus?: StatusKey
  items: ListEntryData[]
  isLoading: boolean
  isLoadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  isOwner?: boolean
  onItemUpdated?: (
    entryId: number,
    updatedEntry: MediaListEntryData | null
  ) => void
  onIncrementProgress?: (item: ListEntryData, count: number) => Promise<void>
  mediaTitlePreference?: "primary" | "secondary" | "native"
  searchQuery?: string
  facets?: ListFilterFacets
  totalCount?: number
  className?: string
}

export function toNormalizedMedia(
  media: ListEntryData["media"],
  category: MediaListType
): NormalizedMediaData {
  const normCat =
    category === "movie"
      ? ("movies" as const)
      : category === "game"
        ? ("games" as const)
        : category === "book"
          ? ("books" as const)
          : category === "music"
            ? ("music" as const)
            : category === "other"
              ? ("other" as const)
              : (category as "anime" | "manga" | "tv")

  return {
    id: media.id,
    category: normCat,
    titlePrimary:
      media.titlePrimary ||
      media.titleEnglish ||
      media.titleRomaji ||
      media.title ||
      media.name ||
      "Untitled",
    titleSecondary:
      media.titleSecondary || media.titleEnglish || media.titleRomaji || null,
    titleNative: media.titleNative || null,
    coverImage:
      media.coverImage || media.posterImage || media.bannerImage || null,
    bannerImage: media.bannerImage || null,
    description: media.description || null,
    format: media.format || null,
    status: media.status || null,
    isAdult: Boolean((media as any).isAdult),
    genres: Array.isArray(media.genres)
      ? media.genres.map((g: any, idx: number) =>
          typeof g === "string"
            ? { id: idx, name: g, slug: g.toLowerCase().replace(/\s+/g, "-") }
            : {
                id: g.id || idx,
                name: g.name,
                slug: (g.slug || g.name || "")
                  .toLowerCase()
                  .replace(/\s+/g, "-"),
              }
        )
      : [],
    tags: [],
    studios: [],
    characters: [],
    staff: [],
    relations: [],
    episodeCount:
      typeof media.episodeCount === "number" && media.episodeCount > 0
        ? media.episodeCount
        : Array.isArray((media as any).episodes) &&
            (media as any).episodes.length > 0
          ? (media as any).episodes.length
          : null,
    seasonCount: (media as any).seasonCount ?? null,
    chapterCount: media.chapters ?? media.chapterCount ?? null,
    volumeCount: media.volumes ?? media.volumeCount ?? null,
    startDateYear: media.startDateYear ?? media.year ?? null,
    releaseDateYear: media.releaseDateYear ?? media.year ?? null,
    seasons: Array.isArray((media as any).seasons)
      ? (media as any).seasons.map((s: any) => ({
          id: s.id,
          seasonNumber: s.seasonNumber,
          title: s.titlePrimary || s.title || null,
          titlePrimary: s.titlePrimary || null,
          titleSecondary: s.titleSecondary || null,
          episodeCount: s.episodeCount || null,
        }))
      : undefined,
    episodes: Array.isArray((media as any).episodes)
      ? (media as any).episodes.map((ep: any) => ({
          id: ep.id,
          number: ep.number ?? ep.episodeNumber,
          seasonNumber: ep.seasonNumber ?? ep.season ?? null,
          titlePrimary: ep.titlePrimary || ep.title || null,
          titleSecondary: ep.titleSecondary || null,
        }))
      : undefined,
    progressFields: (media as any).progressFields || undefined,
    incrementFieldKey: (media as any).incrementFieldKey || undefined,
    updatedAt: (media as any).updatedAt
      ? new Date((media as any).updatedAt)
      : new Date(),
  }
}

export function toMediaListEntry(
  entry: ListEntryData["entry"]
): MediaListEntryData {
  const e = entry as any
  let status = (entry.status?.toUpperCase() || "PLANNING") as MediaListStatus
  if ((status as any) === "CURRENT" || (status as any) === "TRACKING") {
    status = "WATCHING"
  }
  const rewatchedCount =
    entry.rewatched ??
    entry.reread ??
    e.replayed ??
    entry.playCount ??
    e.relistens ??
    0
  const history = parseRewatchHistory(
    e.rewatchHistory ??
      e.rereadHistory ??
      e.replayHistory ??
      e.listenHistory
  )
  return {
    id: entry.id,
    status,
    progress: entry.progress ?? entry.playCount ?? entry.chaptersProgress ?? 0,
    chaptersProgress: entry.chaptersProgress,
    volumesProgress: entry.volumesProgress,
    progressValues: e.progressValues || null,
    score: entry.score ?? null,
    notes: entry.notes || "",
    rewatched: rewatchedCount,
    reread: entry.reread ?? rewatchedCount,
    replayed: e.replayed ?? rewatchedCount,
    private: Boolean(entry.private),
    startedAt: entry.startedAt || null,
    completedAt: entry.completedAt || null,
    rewatchHistory: history.length > 0 ? history : null,
    rereadHistory: history.length > 0 ? history : null,
    replayHistory: history.length > 0 ? history : null,
    connections: e.connections || null,
    watchedEpisodes: Array.isArray(e.watchedEpisodes) ? e.watchedEpisodes : [],
    seasons: Array.isArray(e.seasons) ? e.seasons : [],
  } as MediaListEntryData
}

export function MediaListGrid({
  mediaType,
  activeStatus,
  items,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  isOwner = false,
  onItemUpdated,
  onIncrementProgress,
  mediaTitlePreference = "primary",
  searchQuery,
  facets,
  totalCount,
  className,
}: MediaListGridProps): React.JSX.Element {
  const currentCategory = MEDIA_CATEGORIES.find((c) => c.key === mediaType)
  const progressUnit = currentCategory?.progressLabel || "Ep"
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<ListEntryData | null>(null)

  const handleOpenEditModal = useCallback((target: ListEntryData) => {
    setEditingItem(target)
  }, [])

  // Compute status badge counts from facets
  const statusExpectedCounts = useMemo(() => {
    const map: Record<string, number> = {
      WATCHING: 0,
      ON_HOLD: 0,
      COMPLETED: 0,
      DROPPED: 0,
      PLANNING: 0,
    }

    if (!facets?.statuses) return map

    facets.statuses.forEach((item) => {
      const upper = item.value.toUpperCase()
      if (
        upper === "WATCHING" ||
        upper === "READING" ||
        upper === "PLAYING" ||
        upper === "LISTENING" ||
        upper === "CURRENT"
      ) {
        map.WATCHING = (map.WATCHING || 0) + item.count
      } else if (
        upper === "ON_HOLD" ||
        upper === "HOLD" ||
        upper === "PAUSED"
      ) {
        map.ON_HOLD = (map.ON_HOLD || 0) + item.count
      } else if (upper === "COMPLETED" || upper === "FINISHED") {
        map.COMPLETED = (map.COMPLETED || 0) + item.count
      } else if (upper === "DROPPED") {
        map.DROPPED = (map.DROPPED || 0) + item.count
      } else if (upper === "PLANNING") {
        map.PLANNING = (map.PLANNING || 0) + item.count
      }
    })

    return map
  }, [facets?.statuses])

  // When All is selected, separate entries by status in this exact order:
  // 1. Watching (or Reading / Playing)
  // 2. On hold
  // 3. Completed
  // 4. Dropped
  // 5. Planning
  const groupedSections = useMemo(() => {
    if (activeStatus && activeStatus !== "ALL") {
      return null
    }

    const watchingSection = {
      key: "WATCHING",
      title: currentCategory?.activeVerb || "Watching",
      expectedCount: statusExpectedCounts.WATCHING ?? 0,
      items: [] as ListEntryData[],
    }
    const onHoldSection = {
      key: "ON_HOLD",
      title: "On hold",
      expectedCount: statusExpectedCounts.ON_HOLD ?? 0,
      items: [] as ListEntryData[],
    }
    const completedSection = {
      key: "COMPLETED",
      title: "Completed",
      expectedCount: statusExpectedCounts.COMPLETED ?? 0,
      items: [] as ListEntryData[],
    }
    const droppedSection = {
      key: "DROPPED",
      title: "Dropped",
      expectedCount: statusExpectedCounts.DROPPED ?? 0,
      items: [] as ListEntryData[],
    }
    const planningSection = {
      key: "PLANNING",
      title: "Planning",
      expectedCount: statusExpectedCounts.PLANNING ?? 0,
      items: [] as ListEntryData[],
    }

    for (const item of items) {
      const upperStatus = (item.entry.status || "").toUpperCase()
      if (
        upperStatus === "WATCHING" ||
        upperStatus === "READING" ||
        upperStatus === "PLAYING" ||
        upperStatus === "CURRENT" ||
        upperStatus === "LISTENING"
      ) {
        watchingSection.items.push(item)
      } else if (
        upperStatus === "ON_HOLD" ||
        upperStatus === "HOLD" ||
        upperStatus === "PAUSED"
      ) {
        onHoldSection.items.push(item)
      } else if (upperStatus === "COMPLETED" || upperStatus === "FINISHED") {
        completedSection.items.push(item)
      } else if (upperStatus === "DROPPED") {
        droppedSection.items.push(item)
      } else {
        planningSection.items.push(item)
      }
    }

    const sections = [
      watchingSection,
      onHoldSection,
      completedSection,
      droppedSection,
      planningSection,
    ]

    const hasFilter = Boolean(searchQuery?.trim())

    return sections.filter((sec) => {
      // If a search query is active, only show sections that contain matching loaded items
      if (hasFilter) {
        return sec.items.length > 0
      }

      // If we have loaded items for this section, always keep it
      if (sec.items.length > 0) return true

      // If items are still streaming/loading and this status exists in user's library, keep section visible
      if (sec.expectedCount > 0 && (hasMore || isLoadingMore)) {
        return true
      }

      return false
    })
  }, [
    items,
    activeStatus,
    currentCategory?.activeVerb,
    statusExpectedCounts,
    searchQuery,
    hasMore,
    isLoadingMore,
  ])

  // Infinite Scroll IntersectionObserver with generous rootMargin
  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore || !onLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: "1200px" }
    )

    const el = sentinelRef.current
    if (el) observer.observe(el)

    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasMore, isLoading, isLoadingMore, onLoadMore])

  // Initial Loading
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex min-h-[360px] w-full items-center justify-center py-20",
          className
        )}
      >
        <Spinner className="size-8 text-primary" />
      </div>
    )
  }

  // Empty State
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
          <IconInbox className="size-7" />
        </div>
        <h3 className="mt-4 font-heading text-base font-semibold text-foreground">
          {searchQuery
            ? `No entries found matching "${searchQuery}"`
            : "No entries found"}
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {searchQuery
            ? "No items in this list match your search query or synonyms. Try another keyword or clear the search."
            : "There are no items matching the selected status or filters in this list."}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {groupedSections ? (
        <div className="flex flex-col gap-8">
          {groupedSections.map((section, sectionIdx) => {
            const isSectionLoading =
              (hasMore || isLoadingMore) &&
              section.items.length < section.expectedCount
            const displayCount =
              section.expectedCount > 0 && (hasMore || isLoadingMore)
                ? section.expectedCount
                : section.items.length

            // Skeleton placeholders for pending items (capped at 12)
            const skeletonCount = isSectionLoading
              ? Math.min(
                  12,
                  Math.max(
                    section.items.length === 0 ? 4 : 2,
                    section.expectedCount - section.items.length
                  )
                )
              : 0

            return (
              <div key={section.key} className="flex flex-col gap-3">
                {/* Section Header with Title & Count */}
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground sm:text-base">
                    {section.title}
                  </h2>
                  <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
                    {displayCount}
                  </span>
                </div>

                {/* Fixed-Size Auto-Fill Grid */}
                <div className="grid grid-cols-[repeat(auto-fill,140px)] gap-2.5 sm:gap-3">
                  {section.items.map((item, idx) => (
                    <MediaListCard
                      key={`${item.entry.id}-${item.media.id}`}
                      item={item}
                      mediaType={mediaType}
                      mediaTitlePreference={mediaTitlePreference}
                      progressUnit={progressUnit}
                      onOpenEditModal={handleOpenEditModal}
                      onIncrementProgress={
                        isOwner ? onIncrementProgress : undefined
                      }
                      priority={sectionIdx === 0 && idx === 0}
                    />
                  ))}

                  {/* Skeleton Placeholders while pending items stream in */}
                  {Array.from({ length: skeletonCount }).map((_, sIdx) => (
                    <MediaListCardSkeleton
                      key={`skeleton-${section.key}-${sIdx}`}
                      isMusic={mediaType === "music"}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,140px)] gap-2.5 sm:gap-3">
          {items.map((item, idx) => (
            <MediaListCard
              key={`${item.entry.id}-${item.media.id}`}
              item={item}
              mediaType={mediaType}
              mediaTitlePreference={mediaTitlePreference}
              progressUnit={progressUnit}
              onOpenEditModal={handleOpenEditModal}
              onIncrementProgress={isOwner ? onIncrementProgress : undefined}
              priority={idx === 0}
            />
          ))}
        </div>
      )}

      {/* Edit List Modal */}
      {editingItem && (
        <MediaListModal
          isOpen={Boolean(editingItem)}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null)
          }}
          media={toNormalizedMedia(editingItem.media, mediaType)}
          initialEntry={toMediaListEntry(editingItem.entry)}
          onEntryUpdated={(updated) => {
            if (onItemUpdated && editingItem) {
              onItemUpdated(editingItem.entry.id, updated)
            }
            setEditingItem(null)
          }}
        />
      )}

      {/* Infinite Scroll Sentinel & Loading Indicator */}
      <div
        ref={sentinelRef}
        className="flex h-12 w-full items-center justify-center"
      >
        {isLoadingMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-4" />
            <span>Loading more items…</span>
          </div>
        )}
      </div>
    </div>
  )
}
