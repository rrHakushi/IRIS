"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  IconStar,
  IconPhotoOff,
  IconMenu2,
  IconLink,
  IconPlus,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import type { ListEntryData, MediaListType } from "./types"

export interface MediaListCardProps {
  item: ListEntryData
  mediaType: MediaListType
  mediaTitlePreference?: "primary" | "secondary" | "native"
  progressUnit?: string
  onOpenEditModal: (item: ListEntryData) => void
  onIncrementProgress?: (item: ListEntryData, count: number) => Promise<void>
}

export function resolveMediaTitle(
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

export function resolveCoverImage(media: ListEntryData["media"]): string | null {
  return media.coverImage || media.posterImage || media.bannerImage || null
}

export function getConnectedCount(connections: unknown): number {
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

export function computeTvProgress(item: ListEntryData): {
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

export function MediaListCard({
  item,
  mediaType,
  mediaTitlePreference = "primary",
  progressUnit = "Ep",
  onOpenEditModal,
  onIncrementProgress,
}: MediaListCardProps): React.JSX.Element {
  const { entry, media } = item
  const title = resolveMediaTitle(media, mediaTitlePreference)
  const cover = resolveCoverImage(media)
  const mediaHref = `/IRIS-list/media/${mediaType}/${media.id}`

  const maxProgress =
    mediaType === "manga"
      ? (media.chapters ?? (media as any).chapterCount ?? undefined)
      : mediaType === "anime"
        ? (media.episodes ?? (media as any).episodeCount ?? undefined)
        : mediaType === "tv"
          ? (media.episodes ?? (media as any).episodeCount ?? undefined)
          : mediaType === "book"
            ? ((media as any).chapterCount ?? (media as any).pageCount ?? undefined)
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

  // ---------------------------------------------------------------------------
  // Debounced Increment State (600ms)
  // ---------------------------------------------------------------------------
  const INCREMENT_DEBOUNCE_MS = 600
  const [displayDelta, setDisplayDelta] = useState<number>(0)
  const pendingCountRef = useRef<number>(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const displayedProgress =
    typeof maxProgress === "number" && maxProgress > 0
      ? Math.min(currentProgress + displayDelta, maxProgress)
      : currentProgress + displayDelta

  const isAtMax =
    typeof maxProgress === "number" &&
    maxProgress > 0 &&
    displayedProgress >= maxProgress

  const tvDisplayEpisode =
    tvProg?.seasonEpisodeCount && tvProg.seasonEpisodeCount > 0
      ? Math.min(tvProg.episodeNumber + displayDelta, tvProg.seasonEpisodeCount)
      : tvProg
        ? tvProg.episodeNumber + displayDelta
        : 0

  // Reset local optimistic delta when entry updates from server/parent,
  // but only when no debounce timer is active to avoid wiping pending clicks.
  useEffect(() => {
    if (!debounceTimerRef.current) {
      setDisplayDelta(0)
      pendingCountRef.current = 0
    }
  }, [entry.progress, entry.chaptersProgress, entry.rewatched, entry.updatedAt])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const upperStatus = (entry.status || "").toUpperCase()
  const isWatchingOrActive =
    upperStatus === "WATCHING" ||
    upperStatus === "READING" ||
    upperStatus === "PLAYING"

  const handleIncrementClick = () => {
    if (!onIncrementProgress) return
    if (isAtMax) return

    pendingCountRef.current += 1
    setDisplayDelta((prev) => prev + 1)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      debounceTimerRef.current = null
      const countToIncrement = pendingCountRef.current
      pendingCountRef.current = 0

      if (countToIncrement > 0) {
        try {
          await onIncrementProgress(item, countToIncrement)
        } catch {
          // Revert optimistic delta on error
          setDisplayDelta(0)
        }
      }
    }, INCREMENT_DEBOUNCE_MS)
  }

  // ---------------------------------------------------------------------------
  // Long-press detection for mobile touch edit modal
  // ---------------------------------------------------------------------------
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
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/40"
    >
      {/* Cover Image & Overlays Container */}
      <div className="relative aspect-2/3 w-full overflow-hidden bg-muted select-none">
        {/* Cover Image Link */}
        <Link
          href={mediaHref}
          onClick={(e) => {
            if (isLongPressRef.current) {
              e.preventDefault()
              e.stopPropagation()
              isLongPressRef.current = false
            }
          }}
          className="absolute inset-0 size-full block"
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
        </Link>

        {/* Top-Left: Hamburger Icon Overlay (Visible on hover) */}
        <Button
          variant="ghost"
          size="icon-xs"
          onPress={() => onOpenEditModal(item)}
          aria-label="Edit list entry"
          className="absolute top-1.5 start-1.5 z-20 size-6 rounded-md bg-black/70 text-white/90 backdrop-blur-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto hover:bg-black/90 hover:text-white cursor-pointer"
        >
          <IconMenu2 className="size-3.5" />
        </Button>

        {/* Bottom-Right: Quick Increment (+) Button (Visible on hover, only when WATCHING/reading/playing) */}
        {isWatchingOrActive && onIncrementProgress && (
          <Button
            variant="ghost"
            size="icon-xs"
            onPress={handleIncrementClick}
            isDisabled={isAtMax}
            aria-label={`Increment ${progressUnit}`}
            className="absolute bottom-1.5 end-1.5 z-20 size-6 rounded-md bg-black/70 text-white/90 backdrop-blur-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto hover:bg-primary hover:text-primary-foreground shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            <IconPlus className="size-3.5" />
          </Button>
        )}

        {/* Bottom-Left: Vertically Stacked Badges */}
        <div className="absolute bottom-1.5 start-1.5 z-10 flex flex-col items-start gap-1 pointer-events-none select-none max-w-[calc(100%-2rem)]">
          {/* 1. Connections Count Badge */}
          {connectedCount > 0 && (
            <div
              className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs"
              title={`${connectedCount} connected service${connectedCount === 1 ? "" : "s"}`}
            >
              <IconLink className="size-2.5 text-primary shrink-0" />
              <span>{connectedCount}</span>
            </div>
          )}

          {/* 2. Progress Badge: Season/Episode, Volume/Chapter, Ep, Hrs, or Pages */}
          {mediaType === "movie" ? (
            entry.rewatched && entry.rewatched > 0 ? (
              <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
                <span>Rewatched {entry.rewatched}x</span>
              </div>
            ) : (
              <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
                <span>Movie</span>
              </div>
            )
          ) : mediaType === "tv" && tvProg ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
              <span className="font-semibold text-white">S{tvProg.seasonNumber}</span>
              <span className="text-white/80">
                /E{tvDisplayEpisode}
                {tvProg.seasonEpisodeCount ? `/${tvProg.seasonEpisodeCount}` : ""}
              </span>
            </div>
          ) : mediaType === "manga" ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
              {typeof maxVolumes === "number" || volumesProgress > 0 ? (
                <span className="font-semibold text-white">V{volumesProgress}/</span>
              ) : null}
              <span>
                CH{displayedProgress}
                {typeof maxProgress === "number" && maxProgress > 0 ? `/${maxProgress}` : ""}
              </span>
            </div>
          ) : mediaType === "game" ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
              <span>{displayedProgress} Hrs</span>
            </div>
          ) : mediaType === "book" ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
              <span>P {displayedProgress}</span>
            </div>
          ) : (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md shadow-xs">
              <span>
                {progressUnit} {displayedProgress}
                {typeof maxProgress === "number" && maxProgress > 0
                  ? `/${maxProgress}`
                  : ""}
              </span>
            </div>
          )}

          {/* 3. Score Badge (score/100) */}
          {typeof entry.score === "number" && entry.score > 0 && (
            <div className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 backdrop-blur-md shadow-xs">
              <IconStar className="size-2.5 fill-amber-400 shrink-0" />
              <span>{entry.score}/100</span>
            </div>
          )}
        </div>
      </div>

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
          className="line-clamp-2 text-[11px] sm:text-xs font-semibold text-foreground hover:text-primary leading-tight"
        >
          {title}
        </Link>
      </div>
    </div>
  )
}
