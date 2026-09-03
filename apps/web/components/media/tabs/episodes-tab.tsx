"use client"

import React, { useMemo, useState, useEffect } from "react"
import {
  IconCalendar,
  IconChevronDown,
  IconClock,
  IconFileText,
  IconPhotoOff,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type {
  AiringScheduleItem,
  EpisodeItem,
  SeasonItem,
} from "../media-types"

interface EpisodesTabProps {
  episodes: EpisodeItem[]
  seasons?: SeasonItem[]
  airingSchedule?: AiringScheduleItem[]
  nextAiringEpisodeNumber?: number | null
  nextAiringAt?: string | Date | null
  status?: string | null
}

export function EpisodesTab({
  episodes,
  seasons,
  airingSchedule = [],
  nextAiringEpisodeNumber,
  nextAiringAt,
  status,
}: EpisodesTabProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const isReleasing = status?.toUpperCase() === "RELEASING"

  // Detect distinct seasons either from seasons prop or from episodes' seasonNumber
  const availableSeasons = useMemo(() => {
    const seasonMap = new Map<
      number,
      { id: number; seasonNumber: number; title: string }
    >()

    if (seasons && seasons.length > 0) {
      seasons.forEach((s) => {
        seasonMap.set(s.seasonNumber, {
          id: s.id,
          seasonNumber: s.seasonNumber,
          title:
            s.titlePrimary ||
            (s.seasonNumber === 0 ? "Specials" : `Season ${s.seasonNumber}`),
        })
      })
    }

    episodes.forEach((ep) => {
      if (typeof ep.seasonNumber === "number") {
        if (!seasonMap.has(ep.seasonNumber)) {
          seasonMap.set(ep.seasonNumber, {
            id: ep.seasonNumber,
            seasonNumber: ep.seasonNumber,
            title:
              ep.seasonNumber === 0 ? "Specials" : `Season ${ep.seasonNumber}`,
          })
        }
      }
    })

    return Array.from(seasonMap.values()).sort(
      (a, b) => a.seasonNumber - b.seasonNumber
    )
  }, [seasons, episodes])

  const hasMultipleSeasons = availableSeasons.length > 1

  // Default to Season 1 if present, otherwise lowest non-zero or first
  const defaultSeason = useMemo(() => {
    const s1 = availableSeasons.find((s) => s.seasonNumber === 1)
    if (s1) return 1
    const nonZero = availableSeasons.find((s) => s.seasonNumber > 0)
    if (nonZero) return nonZero.seasonNumber
    return availableSeasons[0]?.seasonNumber ?? 1
  }, [availableSeasons])

  const [selectedSeason, setSelectedSeason] = useState<number | "all">(
    defaultSeason
  )

  useEffect(() => {
    if (hasMultipleSeasons) {
      setSelectedSeason(defaultSeason)
    }
  }, [defaultSeason, hasMultipleSeasons])

  // Resolve full schedule list from airingSchedule or falling back to episode air dates
  const resolvedSchedule = useMemo(() => {
    if (airingSchedule && airingSchedule.length > 0) {
      return [...airingSchedule].sort(
        (a, b) =>
          (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) ||
          a.episodeNumber - b.episodeNumber
      )
    }
    return episodes
      .filter((ep) => ep.airDate)
      .map((ep) => ({
        id: ep.id,
        episodeNumber: ep.number,
        seasonNumber: ep.seasonNumber,
        airingAt: ep.airDate as string | Date,
      }))
      .sort(
        (a, b) =>
          (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) ||
          a.episodeNumber - b.episodeNumber
      )
  }, [airingSchedule, episodes])

  // Filter episodes by season
  const filteredEpisodes = useMemo(() => {
    if (!hasMultipleSeasons || selectedSeason === "all") {
      return [...episodes].sort(
        (a, b) =>
          (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) || a.number - b.number
      )
    }
    return episodes
      .filter((ep) => ep.seasonNumber === selectedSeason)
      .sort((a, b) => a.number - b.number)
  }, [episodes, hasMultipleSeasons, selectedSeason])

  // Filter schedule by season
  const filteredSchedule = useMemo(() => {
    if (!hasMultipleSeasons || selectedSeason === "all") {
      return resolvedSchedule
    }
    return resolvedSchedule.filter(
      (item) => item.seasonNumber === selectedSeason
    )
  }, [resolvedSchedule, hasMultipleSeasons, selectedSeason])

  const formatDate = (dateVal: string | Date | null) => {
    if (!dateVal) return null
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const selectedSeasonObj = availableSeasons.find(
    (s) => s.seasonNumber === selectedSeason
  )
  const currentSeasonLabel =
    selectedSeason === "all"
      ? "All Seasons"
      : selectedSeasonObj?.title || `Season ${selectedSeason}`

  return (
    <div className="flex flex-col gap-5">
      {/* Season Selector Pills (when multiple seasons exist) */}
      {hasMultipleSeasons && (
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
          {availableSeasons.map((season) => {
            const count = episodes.filter(
              (e) => e.seasonNumber === season.seasonNumber
            ).length
            const isSelected = selectedSeason === season.seasonNumber
            return (
              <button
                key={season.seasonNumber}
                type="button"
                onClick={() => setSelectedSeason(season.seasonNumber)}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{season.title}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "py-0.2 rounded-full px-1.5 text-[10px] font-bold",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background/80 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setSelectedSeason("all")}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedSeason === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>All Seasons</span>
            <span
              className={cn(
                "py-0.2 rounded-full px-1.5 text-[10px] font-bold",
                selectedSeason === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-muted-foreground"
              )}
            >
              {episodes.length}
            </span>
          </button>
        </div>
      )}

      {/* 2-Column Split: Episodes (Left) and Airing Schedule (Right) */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        {/* 1. Left (Yellow Area): Scrollable List of Episodes - 6 visible at once, expandable descriptions */}
        <section
          aria-labelledby="episodes-list-heading"
          className="flex min-w-0 flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2
              id="episodes-list-heading"
              className="text-base font-semibold text-foreground"
            >
              {hasMultipleSeasons && selectedSeason !== "all"
                ? `${currentSeasonLabel} `
                : ""}
              Episodes ({filteredEpisodes.length})
            </h2>
            {filteredEpisodes.length > 6 && (
              <span className="text-[11px] text-muted-foreground">
                Scroll for more
              </span>
            )}
          </div>

          {filteredEpisodes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No episode data available for this season.
            </div>
          ) : (
            /* Exactly 6 cards visible at once: 6 * 52px card + 5 * 8px gap = 352px - scrollbars hidden */
            <div className="no-scrollbar flex max-h-[352px] flex-col gap-2 overflow-y-auto">
              {filteredEpisodes.map((ep) => {
                const formattedDate = formatDate(ep.airDate)
                const isExpanded = expandedId === ep.id
                const hasDescription = Boolean(
                  ep.description && ep.description.trim().length > 0
                )

                return (
                  <div
                    key={`${ep.seasonNumber ?? 0}-${ep.id}`}
                    onClick={() => {
                      if (hasDescription) {
                        setExpandedId((prev) => (prev === ep.id ? null : ep.id))
                      }
                    }}
                    className={cn(
                      "flex shrink-0 flex-col rounded-xl border border-border/40 bg-card/70 px-2.5 py-1.5 transition-colors",
                      hasDescription &&
                        "cursor-pointer hover:border-border/60 hover:bg-card",
                      isExpanded && "border-primary/40 bg-card shadow-xs"
                    )}
                  >
                    {/* Main Card Row */}
                    <div className="flex h-[40px] items-center justify-between gap-3">
                      {/* Left: Thumbnail & Details */}
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {/* Compact Episode Thumbnail */}
                        <div className="relative aspect-video w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {ep.thumbnail ? (
                            <img
                              src={ep.thumbnail}
                              alt={`EP ${ep.number}`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                              <IconPhotoOff
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            </div>
                          )}
                          <span className="absolute start-0.5 bottom-0.5 rounded bg-background/90 px-1 py-0 text-[8px] font-bold tabular-nums">
                            {hasMultipleSeasons &&
                            typeof ep.seasonNumber === "number"
                              ? `S${ep.seasonNumber}E${ep.number}`
                              : ep.number}
                          </span>
                        </div>

                        <div className="flex min-w-0 flex-col">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-xs font-medium text-foreground">
                              {ep.titlePrimary || `Episode ${ep.number}`}
                            </span>
                            {ep.isFiller && (
                              <Badge
                                variant="outline"
                                className="h-3.5 border-amber-500/40 px-1 py-0 text-[8px] text-amber-600 dark:text-amber-400"
                              >
                                Filler
                              </Badge>
                            )}
                            {ep.isRecap && (
                              <Badge
                                variant="outline"
                                className="h-3.5 border-blue-500/40 px-1 py-0 text-[8px] text-blue-600 dark:text-blue-400"
                              >
                                Recap
                              </Badge>
                            )}
                          </div>

                          {ep.titleSecondary &&
                          ep.titleSecondary !== ep.titlePrimary ? (
                            <span className="truncate text-[10px] text-muted-foreground">
                              {ep.titleSecondary}
                            </span>
                          ) : ep.titleNative ? (
                            <span className="font-japanese truncate text-[10px] text-muted-foreground opacity-75">
                              {ep.titleNative}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Right: Air Date, Duration, and Description Expand Icon */}
                      <div className="flex shrink-0 items-center gap-2 text-end text-[10px] text-muted-foreground">
                        {formattedDate && <span>{formattedDate}</span>}
                        {typeof ep.duration === "number" && ep.duration > 0 && (
                          <span className="font-medium tabular-nums">
                            {ep.duration}m
                          </span>
                        )}
                        {hasDescription && (
                          <div
                            className={cn(
                              "flex size-5 items-center justify-center rounded-md bg-muted/70 text-muted-foreground transition-colors",
                              isExpanded && "bg-primary text-primary-foreground"
                            )}
                            title={
                              isExpanded
                                ? "Collapse description"
                                : "View episode description"
                            }
                            aria-label={
                              isExpanded
                                ? "Collapse description"
                                : "View episode description"
                            }
                          >
                            <IconChevronDown
                              className={cn(
                                "size-3.5 transition-transform duration-150",
                                isExpanded && "rotate-180"
                              )}
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expandable Episode Description */}
                    {isExpanded && ep.description && (
                      <div className="mt-2 border-t border-border/30 pt-2 text-xs leading-relaxed whitespace-pre-line text-foreground/85 select-text">
                        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          <IconFileText
                            className="size-3 text-primary"
                            aria-hidden="true"
                          />
                          <span>Episode Synopsis</span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {ep.description}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 2. Right (Green Area): Airing Schedule */}
        <section
          aria-labelledby="airing-schedule-heading"
          className="flex min-w-0 flex-col gap-3"
        >
          <div className="flex items-center gap-2">
            <IconCalendar className="size-4 text-primary" aria-hidden="true" />
            <h2
              id="airing-schedule-heading"
              className="text-base font-semibold text-foreground"
            >
              {hasMultipleSeasons && selectedSeason !== "all"
                ? `${currentSeasonLabel} `
                : ""}
              Schedule ({filteredSchedule.length})
            </h2>
          </div>

          {filteredSchedule.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No airing schedule available for this season.
            </div>
          ) : (
            /* Exactly matching height with left column - scrollbars hidden */
            <div className="no-scrollbar flex max-h-[352px] flex-col gap-2 overflow-y-auto">
              {/* List of Scheduled/Aired Episodes */}
              {filteredSchedule.map((item) => {
                const airDate = new Date(item.airingAt)
                const isValid = !isNaN(airDate.getTime())
                const diff = isValid ? Date.now() - airDate.getTime() : 0
                const ONE_DAY_MS = 24 * 60 * 60 * 1000
                const isAiringNow = isValid && diff >= 0 && diff < ONE_DAY_MS
                const isPast = isValid && diff >= ONE_DAY_MS

                return (
                  <div
                    key={`${item.seasonNumber ?? 0}-${item.id}`}
                    className="flex h-[52px] shrink-0 items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/70 px-3 py-1.5 transition-colors hover:bg-card"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Badge
                        variant="secondary"
                        className="shrink-0 px-2 py-0.5 text-[10px] font-bold tabular-nums"
                      >
                        {hasMultipleSeasons &&
                        typeof item.seasonNumber === "number"
                          ? `S${item.seasonNumber} · E${item.episodeNumber}`
                          : `EP ${item.episodeNumber}`}
                      </Badge>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-xs font-medium text-foreground">
                          {isValid
                            ? airDate.toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Scheduled date TBA"}
                        </span>
                        {isValid && (
                          <span className="text-[10px] text-muted-foreground">
                            {airDate.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant={isPast || isAiringNow ? "outline" : "secondary"}
                      className={cn(
                        "py-0.2 shrink-0 px-1.5 text-[9px] font-semibold uppercase",
                        (isPast || isAiringNow) &&
                          "border-border/60 text-muted-foreground"
                      )}
                    >
                      {isPast || isAiringNow ? "Aired" : "Upcoming"}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
