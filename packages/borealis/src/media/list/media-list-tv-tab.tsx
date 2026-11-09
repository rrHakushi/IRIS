"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
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
  mediaId?: number | string
  category?: CanonicalMediaCategory
  seasons?: TvSeasonItem[]
  episodes?: AnimeEpisodeItem[]
  episodeCount?: number | null
  seasonCount?: number | null
  isLoading?: boolean
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

function getCurrentlyWatchingSeason(
  seasonsList: TvSeasonItem[],
  watched: WatchedEpisodeItem[]
): number | null {
  if (!seasonsList || seasonsList.length === 0) return null

  // Filter regular seasons (seasonNumber > 0)
  const regularSeasons = seasonsList.filter((s) => s.seasonNumber > 0)
  const candidateSeasons =
    regularSeasons.length > 0 ? regularSeasons : seasonsList

  const seasonStats = candidateSeasons.map((season) => {
    const seasonNum = season.seasonNumber
    const count = season.episodeCount || season.episodes?.length || 0
    const watchedInSeason = watched.filter(
      (we) => we.seasonNumber === seasonNum
    ).length
    const isFullyWatched = count > 0 && watchedInSeason >= count
    const isPartiallyWatched =
      count > 0 ? watchedInSeason > 0 && !isFullyWatched : watchedInSeason > 0

    return {
      seasonNum,
      count,
      watchedInSeason,
      isFullyWatched,
      isPartiallyWatched,
    }
  })

  // 1. First priority: Season currently in progress (partially watched, e.g. 4/10)
  const inProgress = seasonStats.find((s) => s.isPartiallyWatched)
  if (inProgress) {
    return inProgress.seasonNum
  }

  // Check if Season 0 (Specials) is in progress
  const seasonZero = seasonsList.find((s) => s.seasonNumber === 0)
  if (seasonZero) {
    const count0 = seasonZero.episodeCount || seasonZero.episodes?.length || 0
    const watched0 = watched.filter((we) => we.seasonNumber === 0).length
    if (count0 > 0 ? watched0 > 0 && watched0 < count0 : watched0 > 0) {
      return 0
    }
  }

  // 2. Second priority: First non-finished regular season (e.g. S1 finished -> S2)
  const nextUp = seasonStats.find((s) => !s.isFullyWatched)
  if (nextUp) {
    return nextUp.seasonNum
  }

  // 3. Fallback: If all seasons are finished, default to the last regular season
  return (
    candidateSeasons[candidateSeasons.length - 1]?.seasonNumber ??
    seasonsList[0]?.seasonNumber ??
    null
  )
}

