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

function formatEpisodeTitle(
  title: string | null | undefined,
  epNum: number
): string | null {
  if (!title) return null
  const trimmed = title.trim()
  if (!trimmed) return null

  // Strip prefix like "Episode 1 - ", "Episode 1: ", "Episode 1. ", "Episode 01 - ", "Ep. 1 - ", "Ep 1: ", "#1 - ", etc.
  const prefixRegex = new RegExp(
    `^(?:Episode|Ep\\.?|#)\\s*0*${epNum}\\s*[:\\-–—.]\\s*`,
    "i"
  )
  let cleaned = trimmed.replace(prefixRegex, "").trim()

  // Also handle "1 - ", "01 - ", "1: "
  const numPrefixRegex = new RegExp(`^0*${epNum}\\s*[:\\-–—.]\\s*`)
  cleaned = cleaned.replace(numPrefixRegex, "").trim()

  // If the title is literally just "Episode 1", "Episode 01", "Ep 1", "Ep. 1", "#1", or the episode number itself
  const exactRegex = new RegExp(
    `^(?:(?:Episode|Ep\\.?|#)\\s*)?0*${epNum}$`,
    "i"
  )
  if (exactRegex.test(cleaned) || exactRegex.test(trimmed)) {
    return null
  }

  return cleaned || null
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
  const [expandedSeasons, setExpandedSeasons] = useState<
    Record<number, boolean>
  >({})

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
    const clampedProgress =
      animeTotalEpisodes > 0
        ? Math.min(animeTotalEpisodes, Math.max(0, nextProgress))
        : Math.max(0, nextProgress)
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
          !(
            we.seasonNumber === seasonNumber &&
            we.episodeNumber === episodeNumber
          )
      )
    }

    onWatchedEpisodesChange?.(nextWatchedList)
    onProgressChange?.(nextWatchedList.length)
  }

  const handleMarkTvSeasonAll = (
    season: TvSeasonItem,
    markWatched: boolean
  ) => {
    const seasonNum = season.seasonNumber ?? 1
    const totalEpisodes = season.episodes?.length || season.episodeCount || 0
    if (totalEpisodes <= 0) return

    let nextWatchedList: WatchedEpisodeItem[]
    if (markWatched) {
      const otherSeasonsWatched = watchedEpisodes.filter(
        (we) => we.seasonNumber !== seasonNum
      )
      const now = new Date().toISOString()
      const newSeasonWatched = Array.from(
        { length: totalEpisodes },
        (_, i) => ({
          seasonNumber: seasonNum,
          episodeNumber: i + 1,
          watchedAt: now,
        })
      )
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
          <p className="mt-2 text-xs font-medium text-foreground">
            No Episode Data Available
          </p>
          <p className="text-[11px] text-muted-foreground">
            Use the general progress stepper on the first tab to track overall
            episodes.
          </p>
        </div>
      )
    }

    const isAllWatched =
      animeTotalEpisodes > 0 && progress >= animeTotalEpisodes
    const displayProgress =
      animeTotalEpisodes > 0 ? Math.min(progress, animeTotalEpisodes) : progress

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Episodes</h3>
            <Badge
              variant={isAllWatched ? "default" : "secondary"}
              className="px-2 py-0.5 font-mono text-[10px]"
            >
              {displayProgress} / {animeTotalEpisodes}
            </Badge>
          </div>

          <Button
            variant="outline"
            size="xs"
            onClick={() => handleAnimeMarkAll(!isAllWatched)}
            className="h-7 cursor-pointer border-border px-3 text-xs font-medium"
          >
            {isAllWatched ? "Reset All" : "Mark All Watched"}
          </Button>
        </div>

        {/* Vertical Scrollable Episodes List */}
        <div className="no-scrollbar max-h-[380px] space-y-1.5 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-2.5 pe-1">
          {Array.from({ length: animeTotalEpisodes }, (_, idx) => {
            const epNum = idx + 1
            const isWatched = epNum <= progress
            const epItem = episodes.find((e) => e.number === epNum)
            const rawTitle =
              epItem?.titlePrimary || epItem?.titleSecondary || null
            const displayTitle = formatEpisodeTitle(rawTitle, epNum)

            return (
              <button
                key={epNum}
                type="button"
                onClick={() => handleAnimeToggleEpisode(epNum)}
                className={`group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 text-start transition-colors ${
                  isWatched
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-12 shrink-0 font-mono text-xs font-bold text-muted-foreground">
                    Ep {epNum}
                  </span>
                  {displayTitle ? (
                    <span
                      className={`truncate text-xs font-medium ${
                        isWatched
                          ? "font-semibold text-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {displayTitle}
                    </span>
                  ) : null}
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
              title: null,
              episodeCount: episodeCount,
            },
          ]
        : []

  if (effectiveSeasons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <IconDeviceTv className="size-8 opacity-40" />
        <p className="mt-2 text-xs font-medium text-foreground">
          No Season Data Available
        </p>
        <p className="text-[11px] text-muted-foreground">
          Use the general progress stepper on the first tab to track overall
          episodes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">
          Seasons & Episodes
        </h3>
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
                    {season.title &&
                    season.title.trim().toLowerCase() !==
                      `season ${seasonNum}`.toLowerCase()
                      ? ` • ${season.title}`
                      : ""}
                  </span>
                  <Badge
                    variant={isFullyWatched ? "default" : "secondary"}
                    className="px-1.5 py-0 font-mono text-[10px]"
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
                    onClick={() =>
                      handleMarkTvSeasonAll(season, !isFullyWatched)
                    }
                    className="h-6.5 border-border text-[11px] font-medium"
                  >
                    {isFullyWatched ? "Reset" : "Mark Watched"}
                  </Button>
                </div>
              </div>

              {/* Episode Vertical Scrollable List */}
              {isExpanded && count > 0 && (
                <div className="no-scrollbar max-h-[300px] space-y-1.5 overflow-y-auto border-t border-border bg-muted/20 p-2.5 pe-1">
                  {Array.from({ length: count }, (_, idx) => {
                    const epNum = idx + 1
                    const isWatched = isEpisodeWatched(seasonNum, epNum)
                    const epItem = season.episodes?.find(
                      (e) => e.episodeNumber === epNum
                    )
                    const rawTitle = epItem?.title || epItem?.name || null
                    const displayTitle = formatEpisodeTitle(rawTitle, epNum)

                    return (
                      <button
                        key={epNum}
                        type="button"
                        onClick={() => handleToggleTvEpisode(seasonNum, epNum)}
                        className={`group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-2 text-xs font-medium transition-colors ${
                          isWatched
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-12 shrink-0 font-mono text-xs font-bold text-muted-foreground">
                            Ep {epNum}
                          </span>
                          {displayTitle ? (
                            <span
                              className={`truncate text-xs font-medium ${
                                isWatched
                                  ? "font-semibold text-foreground"
                                  : "text-foreground"
                              }`}
                            >
                              {displayTitle}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isWatched
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card group-hover:border-foreground/40"
                          }`}
                        >
                          {isWatched && (
                            <IconCheck className="size-2.5 stroke-[3]" />
                          )}
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
