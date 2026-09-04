"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  IconStar,
  IconPhotoOff,
  IconInbox,
  IconMenu2,
  IconLink,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { MediaListModal } from "@/components/media/list/media-list-modal"
import type { NormalizedMediaData } from "@/components/media/media-types"
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
  mediaTitlePreference?: "primary" | "secondary" | "native"
  className?: string
}

function resolveMediaTitle(
  media: ListEntryData["media"],
  pref: "primary" | "secondary" | "native" = "primary"
): string {
  if (pref === "secondary" && (media.titleEnglish || media.titleRomaji)) {
    return media.titleEnglish || media.titleRomaji || ""
  }
  if (pref === "native" && media.titleNative) {
    return media.titleNative
  }
  return (
    media.titlePrimary ||
    media.titleEnglish ||
    media.titleRomaji ||
    media.titleNative ||
    media.title ||
    media.name ||
    "Untitled"
  )
}

function resolveCoverImage(media: ListEntryData["media"]): string | null {
  return media.coverImage || media.posterImage || media.bannerImage || null
}

function getConnectedCount(connections: unknown): number {
  if (!connections) return 0
  if (Array.isArray(connections)) {
    return connections.filter(Boolean).length
  }
  if (typeof connections === "object") {
    return Object.keys(connections as Record<string, unknown>).filter((key) => {
      const val = (connections as Record<string, unknown>)[key]
      if (!val) return false
      if (typeof val === "object") {
        return Object.keys(val).length > 0
      }
      return true
    }).length
  }
  return 0
}

function toNormalizedMedia(
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
    titleSecondary: media.titleEnglish || media.titleRomaji || null,
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
        : Array.isArray((media as any).episodes) && (media as any).episodes.length > 0
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

function toMediaListEntry(entry: ListEntryData["entry"]): MediaListEntryData {
  const e = entry as any
  return {
    id: entry.id,
    status: (entry.status?.toUpperCase() || "PLANNING") as MediaListStatus,
    progress: entry.progress ?? entry.chaptersProgress ?? 0,
    chaptersProgress: entry.chaptersProgress,
    volumesProgress: entry.volumesProgress,
    score: entry.score ?? null,
    notes: entry.notes || "",
    rewatched: entry.rewatched ?? entry.reread ?? 0,
    private: Boolean(entry.private),
    startedAt: entry.startedAt || null,
    completedAt: entry.completedAt || null,
    rewatchHistory: e.rewatchHistory || null,
    connections: e.connections || null,
    watchedEpisodes: Array.isArray(e.watchedEpisodes) ? e.watchedEpisodes : [],
    seasons: Array.isArray(e.seasons) ? e.seasons : [],
  } as MediaListEntryData
}

interface MediaListCardProps {
  item: ListEntryData
  mediaType: MediaListType
  mediaTitlePreference: "primary" | "secondary" | "native"
  progressUnit: string
  onOpenEditModal: (item: ListEntryData) => void
}

function computeTvProgress(item: ListEntryData): {
  seasonNumber: number
  episodeNumber: number
  seasonEpisodeCount?: number
} {
  const { entry, media } = item
  const seasons: any[] = Array.isArray(media.seasons) ? media.seasons : []
  const entrySeasons: any[] = Array.isArray((entry as any).seasons)
    ? (entry as any).seasons
    : []
  const watchedEpisodes: any[] = Array.isArray((entry as any).watchedEpisodes)
    ? (entry as any).watchedEpisodes
    : []

  // 1. From watchedEpisodes: find the highest season and episode watched
  if (watchedEpisodes.length > 0) {
    const sorted = [...watchedEpisodes].sort((a, b) => {
      if (b.seasonNumber !== a.seasonNumber) return b.seasonNumber - a.seasonNumber
      return b.episodeNumber - a.episodeNumber
    })
    const latest = sorted[0]
    const sObj = seasons.find((s) => s.seasonNumber === latest.seasonNumber)
    return {
      seasonNumber: latest.seasonNumber,
      episodeNumber: latest.episodeNumber,
      seasonEpisodeCount: sObj?.episodeCount ?? undefined,
    }
  }

  // 2. From entrySeasons: find latest season with progress > 0
  if (entrySeasons.length > 0) {
    const sorted = [...entrySeasons].sort((a, b) => b.seasonNumber - a.seasonNumber)
    const inProgressSeason = sorted.find((s) => (s.progress ?? 0) > 0) || sorted[0]
    if (inProgressSeason) {
      const sObj = seasons.find((s) => s.seasonNumber === inProgressSeason.seasonNumber)
      return {
        seasonNumber: inProgressSeason.seasonNumber,
        episodeNumber: inProgressSeason.progress ?? 0,
        seasonEpisodeCount: sObj?.episodeCount ?? undefined,
      }
    }
  }

  // 3. From overall progress & media.seasons
  const overallProg = entry.progress ?? 0
  if (seasons.length > 0) {
    let remaining = overallProg
    const sortedSeasons = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber)
    for (let i = 0; i < sortedSeasons.length; i++) {
      const s = sortedSeasons[i]
      const count = s.episodeCount || 0
      if (i === sortedSeasons.length - 1 || remaining <= count) {
        return {
          seasonNumber: s.seasonNumber,
          episodeNumber: remaining,
          seasonEpisodeCount: count > 0 ? count : undefined,
        }
      }
      remaining -= count
    }
  }

  // 4. Default fallback
  return {
    seasonNumber: 1,
    episodeNumber: overallProg,
    seasonEpisodeCount: media.episodes ?? undefined,
  }
}

