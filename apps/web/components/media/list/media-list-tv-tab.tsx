"use client"

import React, { useState } from "react"
import {
  IconChevronDown,
  IconChevronRight,
  IconCheck,
  IconDeviceTv,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import type { CanonicalMediaCategory } from "./types"

export interface TvSeasonItem {
  id?: number
  seasonNumber: number
  title?: string | null
  name?: string | null
  episodeCount?: number | null
  episodes?: Array<{
    id?: number
    episodeNumber: number
    title?: string | null
    name?: string | null
  }>
}

export interface AnimeEpisodeItem {
  id?: number
  number: number
  titlePrimary?: string | null
  titleSecondary?: string | null
  description?: string | null
  isFiller?: boolean
  isRecap?: boolean
}

export interface WatchedEpisodeItem {
  seasonNumber: number
  episodeNumber: number
  watchedAt: string
}

export interface MediaListTvTabProps {
  mediaId: number
  category?: CanonicalMediaCategory
  seasons?: TvSeasonItem[]
  episodes?: AnimeEpisodeItem[]
  episodeCount?: number | null
  progress?: number
  onProgressChange?: (newProgress: number) => void
  watchedEpisodes?: WatchedEpisodeItem[]
  onWatchedEpisodesChange?: (newWatched: WatchedEpisodeItem[]) => void
}

export function MediaListTvTab({
  category = "tv",
  seasons = [],
  episodes = [],
  episodeCount = null,
  progress = 0,
  onProgressChange,
  watchedEpisodes = [],
  onWatchedEpisodesChange,
}: MediaListTvTabProps) {
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({
    1: true,
  })

  // ==========================================
  // Anime Episode Handling (Local state only, saves on Save button)
  // ==========================================
  const isAnime = category === "anime"
  const animeTotalEpisodes =
    episodes && episodes.length > 0
      ? episodes.length
      : episodeCount && episodeCount > 0
        ? episodeCount
        : 0

  const handleAnimeToggleEpisode = (episodeNumber: number) => {
    const isCurrentProgress = progress === episodeNumber
    const nextProgress = isCurrentProgress ? episodeNumber - 1 : episodeNumber
    const clampedProgress = Math.max(0, nextProgress)
    onProgressChange?.(clampedProgress)
  }

  const handleAnimeMarkAll = (markAll: boolean) => {
    if (animeTotalEpisodes <= 0) return
    const nextProgress = markAll ? animeTotalEpisodes : 0
    onProgressChange?.(nextProgress)
  }

  // ==========================================
  // TV Series Handling (Local state only, saves on Save button)
  // ==========================================
  const isEpisodeWatched = (seasonNumber: number, episodeNumber: number) => {
    return watchedEpisodes.some(
      (we) =>
        we.seasonNumber === seasonNumber && we.episodeNumber === episodeNumber
    )
  }

  const toggleSeasonExpanded = (seasonNum: number) => {
    setExpandedSeasons((prev) => ({
      ...prev,
      [seasonNum]: !prev[seasonNum],
    }))
  }

  const handleToggleTvEpisode = (
    seasonNumber: number,
    episodeNumber: number
  ) => {
    const currentlyWatched = isEpisodeWatched(seasonNumber, episodeNumber)
    const nextWatched = !currentlyWatched

    let nextWatchedList: WatchedEpisodeItem[]
    if (nextWatched) {
      nextWatchedList = [
        ...watchedEpisodes,
        {
          seasonNumber,
          episodeNumber,
          watchedAt: new Date().toISOString(),
        },
      ]
    } else {
      nextWatchedList = watchedEpisodes.filter(
        (we) =>
          !(we.seasonNumber === seasonNumber && we.episodeNumber === episodeNumber)
      )
    }

    onWatchedEpisodesChange?.(nextWatchedList)
    onProgressChange?.(nextWatchedList.length)
  }

  const handleMarkTvSeasonAll = (season: TvSeasonItem, markWatched: boolean) => {
    const seasonNum = season.seasonNumber ?? 1
    const totalEpisodes =
      season.episodes?.length || season.episodeCount || 0
    if (totalEpisodes <= 0) return

    let nextWatchedList: WatchedEpisodeItem[]
    if (markWatched) {
      const otherSeasonsWatched = watchedEpisodes.filter(
        (we) => we.seasonNumber !== seasonNum
      )
      const now = new Date().toISOString()
      const newSeasonWatched = Array.from({ length: totalEpisodes }, (_, i) => ({
        seasonNumber: seasonNum,
        episodeNumber: i + 1,
        watchedAt: now,
      }))
      nextWatchedList = [...otherSeasonsWatched, ...newSeasonWatched]
    } else {
      nextWatchedList = watchedEpisodes.filter(
        (we) => we.seasonNumber !== seasonNum
      )
    }

    onWatchedEpisodesChange?.(nextWatchedList)
    onProgressChange?.(nextWatchedList.length)
  }

  // ==========================================
  // RENDER: Anime Mode
  // ==========================================
  if (isAnime) {
    if (animeTotalEpisodes <= 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <IconDeviceTv className="size-8 opacity-40" />
          <p className="mt-2 text-xs font-medium text-foreground">No Episode Data Available</p>
          <p className="text-[11px] text-muted-foreground">
            Use the general progress stepper on the first tab to track overall episodes.
          </p>
        </div>
      )
    }

    const isAllWatched = progress >= animeTotalEpisodes

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Episodes</h3>
            <Badge
              variant={isAllWatched ? "default" : "secondary"}
              className="text-[10px] px-2 py-0.5 font-mono"
            >
              {progress} / {animeTotalEpisodes}
            </Badge>
          </div>

          <Button
            variant="outline"
            size="xs"
            onClick={() => handleAnimeMarkAll(!isAllWatched)}
            className="h-7 cursor-pointer text-xs font-medium border-border px-3"
          >
            {isAllWatched ? "Reset All" : "Mark All Watched"}
          </Button>
        </div>

        {/* Vertical Scrollable Episodes List */}
        <div className="max-h-[380px] overflow-y-auto space-y-1.5 pe-1 no-scrollbar rounded-2xl border border-border bg-muted/30 p-2.5">
          {Array.from({ length: animeTotalEpisodes }, (_, idx) => {
            const epNum = idx + 1
            const isWatched = epNum <= progress
            const epItem = episodes.find((e) => e.number === epNum)
            const title = epItem?.titlePrimary || epItem?.titleSecondary || null

            return (
              <button
                key={epNum}
                type="button"
                onClick={() => handleAnimeToggleEpisode(epNum)}
                className={`group flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-start transition-colors cursor-pointer ${
                  isWatched
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 font-mono text-xs font-bold text-muted-foreground w-12">
                    Ep {epNum}
                  </span>
                  <span className={`truncate text-xs font-medium ${isWatched ? "text-foreground font-semibold" : "text-foreground"}`}>
                    {title || `Episode ${epNum}`}
                  </span>
                </div>
                <span
                  className={`flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    isWatched
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card group-hover:border-foreground/40"
                  }`}
                >
                  {isWatched && <IconCheck className="size-2.5 stroke-[3]" />}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: TV Mode
  // ==========================================
  const effectiveSeasons: TvSeasonItem[] =
    seasons && seasons.length > 0
      ? seasons
      : episodeCount && episodeCount > 0
        ? [
            {
              seasonNumber: 1,
              title: "Season 1",
              episodeCount: episodeCount,
            },
          ]
        : []

  if (effectiveSeasons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <IconDeviceTv className="size-8 opacity-40" />
        <p className="mt-2 text-xs font-medium text-foreground">No Season Data Available</p>
        <p className="text-[11px] text-muted-foreground">
          Use the general progress stepper on the first tab to track overall episodes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Seasons & Episodes</h3>
      </div>

      <div className="space-y-2">
        {effectiveSeasons.map((season) => {
          const seasonNum = season.seasonNumber
          const isExpanded = Boolean(expandedSeasons[seasonNum])
          const count = season.episodeCount || season.episodes?.length || 0

          const watchedInSeason = watchedEpisodes.filter(
            (we) => we.seasonNumber === seasonNum
          ).length

          const isFullyWatched = count > 0 && watchedInSeason >= count

          return (
            <div
              key={seasonNum}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {/* Season Header Accordion Trigger */}
              <div
                className="flex cursor-pointer items-center justify-between gap-2 p-3 transition-colors hover:bg-muted/50"
                onClick={() => toggleSeasonExpanded(seasonNum)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    className="text-muted-foreground transition-transform"
                    aria-label="Expand season"
                  >
                    {isExpanded ? (
                      <IconChevronDown className="size-4" />
                    ) : (
                      <IconChevronRight className="size-4" />
                    )}
                  </button>
                  <span className="truncate text-xs font-semibold text-foreground">
                    Season {seasonNum}
                    {season.title ? ` • ${season.title}` : ""}
                  </span>
                  <Badge
                    variant={isFullyWatched ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 font-mono"
                  >
                    {watchedInSeason} / {count || "?"}
                  </Badge>
                </div>

                <div
                  className="flex shrink-0 items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleMarkTvSeasonAll(season, !isFullyWatched)}
                    className="h-6.5 text-[11px] font-medium border-border"
                  >
                    {isFullyWatched ? "Reset" : "Mark Watched"}
                  </Button>
                </div>
              </div>

              {/* Episode Vertical Scrollable List */}
              {isExpanded && count > 0 && (
                <div className="border-t border-border bg-muted/20 p-2.5 max-h-[300px] overflow-y-auto space-y-1.5 pe-1 no-scrollbar">
                  {Array.from({ length: count }, (_, idx) => {
                    const epNum = idx + 1
                    const isWatched = isEpisodeWatched(seasonNum, epNum)
                    const epItem = season.episodes?.find((e) => e.episodeNumber === epNum)
                    const title = epItem?.title || epItem?.name || null

                    return (
                      <button
                        key={epNum}
                        type="button"
                        onClick={() => handleToggleTvEpisode(seasonNum, epNum)}
                        className={`group flex w-full items-center justify-between gap-3 rounded-xl border p-2 text-xs font-medium transition-colors cursor-pointer ${
                          isWatched
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-card hover:border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="shrink-0 font-mono text-xs font-bold text-muted-foreground w-12">
                            Ep {epNum}
                          </span>
                          <span className={`truncate text-xs font-medium ${isWatched ? "text-foreground font-semibold" : "text-foreground"}`}>
                            {title || `Episode ${epNum}`}
                          </span>
                        </div>
                        <span
                          className={`flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isWatched
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card group-hover:border-foreground/40"
                          }`}
                        >
                          {isWatched && <IconCheck className="size-2.5 stroke-[3]" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
