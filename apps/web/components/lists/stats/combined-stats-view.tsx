"use client"

import React, { useState, useEffect } from "react"
import { elysia } from "@/lib/elysia"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Card } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconChartBarOff,
  IconStack2,
  IconClock,
  IconCalendarEvent,
  IconStar,
  IconChartDots,
  IconCheck,
  IconDeviceTv,
  IconBook2,
  IconMovie,
  IconDeviceGamepad,
  IconBook,
  IconMusic,
} from "@tabler/icons-react"
import { ScoreDistributionChart } from "./score-distribution-chart"
import { YearTimelineChart } from "./year-timeline-chart"
import { GenreStudioBreakdown } from "./genre-studio-breakdown"
import { ActivityHeatmap } from "./activity-heatmap"
import { cn } from "@workspace/ui/lib/utils"

export interface CombinedStatsViewProps {
  username: string
}

const MEDIA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  anime: IconDeviceTv,
  manga: IconBook2,
  movie: IconMovie,
  tv: IconDeviceTv,
  game: IconDeviceGamepad,
  book: IconBook,
  music: IconMusic,
}

const MEDIA_NAMES: Record<string, string> = {
  anime: "Anime",
  manga: "Manga",
  movie: "Movies",
  tv: "TV Series",
  game: "Games",
  book: "Books",
  music: "Music",
}

const combinedStatsClientCache = new Map<string, { data: any; timestamp: number }>()
const CLIENT_CACHE_TTL_MS = 30_000

