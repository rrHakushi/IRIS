"use client"

import React, { useMemo, useState } from "react"
import { IconCheck, IconChevronDown, IconClock } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import {
  BorealisCard,
  BorealisCardGroup,
  type BorealisBadge,
} from "@NamelessLiberty/borealis"
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
  imagePosition?: "left" | "right"
}

export function EpisodesTab({
  episodes,
  seasons,
  airingSchedule = [],
  nextAiringEpisodeNumber,
  nextAiringAt,
  status,
  imagePosition = "left",
}: EpisodesTabProps) {
  // Format date helper with time if available
  const formatDateWithTime = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return null
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return null
    const dateStr = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0
    if (hasTime) {
      const timeStr = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
      return `${dateStr} • ${timeStr}`
    }
    return dateStr
  }

  // Format countdown string
  const formatCountdown = (targetDate: string | Date | null | undefined): string | null => {
    if (!targetDate) return null
    const d = new Date(targetDate)
    const diff = d.getTime() - Date.now()
    if (diff <= 0) return null
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((diff / (1000 * 60)) % 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Next airing info banner helper
  const nextAiringInfo = useMemo(() => {
    const targetDate = nextAiringAt
    if (!targetDate) return null
    const countdown = formatCountdown(targetDate)
    const formattedDate = formatDateWithTime(targetDate)
    return {
      episodeNumber: nextAiringEpisodeNumber,
      formattedDate,
      countdown,
    }
  }, [nextAiringAt, nextAiringEpisodeNumber])

  // Merge episodes with airing schedule items
  const mergedEpisodes = useMemo(() => {
    const episodeMap = new Map<
      string,
      EpisodeItem & {
        isUpcoming?: boolean
        isAiringNow?: boolean
        airingAt?: string | Date | null
      }
    >()

    const now = Date.now()
    const ONE_DAY_MS = 24 * 60 * 60 * 1000

    // 1. Seed with known episodes
    for (const ep of episodes) {
      const sNum = ep.seasonNumber ?? 1
      const key = `${sNum}-${ep.number}`

      const airTimestamp = ep.airDate ? new Date(ep.airDate).getTime() : null
      const isValid = airTimestamp !== null && !isNaN(airTimestamp)
      const diff = isValid ? now - airTimestamp : null
      const isAiringNow = diff !== null && diff >= 0 && diff < ONE_DAY_MS
      const isUpcoming = isValid && airTimestamp > now

      episodeMap.set(key, {
        ...ep,
        isUpcoming,
        isAiringNow,
        airingAt: ep.airDate,
      })
    }

    // 2. Merge or append entries from airingSchedule
    if (airingSchedule && airingSchedule.length > 0) {
      for (const item of airingSchedule) {
        const sNum = item.seasonNumber ?? 1
        const key = `${sNum}-${item.episodeNumber}`

        const airDate = new Date(item.airingAt)
        const isValid = !isNaN(airDate.getTime())
        const diff = isValid ? now - airDate.getTime() : null
        const isAiringNow = diff !== null && diff >= 0 && diff < ONE_DAY_MS
        const isUpcoming = isValid && airDate.getTime() > now

        const existing = episodeMap.get(key)
        if (existing) {
          if (!existing.airDate || isUpcoming) {
            existing.airDate = existing.airDate ?? item.airingAt
            existing.airingAt = item.airingAt
            existing.isUpcoming = isUpcoming
            existing.isAiringNow = isAiringNow
          }
        } else {
          // Scheduled episode that isn't in episodes array yet
          episodeMap.set(key, {
            id: item.id ?? -item.episodeNumber,
            number: item.episodeNumber,
            seasonNumber: item.seasonNumber,
            titlePrimary: `Episode ${item.episodeNumber}`,
            titleSecondary: null,
            titleNative: null,
            description: null,
            duration: null,
            airDate: item.airingAt,
            airingAt: item.airingAt,
            thumbnail: null,
            isFiller: false,
            isRecap: false,
            isUpcoming,
            isAiringNow,
          })
        }
      }
    }

    // Sort by seasonNumber then episodeNumber
    return Array.from(episodeMap.values()).sort(
      (a, b) =>
        (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) || a.number - b.number
    )
  }, [episodes, airingSchedule])

  // Detect distinct seasons
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

    mergedEpisodes.forEach((ep) => {
      const sNum = typeof ep.seasonNumber === "number" ? ep.seasonNumber : 1
      if (!seasonMap.has(sNum)) {
        seasonMap.set(sNum, {
          id: sNum,
          seasonNumber: sNum,
          title: sNum === 0 ? "Specials" : `Season ${sNum}`,
        })
      }
    })

    if (seasonMap.size === 0) {
      seasonMap.set(1, { id: 1, seasonNumber: 1, title: "Season 1" })
    }

    return Array.from(seasonMap.values()).sort(
      (a, b) => a.seasonNumber - b.seasonNumber
    )
  }, [seasons, mergedEpisodes])

  const hasMultipleSeasons = availableSeasons.length > 1

  const [selectedSeason, setSelectedSeason] = useState<number | "all">("all")

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    const map = new Map<number, typeof mergedEpisodes>()
    for (const ep of mergedEpisodes) {
      const sNum = typeof ep.seasonNumber === "number" ? ep.seasonNumber : 1
      const list = map.get(sNum) ?? []
      list.push(ep)
      map.set(sNum, list)
    }
    return map
  }, [mergedEpisodes])

  const seasonsToDisplay = useMemo(() => {
    if (!hasMultipleSeasons) {
      return availableSeasons
    }
    if (selectedSeason === "all") {
      return availableSeasons.filter(
        (s) => (episodesBySeason.get(s.seasonNumber)?.length ?? 0) > 0
      )
    }
    return availableSeasons.filter((s) => s.seasonNumber === selectedSeason)
  }, [availableSeasons, hasMultipleSeasons, selectedSeason, episodesBySeason])

  const totalDisplayEpisodes = useMemo(() => {
    return seasonsToDisplay.reduce(
      (sum, s) => sum + (episodesBySeason.get(s.seasonNumber)?.length ?? 0),
      0
    )
  }, [seasonsToDisplay, episodesBySeason])

  const currentSeasonInfo = useMemo(() => {
    if (selectedSeason === "all") {
      return {
        label: "All Seasons",
        count: mergedEpisodes.length,
      }
    }
    const found = availableSeasons.find(
      (s) => s.seasonNumber === selectedSeason
    )
    const count = episodesBySeason.get(selectedSeason)?.length ?? 0
    return {
      label: found?.title || `Season ${selectedSeason}`,
      count,
    }
  }, [selectedSeason, mergedEpisodes.length, availableSeasons, episodesBySeason])

  return (
    <div className="flex flex-col gap-6">
      {/* Next Airing Banner (for ongoing / releasing series) */}
      {nextAiringInfo && nextAiringInfo.countdown && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 sm:px-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <IconClock className="size-4.5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">
                {nextAiringInfo.episodeNumber
                  ? `Episode ${nextAiringInfo.episodeNumber} Airing Soon`
                  : "Next Episode Airing Soon"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {nextAiringInfo.formattedDate}
              </span>
            </div>
          </div>
          <Badge
            variant="default"
            className="font-mono text-xs font-bold tracking-wide uppercase px-2.5 py-1"
          >
            In {nextAiringInfo.countdown}
          </Badge>
        </div>
      )}

      {/* Season Selector Dropdown (when multiple seasons exist) */}
      {hasMultipleSeasons && (
        <div className="flex items-center">
          <DropdownMenuTrigger>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-xl border-border/60 bg-card/60 px-3 text-xs font-semibold backdrop-blur-md transition-colors hover:bg-muted cursor-pointer"
            >
              <span>{currentSeasonInfo.label}</span>
              <span className="rounded-full bg-muted/80 px-1.5 py-0.2 font-mono text-[10px] font-bold text-muted-foreground">
                {currentSeasonInfo.count}
              </span>
              <IconChevronDown
                className="size-3.5 text-muted-foreground shrink-0"
                aria-hidden="true"
              />
            </Button>
            <DropdownMenu
              placement="bottom start"
              className="w-52 rounded-2xl p-1 backdrop-blur-xl"
            >
              <DropdownMenuItem
                onAction={() => setSelectedSeason("all")}
                className="flex items-center justify-between gap-2 cursor-pointer rounded-xl px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2">
                  {selectedSeason === "all" ? (
                    <IconCheck
                      className="size-3.5 text-primary shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span
                    className={cn(
                      "text-xs",
                      selectedSeason === "all"
                        ? "font-bold text-foreground"
                        : "font-medium text-muted-foreground"
                    )}
                  >
                    All Seasons
                  </span>
                </div>
                <span className="rounded-full bg-muted/80 px-1.5 py-0.2 font-mono text-[10px] font-bold text-muted-foreground">
                  {mergedEpisodes.length}
                </span>
              </DropdownMenuItem>

              {availableSeasons.map((season) => {
                const count =
                  episodesBySeason.get(season.seasonNumber)?.length ?? 0
                if (count === 0) return null
                const isSelected = selectedSeason === season.seasonNumber
                return (
                  <DropdownMenuItem
                    key={season.seasonNumber}
                    onAction={() => setSelectedSeason(season.seasonNumber)}
                    className="flex items-center justify-between gap-2 cursor-pointer rounded-xl px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <IconCheck
                          className="size-3.5 text-primary shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="size-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span
                        className={cn(
                          "text-xs",
                          isSelected
                            ? "font-bold text-foreground"
                            : "font-medium text-muted-foreground"
                        )}
                      >
                        {season.title}
                      </span>
                    </div>
                    <span className="rounded-full bg-muted/80 px-1.5 py-0.2 font-mono text-[10px] font-bold text-muted-foreground">
                      {count}
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenu>
          </DropdownMenuTrigger>
        </div>
      )}

  {/* Episodes Grid Grouped by Season */ }
{
  totalDisplayEpisodes === 0 ? (
    <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
      No episode data available for this season.
    </div>
  ) : (
  <div className="flex flex-col gap-8">
    {seasonsToDisplay.map((season) => {
      const seasonEpisodes =
        episodesBySeason.get(season.seasonNumber) ?? []
      if (seasonEpisodes.length === 0) return null

      const groupTitle = hasMultipleSeasons
        ? season.title
        : (seasons?.[0]?.titlePrimary || "Episodes")

      return (
        <BorealisCardGroup
          key={season.seasonNumber}
          title={groupTitle}
          grid
          variant="none"
          gap="md"
          contentClassName="grid-cols-1 md:grid-cols-2 2xl:grid-cols-3"
          className="w-full"
        >
          {seasonEpisodes.map((ep) => {
            const formattedDate = formatDateWithTime(ep.airDate)
            const epBadge =
              hasMultipleSeasons &&
                typeof ep.seasonNumber === "number" &&
                ep.seasonNumber > 0
                ? `S${ep.seasonNumber} · E${ep.number}`
                : `EP ${ep.number}`

            const badges: BorealisBadge[] = [
              {
                label: epBadge,
                variant: "secondary",
                className:
                  "bg-frost border border-frost text-zinc-100 font-mono text-[10px] font-bold tracking-wider shadow-md backdrop-blur-md",
              },
            ]

            if (ep.isAiringNow) {
              badges.push({
                label: "Airing Now",
                variant: "default",
                className:
                  "bg-emerald-500/80 text-white font-mono text-[10px] font-bold backdrop-blur-md animate-pulse",
              })
            } else if (ep.isUpcoming) {
              badges.push({
                label: "Upcoming",
                variant: "outline",
                className:
                  "border-cyan-500/50 bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold backdrop-blur-md",
              })
            }

            if (ep.isFiller) {
              badges.push({
                label: "Filler",
                variant: "outline",
                className:
                  "border-amber-500/50 bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold backdrop-blur-md",
              })
            }

            if (ep.isRecap) {
              badges.push({
                label: "Recap",
                variant: "outline",
                className:
                  "border-blue-500/50 bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold backdrop-blur-md",
              })
            }

                  return (
                    <BorealisCard
                      key={`${ep.seasonNumber ?? 0}-${ep.id}`}
                      expanded
                      imagePosition={imagePosition}
                      type="episode"
                      aspectRatio="video"
                      showExtras={false}
                      showSubtitle={false}
                      data={{
                        id: ep.id,
                        number: ep.number,
                        seasonNumber: ep.seasonNumber,
                        titlePrimary: ep.titlePrimary || `Episode ${ep.number}`,
                        titleSecondary: ep.titleSecondary,
                        titleNative: ep.titleNative,
                        thumbnail: ep.thumbnail,
                        coverImage: ep.thumbnail,
                        bannerImage: ep.thumbnail,
                        image: ep.thumbnail,
                        description: ep.description,
                        airDate: formattedDate,
                        year: formattedDate,
                        duration: ep.duration,
                        badges,
                      }}
                    />
                  )
                })}
              </BorealisCardGroup>
            )
          })}
        </div>
      )}
    </div>
  )
}
