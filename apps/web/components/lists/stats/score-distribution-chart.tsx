"use client"

import React from "react"
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts"
import { Card } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"

export interface ScoreDistributionProps {
  scores: Array<{ score: number; count: number }>
  unratedCount: number
  meanScore: number
}

const chartConfig = {
  count: {
    label: "Titles",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ScoreDistributionChart({
  scores,
  unratedCount,
  meanScore,
}: ScoreDistributionProps): React.JSX.Element {
  const totalScored = scores.reduce((sum, s) => sum + s.count, 0)
  const maxCount = Math.max(...scores.map((s) => s.count), 1)

  return (
    <Card className="flex flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
        <div>
          <h3 className="font-heading text-sm font-semibold tracking-wide text-foreground uppercase">
            Score Distribution
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {meanScore > 0 && (
            <Badge variant="secondary" className="rounded-xl px-2.5 py-1 text-xs">
              {meanScore.toFixed(1)} avg
            </Badge>
          )}
          {unratedCount > 0 && (
            <Badge variant="secondary" className="rounded-xl px-2.5 py-1 text-xs">
              {unratedCount.toLocaleString()} unrated
            </Badge>
          )}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-48 w-full">
        <BarChart data={scores} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="score"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            allowDecimals={false}
          />
          <ChartTooltip
            cursor={{ fill: "var(--accent)", opacity: 0.15 }}
            content={
              <ChartTooltipContent
                indicator="dot"
                formatter={(value) => (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {Number(value).toLocaleString()} titles
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({totalScored > 0 ? Math.round((Number(value) / totalScored) * 1000) / 10 : 0}%)
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {scores.map((entry) => {
              const isMax = entry.count === maxCount && entry.count > 0
              return (
                <Cell
                  key={`cell-${entry.score}`}
                  fill="var(--primary)"
                  fillOpacity={entry.count > 0 ? (isMax ? 1 : 0.65) : 0.15}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ChartContainer>
    </Card>
  )
}
