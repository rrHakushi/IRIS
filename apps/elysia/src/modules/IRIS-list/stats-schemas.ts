import { t } from "@/router"

export const StatsQuerySchema = t.Object({
  year: t.Optional(t.Number({ description: "Rewind year filter e.g. 2026" })),
  quarter: t.Optional(
    t.Number({ minimum: 1, maximum: 4, description: "Rewind quarter filter 1-4" })
  ),
  month: t.Optional(
    t.Number({ minimum: 1, maximum: 12, description: "Rewind month filter 1-12" })
  ),
})

export const ScoreDistributionItemSchema = t.Object({
  score: t.Number(),
  count: t.Number(),
})

export const DistributionItemSchema = t.Object({
  name: t.String(),
  count: t.Number(),
  percentage: t.Number(),
})

export const YearGraphItemSchema = t.Object({
  year: t.Number(),
  titles: t.Number(),
  meanScore: t.Number(),
  hours: t.Number(),
})

export const LengthBucketItemSchema = t.Object({
  label: t.String(),
  count: t.Number(),
  description: t.String(),
})

export const TopGenreItemSchema = t.Object({
  genre: t.String(),
  count: t.Number(),
  meanScore: t.Number(),
  hours: t.Number(),
})

export const TopCreatorItemSchema = t.Object({
  name: t.String(),
  count: t.Number(),
  meanScore: t.Number(),
})

export const MonthlyActivityItemSchema = t.Object({
  year: t.Number(),
  month: t.Number(),
  count: t.Number(),
})

export const WeeklyActivityItemSchema = t.Object({
  year: t.Number(),
  week: t.Number(),
  count: t.Number(),
})

export const DayOfWeekItemSchema = t.Object({
  day: t.Number(),
  dayName: t.String(),
  count: t.Number(),
})

export const RewindHighlightsSchema = t.Optional(
  t.Object({
    topScored: t.Array(
      t.Object({
        id: t.Number(),
        title: t.String(),
        score: t.Number(),
        coverImage: t.Nullable(t.String()),
      })
    ),
    milestones: t.Object({
      firstCompleted: t.Optional(
        t.Object({
          id: t.Number(),
          title: t.String(),
          completedAt: t.String(),
        })
      ),
      lastCompleted: t.Optional(
        t.Object({
          id: t.Number(),
          title: t.String(),
          completedAt: t.String(),
        })
      ),
    }),
    busiestMonth: t.Nullable(t.String()),
  })
)

export const MediaStatsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    mediaType: t.String(),
    isPeriodFiltered: t.Boolean(),
    period: t.Optional(
      t.Object({
        year: t.Optional(t.Number()),
        quarter: t.Optional(t.Number()),
        month: t.Optional(t.Number()),
      })
    ),
    overview: t.Object({
      totalCount: t.Number(),
      completedCount: t.Number(),
      currentCount: t.Number(),
      planningCount: t.Number(),
      onHoldCount: t.Number(),
      droppedCount: t.Number(),
      totalUnits: t.Number(),
      totalTimeMinutes: t.Number(),
      daysConsumed: t.Number(),
      daysPlanned: t.Number(),
      meanScore: t.Number(),
      standardDeviation: t.Number(),
      scoredCount: t.Number(),
    }),
    scoreDistribution: t.Object({
      scores: t.Array(ScoreDistributionItemSchema),
      unratedCount: t.Number(),
    }),
    lengthDistribution: t.Array(LengthBucketItemSchema),
    formatDistribution: t.Array(DistributionItemSchema),
    statusDistribution: t.Array(DistributionItemSchema),
    countryDistribution: t.Array(DistributionItemSchema),
    releaseYearGraph: t.Array(YearGraphItemSchema),
    activityYearGraph: t.Array(YearGraphItemSchema),
    topGenres: t.Array(TopGenreItemSchema),
    topCreators: t.Array(TopCreatorItemSchema),
    monthlyActivity: t.Array(MonthlyActivityItemSchema),
    weeklyActivity: t.Optional(t.Array(WeeklyActivityItemSchema)),
    dayOfWeekActivity: t.Optional(t.Array(DayOfWeekItemSchema)),
    rewindHighlights: RewindHighlightsSchema,
  }),
})

export const CombinedStatsResponseSchema = t.Object({
  success: t.Boolean(),
  data: t.Object({
    isPeriodFiltered: t.Boolean(),
    period: t.Optional(
      t.Object({
        year: t.Optional(t.Number()),
        quarter: t.Optional(t.Number()),
        month: t.Optional(t.Number()),
      })
    ),
    overview: t.Object({
      totalTitles: t.Number(),
      completedTitles: t.Number(),
      totalTimeMinutes: t.Number(),
      daysConsumed: t.Number(),
      meanScore: t.Number(),
      standardDeviation: t.Number(),
      scoredCount: t.Number(),
    }),
    mediaBreakdown: t.Array(
      t.Object({
        mediaType: t.String(),
        count: t.Number(),
        hours: t.Number(),
        percentage: t.Number(),
      })
    ),
    statusDistribution: t.Array(DistributionItemSchema),
    scoreDistribution: t.Object({
      scores: t.Array(ScoreDistributionItemSchema),
      unratedCount: t.Number(),
    }),
    activityYearGraph: t.Array(YearGraphItemSchema),
    topGenres: t.Array(TopGenreItemSchema),
    topCreators: t.Optional(t.Array(TopCreatorItemSchema)),
    monthlyActivity: t.Array(MonthlyActivityItemSchema),
    weeklyActivity: t.Optional(t.Array(WeeklyActivityItemSchema)),
    dayOfWeekActivity: t.Optional(t.Array(DayOfWeekItemSchema)),
    rewindHighlights: RewindHighlightsSchema,
  }),
})