function MediaListCard({
  item,
  mediaType,
  mediaTitlePreference,
  progressUnit,
  onOpenEditModal,
}: MediaListCardProps): React.JSX.Element {
  const { entry, media } = item
  const title = resolveMediaTitle(media, mediaTitlePreference)
  const cover = resolveCoverImage(media)
  const mediaHref = `/IRIS-list/media/${mediaType}/${media.id}`

  const maxProgress =
    mediaType === "manga"
      ? media.chapters
      : mediaType === "anime" || mediaType === "tv"
        ? media.episodes
        : undefined

  const maxVolumes = mediaType === "manga" ? media.volumes : undefined

  const currentProgress =
    mediaType === "manga"
      ? entry.chaptersProgress ?? entry.progress ?? 0
      : entry.progress ?? 0

  const volumesProgress = entry.volumesProgress ?? 0

  const tvProg = useMemo(
    () => (mediaType === "tv" ? computeTvProgress(item) : null),
    [item, mediaType]
  )

  const connectedCount = getConnectedCount(entry.connections)

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressRef = useRef<boolean>(false)

  const handleTouchStart = () => {
    isLongPressRef.current = false
    touchTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      onOpenEditModal(item)
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(40)
        } catch {}
      }
    }, 300)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
    if (isLongPressRef.current) {
      e.preventDefault()
    }
  }

  const handleTouchMove = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchMove}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card"
    >
      {/* Cover Image */}
      <Link
        href={mediaHref}
        onClick={(e) => {
          if (isLongPressRef.current) {
            e.preventDefault()
            e.stopPropagation()
            isLongPressRef.current = false
          }
        }}
        className="relative aspect-2/3 w-full overflow-hidden bg-muted select-none"
      >
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 12.5vw"
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground/50">
            <IconPhotoOff className="size-6" />
          </div>
        )}

        {/* Connection Count Badge (Top-Left, visible only on hover) */}
        {connectedCount > 0 && (
          <div
            className="absolute top-1.5 start-1.5 z-10 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 select-none shadow-xs"
            title={`${connectedCount} connected service${connectedCount === 1 ? "" : "s"}`}
          >
            <IconLink className="size-2.5 text-primary" />
            <span>{connectedCount}</span>
          </div>
        )}

        {/* Hamburger Icon Overlay (Top-Right, visible only on hover) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onOpenEditModal(item)
          }}
          title="Edit list entry"
          className="absolute top-1.5 end-1.5 z-10 flex size-6 items-center justify-center rounded-md bg-black/70 text-white/90 backdrop-blur-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto transition-opacity duration-150 hover:bg-black/90 hover:text-white cursor-pointer select-none"
        >
          <IconMenu2 className="size-3.5" />
        </button>

        {/* Bottom Badges Overlay: Score, Progress */}
        <div className="absolute bottom-1.5 start-1.5 end-1.5 flex items-center gap-1 flex-wrap pointer-events-none select-none">
          {/* Score Badge */}
          {typeof entry.score === "number" && entry.score > 0 && (
            <div className="flex items-center gap-0.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 backdrop-blur-md shadow-xs">
              <IconStar className="size-2.5 fill-amber-400" />
              <span>{entry.score}</span>
            </div>
          )}

          {/* Progress Badges: Type-specific */}
          {mediaType === "movie" ? null : mediaType === "tv" && tvProg ? (
            <>
              <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-md shadow-xs">
                <span>S{tvProg.seasonNumber}</span>
              </div>
              <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
                <span>
                  Ep {tvProg.episodeNumber}
                  {tvProg.seasonEpisodeCount ? `/${tvProg.seasonEpisodeCount}` : ""}
                </span>
              </div>
            </>
          ) : mediaType === "manga" ? (
            <>
              <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
                <span>
                  Ch {currentProgress}
                  {typeof maxProgress === "number" && maxProgress > 0
                    ? `/${maxProgress}`
                    : ""}
                </span>
              </div>
              <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
                <span>
                  Vol {volumesProgress}
                  {typeof maxVolumes === "number" && maxVolumes > 0
                    ? `/${maxVolumes}`
                    : ""}
                </span>
              </div>
            </>
          ) : mediaType === "game" ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
              <span>{currentProgress} Hrs</span>
            </div>
          ) : (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
              <span>
                {progressUnit} {currentProgress}
                {typeof maxProgress === "number" && maxProgress > 0
                  ? `/${maxProgress}`
                  : ""}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Card Meta */}
      <div className="flex flex-1 flex-col p-2">
        <Link
          href={mediaHref}
          title={title}
          onClick={(e) => {
            if (isLongPressRef.current) {
              e.preventDefault()
              e.stopPropagation()
              isLongPressRef.current = false
            }
          }}
          className="line-clamp-2 text-[11px] sm:text-xs font-semibold text-foreground transition-colors hover:text-primary leading-tight"
        >
          {title}
        </Link>
      </div>
    </div>
  )
}

