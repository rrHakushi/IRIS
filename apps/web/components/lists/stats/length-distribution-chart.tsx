"use client"

import React from "react"
import { Card } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
export interface LengthBucketItem {
  label: string
  count: number
  description: string
}

interface LengthDistributionChartProps {
  buckets: LengthBucketItem[]
  mediaType: string
}

export function LengthDistributionChart({
  buckets,
  mediaType,
}: LengthDistributionChartProps): React.JSX.Element | null {
  if (!buckets || buckets.length === 0) return null

  const total = buckets.reduce((sum, b) => sum + b.count, 0)
  const getHeader = () => {
    switch (mediaType) {
      case "anime":
      case "tv":
        return "Episode Count Distribution"
      case "manga":
        return "Chapter Count Distribution"
      case "movie":
        return "Runtime Distribution"
      case "game":
        return "Playtime Length Distribution"
      case "book":
        return "Book Length Distribution"
      default:
        return "Series Length Distribution"
    }
  }

  return (
    <Card className="flex flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
      <h3 className="font-heading text-sm font-semibold tracking-wide text-foreground uppercase mb-4">
        {getHeader()}
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {buckets.map((b) => {
          const pct = total > 0 ? Math.round((b.count / total) * 1000) / 10 : 0
          return (
            <div
              key={b.label}
              className="flex flex-col justify-between rounded-xl border border-border/50 bg-background/40 p-3.5 transition-colors hover:border-border/80"
            >
              <div>
                <span className="text-xs font-semibold text-foreground">
                  {b.label}
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-heading text-xl font-bold text-primary">
                    {b.count.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ({pct}%)
                  </span>
                </div>
              </div>
              <Progress
                value={pct}
                aria-label={`${b.label}: ${b.count.toLocaleString()} titles (${pct}%)`}
                className="mt-3 h-1"
              />
            </div>
          )
        })}
      </div>
    </Card>
  )
}