export function CombinedStatsView({
  username,
}: CombinedStatsViewProps): React.JSX.Element {
  const cacheKey = `combined:${username}`
  const cached = combinedStatsClientCache.get(cacheKey)
  const isFresh = Boolean(
    cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS
  )

  const [stats, setStats] = useState<any | null>(() =>
    isFresh && cached ? cached.data : null
  )
  const [isLoading, setIsLoading] = useState(!isFresh)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let ignore = false

    if (combinedStatsClientCache.has(cacheKey)) {
      const entry = combinedStatsClientCache.get(cacheKey)!
      if (Date.now() - entry.timestamp < CLIENT_CACHE_TTL_MS) {
        setStats(entry.data)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)
    setHasError(false)

    async function fetchStats() {
      try {
        const client = elysia.user({ username }).lists
        const res = await client.combined.stats.get()

        if (ignore) return

        if (res?.data?.success && res.data.data) {
          combinedStatsClientCache.set(cacheKey, {
            data: res.data.data,
            timestamp: Date.now(),
          })
          setStats(res.data.data)
        } else {
          setHasError(true)
        }
      } catch (err) {
        if (!ignore) setHasError(true)
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    fetchStats()

    return () => {
      ignore = true
    }
  }, [cacheKey, username])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-36 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    )
  }

  if (hasError || !stats || stats.overview.totalTitles === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/60 p-8 text-center backdrop-blur-md">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
          <IconChartBarOff className="size-7" />
        </div>
        <h3 className="font-heading text-base font-semibold text-foreground">
          No Statistics Yet
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {stats?.overview?.totalTitles === 0
            ? "There are no media entries in this user's lists yet. Once titles are added, aggregated statistics across all media will appear here."
            : "Could not load statistics at this time."}
        </p>
      </div>
    )
  }

  const { overview } = stats
  const hoursConsumed = Math.round((overview.totalTimeMinutes / 60) * 10) / 10
  const monthsConsumed = (overview.daysConsumed / 30.4375).toFixed(1)
  const monthsPlanned = (overview.daysPlanned / 30.4375).toFixed(1)
  const hoursPlanned = Math.round((overview.daysPlanned * 24) * 10) / 10

  const kpiCards = [
    {
      label: "Total Titles",
      value: overview.totalTitles.toLocaleString(),
      subtext: `${overview.completedTitles.toLocaleString()} completed`,
      icon: IconStack2,
      iconColor: "text-rose-500",
    },
    {
      label: "Time Spent",
      value: `${overview.daysConsumed}d`,
      subtext: `${hoursConsumed.toLocaleString()}h • ${monthsConsumed}mo`,
      icon: IconClock,
      iconColor: "text-amber-500",
    },
    {
      label: "Time Planned",
      value: `${overview.daysPlanned}d`,
      subtext: `${hoursPlanned.toLocaleString()}h • ${monthsPlanned}mo`,
      icon: IconCalendarEvent,
      iconColor: "text-blue-500",
    },
    {
      label: "Mean Score",
      value: overview.meanScore > 0 ? `${overview.meanScore.toFixed(1)}/10` : "—",
      subtext: `From ${overview.scoredCount.toLocaleString()} rated`,
      icon: IconStar,
      iconColor: "text-yellow-500",
    },
    {
      label: "Std Deviation",
      value:
        overview.standardDeviation > 0
          ? `±${overview.standardDeviation.toFixed(2)}`
          : "—",
      subtext: "Rating variance (out of 10)",
      icon: IconChartDots,
      iconColor: "text-purple-500",
    },
    {
      label: "Rated Coverage",
      value:
        overview.totalTitles > 0
          ? `${Math.round((overview.scoredCount / overview.totalTitles) * 100)}%`
          : "0%",
      subtext: `${overview.scoredCount.toLocaleString()} of ${overview.totalTitles.toLocaleString()} scored`,
      icon: IconCheck,
      iconColor: "text-emerald-500",
    },
  ]

  return (
    <div className="space-y-6">
      {/* 1. Combined Overview KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((card) => {
          const IconComp = card.icon
          return (
            <Card
              key={card.label}
              className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md transition-all hover:border-border/90 hover:bg-card/90"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {card.label}
                </span>
                <IconComp className={`size-4 shrink-0 ${card.iconColor}`} />
              </div>

              <div className="mt-3">
                <span className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {card.value}
                </span>
                <p className="mt-0.5 truncate text-xs text-muted-foreground" title={card.subtext}>
                  {card.subtext}
                </p>
              </div>
            </Card>
          )
        })}
      </div>

      {/* 2. Media Types Breakdown Grid */}
      {stats.mediaBreakdown && stats.mediaBreakdown.length > 0 && (
        <Card className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold tracking-wide text-foreground uppercase">
              Cross-Media Breakdown
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {stats.mediaBreakdown.map((item: any) => {
              const IconComp = MEDIA_ICONS[item.mediaType] || IconStack2
              const label = MEDIA_NAMES[item.mediaType] || item.mediaType
              return (
                <div
                  key={item.mediaType}
                  className="flex flex-col justify-between rounded-xl border border-border/40 bg-background/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground capitalize">
                      {label}
                    </span>
                    <IconComp className="size-3.5 text-primary" />
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {item.count.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {item.hours}h
                      </span>
                    </div>
                    <Progress value={item.percentage} className="h-1" />
                    <span className="block text-end text-[10px] text-muted-foreground">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* 3. Charts Row: Score Distribution & Status Distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Score Distribution */}
        <ScoreDistributionChart
          scores={stats.scoreDistribution.scores}
          unratedCount={stats.scoreDistribution.unratedCount}
          meanScore={stats.overview.meanScore}
        />

        {/* Status Distribution */}
        <Card className="flex flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
          <h3 className="mb-3 shrink-0 font-heading text-sm font-semibold tracking-wide text-foreground uppercase">
            Status Distribution
          </h3>

          <div className="flex-1 space-y-3 overflow-y-auto pe-1.5">
            {stats.statusDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground">No entries found</p>
            ) : (
              stats.statusDistribution.map((item: any) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground">
                      {item.name.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted-foreground">
                      {item.count.toLocaleString()} ({item.percentage}%)
                    </span>
                  </div>
                  <Progress
                    value={item.percentage}
                    aria-label={`${item.name.replace(/_/g, " ")}: ${item.count.toLocaleString()} titles (${item.percentage}%)`}
                    className="h-1.5"
                  />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 4. Activity Breakdown Heatmap (Monthly, Weekly, Days of Week) */}
      <ActivityHeatmap
        monthlyData={stats.monthlyActivity}
        weeklyData={stats.weeklyActivity}
        dayOfWeekData={stats.dayOfWeekActivity}
      />

      {/* 5. Top Cross-Media Genres & Year Timeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {stats.topGenres && (
          <GenreStudioBreakdown
            genres={stats.topGenres}
            creators={stats.topCreators || []}
            mediaType="anime"
          />
        )}
        {stats.activityYearGraph && (
          <YearTimelineChart
            releaseYears={[]}
            activityYears={stats.activityYearGraph}
            mediaType="anime"
          />
        )}
      </div>
    </div>
  )
}
