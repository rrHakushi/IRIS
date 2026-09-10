import { prisma } from "@IRIS/database"
import { cache } from "../utils/cache.js"

export interface PeriodFilter {
  year?: number
  quarter?: number
  month?: number
}

export interface ScoreDistributionItem {
  score: number
  count: number
}

export interface DistributionItem {
  name: string
  count: number
  percentage: number
}

export interface YearGraphItem {
  year: number
  titles: number
  meanScore: number
  hours: number
}

export interface LengthBucketItem {
  label: string
  count: number
  description: string
}

export interface TopGenreItem {
  genre: string
  count: number
  meanScore: number
  hours: number
}

export interface TopCreatorItem {
  name: string
  count: number
  meanScore: number
}

export interface MonthlyActivityItem {
  year: number
  month: number
  count: number
}

export interface WeeklyActivityItem {
  year: number
  week: number
  count: number
}

export interface DayOfWeekItem {
  day: number
  dayName: string
  count: number
}

export interface RewindHighlights {
  topScored: Array<{
    id: number
    title: string
    score: number
    coverImage: string | null
  }>
  milestones: {
    firstCompleted?: { id: number; title: string; completedAt: string }
    lastCompleted?: { id: number; title: string; completedAt: string }
  }
  busiestMonth: string | null
}

export interface MediaStatsResponse {
  mediaType: string
  isPeriodFiltered: boolean
  period?: PeriodFilter
  overview: {
    totalCount: number
    completedCount: number
    currentCount: number
    planningCount: number
    onHoldCount: number
    droppedCount: number
    totalUnits: number
    totalTimeMinutes: number
    daysConsumed: number
    daysPlanned: number
    meanScore: number
    standardDeviation: number
    scoredCount: number
  }
  scoreDistribution: {
    scores: ScoreDistributionItem[]
    unratedCount: number
  }
  lengthDistribution: LengthBucketItem[]
  formatDistribution: DistributionItem[]
  statusDistribution: DistributionItem[]
  countryDistribution: DistributionItem[]
  releaseYearGraph: YearGraphItem[]
  activityYearGraph: YearGraphItem[]
  topGenres: TopGenreItem[]
  topCreators: TopCreatorItem[]
  monthlyActivity: MonthlyActivityItem[]
  weeklyActivity?: WeeklyActivityItem[]
  dayOfWeekActivity?: DayOfWeekItem[]
  rewindHighlights?: RewindHighlights
}

export interface CombinedStatsResponse {
  isPeriodFiltered: boolean
  period?: PeriodFilter
  overview: {
    totalTitles: number
    completedTitles: number
    totalTimeMinutes: number
    daysConsumed: number
    meanScore: number
    standardDeviation: number
    scoredCount: number
  }
  mediaBreakdown: Array<{
    mediaType: string
    count: number
    hours: number
    percentage: number
  }>
  statusDistribution: DistributionItem[]
  scoreDistribution: {
    scores: ScoreDistributionItem[]
    unratedCount: number
  }
  activityYearGraph: YearGraphItem[]
  topGenres: TopGenreItem[]
  topCreators?: TopCreatorItem[]
  monthlyActivity: MonthlyActivityItem[]
  weeklyActivity?: WeeklyActivityItem[]
  dayOfWeekActivity?: DayOfWeekItem[]
}

function resolveDateRange(period?: PeriodFilter): {
  start: Date | null
  end: Date | null
} {
  if (!period || (!period.year && !period.quarter && !period.month)) {
    return { start: null, end: null }
  }

  const currentYear = new Date().getUTCFullYear()
  const year = period.year ?? currentYear

  if (period.month) {
    const m = Math.max(1, Math.min(12, period.month))
    const start = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0))
    const end = new Date(Date.UTC(year, m, 1, 0, 0, 0))
    return { start, end }
  }

  if (period.quarter) {
    const q = Math.max(1, Math.min(4, period.quarter))
    const startMonth = (q - 1) * 3
    const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0))
    const end = new Date(Date.UTC(year, startMonth + 3, 1, 0, 0, 0))
    return { start, end }
  }

  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0))
  return { start, end }
}

function resolveEntryDate(
  completedAt: Date | null,
  startedAt: Date | null,
  createdAt: Date
): Date {
  return completedAt ?? startedAt ?? createdAt
}

function isDateInRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start && !end) return true
  const time = date.getTime()
  if (start && time < start.getTime()) return false
  if (end && time >= end.getTime()) return false
  return true
}

function calculateMeanAndStdDev(scores: number[]): {
  mean: number
  stdDev: number
} {
  if (scores.length === 0) return { mean: 0, stdDev: 0 }
  const sum = scores.reduce((a, b) => a + b, 0)
  const mean = Math.round((sum / scores.length) * 100) / 100
  const variance =
    scores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / scores.length
  const stdDev = Math.round(Math.sqrt(variance) * 100) / 100
  return { mean, stdDev }
}

function buildScoreDistribution(rawScores: (number | null)[]): {
  scores: ScoreDistributionItem[]
  unratedCount: number
} {
  const buckets: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
  }
  let unratedCount = 0

  for (const s of rawScores) {
    if (s === null || s === undefined || s <= 0) {
      unratedCount++
    } else {
      const rounded = Math.min(10, Math.max(1, Math.round(s)))
      buckets[rounded] = (buckets[rounded] ?? 0) + 1
    }
  }

  const scores = Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map((score) => ({ score, count: buckets[score] ?? 0 }))

  return { scores, unratedCount }
}

function buildDistribution(
  counts: Record<string, number>,
  total: number
): DistributionItem[] {
  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function buildWeeklyAndDailyActivity(
  weeklyActivityMap: Record<string, number>,
  dayOfWeekMap: Record<number, number>
) {
  const weeklyActivity: WeeklyActivityItem[] = Object.entries(weeklyActivityMap)
    .map(([k, count]) => {
      const [y, w] = k.split("-").map(Number)
      return { year: y ?? 0, week: w ?? 1, count }
    })
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.week - b.week))

  const dayOfWeekActivity: DayOfWeekItem[] = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    day: d,
    dayName: DAY_NAMES[d]!,
    count: dayOfWeekMap[d] ?? 0,
  }))

  return { weeklyActivity, dayOfWeekActivity }
}

const STATS_CACHE_TTL_SECONDS = 86400 // 24 hours

export class MediaStatsService {
  private static instance: MediaStatsService

  public static getInstance(): MediaStatsService {
    if (!MediaStatsService.instance) {
      MediaStatsService.instance = new MediaStatsService()
    }
    return MediaStatsService.instance
  }

