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
import { cn } from "@workspace/ui/lib/utils"
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

export function resolveCoverImage(
  media: ListEntryData["media"]
): string | null {
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
      if (b.seasonNumber !== a.seasonNumber)
        return b.seasonNumber - a.seasonNumber
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
    const activeSeasons = entrySeasons
      .filter((es: any) => es.progress > 0)
      .sort((a: any, b: any) => b.seasonNumber - a.seasonNumber)
    if (activeSeasons.length > 0) {
      const latest = activeSeasons[0]
      const sObj = seasons.find((s) => s.seasonNumber === latest.seasonNumber)
      return {
        seasonNumber: latest.seasonNumber,
        episodeNumber: latest.progress,
        seasonEpisodeCount: sObj?.episodeCount ?? undefined,
      }
    }
  }

  // 3. Fallback: cumulative episodes calculated across seasons
  const overallProg = entry.progress ?? 0
  if (seasons.length > 0) {
    let remaining = overallProg
    const sortedSeasons = [...seasons].sort(
      (a, b) => a.seasonNumber - b.seasonNumber
    )
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

  const isMusic = mediaType === "music"
  const isTrack =
    isMusic &&
    (media.format === "TRACK" ||
      entry.itemType === "TRACK" ||
      Boolean(entry.trackId && !entry.albumId))
  const mediaHref = isMusic
    ? `/IRIS-list/media/music/${isTrack ? "tracks" : "albums"}/${media.id}`
    : `/IRIS-list/media/${mediaType}/${media.id}`

  const maxProgress: number | undefined = (() => {
    if (mediaType === "manga") {
      if (
        typeof (media as any).chapterCount === "number" &&
        (media as any).chapterCount > 0
      ) {
        return (media as any).chapterCount
      }
      if (
        typeof (media as any).chapters === "number" &&
        (media as any).chapters > 0
      ) {
        return (media as any).chapters
      }
      return undefined
    }
    if (mediaType === "anime") {
      if (
        typeof (media as any).episodeCount === "number" &&
        (media as any).episodeCount > 0
      ) {
        return (media as any).episodeCount
      }
      if (
        Array.isArray((media as any).episodes) &&
        (media as any).episodes.length > 0
      ) {
        return (media as any).episodes.length
      }
      if (
        typeof (media as any).episodes === "number" &&
        (media as any).episodes > 0
      ) {
        return (media as any).episodes
      }
      return undefined
    }
    if (mediaType === "tv") {
      if (
        typeof (media as any).episodeCount === "number" &&
        (media as any).episodeCount > 0
      ) {
        return (media as any).episodeCount
      }
      if (
        Array.isArray((media as any).episodes) &&
        (media as any).episodes.length > 0
      ) {
        return (media as any).episodes.length
      }
      if (
        typeof (media as any).episodes === "number" &&
        (media as any).episodes > 0
      ) {
        return (media as any).episodes
      }
      return undefined
    }
    if (mediaType === "book") {
      if (
        typeof (media as any).chapterCount === "number" &&
        (media as any).chapterCount > 0
      ) {
        return (media as any).chapterCount
      }
      if (
        typeof (media as any).pageCount === "number" &&
        (media as any).pageCount > 0
      ) {
        return (media as any).pageCount
      }
      return undefined
    }
    return undefined
  })()

  const maxVolumes: number | undefined = (() => {
    if (mediaType === "manga") {
      if (
        typeof (media as any).volumeCount === "number" &&
        (media as any).volumeCount > 0
      ) {
        return (media as any).volumeCount
      }
      if (
        typeof (media as any).volumes === "number" &&
        (media as any).volumes > 0
      ) {
        return (media as any).volumes
      }
    }
    return undefined
  })()

  const currentProgress =
    mediaType === "manga"
      ? (entry.chaptersProgress ?? entry.progress ?? 0)
      : (entry.progress ?? 0)

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
    upperStatus === "PLAYING" ||
    upperStatus === "LISTENING"

  const handleIncrementClick = () => {
    if (!onIncrementProgress) return
    if (isAtMax) return
    if (
      typeof maxProgress === "number" &&
      maxProgress > 0 &&
      currentProgress + displayDelta >= maxProgress
    ) {
      return
    }

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
      {/* Cover Image & Overlays Container - 1:1 square for music, 2:3 for posters */}
      <div
        className={cn(
          "relative w-full overflow-hidden bg-muted select-none",
          isMusic ? "aspect-square" : "aspect-2/3"
        )}
      >
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
          className="absolute inset-0 block size-full"
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
          className="pointer-events-none absolute start-1.5 top-1.5 z-20 size-6 cursor-pointer rounded-md bg-black/70 text-white/90 opacity-0 backdrop-blur-md group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-black/90 hover:text-white focus-visible:pointer-events-auto focus-visible:opacity-100"
        >
          <IconMenu2 className="size-3.5" />
        </Button>

        {/* Bottom-Right: Quick Increment (+) Button (Visible on hover, only when active) */}
        {isWatchingOrActive && onIncrementProgress && mediaType !== "movie" && (
          <Button
            variant="ghost"
            size="icon-xs"
            onPress={handleIncrementClick}
            isDisabled={isAtMax}
            aria-label={`Increment ${progressUnit}`}
            className="pointer-events-none absolute end-1.5 bottom-1.5 z-20 size-6 cursor-pointer rounded-md bg-black/70 text-white/90 opacity-0 shadow-xs backdrop-blur-md group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconPlus className="size-3.5" />
          </Button>
        )}

        {/* Bottom-Left: Vertically Stacked Badges */}
        <div className="pointer-events-none absolute start-1.5 bottom-1.5 z-10 flex max-w-[calc(100%-2rem)] flex-col items-start gap-1 select-none">
          {/* 1. Connections Count Badge */}
          {connectedCount > 0 && (
            <div
              className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow-xs backdrop-blur-md"
              title={`${connectedCount} connected service${connectedCount === 1 ? "" : "s"}`}
            >
              <IconLink className="size-2.5 shrink-0 text-primary" />
              <span>{connectedCount}</span>
            </div>
          )}

          {/* 2. Progress Badge: Season/Episode, Volume/Chapter, Ep, Hrs, Pages, or Plays */}
          {mediaType === "movie" ? (
            entry.rewatched && entry.rewatched > 0 ? (
              <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow-xs backdrop-blur-md">
                <span>Rewatched {entry.rewatched}x</span>
              </div>
            ) : null
          ) : mediaType === "tv" && tvProg ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow-xs backdrop-blur-md">
              <span className="font-semibold text-white">
                S{tvProg.seasonNumber}
              </span>
              <span className="text-white/80">/E{tvDisplayEpisode}</span>
              {tvProg.seasonEpisodeCount ? (
                <span className="font-semibold text-primary">
                  /{tvProg.seasonEpisodeCount}
                </span>
              ) : null}
            </div>
          ) : mediaType === "manga" ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow-xs backdrop-blur-md">
              {typeof maxVolumes === "number" || volumesProgress > 0 ? (
                <span className="font-semibold text-white">
                  V{volumesProgress}
                  {typeof maxVolumes === "number" && maxVolumes > 0 ? (
                    <span className="font-semibold text-primary">
                      /{maxVolumes}
                    </span>
                  ) : null}
                  /
                </span>
              ) : null}
              <span>CH{displayedProgress}</span>
              {typeof maxProgress === "number" && maxProgress > 0 ? (
                <span className="font-semibold text-primary">
                  /{maxProgress}
                </span>
              ) : null}
            </div>
          ) : mediaType === "game" ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow-xs backdrop-blur-md">
              <span>{displayedProgress} Hrs</span>
            </div>
          ) : mediaType === "book" ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow-xs backdrop-blur-md">
              <span>P {displayedProgress}</span>
              {typeof maxProgress === "number" && maxProgress > 0 ? (
                <span className="font-semibold text-primary">
                  /{maxProgress}
                </span>
              ) : null}
            </div>
          ) : mediaType === "music" ? (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow-xs backdrop-blur-md">
              <span>{displayedProgress} Plays</span>
            </div>
          ) : (
            <div className="flex items-center rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90 shadow-xs backdrop-blur-md">
              <span>
                {progressUnit} {displayedProgress}
              </span>
              {typeof maxProgress === "number" && maxProgress > 0 ? (
                <span className="font-semibold text-primary">
                  /{maxProgress}
                </span>
              ) : null}
            </div>
          )}

          {/* 3. Score Badge (score/10) */}
          {typeof entry.score === "number" && entry.score > 0 && (
            <div className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 shadow-xs backdrop-blur-md">
              <IconStar className="size-2.5 shrink-0 fill-amber-400" />
              <span>
                {Number(
                  (entry.score > 10 ? entry.score / 10 : entry.score).toFixed(1)
                )}
                /10
              </span>
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
          className="line-clamp-2 text-[11px] leading-tight font-semibold text-foreground hover:text-primary sm:text-xs"
        >
          {title}
        </Link>
        {isMusic && (media.artistName || (media as any).artist) && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
            {media.artistName || (media as any).artist}
          </p>
        )}
      </div>
    </div>
  )
}
