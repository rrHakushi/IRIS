"use client"

import React from "react"
import { Card } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"

export interface DistributionEntry {
  name: string
  count: number
  percentage: number
}

interface FormatCountryDistributionProps {
  formats: DistributionEntry[]
  countries: DistributionEntry[]
  statuses: DistributionEntry[]
}

const COUNTRY_NAMES: Record<string, string> = {
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  US: "United States",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  TW: "Taiwan",
}

export function FormatCountryDistribution({
  formats,
  countries,
  statuses,
}: FormatCountryDistributionProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 1. Status Distribution */}
      <Card className="flex h-[320px] flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
        <h3 className="font-heading text-sm font-semibold tracking-wide text-foreground uppercase mb-3 shrink-0">
          Status Distribution
        </h3>

        <div className="flex-1 overflow-y-auto pe-1.5 space-y-3">
          {statuses.length === 0 ? (
            <p className="text-xs text-muted-foreground">No entries found</p>
          ) : (
            statuses.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-foreground">{item.name.replace(/_/g, " ")}</span>
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

      {/* 2. Format Distribution */}
      <Card className="flex h-[320px] flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
        <h3 className="font-heading text-sm font-semibold tracking-wide text-foreground uppercase mb-3 shrink-0">
          Format Distribution
        </h3>

        <div className="flex-1 overflow-y-auto pe-1.5 space-y-3">
          {formats.length === 0 ? (
            <p className="text-xs text-muted-foreground">No formats recorded</p>
          ) : (
            formats.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-foreground">{item.name.replace(/_/g, " ")}</span>
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

      {/* 3. Country Distribution */}
      <Card className="flex h-[320px] flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
        <h3 className="font-heading text-sm font-semibold tracking-wide text-foreground uppercase mb-3 shrink-0">
          Country of Origin
        </h3>

        <div className="flex-1 overflow-y-auto pe-1.5 space-y-3">
          {countries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No country data available</p>
          ) : (
            countries.map((item) => {
              const displayName = COUNTRY_NAMES[item.name.toUpperCase()] || item.name
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground">{displayName}</span>
                    <span className="text-muted-foreground">
                      {item.count.toLocaleString()} ({item.percentage}%)
                    </span>
                  </div>
                  <Progress
                    value={item.percentage}
                    aria-label={`${displayName}: ${item.count.toLocaleString()} titles (${item.percentage}%)`}
                    className="h-1.5"
                  />
                </div>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}