  /**
   * Calculates comprehensive stats for user's anime list.
   */
  public async getAnimeStats(
    userId: string,
    isOwner: boolean,
    period?: PeriodFilter
  ): Promise<MediaStatsResponse> {
    const cacheKey = `iris:stats:${userId}:anime:${period?.year ?? "all"}:${period?.quarter ?? "all"}:${period?.month ?? "all"}:${isOwner ? "1" : "0"}`

    return cache.getOrSet(cacheKey, async () => {
      const { start, end } = resolveDateRange(period)
      const isPeriodFiltered = Boolean(start || end)

      const entries = await prisma.animeList.findMany({
        where: {
          userId,
          ...(!isOwner ? { private: false } : {}),
        },
        include: {
          anime: {
            select: {
              id: true,
              titlePrimary: true,
              coverImage: true,
              episodeCount: true,
              episodeDuration: true,
              format: true,
              countryOfOrigin: true,
              startDateYear: true,
              genres: { select: { name: true } },
              studios: { select: { studio: { select: { name: true } } } },
            },
          },
        },
      })

      const filteredEntries = isPeriodFiltered
        ? entries.filter((e) => {
          const d = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
          return isDateInRange(d, start, end)
        })
        : entries

      let completedCount = 0
      let watchingCount = 0
      let planningCount = 0
      let onHoldCount = 0
      let droppedCount = 0
      let totalEpisodesWatched = 0
      let totalTimeMinutes = 0
      let plannedMinutes = 0

      const scores: number[] = []
      const allScores: (number | null)[] = []
      const formatCounts: Record<string, number> = {}
      const statusCounts: Record<string, number> = {}
      const countryCounts: Record<string, number> = {}
      const releaseYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const activityYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const genreMap: Record<
        string,
        { count: number; scores: number[]; minutes: number }
      > = {}
      const studioMap: Record<string, { count: number; scores: number[] }> = {}
      const monthlyActivityMap: Record<string, number> = {}
      const weeklyActivityMap: Record<string, number> = {}
      const dayOfWeekMap: Record<number, number> = {}

      const lengthBuckets: Record<string, number> = {
        "Movie / Special (1 ep)": 0,
        "Short (2–13 eps)": 0,
        "Standard (14–26 eps)": 0,
        "Long (27–52 eps)": 0,
        "Massive (53+ eps)": 0,
      }

      for (const e of filteredEntries) {
        const status = e.status
        statusCounts[status] = (statusCounts[status] ?? 0) + 1

        if (status === "COMPLETED") completedCount++
        else if (status === "WATCHING") watchingCount++
        else if (status === "PLANNING") planningCount++
        else if (status === "ON_HOLD") onHoldCount++
        else if (status === "DROPPED") droppedCount++

        const progress = e.progress || 0
        const rewatched = e.rewatched || 0
        totalEpisodesWatched += progress * (rewatched + 1)

        const duration =
          e.anime.episodeDuration && e.anime.episodeDuration > 0
            ? e.anime.episodeDuration
            : e.anime.format === "MOVIE"
              ? 90
              : 24

        const entryWatchedMinutes = progress * duration * (rewatched + 1)
        totalTimeMinutes += entryWatchedMinutes

        if (status === "PLANNING" || status === "WATCHING") {
          const totalEps = e.anime.episodeCount || progress
          const remaining = Math.max(0, totalEps - progress)
          plannedMinutes += remaining * duration
        }

        allScores.push(e.score)
        if (typeof e.score === "number" && e.score > 0) {
          scores.push(e.score)
        }

        const fmt = e.anime.format || "UNKNOWN"
        formatCounts[fmt] = (formatCounts[fmt] ?? 0) + 1

        const country = e.anime.countryOfOrigin || "JP"
        countryCounts[country] = (countryCounts[country] ?? 0) + 1

        const totalEps = e.anime.episodeCount || progress || 1
        if (totalEps <= 1) {
          lengthBuckets["Movie / Special (1 ep)"] = (lengthBuckets["Movie / Special (1 ep)"] ?? 0) + 1
        } else if (totalEps <= 13) {
          lengthBuckets["Short (2–13 eps)"] = (lengthBuckets["Short (2–13 eps)"] ?? 0) + 1
        } else if (totalEps <= 26) {
          lengthBuckets["Standard (14–26 eps)"] = (lengthBuckets["Standard (14–26 eps)"] ?? 0) + 1
        } else if (totalEps <= 52) {
          lengthBuckets["Long (27–52 eps)"] = (lengthBuckets["Long (27–52 eps)"] ?? 0) + 1
        } else {
          lengthBuckets["Massive (53+ eps)"] = (lengthBuckets["Massive (53+ eps)"] ?? 0) + 1
        }

        if (e.anime.startDateYear) {
          const y = e.anime.startDateYear
          let node = releaseYearMap[y]
          if (!node) {
            node = { titles: 0, scores: [], minutes: 0 }
            releaseYearMap[y] = node
          }
          node.titles++
          node.minutes += entryWatchedMinutes
          if (typeof e.score === "number" && e.score > 0) {
            node.scores.push(e.score)
          }
        }

        const entryDate = resolveEntryDate(
          e.completedAt,
          e.startedAt,
          e.createdAt
        )
        const actYear = entryDate.getUTCFullYear()
        let actNode = activityYearMap[actYear]
        if (!actNode) {
          actNode = { titles: 0, scores: [], minutes: 0 }
          activityYearMap[actYear] = actNode
        }
        actNode.titles++
        actNode.minutes += entryWatchedMinutes
        if (typeof e.score === "number" && e.score > 0) {
          actNode.scores.push(e.score)
        }

        const monthKey = `${entryDate.getUTCFullYear()}-${entryDate.getUTCMonth() + 1}`
        monthlyActivityMap[monthKey] = (monthlyActivityMap[monthKey] ?? 0) + 1

        const weekNum = getISOWeekNumber(entryDate)
        const weekKey = `${entryDate.getUTCFullYear()}-${weekNum}`
        weeklyActivityMap[weekKey] = (weeklyActivityMap[weekKey] ?? 0) + 1
        dayOfWeekMap[entryDate.getUTCDay()] = (dayOfWeekMap[entryDate.getUTCDay()] ?? 0) + 1

        for (const g of e.anime.genres) {
          let gNode = genreMap[g.name]
          if (!gNode) {
            gNode = { count: 0, scores: [], minutes: 0 }
            genreMap[g.name] = gNode
          }
          gNode.count++
          gNode.minutes += entryWatchedMinutes
          if (typeof e.score === "number" && e.score > 0) {
            gNode.scores.push(e.score)
          }
        }

        for (const st of e.anime.studios) {
          const sName = st.studio.name
          let sNode = studioMap[sName]
          if (!sNode) {
            sNode = { count: 0, scores: [] }
            studioMap[sName] = sNode
          }
          sNode.count++
          if (typeof e.score === "number" && e.score > 0) {
            sNode.scores.push(e.score)
          }
        }
      }

      const { mean, stdDev } = calculateMeanAndStdDev(scores)
      const scoreDist = buildScoreDistribution(allScores)
      const totalCount = filteredEntries.length

      const releaseYearGraph: YearGraphItem[] = Object.keys(releaseYearMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((year) => {
          const node = releaseYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
          const mScore =
            node.scores.length > 0
              ? Math.round(
                (node.scores.reduce((a, b) => a + b, 0) / node.scores.length) *
                10
              ) / 10
              : 0
          return {
            year,
            titles: node.titles,
            meanScore: mScore,
            hours: Math.round((node.minutes / 60) * 10) / 10,
          }
        })

      const activityYearGraph: YearGraphItem[] = Object.keys(activityYearMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((year) => {
          const node = activityYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
          const mScore =
            node.scores.length > 0
              ? Math.round(
                (node.scores.reduce((a, b) => a + b, 0) / node.scores.length) *
                10
              ) / 10
              : 0
          return {
            year,
            titles: node.titles,
            meanScore: mScore,
            hours: Math.round((node.minutes / 60) * 10) / 10,
          }
        })

      const topGenres: TopGenreItem[] = Object.entries(genreMap)
        .map(([genre, data]) => ({
          genre,
          count: data.count,
          meanScore:
            data.scores.length > 0
              ? Math.round(
                (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                10
              ) / 10
              : 0,
          hours: Math.round((data.minutes / 60) * 10) / 10,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)

      const topCreators: TopCreatorItem[] = Object.entries(studioMap)
        .map(([name, data]) => ({
          name,
          count: data.count,
          meanScore:
            data.scores.length > 0
              ? Math.round(
                (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                10
              ) / 10
              : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      const monthlyActivity: MonthlyActivityItem[] = Object.entries(
        monthlyActivityMap
      )
        .map(([key, count]) => {
          const [y, m] = key.split("-").map(Number)
          return { year: y ?? 0, month: m ?? 1, count }
        })
        .sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month
        )

      const { weeklyActivity, dayOfWeekActivity } = buildWeeklyAndDailyActivity(
        weeklyActivityMap,
        dayOfWeekMap
      )

      let rewindHighlights: RewindHighlights | undefined = undefined
      if (isPeriodFiltered) {
        const scoredEntries = filteredEntries
          .filter((e) => typeof e.score === "number" && e.score > 0)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 5)
          .map((e) => ({
            id: e.anime.id,
            title: e.anime.titlePrimary,
            score: e.score!,
            coverImage: e.anime.coverImage,
          }))

        const completedWithDates = filteredEntries
          .filter((e) => e.status === "COMPLETED")
          .sort((a, b) => {
            const dateA = (a.completedAt ?? a.createdAt).getTime()
            const dateB = (b.completedAt ?? b.createdAt).getTime()
            return dateA - dateB
          })

        const first = completedWithDates[0]
        const last = completedWithDates[completedWithDates.length - 1]

        let busiestMonth: string | null = null
        let maxMonthCount = 0
        for (const [m, count] of Object.entries(monthlyActivityMap)) {
          if (count > maxMonthCount) {
            maxMonthCount = count
            busiestMonth = m
          }
        }

        rewindHighlights = {
          topScored: scoredEntries,
          milestones: {
            firstCompleted: first
              ? {
                id: first.anime.id,
                title: first.anime.titlePrimary,
                completedAt: (
                  first.completedAt ?? first.createdAt
                ).toISOString(),
              }
              : undefined,
            lastCompleted: last
              ? {
                id: last.anime.id,
                title: last.anime.titlePrimary,
                completedAt: (
                  last.completedAt ?? last.createdAt
                ).toISOString(),
              }
              : undefined,
          },
          busiestMonth,
        }
      }

      return {
        mediaType: "anime",
        isPeriodFiltered,
        period,
        overview: {
          totalCount,
          completedCount,
          currentCount: watchingCount,
          planningCount,
          onHoldCount,
          droppedCount,
          totalUnits: totalEpisodesWatched,
          totalTimeMinutes,
          daysConsumed: Math.round((totalTimeMinutes / 1440) * 10) / 10,
          daysPlanned: Math.round((plannedMinutes / 1440) * 10) / 10,
          meanScore: mean,
          standardDeviation: stdDev,
          scoredCount: scores.length,
        },
        scoreDistribution: scoreDist,
        lengthDistribution: Object.entries(lengthBuckets).map(
          ([label, count]) => ({
            label,
            count,
            description: label,
          })
        ),
        formatDistribution: buildDistribution(formatCounts, totalCount),
        statusDistribution: buildDistribution(statusCounts, totalCount),
        countryDistribution: buildDistribution(countryCounts, totalCount),
        releaseYearGraph,
        activityYearGraph,
        topGenres,
        topCreators,
        monthlyActivity,
        weeklyActivity,
        dayOfWeekActivity,
        rewindHighlights,
      }
    }, STATS_CACHE_TTL_SECONDS)
  }

  /**
   * Calculates comprehensive stats for user's manga list.
   * Rates: 7m Manga, 4m Manhwa, 20m Light Novel / ch; 1.5h Manga, 1h Manhwa, 3h Light Novel / vol.
   */
  public async getMangaStats(
    userId: string,
    isOwner: boolean,
    period?: PeriodFilter
  ): Promise<MediaStatsResponse> {
    const cacheKey = `iris:stats:${userId}:manga:${period?.year ?? "all"}:${period?.quarter ?? "all"}:${period?.month ?? "all"}:${isOwner ? "1" : "0"}`

    return cache.getOrSet(cacheKey, async () => {
      const { start, end } = resolveDateRange(period)
      const isPeriodFiltered = Boolean(start || end)

      const entries = await prisma.mangaList.findMany({
        where: {
          userId,
          ...(!isOwner ? { private: false } : {}),
        },
        include: {
          manga: {
            select: {
              id: true,
              titlePrimary: true,
              coverImage: true,
              volumeCount: true,
              chapterCount: true,
              format: true,
              countryOfOrigin: true,
              startDateYear: true,
              genres: { select: { name: true } },
              staff: { select: { person: { select: { namePrimary: true } } } },
            },
          },
        },
      })

      const filteredEntries = isPeriodFiltered
        ? entries.filter((e) => {
          const d = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
          return isDateInRange(d, start, end)
        })
        : entries

      let completedCount = 0
      let readingCount = 0
      let planningCount = 0
      let onHoldCount = 0
      let droppedCount = 0
      let totalChaptersRead = 0
      let totalVolumesRead = 0
      let totalTimeMinutes = 0
      let plannedMinutes = 0

      const scores: number[] = []
      const allScores: (number | null)[] = []
      const formatCounts: Record<string, number> = {}
      const statusCounts: Record<string, number> = {}
      const countryCounts: Record<string, number> = {}
      const releaseYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const activityYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const genreMap: Record<
        string,
        { count: number; scores: number[]; minutes: number }
      > = {}
      const creatorMap: Record<string, { count: number; scores: number[] }> = {}
      const monthlyActivityMap: Record<string, number> = {}
      const weeklyActivityMap: Record<string, number> = {}
      const dayOfWeekMap: Record<number, number> = {}

      const lengthBuckets: Record<string, number> = {
        "One-Shot / Short (<10 ch)": 0,
        "Medium (10–50 ch)": 0,
        "Long (51–100 ch)": 0,
        "Epic (100+ ch)": 0,
      }

      for (const e of filteredEntries) {
        const status = e.status
        statusCounts[status] = (statusCounts[status] ?? 0) + 1

        if (status === "COMPLETED") completedCount++
        else if (status === "READING") readingCount++
        else if (status === "PLANNING") planningCount++
        else if (status === "ON_HOLD") onHoldCount++
        else if (status === "DROPPED") droppedCount++

        const chProg = e.chaptersProgress || 0
        const volProg = e.volumesProgress || 0
        const reread = e.reread || 0

        totalChaptersRead += chProg * (reread + 1)
        totalVolumesRead += volProg * (reread + 1)

        const fmt = e.manga.format || "MANGA"
        const isManhwa = fmt === "MANHWA" || fmt === "MANHUA"
        const isNovel = fmt === "NOVEL" || fmt === "LIGHT_NOVEL"

        const chRate = isNovel ? 20 : isManhwa ? 4 : 7
        const volRate = isNovel ? 180 : isManhwa ? 60 : 90

        let entryMinutes = 0
        if (chProg > 0) {
          entryMinutes = chProg * chRate * (reread + 1)
        } else if (volProg > 0) {
          entryMinutes = volProg * volRate * (reread + 1)
        }
        totalTimeMinutes += entryMinutes

        if (status === "PLANNING" || status === "READING") {
          if (e.manga.chapterCount) {
            const rem = Math.max(0, e.manga.chapterCount - chProg)
            plannedMinutes += rem * chRate
          } else if (e.manga.volumeCount) {
            const rem = Math.max(0, e.manga.volumeCount - volProg)
            plannedMinutes += rem * volRate
          }
        }

        allScores.push(e.score)
        if (typeof e.score === "number" && e.score > 0) {
          scores.push(e.score)
        }

        formatCounts[fmt] = (formatCounts[fmt] ?? 0) + 1
        const country = e.manga.countryOfOrigin || (isManhwa ? "KR" : "JP")
        countryCounts[country] = (countryCounts[country] ?? 0) + 1

        const totalChapters = e.manga.chapterCount || chProg || 1
        if (totalChapters < 10) {
          lengthBuckets["One-Shot / Short (<10 ch)"] = (lengthBuckets["One-Shot / Short (<10 ch)"] ?? 0) + 1
        } else if (totalChapters <= 50) {
          lengthBuckets["Medium (10–50 ch)"] = (lengthBuckets["Medium (10–50 ch)"] ?? 0) + 1
        } else if (totalChapters <= 100) {
          lengthBuckets["Long (51–100 ch)"] = (lengthBuckets["Long (51–100 ch)"] ?? 0) + 1
        } else {
          lengthBuckets["Epic (100+ ch)"] = (lengthBuckets["Epic (100+ ch)"] ?? 0) + 1
        }

        if (e.manga.startDateYear) {
          const y = e.manga.startDateYear
          let node = releaseYearMap[y]
          if (!node) {
            node = { titles: 0, scores: [], minutes: 0 }
            releaseYearMap[y] = node
          }
          node.titles++
          node.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) {
            node.scores.push(e.score)
          }
        }

        const entryDate = resolveEntryDate(
          e.completedAt,
          e.startedAt,
          e.createdAt
        )
        const actYear = entryDate.getUTCFullYear()
        let actNode = activityYearMap[actYear]
        if (!actNode) {
          actNode = { titles: 0, scores: [], minutes: 0 }
          activityYearMap[actYear] = actNode
        }
        actNode.titles++
        actNode.minutes += entryMinutes
        if (typeof e.score === "number" && e.score > 0) {
          actNode.scores.push(e.score)
        }

        const monthKey = `${entryDate.getUTCFullYear()}-${entryDate.getUTCMonth() + 1}`
        monthlyActivityMap[monthKey] = (monthlyActivityMap[monthKey] ?? 0) + 1

        const weekNum = getISOWeekNumber(entryDate)
        const weekKey = `${entryDate.getUTCFullYear()}-${weekNum}`
        weeklyActivityMap[weekKey] = (weeklyActivityMap[weekKey] ?? 0) + 1
        dayOfWeekMap[entryDate.getUTCDay()] = (dayOfWeekMap[entryDate.getUTCDay()] ?? 0) + 1

        for (const g of e.manga.genres) {
          let gNode = genreMap[g.name]
          if (!gNode) {
            gNode = { count: 0, scores: [], minutes: 0 }
            genreMap[g.name] = gNode
          }
          gNode.count++
          gNode.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) {
            gNode.scores.push(e.score)
          }
        }

        for (const st of e.manga.staff) {
          const pName = st.person.namePrimary
          let cNode = creatorMap[pName]
          if (!cNode) {
            cNode = { count: 0, scores: [] }
            creatorMap[pName] = cNode
          }
          cNode.count++
          if (typeof e.score === "number" && e.score > 0) {
            cNode.scores.push(e.score)
          }
        }
      }

      const { mean, stdDev } = calculateMeanAndStdDev(scores)
      const scoreDist = buildScoreDistribution(allScores)
      const totalCount = filteredEntries.length

      const releaseYearGraph: YearGraphItem[] = Object.keys(releaseYearMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((year) => {
          const node = releaseYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
          const mScore =
            node.scores.length > 0
              ? Math.round(
                (node.scores.reduce((a, b) => a + b, 0) / node.scores.length) *
                10
              ) / 10
              : 0
          return {
            year,
            titles: node.titles,
            meanScore: mScore,
            hours: Math.round((node.minutes / 60) * 10) / 10,
          }
        })

      const activityYearGraph: YearGraphItem[] = Object.keys(activityYearMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((year) => {
          const node = activityYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
          const mScore =
            node.scores.length > 0
              ? Math.round(
                (node.scores.reduce((a, b) => a + b, 0) / node.scores.length) *
                10
              ) / 10
              : 0
          return {
            year,
            titles: node.titles,
            meanScore: mScore,
            hours: Math.round((node.minutes / 60) * 10) / 10,
          }
        })

      const topGenres: TopGenreItem[] = Object.entries(genreMap)
        .map(([genre, data]) => ({
          genre,
          count: data.count,
          meanScore:
            data.scores.length > 0
              ? Math.round(
                (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                10
              ) / 10
              : 0,
          hours: Math.round((data.minutes / 60) * 10) / 10,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)

      const topCreators: TopCreatorItem[] = Object.entries(creatorMap)
        .map(([name, data]) => ({
          name,
          count: data.count,
          meanScore:
            data.scores.length > 0
              ? Math.round(
                (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                10
              ) / 10
              : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      const monthlyActivity: MonthlyActivityItem[] = Object.entries(
        monthlyActivityMap
      )
        .map(([key, count]) => {
          const [y, m] = key.split("-").map(Number)
          return { year: y ?? 0, month: m ?? 1, count }
        })
        .sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month
        )

      const { weeklyActivity, dayOfWeekActivity } = buildWeeklyAndDailyActivity(
        weeklyActivityMap,
        dayOfWeekMap
      )

      let rewindHighlights: RewindHighlights | undefined = undefined
      if (isPeriodFiltered) {
        const scoredEntries = filteredEntries
          .filter((e) => typeof e.score === "number" && e.score > 0)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 5)
          .map((e) => ({
            id: e.manga.id,
            title: e.manga.titlePrimary,
            score: e.score!,
            coverImage: e.manga.coverImage,
          }))

        const completedWithDates = filteredEntries
          .filter((e) => e.status === "COMPLETED")
          .sort((a, b) => {
            const dateA = (a.completedAt ?? a.createdAt).getTime()
            const dateB = (b.completedAt ?? b.createdAt).getTime()
            return dateA - dateB
          })

        const first = completedWithDates[0]
        const last = completedWithDates[completedWithDates.length - 1]

        let busiestMonth: string | null = null
        let maxMonthCount = 0
        for (const [m, count] of Object.entries(monthlyActivityMap)) {
          if (count > maxMonthCount) {
            maxMonthCount = count
            busiestMonth = m
          }
        }

        rewindHighlights = {
          topScored: scoredEntries,
          milestones: {
            firstCompleted: first
              ? {
                id: first.manga.id,
                title: first.manga.titlePrimary,
                completedAt: (
                  first.completedAt ?? first.createdAt
                ).toISOString(),
              }
              : undefined,
            lastCompleted: last
              ? {
                id: last.manga.id,
                title: last.manga.titlePrimary,
                completedAt: (
                  last.completedAt ?? last.createdAt
                ).toISOString(),
              }
              : undefined,
          },
          busiestMonth,
        }
      }

      return {
        mediaType: "manga",
        isPeriodFiltered,
        period,
        overview: {
          totalCount,
          completedCount,
          currentCount: readingCount,
          planningCount,
          onHoldCount,
          droppedCount,
          totalUnits: totalChaptersRead || totalVolumesRead,
          totalTimeMinutes,
          daysConsumed: Math.round((totalTimeMinutes / 1440) * 10) / 10,
          daysPlanned: Math.round((plannedMinutes / 1440) * 10) / 10,
          meanScore: mean,
          standardDeviation: stdDev,
          scoredCount: scores.length,
        },
        scoreDistribution: scoreDist,
        lengthDistribution: Object.entries(lengthBuckets).map(
          ([label, count]) => ({
            label,
            count,
            description: label,
          })
        ),
        formatDistribution: buildDistribution(formatCounts, totalCount),
        statusDistribution: buildDistribution(statusCounts, totalCount),
        countryDistribution: buildDistribution(countryCounts, totalCount),
        releaseYearGraph,
        activityYearGraph,
        topGenres,
        topCreators,
        monthlyActivity,
        weeklyActivity,
        dayOfWeekActivity,
        rewindHighlights,
      }
    }, STATS_CACHE_TTL_SECONDS)
  }

  /**
   * Calculates comprehensive stats for user's movie list.
   */
  public async getMovieStats(
    userId: string,
    isOwner: boolean,
    period?: PeriodFilter
  ): Promise<MediaStatsResponse> {
    const cacheKey = `iris:stats:${userId}:movie:${period?.year ?? "all"}:${period?.quarter ?? "all"}:${period?.month ?? "all"}:${isOwner ? "1" : "0"}`

    return cache.getOrSet(cacheKey, async () => {
      const { start, end } = resolveDateRange(period)
      const isPeriodFiltered = Boolean(start || end)

      const entries = await prisma.movieList.findMany({
        where: {
          userId,
          ...(!isOwner ? { private: false } : {}),
        },
        include: {
          movie: {
            select: {
              id: true,
              titlePrimary: true,
              coverImage: true,
              runtime: true,
              countryOfOrigin: true,
              releaseDateYear: true,
              genres: { select: { name: true } },
              studios: {
                select: {
                  studio: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      const filtered = isPeriodFiltered
        ? entries.filter((e) => {
          const d = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
          return isDateInRange(d, start, end)
        })
        : entries

      let completedCount = 0
      let watchingCount = 0
      let planningCount = 0
      let droppedCount = 0
      let totalMinutes = 0
      const scores: number[] = []
      const allScores: (number | null)[] = []
      const statusCounts: Record<string, number> = {}
      const countryCounts: Record<string, number> = {}
      const releaseYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const activityYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const genreMap: Record<
        string,
        { count: number; scores: number[]; minutes: number }
      > = {}
      const studioMap: Record<string, { count: number; scores: number[] }> = {}
      const monthlyActivityMap: Record<string, number> = {}
      const weeklyActivityMap: Record<string, number> = {}
      const dayOfWeekMap: Record<number, number> = {}

      const lengthBuckets: Record<string, number> = {
        "Under 90m": 0,
        "Standard (90–120m)": 0,
        "Long (120–150m)": 0,
        "Epic (150m+)": 0,
      }

      for (const e of filtered) {
        statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1
        if (e.status === "COMPLETED") completedCount++
        else if (e.status === "WATCHING") watchingCount++
        else if (e.status === "PLANNING") planningCount++
        else if (e.status === "DROPPED") droppedCount++

        const runtime = e.movie.runtime && e.movie.runtime > 0 ? e.movie.runtime : 105
        const entryMinutes = (e.status === "COMPLETED" ? 1 : 0) * runtime * (e.rewatched + 1)
        totalMinutes += entryMinutes

        allScores.push(e.score)
        if (typeof e.score === "number" && e.score > 0) scores.push(e.score)

        const country = e.movie.countryOfOrigin || "US"
        countryCounts[country] = (countryCounts[country] ?? 0) + 1

        if (runtime < 90) lengthBuckets["Under 90m"] = (lengthBuckets["Under 90m"] ?? 0) + 1
        else if (runtime <= 120) lengthBuckets["Standard (90–120m)"] = (lengthBuckets["Standard (90–120m)"] ?? 0) + 1
        else if (runtime <= 150) lengthBuckets["Long (120–150m)"] = (lengthBuckets["Long (120–150m)"] ?? 0) + 1
        else lengthBuckets["Epic (150m+)"] = (lengthBuckets["Epic (150m+)"] ?? 0) + 1

        if (e.movie.releaseDateYear) {
          const y = e.movie.releaseDateYear
          let node = releaseYearMap[y]
          if (!node) {
            node = { titles: 0, scores: [], minutes: 0 }
            releaseYearMap[y] = node
          }
          node.titles++
          node.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) node.scores.push(e.score)
        }

        const entryDate = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
        const actYear = entryDate.getUTCFullYear()
        let actNode = activityYearMap[actYear]
        if (!actNode) {
          actNode = { titles: 0, scores: [], minutes: 0 }
          activityYearMap[actYear] = actNode
        }
        actNode.titles++
        actNode.minutes += entryMinutes
        if (typeof e.score === "number" && e.score > 0) actNode.scores.push(e.score)

        const monthKey = `${entryDate.getUTCFullYear()}-${entryDate.getUTCMonth() + 1}`
        monthlyActivityMap[monthKey] = (monthlyActivityMap[monthKey] ?? 0) + 1

        const weekNum = getISOWeekNumber(entryDate)
        const weekKey = `${entryDate.getUTCFullYear()}-${weekNum}`
        weeklyActivityMap[weekKey] = (weeklyActivityMap[weekKey] ?? 0) + 1
        dayOfWeekMap[entryDate.getUTCDay()] = (dayOfWeekMap[entryDate.getUTCDay()] ?? 0) + 1

        for (const g of e.movie.genres) {
          let gNode = genreMap[g.name]
          if (!gNode) {
            gNode = { count: 0, scores: [], minutes: 0 }
            genreMap[g.name] = gNode
          }
          gNode.count++
          gNode.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) gNode.scores.push(e.score)
        }

        if (e.movie.studios) {
          const seenInMovie = new Set<string>()
          for (const st of e.movie.studios) {
            const sName = st.studio?.name?.trim()
            if (!sName || seenInMovie.has(sName)) continue
            seenInMovie.add(sName)
            let sNode = studioMap[sName]
            if (!sNode) {
              sNode = { count: 0, scores: [] }
              studioMap[sName] = sNode
            }
            sNode.count++
            if (typeof e.score === "number" && e.score > 0) {
              sNode.scores.push(e.score)
            }
          }
        }
      }

      const { mean, stdDev } = calculateMeanAndStdDev(scores)
      const scoreDist = buildScoreDistribution(allScores)
      const totalCount = filtered.length
      const { weeklyActivity, dayOfWeekActivity } = buildWeeklyAndDailyActivity(
        weeklyActivityMap,
        dayOfWeekMap
      )

      return {
        mediaType: "movie",
        isPeriodFiltered,
        period,
        overview: {
          totalCount,
          completedCount,
          currentCount: watchingCount,
          planningCount,
          onHoldCount: 0,
          droppedCount,
          totalUnits: completedCount,
          totalTimeMinutes: totalMinutes,
          daysConsumed: Math.round((totalMinutes / 1440) * 10) / 10,
          daysPlanned: Math.round(((planningCount * 105) / 1440) * 10) / 10,
          meanScore: mean,
          standardDeviation: stdDev,
          scoredCount: scores.length,
        },
        scoreDistribution: scoreDist,
        lengthDistribution: Object.entries(lengthBuckets).map(([label, count]) => ({
          label,
          count,
          description: label,
        })),
        formatDistribution: [{ name: "MOVIE", count: totalCount, percentage: 100 }],
        statusDistribution: buildDistribution(statusCounts, totalCount),
        countryDistribution: buildDistribution(countryCounts, totalCount),
        releaseYearGraph: Object.keys(releaseYearMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map((year) => {
            const node = releaseYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
            return {
              year,
              titles: node.titles,
              meanScore:
                node.scores.length > 0
                  ? Math.round(
                    (node.scores.reduce((a, b) => a + b, 0) /
                      node.scores.length) *
                    10
                  ) / 10
                  : 0,
              hours: Math.round((node.minutes / 60) * 10) / 10,
            }
          }),
        activityYearGraph: Object.keys(activityYearMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map((year) => {
            const node = activityYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
            return {
              year,
              titles: node.titles,
              meanScore:
                node.scores.length > 0
                  ? Math.round(
                    (node.scores.reduce((a, b) => a + b, 0) /
                      node.scores.length) *
                    10
                  ) / 10
                  : 0,
              hours: Math.round((node.minutes / 60) * 10) / 10,
            }
          }),
        topGenres: Object.entries(genreMap)
          .map(([genre, data]) => ({
            genre,
            count: data.count,
            meanScore:
              data.scores.length > 0
                ? Math.round(
                  (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                  10
                ) / 10
                : 0,
            hours: Math.round((data.minutes / 60) * 10) / 10,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 25),
        topCreators: Object.entries(studioMap)
          .map(([name, data]) => ({
            name,
            count: data.count,
            meanScore:
              data.scores.length > 0
                ? Math.round(
                  (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                  10
                ) / 10
                : 0,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30),
        monthlyActivity: Object.entries(monthlyActivityMap).map(([k, count]) => {
          const [y, m] = k.split("-").map(Number)
          return { year: y ?? 0, month: m ?? 1, count }
        }),
        weeklyActivity,
        dayOfWeekActivity,
      }
    }, STATS_CACHE_TTL_SECONDS)
  }

  /**
   * Calculates comprehensive stats for user's tv list.
   */
  public async getTvStats(
    userId: string,
    isOwner: boolean,
    period?: PeriodFilter
  ): Promise<MediaStatsResponse> {
    const cacheKey = `iris:stats:${userId}:tv:${period?.year ?? "all"}:${period?.quarter ?? "all"}:${period?.month ?? "all"}:${isOwner ? "1" : "0"}`

    return cache.getOrSet(cacheKey, async () => {
      const { start, end } = resolveDateRange(period)
      const isPeriodFiltered = Boolean(start || end)

      const entries = await prisma.tvList.findMany({
        where: {
          userId,
          ...(!isOwner ? { private: false } : {}),
        },
        include: {
          tv: {
            select: {
              id: true,
              titlePrimary: true,
              coverImage: true,
              episodeCount: true,
              averageRuntime: true,
              countryOfOrigin: true,
              firstAiredYear: true,
              genres: { select: { name: true } },
              networks: true,
            },
          },
        },
      })

      const filtered = isPeriodFiltered
        ? entries.filter((e) => {
          const d = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
          return isDateInRange(d, start, end)
        })
        : entries

      let completedCount = 0
      let watchingCount = 0
      let planningCount = 0
      let onHoldCount = 0
      let droppedCount = 0
      let totalEpisodes = 0
      let totalMinutes = 0
      const scores: number[] = []
      const allScores: (number | null)[] = []
      const statusCounts: Record<string, number> = {}
      const countryCounts: Record<string, number> = {}
      const releaseYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const activityYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const genreMap: Record<
        string,
        { count: number; scores: number[]; minutes: number }
      > = {}
      const networkMap: Record<string, { count: number; scores: number[] }> = {}
      const monthlyActivityMap: Record<string, number> = {}
      const weeklyActivityMap: Record<string, number> = {}
      const dayOfWeekMap: Record<number, number> = {}

      for (const e of filtered) {
        statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1
        if (e.status === "COMPLETED") completedCount++
        else if (e.status === "WATCHING") watchingCount++
        else if (e.status === "PLANNING") planningCount++
        else if (e.status === "ON_HOLD") onHoldCount++
        else if (e.status === "DROPPED") droppedCount++

        const progress = e.progress || 0
        totalEpisodes += progress * (e.rewatched + 1)
        const runtime = e.tv.averageRuntime || 45
        const entryMinutes = progress * runtime * (e.rewatched + 1)
        totalMinutes += entryMinutes

        allScores.push(e.score)
        if (typeof e.score === "number" && e.score > 0) scores.push(e.score)

        const country = e.tv.countryOfOrigin || "US"
        countryCounts[country] = (countryCounts[country] ?? 0) + 1

        if (e.tv.firstAiredYear) {
          const y = e.tv.firstAiredYear
          let node = releaseYearMap[y]
          if (!node) {
            node = { titles: 0, scores: [], minutes: 0 }
            releaseYearMap[y] = node
          }
          node.titles++
          node.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) node.scores.push(e.score)
        }

        const entryDate = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
        const actYear = entryDate.getUTCFullYear()
        let actNode = activityYearMap[actYear]
        if (!actNode) {
          actNode = { titles: 0, scores: [], minutes: 0 }
          activityYearMap[actYear] = actNode
        }
        actNode.titles++
        actNode.minutes += entryMinutes
        if (typeof e.score === "number" && e.score > 0) actNode.scores.push(e.score)

        const monthKey = `${entryDate.getUTCFullYear()}-${entryDate.getUTCMonth() + 1}`
        monthlyActivityMap[monthKey] = (monthlyActivityMap[monthKey] ?? 0) + 1

        const weekNum = getISOWeekNumber(entryDate)
        const weekKey = `${entryDate.getUTCFullYear()}-${weekNum}`
        weeklyActivityMap[weekKey] = (weeklyActivityMap[weekKey] ?? 0) + 1
        dayOfWeekMap[entryDate.getUTCDay()] = (dayOfWeekMap[entryDate.getUTCDay()] ?? 0) + 1

        for (const g of e.tv.genres) {
          let gNode = genreMap[g.name]
          if (!gNode) {
            gNode = { count: 0, scores: [], minutes: 0 }
            genreMap[g.name] = gNode
          }
          gNode.count++
          gNode.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) gNode.scores.push(e.score)
        }

        for (const net of e.tv.networks) {
          let nNode = networkMap[net]
          if (!nNode) {
            nNode = { count: 0, scores: [] }
            networkMap[net] = nNode
          }
          nNode.count++
          if (typeof e.score === "number" && e.score > 0) nNode.scores.push(e.score)
        }
      }

      const { mean, stdDev } = calculateMeanAndStdDev(scores)
      const scoreDist = buildScoreDistribution(allScores)
      const totalCount = filtered.length

      return {
        mediaType: "tv",
        isPeriodFiltered,
        period,
        overview: {
          totalCount,
          completedCount,
          currentCount: watchingCount,
          planningCount,
          onHoldCount,
          droppedCount,
          totalUnits: totalEpisodes,
          totalTimeMinutes: totalMinutes,
          daysConsumed: Math.round((totalMinutes / 1440) * 10) / 10,
          daysPlanned: Math.round(((planningCount * 45 * 10) / 1440) * 10) / 10,
          meanScore: mean,
          standardDeviation: stdDev,
          scoredCount: scores.length,
        },
        scoreDistribution: scoreDist,
        lengthDistribution: [
          { label: "Mini-Series (1–6 eps)", count: filtered.filter((i) => (i.tv.episodeCount || i.progress) <= 6).length, description: "1-6 episodes" },
          { label: "Standard Season (7–13 eps)", count: filtered.filter((i) => (i.tv.episodeCount || i.progress) > 6 && (i.tv.episodeCount || i.progress) <= 13).length, description: "7-13 episodes" },
          { label: "Full Season (14–24 eps)", count: filtered.filter((i) => (i.tv.episodeCount || i.progress) > 13 && (i.tv.episodeCount || i.progress) <= 24).length, description: "14-24 episodes" },
          { label: "Multi-Season (25+ eps)", count: filtered.filter((i) => (i.tv.episodeCount || i.progress) > 24).length, description: "25+ episodes" },
        ],
        formatDistribution: [{ name: "SERIES", count: totalCount, percentage: 100 }],
        statusDistribution: buildDistribution(statusCounts, totalCount),
        countryDistribution: buildDistribution(countryCounts, totalCount),
        releaseYearGraph: Object.keys(releaseYearMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map((year) => {
            const node = releaseYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
            return {
              year,
              titles: node.titles,
              meanScore:
                node.scores.length > 0
                  ? Math.round(
                    (node.scores.reduce((a, b) => a + b, 0) /
                      node.scores.length) *
                    10
                  ) / 10
                  : 0,
              hours: Math.round((node.minutes / 60) * 10) / 10,
            }
          }),
        activityYearGraph: Object.keys(activityYearMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map((year) => {
            const node = activityYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
            return {
              year,
              titles: node.titles,
              meanScore:
                node.scores.length > 0
                  ? Math.round(
                    (node.scores.reduce((a, b) => a + b, 0) /
                      node.scores.length) *
                    10
                  ) / 10
                  : 0,
              hours: Math.round((node.minutes / 60) * 10) / 10,
            }
          }),
        topGenres: Object.entries(genreMap)
          .map(([genre, data]) => ({
            genre,
            count: data.count,
            meanScore:
              data.scores.length > 0
                ? Math.round(
                  (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                  10
                ) / 10
                : 0,
            hours: Math.round((data.minutes / 60) * 10) / 10,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15),
        topCreators: Object.entries(networkMap)
          .map(([name, data]) => ({
            name,
            count: data.count,
            meanScore:
              data.scores.length > 0
                ? Math.round(
                  (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                  10
                ) / 10
                : 0,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30),
        monthlyActivity: Object.entries(monthlyActivityMap).map(([k, count]) => {
          const [y, m] = k.split("-").map(Number)
          return { year: y ?? 0, month: m ?? 1, count }
        }),
        weeklyActivity: buildWeeklyAndDailyActivity(weeklyActivityMap, dayOfWeekMap).weeklyActivity,
        dayOfWeekActivity: buildWeeklyAndDailyActivity(weeklyActivityMap, dayOfWeekMap).dayOfWeekActivity,
      }
    }, STATS_CACHE_TTL_SECONDS)
  }

  /**
   * Calculates comprehensive stats for user's game list.
   */
  public async getGameStats(
    userId: string,
    isOwner: boolean,
    period?: PeriodFilter
  ): Promise<MediaStatsResponse> {
    const cacheKey = `iris:stats:${userId}:game:${period?.year ?? "all"}:${period?.quarter ?? "all"}:${period?.month ?? "all"}:${isOwner ? "1" : "0"}`

    return cache.getOrSet(cacheKey, async () => {
      const { start, end } = resolveDateRange(period)
      const isPeriodFiltered = Boolean(start || end)

      const entries = await prisma.gameList.findMany({
        where: {
          userId,
          ...(!isOwner ? { private: false } : {}),
        },
        include: {
          game: {
            select: {
              id: true,
              titlePrimary: true,
              coverImage: true,
              platforms: true,
              developers: true,
              publishers: true,
              releaseDateYear: true,
              genres: { select: { name: true } },
            },
          },
        },
      })

      const filtered = isPeriodFiltered
        ? entries.filter((e) => {
          const d = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
          return isDateInRange(d, start, end)
        })
        : entries

      let completedCount = 0
      let playingCount = 0
      let planningCount = 0
      let onHoldCount = 0
      let droppedCount = 0
      let totalPlaytimeHours = 0
      const scores: number[] = []
      const allScores: (number | null)[] = []
      const statusCounts: Record<string, number> = {}
      const platformCounts: Record<string, number> = {}
      const releaseYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const activityYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const genreMap: Record<
        string,
        { count: number; scores: number[]; minutes: number }
      > = {}
      const devMap: Record<string, { count: number; scores: number[] }> = {}
      const monthlyActivityMap: Record<string, number> = {}
      const weeklyActivityMap: Record<string, number> = {}
      const dayOfWeekMap: Record<number, number> = {}

      for (const e of filtered) {
        statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1
        if (e.status === "COMPLETED") completedCount++
        else if (e.status === "PLAYING") playingCount++
        else if (e.status === "PLANNING") planningCount++
        else if (e.status === "ON_HOLD") onHoldCount++
        else if (e.status === "DROPPED") droppedCount++

        const hours = e.progress || 0
        totalPlaytimeHours += hours
        const entryMinutes = hours * 60

        allScores.push(e.score)
        if (typeof e.score === "number" && e.score > 0) scores.push(e.score)

        for (const p of e.game.platforms) {
          platformCounts[p] = (platformCounts[p] ?? 0) + 1
        }

        if (e.game.releaseDateYear) {
          const y = e.game.releaseDateYear
          let node = releaseYearMap[y]
          if (!node) {
            node = { titles: 0, scores: [], minutes: 0 }
            releaseYearMap[y] = node
          }
          node.titles++
          node.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) node.scores.push(e.score)
        }

        const entryDate = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
        const actYear = entryDate.getUTCFullYear()
        let actNode = activityYearMap[actYear]
        if (!actNode) {
          actNode = { titles: 0, scores: [], minutes: 0 }
          activityYearMap[actYear] = actNode
        }
        actNode.titles++
        actNode.minutes += entryMinutes
        if (typeof e.score === "number" && e.score > 0) actNode.scores.push(e.score)

        const monthKey = `${entryDate.getUTCFullYear()}-${entryDate.getUTCMonth() + 1}`
        monthlyActivityMap[monthKey] = (monthlyActivityMap[monthKey] ?? 0) + 1

        const weekNum = getISOWeekNumber(entryDate)
        const weekKey = `${entryDate.getUTCFullYear()}-${weekNum}`
        weeklyActivityMap[weekKey] = (weeklyActivityMap[weekKey] ?? 0) + 1
        dayOfWeekMap[entryDate.getUTCDay()] = (dayOfWeekMap[entryDate.getUTCDay()] ?? 0) + 1

        for (const g of e.game.genres) {
          let gNode = genreMap[g.name]
          if (!gNode) {
            gNode = { count: 0, scores: [], minutes: 0 }
            genreMap[g.name] = gNode
          }
          gNode.count++
          gNode.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) gNode.scores.push(e.score)
        }

        for (const d of e.game.developers) {
          let dNode = devMap[d]
          if (!dNode) {
            dNode = { count: 0, scores: [] }
            devMap[d] = dNode
          }
          dNode.count++
          if (typeof e.score === "number" && e.score > 0) dNode.scores.push(e.score)
        }
      }

      const { mean, stdDev } = calculateMeanAndStdDev(scores)
      const scoreDist = buildScoreDistribution(allScores)
      const totalCount = filtered.length

      return {
        mediaType: "game",
        isPeriodFiltered,
        period,
        overview: {
          totalCount,
          completedCount,
          currentCount: playingCount,
          planningCount,
          onHoldCount,
          droppedCount,
          totalUnits: totalPlaytimeHours,
          totalTimeMinutes: totalPlaytimeHours * 60,
          daysConsumed: Math.round(((totalPlaytimeHours * 60) / 1440) * 10) / 10,
          daysPlanned: Math.round(((planningCount * 25 * 60) / 1440) * 10) / 10,
          meanScore: mean,
          standardDeviation: stdDev,
          scoredCount: scores.length,
        },
        scoreDistribution: scoreDist,
        lengthDistribution: [
          { label: "Quick (<10 hrs)", count: filtered.filter((i) => (i.progress || 0) < 10).length, description: "<10 hours" },
          { label: "Regular (10–30 hrs)", count: filtered.filter((i) => (i.progress || 0) >= 10 && (i.progress || 0) <= 30).length, description: "10-30 hours" },
          { label: "Deep (30–80 hrs)", count: filtered.filter((i) => (i.progress || 0) > 30 && (i.progress || 0) <= 80).length, description: "30-80 hours" },
          { label: "Massive (80+ hrs)", count: filtered.filter((i) => (i.progress || 0) > 80).length, description: "80+ hours" },
        ],
        formatDistribution: buildDistribution(platformCounts, totalCount),
        statusDistribution: buildDistribution(statusCounts, totalCount),
        countryDistribution: [],
        releaseYearGraph: Object.keys(releaseYearMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map((year) => {
            const node = releaseYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
            return {
              year,
              titles: node.titles,
              meanScore:
                node.scores.length > 0
                  ? Math.round(
                    (node.scores.reduce((a, b) => a + b, 0) /
                      node.scores.length) *
                    10
                  ) / 10
                  : 0,
              hours: Math.round((node.minutes / 60) * 10) / 10,
            }
          }),
        activityYearGraph: Object.keys(activityYearMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map((year) => {
            const node = activityYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
            return {
              year,
              titles: node.titles,
              meanScore:
                node.scores.length > 0
                  ? Math.round(
                    (node.scores.reduce((a, b) => a + b, 0) /
                      node.scores.length) *
                    10
                  ) / 10
                  : 0,
              hours: Math.round((node.minutes / 60) * 10) / 10,
            }
          }),
        topGenres: Object.entries(genreMap)
          .map(([genre, data]) => ({
            genre,
            count: data.count,
            meanScore:
              data.scores.length > 0
                ? Math.round(
                  (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                  10
                ) / 10
                : 0,
            hours: Math.round((data.minutes / 60) * 10) / 10,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15),
        topCreators: Object.entries(devMap)
          .map(([name, data]) => ({
            name,
            count: data.count,
            meanScore:
              data.scores.length > 0
                ? Math.round(
                  (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                  10
                ) / 10
                : 0,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30),
        monthlyActivity: Object.entries(monthlyActivityMap).map(([k, count]) => {
          const [y, m] = k.split("-").map(Number)
          return { year: y ?? 0, month: m ?? 1, count }
        }),
        weeklyActivity: buildWeeklyAndDailyActivity(weeklyActivityMap, dayOfWeekMap).weeklyActivity,
        dayOfWeekActivity: buildWeeklyAndDailyActivity(weeklyActivityMap, dayOfWeekMap).dayOfWeekActivity,
      }
    }, STATS_CACHE_TTL_SECONDS)
  }

  /**
   * Calculates comprehensive stats for user's book list.
   */
  public async getBookStats(
    userId: string,
    isOwner: boolean,
    period?: PeriodFilter
  ): Promise<MediaStatsResponse> {
    const cacheKey = `iris:stats:${userId}:book:${period?.year ?? "all"}:${period?.quarter ?? "all"}:${period?.month ?? "all"}:${isOwner ? "1" : "0"}`

    return cache.getOrSet(cacheKey, async () => {
      const { start, end } = resolveDateRange(period)
      const isPeriodFiltered = Boolean(start || end)

      const entries = await prisma.bookList.findMany({
        where: {
          userId,
          ...(!isOwner ? { private: false } : {}),
        },
        include: {
          book: {
            select: {
              id: true,
              titlePrimary: true,
              coverImage: true,
              pageCount: true,
              authors: true,
              publishers: true,
              releaseDateYear: true,
              genres: { select: { name: true } },
            },
          },
        },
      })

      const filtered = isPeriodFiltered
        ? entries.filter((e) => {
          const d = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
          return isDateInRange(d, start, end)
        })
        : entries

      let completedCount = 0
      let readingCount = 0
      let planningCount = 0
      let onHoldCount = 0
      let droppedCount = 0
      let totalPages = 0
      let totalMinutes = 0
      const scores: number[] = []
      const allScores: (number | null)[] = []
      const statusCounts: Record<string, number> = {}
      const releaseYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const activityYearMap: Record<
        number,
        { titles: number; scores: number[]; minutes: number }
      > = {}
      const genreMap: Record<
        string,
        { count: number; scores: number[]; minutes: number }
      > = {}
      const authorMap: Record<string, { count: number; scores: number[] }> = {}
      const monthlyActivityMap: Record<string, number> = {}
      const weeklyActivityMap: Record<string, number> = {}
      const dayOfWeekMap: Record<number, number> = {}

      for (const e of filtered) {
        statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1
        if (e.status === "COMPLETED") completedCount++
        else if (e.status === "READING") readingCount++
        else if (e.status === "PLANNING") planningCount++
        else if (e.status === "ON_HOLD") onHoldCount++
        else if (e.status === "DROPPED") droppedCount++

        const pages = e.progressPages || (e.status === "COMPLETED" ? e.book.pageCount || 300 : 0)
        totalPages += pages * (e.reread + 1)
        const entryMinutes = Math.round(pages * 1.2 * (e.reread + 1))
        totalMinutes += entryMinutes

        allScores.push(e.score)
        if (typeof e.score === "number" && e.score > 0) scores.push(e.score)

        if (e.book.releaseDateYear) {
          const y = e.book.releaseDateYear
          let node = releaseYearMap[y]
          if (!node) {
            node = { titles: 0, scores: [], minutes: 0 }
            releaseYearMap[y] = node
          }
          node.titles++
          node.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) node.scores.push(e.score)
        }

        const entryDate = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
        const actYear = entryDate.getUTCFullYear()
        let actNode = activityYearMap[actYear]
        if (!actNode) {
          actNode = { titles: 0, scores: [], minutes: 0 }
          activityYearMap[actYear] = actNode
        }
        actNode.titles++
        actNode.minutes += entryMinutes
        if (typeof e.score === "number" && e.score > 0) actNode.scores.push(e.score)

        const monthKey = `${entryDate.getUTCFullYear()}-${entryDate.getUTCMonth() + 1}`
        monthlyActivityMap[monthKey] = (monthlyActivityMap[monthKey] ?? 0) + 1

        const weekNum = getISOWeekNumber(entryDate)
        const weekKey = `${entryDate.getUTCFullYear()}-${weekNum}`
        weeklyActivityMap[weekKey] = (weeklyActivityMap[weekKey] ?? 0) + 1
        dayOfWeekMap[entryDate.getUTCDay()] = (dayOfWeekMap[entryDate.getUTCDay()] ?? 0) + 1

        for (const g of e.book.genres) {
          let gNode = genreMap[g.name]
          if (!gNode) {
            gNode = { count: 0, scores: [], minutes: 0 }
            genreMap[g.name] = gNode
          }
          gNode.count++
          gNode.minutes += entryMinutes
          if (typeof e.score === "number" && e.score > 0) gNode.scores.push(e.score)
        }

        for (const a of e.book.authors) {
          let aNode = authorMap[a]
          if (!aNode) {
            aNode = { count: 0, scores: [] }
            authorMap[a] = aNode
          }
          aNode.count++
          if (typeof e.score === "number" && e.score > 0) aNode.scores.push(e.score)
        }
      }

      const { mean, stdDev } = calculateMeanAndStdDev(scores)
      const scoreDist = buildScoreDistribution(allScores)
      const totalCount = filtered.length

      return {
        mediaType: "book",
        isPeriodFiltered,
        period,
        overview: {
          totalCount,
          completedCount,
          currentCount: readingCount,
          planningCount,
          onHoldCount,
          droppedCount,
          totalUnits: totalPages,
          totalTimeMinutes: totalMinutes,
          daysConsumed: Math.round((totalMinutes / 1440) * 10) / 10,
          daysPlanned: Math.round(((planningCount * 300 * 1.2) / 1440) * 10) / 10,
          meanScore: mean,
          standardDeviation: stdDev,
          scoredCount: scores.length,
        },
        scoreDistribution: scoreDist,
        lengthDistribution: [
          { label: "Novella (<200 pages)", count: filtered.filter((i) => (i.book.pageCount || 250) < 200).length, description: "<200 pages" },
          { label: "Regular (200–400 pages)", count: filtered.filter((i) => (i.book.pageCount || 250) >= 200 && (i.book.pageCount || 250) <= 400).length, description: "200-400 pages" },
          { label: "Thick (400–700 pages)", count: filtered.filter((i) => (i.book.pageCount || 250) > 400 && (i.book.pageCount || 250) <= 700).length, description: "400-700 pages" },
          { label: "Epic (700+ pages)", count: filtered.filter((i) => (i.book.pageCount || 250) > 700).length, description: "700+ pages" },
        ],
        formatDistribution: [{ name: "BOOK", count: totalCount, percentage: 100 }],
        statusDistribution: buildDistribution(statusCounts, totalCount),
        countryDistribution: [],
        releaseYearGraph: Object.keys(releaseYearMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map((year) => {
            const node = releaseYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
            return {
              year,
              titles: node.titles,
              meanScore:
                node.scores.length > 0
                  ? Math.round(
                    (node.scores.reduce((a, b) => a + b, 0) /
                      node.scores.length) *
                    10
                  ) / 10
                  : 0,
              hours: Math.round((node.minutes / 60) * 10) / 10,
            }
          }),
        activityYearGraph: Object.keys(activityYearMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map((year) => {
            const node = activityYearMap[year] ?? { titles: 0, scores: [], minutes: 0 }
            return {
              year,
              titles: node.titles,
              meanScore:
                node.scores.length > 0
                  ? Math.round(
                    (node.scores.reduce((a, b) => a + b, 0) /
                      node.scores.length) *
                    10
                  ) / 10
                  : 0,
              hours: Math.round((node.minutes / 60) * 10) / 10,
            }
          }),
        topGenres: Object.entries(genreMap)
          .map(([genre, data]) => ({
            genre,
            count: data.count,
            meanScore:
              data.scores.length > 0
                ? Math.round(
                  (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                  10
                ) / 10
                : 0,
            hours: Math.round((data.minutes / 60) * 10) / 10,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15),
        topCreators: Object.entries(authorMap)
          .map(([name, data]) => ({
            name,
            count: data.count,
            meanScore:
              data.scores.length > 0
                ? Math.round(
                  (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                  10
                ) / 10
                : 0,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30),
        monthlyActivity: Object.entries(monthlyActivityMap).map(([k, count]) => {
          const [y, m] = k.split("-").map(Number)
          return { year: y ?? 0, month: m ?? 1, count }
        }),
        weeklyActivity: buildWeeklyAndDailyActivity(weeklyActivityMap, dayOfWeekMap).weeklyActivity,
        dayOfWeekActivity: buildWeeklyAndDailyActivity(weeklyActivityMap, dayOfWeekMap).dayOfWeekActivity,
      }
    }, STATS_CACHE_TTL_SECONDS)
  }

  /**
   * Calculates comprehensive stats for user's music list.
   */
  public async getMusicStats(
    userId: string,
    isOwner: boolean,
    period?: PeriodFilter
  ): Promise<MediaStatsResponse> {
    const cacheKey = `iris:stats:${userId}:music:${period?.year ?? "all"}:${period?.quarter ?? "all"}:${period?.month ?? "all"}:${isOwner ? "1" : "0"}`

    return cache.getOrSet(cacheKey, async () => {
      const { start, end } = resolveDateRange(period)
      const isPeriodFiltered = Boolean(start || end)

      const entries = await prisma.musicList.findMany({
        where: {
          userId,
          ...(!isOwner ? { private: false } : {}),
        },
        include: {
          music: {
            select: {
              id: true,
              titlePrimary: true,
              coverImage: true,
              duration: true,
              type: true,
              releaseDateYear: true,
              genres: { select: { name: true } },
            },
          },
        },
      })

      const filtered = isPeriodFiltered
        ? entries.filter((e) => {
          const d = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
          return isDateInRange(d, start, end)
        })
        : entries

      let totalPlays = 0
      let totalMinutes = 0
      const scores: number[] = []
      const allScores: (number | null)[] = []
      const statusCounts: Record<string, number> = {}
      const formatCounts: Record<string, number> = {}

      const monthlyActivityMap: Record<string, number> = {}
      const weeklyActivityMap: Record<string, number> = {}
      const dayOfWeekMap: Record<number, number> = {}

      for (const e of filtered) {
        statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1
        const plays = e.playCount || 1
        totalPlays += plays
        const durSec = e.music.duration || 210
        totalMinutes += Math.round((plays * durSec) / 60)

        allScores.push(e.score)
        if (typeof e.score === "number" && e.score > 0) scores.push(e.score)

        const fmt = e.music.type || "TRACK"
        formatCounts[fmt] = (formatCounts[fmt] ?? 0) + 1

        const entryDate = resolveEntryDate(e.completedAt, e.startedAt, e.createdAt)
        const monthKey = `${entryDate.getUTCFullYear()}-${entryDate.getUTCMonth() + 1}`
        monthlyActivityMap[monthKey] = (monthlyActivityMap[monthKey] ?? 0) + 1

        const weekNum = getISOWeekNumber(entryDate)
        const weekKey = `${entryDate.getUTCFullYear()}-${weekNum}`
        weeklyActivityMap[weekKey] = (weeklyActivityMap[weekKey] ?? 0) + 1
        dayOfWeekMap[entryDate.getUTCDay()] = (dayOfWeekMap[entryDate.getUTCDay()] ?? 0) + 1
      }

      const { mean, stdDev } = calculateMeanAndStdDev(scores)
      const scoreDist = buildScoreDistribution(allScores)
      const totalCount = filtered.length

      return {
        mediaType: "music",
        isPeriodFiltered,
        period,
        overview: {
          totalCount,
          completedCount: filtered.filter((i) => i.status === "COMPLETED").length,
          currentCount: filtered.filter((i) => i.status === "LISTENING").length,
          planningCount: filtered.filter((i) => i.status === "PLANNING").length,
          onHoldCount: 0,
          droppedCount: filtered.filter((i) => i.status === "DROPPED").length,
          totalUnits: totalPlays,
          totalTimeMinutes: totalMinutes,
          daysConsumed: Math.round((totalMinutes / 1440) * 10) / 10,
          daysPlanned: 0,
          meanScore: mean,
          standardDeviation: stdDev,
          scoredCount: scores.length,
        },
        scoreDistribution: scoreDist,
        lengthDistribution: [],
        formatDistribution: buildDistribution(formatCounts, totalCount),
        statusDistribution: buildDistribution(statusCounts, totalCount),
        countryDistribution: [],
        releaseYearGraph: [],
        activityYearGraph: [],
        topGenres: [],
        topCreators: [],
        monthlyActivity: Object.entries(monthlyActivityMap).map(([k, count]) => {
          const [y, m] = k.split("-").map(Number)
          return { year: y ?? 0, month: m ?? 1, count }
        }),
        weeklyActivity: buildWeeklyAndDailyActivity(weeklyActivityMap, dayOfWeekMap).weeklyActivity,
        dayOfWeekActivity: buildWeeklyAndDailyActivity(weeklyActivityMap, dayOfWeekMap).dayOfWeekActivity,
      }
    }, STATS_CACHE_TTL_SECONDS)
  }

  /**
   * Calculates overarching combined stats across all 7 media types.
   */
  public async getCombinedStats(
    userId: string,
    isOwner: boolean,
    period?: PeriodFilter
  ): Promise<CombinedStatsResponse> {
    const cacheKey = `iris:stats:${userId}:combined:${period?.year ?? "all"}:${period?.quarter ?? "all"}:${period?.month ?? "all"}:${isOwner ? "1" : "0"}`

    return cache.getOrSet(cacheKey, async () => {
      const [anime, manga, movie, tv, game, book, music] = await Promise.all([
        this.getAnimeStats(userId, isOwner, period),
        this.getMangaStats(userId, isOwner, period),
        this.getMovieStats(userId, isOwner, period),
        this.getTvStats(userId, isOwner, period),
        this.getGameStats(userId, isOwner, period),
        this.getBookStats(userId, isOwner, period),
        this.getMusicStats(userId, isOwner, period),
      ])

      const allStats = [
        { type: "anime", stats: anime },
        { type: "manga", stats: manga },
        { type: "movie", stats: movie },
        { type: "tv", stats: tv },
        { type: "game", stats: game },
        { type: "book", stats: book },
        { type: "music", stats: music },
      ]

      let totalTitles = 0
      let completedTitles = 0
      let totalTimeMinutes = 0
      let totalScoredCount = 0
      let scoreWeightedSum = 0

      for (const { stats } of allStats) {
        totalTitles += stats.overview.totalCount
        completedTitles += stats.overview.completedCount
        totalTimeMinutes += stats.overview.totalTimeMinutes
        totalScoredCount += stats.overview.scoredCount
        scoreWeightedSum += stats.overview.meanScore * stats.overview.scoredCount
      }

      const overallMean =
        totalScoredCount > 0
          ? Math.round((scoreWeightedSum / totalScoredCount) * 100) / 100
          : 0

      const mediaBreakdown = allStats.map(({ type, stats }) => ({
        mediaType: type,
        count: stats.overview.totalCount,
        hours: Math.round((stats.overview.totalTimeMinutes / 60) * 10) / 10,
        percentage:
          totalTimeMinutes > 0
            ? Math.round(
              (stats.overview.totalTimeMinutes / totalTimeMinutes) * 1000
            ) / 10
            : 0,
      }))

      const combinedScoreBuckets: Record<number, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0,
        7: 0,
        8: 0,
        9: 0,
        10: 0,
      }
      let combinedUnrated = 0

      for (const { stats } of allStats) {
        combinedUnrated += stats.scoreDistribution.unratedCount
        for (const item of stats.scoreDistribution.scores) {
          combinedScoreBuckets[item.score] =
            (combinedScoreBuckets[item.score] ?? 0) + item.count
        }
      }

      const scoreDist = {
        scores: Object.keys(combinedScoreBuckets)
          .map(Number)
          .sort((a, b) => a - b)
          .map((s) => ({ score: s, count: combinedScoreBuckets[s] ?? 0 })),
        unratedCount: combinedUnrated,
      }

      const combinedStatusCounts: Record<string, number> = {}
      for (const { stats } of allStats) {
        for (const st of stats.statusDistribution) {
          combinedStatusCounts[st.name] =
            (combinedStatusCounts[st.name] ?? 0) + st.count
        }
      }

      const activityYearMap: Record<
        number,
        { titles: number; scores: number[]; hours: number }
      > = {}
      for (const { stats } of allStats) {
        for (const y of stats.activityYearGraph) {
          let node = activityYearMap[y.year]
          if (!node) {
            node = { titles: 0, scores: [], hours: 0 }
            activityYearMap[y.year] = node
          }
          node.titles += y.titles
          node.hours += y.hours
          if (y.meanScore > 0) node.scores.push(y.meanScore)
        }
      }

      const activityYearGraph: YearGraphItem[] = Object.keys(activityYearMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((year) => {
          const node = activityYearMap[year] ?? { titles: 0, scores: [], hours: 0 }
          const mScore =
            node.scores.length > 0
              ? Math.round(
                (node.scores.reduce((a, b) => a + b, 0) / node.scores.length) *
                10
              ) / 10
              : 0
          return {
            year,
            titles: node.titles,
            meanScore: mScore,
            hours: Math.round(node.hours * 10) / 10,
          }
        })

      const combinedGenreMap: Record<
        string,
        { count: number; scores: number[]; hours: number }
      > = {}
      for (const { stats } of allStats) {
        for (const g of stats.topGenres) {
          let gNode = combinedGenreMap[g.genre]
          if (!gNode) {
            gNode = { count: 0, scores: [], hours: 0 }
            combinedGenreMap[g.genre] = gNode
          }
          gNode.count += g.count
          gNode.hours += g.hours
          if (g.meanScore > 0) gNode.scores.push(g.meanScore)
        }
      }

      const topGenres: TopGenreItem[] = Object.entries(combinedGenreMap)
        .map(([genre, data]) => ({
          genre,
          count: data.count,
          meanScore:
            data.scores.length > 0
              ? Math.round(
                (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                10
              ) / 10
              : 0,
          hours: Math.round(data.hours * 10) / 10,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)

      const combinedMonthlyMap: Record<string, number> = {}
      const combinedWeeklyMap: Record<string, number> = {}
      const combinedDayOfWeekMap: Record<number, number> = {}
      const combinedCreatorMap: Record<string, { count: number; scores: number[] }> = {}

      for (const { stats } of allStats) {
        for (const m of stats.monthlyActivity) {
          const k = `${m.year}-${m.month}`
          combinedMonthlyMap[k] = (combinedMonthlyMap[k] ?? 0) + m.count
        }
        if (stats.weeklyActivity) {
          for (const w of stats.weeklyActivity) {
            const k = `${w.year}-${w.week}`
            combinedWeeklyMap[k] = (combinedWeeklyMap[k] ?? 0) + w.count
          }
        }
        if (stats.dayOfWeekActivity) {
          for (const d of stats.dayOfWeekActivity) {
            combinedDayOfWeekMap[d.day] = (combinedDayOfWeekMap[d.day] ?? 0) + d.count
          }
        }
        if (stats.topCreators) {
          for (const c of stats.topCreators) {
            let cNode = combinedCreatorMap[c.name]
            if (!cNode) {
              cNode = { count: 0, scores: [] }
              combinedCreatorMap[c.name] = cNode
            }
            cNode.count += c.count
            if (c.meanScore > 0) cNode.scores.push(c.meanScore)
          }
        }
      }

      const monthlyActivity: MonthlyActivityItem[] = Object.entries(
        combinedMonthlyMap
      )
        .map(([k, count]) => {
          const [y, m] = k.split("-").map(Number)
          return { year: y ?? 0, month: m ?? 1, count }
        })
        .sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month
        )

      const topCreators: TopCreatorItem[] = Object.entries(combinedCreatorMap)
        .map(([name, data]) => ({
          name,
          count: data.count,
          meanScore:
            data.scores.length > 0
              ? Math.round(
                (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                10
              ) / 10
              : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30)

      const { weeklyActivity, dayOfWeekActivity } = buildWeeklyAndDailyActivity(
        combinedWeeklyMap,
        combinedDayOfWeekMap
      )

      return {
        isPeriodFiltered: Boolean(period?.year || period?.quarter || period?.month),
        period,
        overview: {
          totalTitles,
          completedTitles,
          totalTimeMinutes,
          daysConsumed: Math.round((totalTimeMinutes / 1440) * 10) / 10,
          meanScore: overallMean,
          standardDeviation: 0,
          scoredCount: totalScoredCount,
        },
        mediaBreakdown,
        statusDistribution: buildDistribution(
          combinedStatusCounts,
          totalTitles
        ),
        scoreDistribution: scoreDist,
        activityYearGraph,
        topGenres,
        topCreators,
        monthlyActivity,
        weeklyActivity,
        dayOfWeekActivity,
      }
    }, STATS_CACHE_TTL_SECONDS)
  }

  /**
   * Invalidate stats cache for a user.
   */
  public async invalidateUserStats(userId: string): Promise<void> {
    await cache.clear(`stats:${userId}:*`)
    await cache.clear(`iris:stats:${userId}:*`)
  }
}

export const mediaStatsService = MediaStatsService.getInstance()
