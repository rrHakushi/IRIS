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
import type {
  MediaListEntryData,
  MediaListStatus,
} from "@/components/media/list/types"
import {
  type ListEntryData,
  type MediaListType,
  type StatusKey,
  MEDIA_CATEGORIES,
} from "./types"
import { MediaListCard } from "./media-list-card"

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
          number: ep.number,
          titlePrimary: ep.titlePrimary || null,
          titleSecondary: ep.titleSecondary || null,
        }))
      : undefined,
    updatedAt: (media as any).updatedAt
      ? new Date((media as any).updatedAt)
      : new Date(),
  }
}

export function toMediaListEntry(
  entry: ListEntryData["entry"]
): MediaListEntryData {
  const e = entry as any
  return {
    id: entry.id,
    status: (entry.status?.toUpperCase() || "PLANNING") as MediaListStatus,
    progress: entry.progress ?? entry.playCount ?? entry.chaptersProgress ?? 0,
    chaptersProgress: entry.chaptersProgress,
    volumesProgress: entry.volumesProgress,
    score: entry.score ?? null,
    notes: entry.notes || "",
    rewatched: entry.rewatched ?? entry.reread ?? (entry as any).relistens ?? 0,
    private: Boolean(entry.private),
    startedAt: entry.startedAt || null,
    completedAt: entry.completedAt || null,
    rewatchHistory: e.rewatchHistory || e.listenHistory || null,
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
      items: [] as ListEntryData[],
    }
    const onHoldSection = {
      key: "ON_HOLD",
      title: "On hold",
      items: [] as ListEntryData[],
    }
    const completedSection = {
      key: "COMPLETED",
      title: "Completed",
      items: [] as ListEntryData[],
    }
    const droppedSection = {
      key: "DROPPED",
      title: "Dropped",
      items: [] as ListEntryData[],
    }
    const planningSection = {
      key: "PLANNING",
      title: "Planning",
      items: [] as ListEntryData[],
    }

    for (const item of items) {
      const upperStatus = (item.entry.status || "").toUpperCase()
      if (
        upperStatus === "WATCHING" ||
        upperStatus === "READING" ||
        upperStatus === "PLAYING" ||
        upperStatus === "CURRENT"
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

    return sections.filter((sec) => sec.items.length > 0)
  }, [items, activeStatus, currentCategory?.activeVerb])

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore || !onLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: "300px" }
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
          {groupedSections.map((section) => (
            <div key={section.key} className="flex flex-col gap-3">
              {/* Section Header with Title & Count */}
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground sm:text-base">
                  {section.title}
                </h2>
                <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
                  {section.items.length}
                </span>
              </div>

              {/* 8-Card Responsive Grid */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-8">
                {section.items.map((item) => (
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
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-8">
          {items.map((item) => (
            <MediaListCard
              key={`${item.entry.id}-${item.media.id}`}
              item={item}
              mediaType={mediaType}
              mediaTitlePreference={mediaTitlePreference}
              progressUnit={progressUnit}
              onOpenEditModal={handleOpenEditModal}
              onIncrementProgress={isOwner ? onIncrementProgress : undefined}
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