export function MediaListTvTab({
  mediaId,
  category = "tv",
  seasons = [],
  episodes = [],
  episodeCount = null,
  seasonCount = null,
  progress = 0,
  onProgressChange,
  watchedEpisodes = [],
  onWatchedEpisodesChange,
  isLoading = false,
}: MediaListTvTabProps) {
  const effectiveSeasons: TvSeasonItem[] = useMemo(() => {
    if (seasons && seasons.length > 0) return seasons
    if (isLoading) return []
    if (
      (!seasonCount || seasonCount <= 1) &&
      episodeCount &&
      episodeCount > 0
    ) {
      return [
        {
          seasonNumber: 1,
          title: null,
          episodeCount: episodeCount,
        },
      ]
    }
    return []
  }, [seasons, episodeCount, seasonCount, isLoading])

  const [expandedSeasons, setExpandedSeasons] = useState<
    Record<number, boolean>
  >(() => {
    const active = getCurrentlyWatchingSeason(effectiveSeasons, watchedEpisodes)
    return active !== null ? { [active]: true } : {}
  })

  const hasAutoOpenedRef = useRef(false)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if (effectiveSeasons.length > 0) {
      if (
        !hasAutoOpenedRef.current ||
        effectiveSeasons.length !== prevCountRef.current
      ) {
        prevCountRef.current = effectiveSeasons.length
        const active = getCurrentlyWatchingSeason(
          effectiveSeasons,
          watchedEpisodes
        )
        if (active !== null) {
          setExpandedSeasons({ [active]: true })
          hasAutoOpenedRef.current = true
        }
      }
    }
  }, [effectiveSeasons, watchedEpisodes])

  useEffect(() => {
    hasAutoOpenedRef.current = false
    prevCountRef.current = 0
    const active = getCurrentlyWatchingSeason(effectiveSeasons, watchedEpisodes)
    if (active !== null) {
      setExpandedSeasons({ [active]: true })
      hasAutoOpenedRef.current = true
    }
  }, [mediaId])

  const activeEpRef = useRef<HTMLButtonElement | null>(null)

  // ==========================================
  // Anime Episode Handling (Local state only, saves on Save button)
  // ==========================================
  const isAnime = category === "anime"
  const isOngoing = !episodeCount || episodeCount <= 0
  const maxKnownCount =
    typeof episodeCount === "number" && episodeCount > 0
      ? episodeCount
      : episodes && episodes.length > 0
        ? episodes.length
        : 0

  const animeTotalEpisodes = isOngoing
    ? Math.max(progress + 1, maxKnownCount)
    : Math.max(progress, maxKnownCount)

  const episodeMap = useMemo(() => {
    const map = new Map<number, AnimeEpisodeItem>()
    if (episodes) {
      for (const ep of episodes) {
        if (typeof ep.number === "number") {
          map.set(ep.number, ep)
        }
      }
    }
    return map
  }, [episodes])

  useEffect(() => {
    if (activeEpRef.current) {
      activeEpRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [])

  const handleAnimeToggleEpisode = (episodeNumber: number) => {
    const isCurrentProgress = progress === episodeNumber
    const nextProgress = isCurrentProgress ? episodeNumber - 1 : episodeNumber
    const maxLimit =
      typeof episodeCount === "number" && episodeCount > 0
        ? episodeCount
        : undefined
    const clampedProgress =
      maxLimit !== undefined
        ? Math.min(maxLimit, Math.max(0, nextProgress))
        : Math.max(0, nextProgress)
    onProgressChange?.(clampedProgress)
  }

  const handleAnimeMarkAll = (markAll: boolean) => {
    if (markAll) {
      const target =
        typeof episodeCount === "number" && episodeCount > 0
          ? episodeCount
          : animeTotalEpisodes
      if (target > 0) onProgressChange?.(target)
    } else {
      onProgressChange?.(0)
    }
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

    // If this completed the season, auto-advance to next season
    const season = effectiveSeasons.find((s) => s.seasonNumber === seasonNumber)
    const count = season?.episodeCount || season?.episodes?.length || 0
    if (
      count > 0 &&
      nextWatched &&
      nextWatchedList.filter((we) => we.seasonNumber === seasonNumber).length >=
        count
    ) {
      const nextSeason = effectiveSeasons.find(
        (s) => s.seasonNumber > seasonNumber
      )
      if (nextSeason) {
        setExpandedSeasons({ [nextSeason.seasonNumber]: true })
      }
    }
  }

  const handleMarkTvSeasonAll = (
    season: TvSeasonItem,
    markWatched: boolean
  ) => {
    const seasonNum = season.seasonNumber ?? 1
    const maxEpNum =
      season.episodes?.reduce(
        (max, ep) => Math.max(max, ep.episodeNumber ?? (ep as any).number ?? 0),
        0
      ) || 0
    const totalEpisodes = Math.max(
      season.episodeCount || 0,
      season.episodes?.length || 0,
      maxEpNum
    )
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

      // Auto-open next season and close completed season
      const nextSeason = effectiveSeasons.find(
        (s) => s.seasonNumber > seasonNum
      )
      if (nextSeason) {
        setExpandedSeasons({ [nextSeason.seasonNumber]: true })
      }
    } else {
      nextWatchedList = watchedEpisodes.filter(
        (we) => we.seasonNumber !== seasonNum
      )
      setExpandedSeasons({ [seasonNum]: true })
    }

    onWatchedEpisodesChange?.(nextWatchedList)
    onProgressChange?.(nextWatchedList.length)
  }

  // ==========================================
  // RENDER: Anime Mode
  // ==========================================
  if (isAnime) {
    if (animeTotalEpisodes <= 0 && progress <= 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <IconDeviceTv className="size-8 opacity-40" />
          <p className="mt-2 text-xs font-medium text-foreground">
            No Episode Data Available
          </p>
          <p className="text-[11px] text-muted-foreground">
            Use the episode progress input in the General tab to track episodes.
          </p>
        </div>
      )
    }

    const isAllWatched =
      typeof episodeCount === "number" && episodeCount > 0
        ? progress >= episodeCount
        : animeTotalEpisodes > 0 && progress >= animeTotalEpisodes

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Episodes</h3>
            <Badge
              variant={isAllWatched ? "default" : "secondary"}
              className="px-2 py-0.5 font-mono text-[10px]"
            >
              {progress} /{" "}
              {typeof episodeCount === "number" && episodeCount > 0
                ? episodeCount
                : episodes && episodes.length > 0
                  ? `${episodes.length}+`
                  : "?"}
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
            const epItem = episodeMap.get(epNum)
            const rawTitle =
              epItem?.titlePrimary || epItem?.titleSecondary || null
            const displayTitle = formatEpisodeTitle(rawTitle, epNum)
            const isCurrentProgress = epNum === progress

            return (
              <button
                key={epNum}
                ref={isCurrentProgress ? activeEpRef : undefined}
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
  if (effectiveSeasons.length === 0) {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <IconDeviceTv className="size-8 animate-pulse opacity-50" />
          <p className="mt-2 text-xs font-medium text-foreground">
            Loading seasons & episodes...
          </p>
        </div>
      )
    }

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
      <div className="space-y-2">
        {effectiveSeasons.map((season) => {
          const seasonNum = season.seasonNumber
          const isExpanded = Boolean(expandedSeasons[seasonNum])
          const maxEpNum =
            season.episodes?.reduce(
              (max, ep) =>
                Math.max(max, ep.episodeNumber ?? (ep as any).number ?? 0),
              0
            ) || 0
          const count = Math.max(
            season.episodeCount || 0,
            season.episodes?.length || 0,
            maxEpNum
          )

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
                    variant={
                      count > 0
                        ? isFullyWatched
                          ? "default"
                          : "secondary"
                        : "outline"
                    }
                    className="px-1.5 py-0 font-mono text-[10px]"
                  >
                    {count > 0 ? `${watchedInSeason} / ${count}` : "0 episodes"}
                  </Badge>
                </div>

                <div
                  className="flex shrink-0 items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="xs"
                    isDisabled={count <= 0}
                    onClick={() =>
                      handleMarkTvSeasonAll(season, !isFullyWatched)
                    }
                    className="h-6.5 border-border text-[11px] font-medium disabled:opacity-40"
                  >
                    {isFullyWatched ? "Reset" : "Mark Watched"}
                  </Button>
                </div>
              </div>

              {/* Episode Vertical Scrollable List or Empty State */}
              {isExpanded && (
                count > 0 ? (
                  <div className="no-scrollbar max-h-[300px] space-y-1.5 overflow-y-auto border-t border-border bg-muted/20 p-2.5 pe-1">
                    {Array.from({ length: count }, (_, idx) => {
                      const epNum = idx + 1
                      const isWatched = isEpisodeWatched(seasonNum, epNum)
                      const epItem = season.episodes?.find(
                        (e) => (e.episodeNumber ?? (e as any).number) === epNum
                      )
                      const rawTitle =
                        epItem?.title ||
                        (epItem as any)?.titlePrimary ||
                        epItem?.name ||
                        (epItem as any)?.titleSecondary ||
                        null
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
                ) : (
                  <div className="border-t border-border bg-muted/10 p-4 text-center">
                    <p className="text-xs font-medium text-muted-foreground">
                      No episodes released or available yet for Season {seasonNum}.
                    </p>
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