export function MediaListGrid({
  mediaType,
  activeStatus,
  items,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  onItemUpdated,
  mediaTitlePreference = "primary",
  className,
}: MediaListGridProps): React.JSX.Element {
  const currentCategory = MEDIA_CATEGORIES.find((c) => c.key === mediaType)
  const progressUnit = currentCategory?.progressLabel || "Ep"
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<ListEntryData | null>(null)

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
      } else if (
        upperStatus === "COMPLETED" ||
        upperStatus === "FINISHED"
      ) {
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

  // Initial Loading Skeletons
  if (isLoading) {
    return (
      <div
        className={cn(
          "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-8",
          className
        )}
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-xl border border-border/40 bg-card p-1.5"
          >
            <Skeleton className="aspect-2/3 w-full rounded-lg" />
            <Skeleton className="h-3 w-4/5 rounded-md" />
            <Skeleton className="h-2.5 w-1/2 rounded-md" />
          </div>
        ))}
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
          No entries found
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          There are no items matching the selected status or filters in this
          list.
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
              {/* Section Header with Title and Count Badge */}
              <div className="flex items-center gap-2.5">
                <h2 className="font-heading text-sm sm:text-base font-semibold text-foreground tracking-tight">
                  {section.title}
                </h2>
                <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
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
                    onOpenEditModal={(target) => setEditingItem(target)}
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
              onOpenEditModal={(target) => setEditingItem(target)}
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
            <span>Loading more items...</span>
          </div>
        )}
      </div>
    </div>
  )
}
