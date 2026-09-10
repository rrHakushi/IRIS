"use client"

import React, { useState, useEffect, useRef } from "react"
import { elysia } from "@/lib/elysia"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { IconChartBarOff } from "@tabler/icons-react"
import type { MediaListType } from "../types"
import { StatsOverviewCards } from "./stats-overview-cards"
import { ScoreDistributionChart } from "./score-distribution-chart"
import { YearTimelineChart } from "./year-timeline-chart"
import { FormatCountryDistribution } from "./format-country-distribution"
import { LengthDistributionChart } from "./length-distribution-chart"
import { GenreStudioBreakdown } from "./genre-studio-breakdown"
import { ActivityHeatmap } from "./activity-heatmap"

interface MediaStatsTabProps {
  username: string
  mediaType: MediaListType
}

const inFlightRequests = new Map<string, Promise<any>>()
const statsClientCache = new Map<string, { data: any; timestamp: number }>()
const CLIENT_CACHE_TTL_MS = 30_000

export function invalidateClientStats(username?: string, mediaType?: string) {
  if (username && mediaType) {
    statsClientCache.delete(`${username}:${mediaType}`)
  } else {
    statsClientCache.clear()
  }
}

export function MediaStatsTab({
  username,
  mediaType,
}: MediaStatsTabProps): React.JSX.Element {
  const cacheKey = `${username}:${mediaType}`
  const cached = statsClientCache.get(cacheKey)
  const isFresh = Boolean(cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS)

  const [stats, setStats] = useState<any | null>(() => (isFresh && cached ? cached.data : null))
  const [isLoading, setIsLoading] = useState(!isFresh)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let ignore = false

    // If cache is fresh, ensure state is set and skip network request
    if (statsClientCache.has(cacheKey)) {
      const entry = statsClientCache.get(cacheKey)!
      if (Date.now() - entry.timestamp < CLIENT_CACHE_TTL_MS) {
        setStats(entry.data)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)
    setHasError(false)

    async function executeFetch() {
      let promise = inFlightRequests.get(cacheKey)

      if (!promise) {
        promise = (async () => {
          const client = elysia.user({ username }).lists
          let res: any = null

          switch (mediaType) {
            case "anime":
              res = await client.anime.stats.get()
              break
            case "manga":
              res = await client.manga.stats.get()
              break
            case "movie":
              res = await client.movie.stats.get()
              break
            case "tv":
              res = await client.tv.stats.get()
              break
            case "game":
              res = await client.game.stats.get()
              break
            case "book":
              res = await client.book.stats.get()
              break
            case "music":
              res = await client.music.stats.get()
              break
          }
          return res
        })().finally(() => {
          inFlightRequests.delete(cacheKey)
        })

        inFlightRequests.set(cacheKey, promise)
      }

      try {
        const res = await promise
        if (ignore) return

        if (res?.data?.success && res.data.data) {
          statsClientCache.set(cacheKey, {
            data: res.data.data,
            timestamp: Date.now(),
          })
          setStats(res.data.data)
        } else {
          setHasError(true)
        }
      } catch (err) {
        if (!ignore) {
          setHasError(true)
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    executeFetch()

    return () => {
      ignore = true
    }
  }, [cacheKey, username, mediaType])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (hasError || !stats || stats.overview.totalCount === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/60 p-8 text-center backdrop-blur-md">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-3">
          <IconChartBarOff className="size-7" />
        </div>
        <h3 className="font-heading text-base font-semibold text-foreground">
          No Statistics Yet
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {stats?.overview?.totalCount === 0
            ? `There are no ${mediaType} entries in this list yet. Once titles are added, detailed statistics and graphs will appear here.`
            : "Could not load statistics at this time."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Overview KPI Cards */}
      <StatsOverviewCards mediaType={mediaType} overview={stats.overview} />

      {/* 2. Charts Row: Score Distribution & Year Timeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScoreDistributionChart
          scores={stats.scoreDistribution.scores}
          unratedCount={stats.scoreDistribution.unratedCount}
          meanScore={stats.overview.meanScore}
        />
        <YearTimelineChart
          releaseYears={stats.releaseYearGraph}
          activityYears={stats.activityYearGraph}
          mediaType={mediaType}
        />
      </div>

      {/* 3. Length & Episode Distribution */}
      <LengthDistributionChart
        buckets={stats.lengthDistribution}
        mediaType={mediaType}
      />

      {/* 4. Format, Country & Status Distribution */}
      <FormatCountryDistribution
        formats={stats.formatDistribution}
        countries={stats.countryDistribution}
        statuses={stats.statusDistribution}
      />

      {/* 5. Top Genres & Top Studios/Creators */}
      <GenreStudioBreakdown
        genres={stats.topGenres}
        creators={stats.topCreators}
        mediaType={mediaType}
      />

      {/* 6. Activity Breakdown Heatmap (Monthly, Weekly, Days of Week) */}
      <ActivityHeatmap
        monthlyData={stats.monthlyActivity}
        weeklyData={stats.weeklyActivity}
        dayOfWeekData={stats.dayOfWeekActivity}
      />
    </div>
  )
}
