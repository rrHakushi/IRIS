"use client"

import React, { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts"
import { Card } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"

export interface YearGraphData {
  year: number
  titles: number
  meanScore: number
  hours: number
}

interface YearTimelineChartProps {
  releaseYears: YearGraphData[]
  activityYears: YearGraphData[]
  mediaType: string
}

type TimelineMetric = "titles" | "hours" | "meanScore"

const chartConfig = {
  titles: {
    label: "Titles",
    color: "var(--primary)",
  },
  hours: {
    label: "Hours",
    color: "var(--primary)",
  },
  meanScore: {
    label: "Mean Score",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function YearTimelineChart({
  releaseYears,
  activityYears,
  mediaType,
}: YearTimelineChartProps): React.JSX.Element {
  const [activeMode, setActiveMode] = useState<"release" | "activity">("activity")
  const [activeMetric, setActiveMetric] = useState<TimelineMetric>("titles")

  const isReading = mediaType === "manga" || mediaType === "book"
  const activityLabel = isReading ? "Read Year" : "Watch Year"
  const activeData = activeMode === "activity" ? activityYears : releaseYears

  return (
    <Card className="flex flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
        <div>
          <h3 className="font-heading text-sm font-semibold tracking-wide text-foreground uppercase">
            {activeMode === "activity" ? `${activityLabel} Timeline` : "Release Year Timeline"}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Metric Selector Pills */}
          <div className="inline-flex rounded-full border border-border/60 bg-muted/40 p-0.5">
            <Button
              variant={activeMetric === "titles" ? "default" : "ghost"}
              size="xs"
              onPress={() => setActiveMetric("titles")}
              className="h-6.5 rounded-full px-2.5 text-[11px] font-semibold"
            >
              Titles
            </Button>
            <Button
              variant={activeMetric === "hours" ? "default" : "ghost"}
              size="xs"
              onPress={() => setActiveMetric("hours")}
              className="h-6.5 rounded-full px-2.5 text-[11px] font-semibold"
            >
              Hours
            </Button>
            <Button
              variant={activeMetric === "meanScore" ? "default" : "ghost"}
              size="xs"
              onPress={() => setActiveMetric("meanScore")}
              className="h-6.5 rounded-full px-2.5 text-[11px] font-semibold"
            >
              Score
            </Button>
          </div>

          {/* Mode Switcher Pills */}
          <div className="inline-flex rounded-full border border-border/60 bg-muted/40 p-0.5">
            <Button
              variant={activeMode === "activity" ? "default" : "ghost"}
              size="xs"
              onPress={() => setActiveMode("activity")}
              className="h-6.5 rounded-full px-3 text-[11px] font-semibold"
            >
              {activityLabel}
            </Button>
            <Button
              variant={activeMode === "release" ? "default" : "ghost"}
              size="xs"
              onPress={() => setActiveMode("release")}
              className="h-6.5 rounded-full px-3 text-[11px] font-semibold"
            >
              Release Year
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full">
        {activeData.length === 0 ? (
          <div className="flex h-56 w-full items-center justify-center text-xs text-muted-foreground">
            No year data recorded yet
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart data={activeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                allowDecimals={activeMetric !== "titles"}
                domain={activeMetric === "meanScore" ? [0, 10] : [0, "auto"]}
              />
              <ChartTooltip
                cursor={{ fill: "var(--accent)", opacity: 0.15 }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value, name, item) => {
                      const data = item.payload as YearGraphData
                      return (
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Titles:</span>
                            <span className="font-semibold text-foreground">
                              {data.titles.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Hours:</span>
                            <span className="font-semibold text-foreground">
                              {data.hours}h
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Mean Score:</span>
                            <span className="font-semibold text-foreground">
                              {data.meanScore > 0 ? data.meanScore.toFixed(1) : "—"}
                            </span>
                          </div>
                        </div>
                      )
                    }}
                  />
                }
              />
              <Bar
                dataKey={activeMetric}
                fill="var(--primary)"
                fillOpacity={0.8}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </Card>
  )
}
