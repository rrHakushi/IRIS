"use client"

import React, { useState } from "react"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"

export interface MonthlyActivityData {
  year: number
  month: number
  count: number
}

export interface WeeklyActivityData {
  year: number
  week: number
  count: number
}

export interface DayOfWeekData {
  day: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
  name: string
  count: number
  percentage: number
}

interface ActivityHeatmapProps {
  data?: MonthlyActivityData[]
  monthlyData?: MonthlyActivityData[]
  weeklyData?: WeeklyActivityData[]
  dayOfWeekData?: DayOfWeekData[]
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const ORDERED_DAYS = [
  { day: 1, name: "Monday", short: "Mon" },
  { day: 2, name: "Tuesday", short: "Tue" },
  { day: 3, name: "Wednesday", short: "Wed" },
  { day: 4, name: "Thursday", short: "Thu" },
  { day: 5, name: "Friday", short: "Fri" },
  { day: 6, name: "Saturday", short: "Sat" },
  { day: 0, name: "Sunday", short: "Sun" },
]

export function ActivityHeatmap({
  data,
  monthlyData: propMonthlyData,
  weeklyData = [],
  dayOfWeekData = [],
}: ActivityHeatmapProps): React.JSX.Element | null {
  const monthlyData = propMonthlyData ?? data ?? []
  const [activeTab, setActiveTab] = useState<"monthly" | "weekly" | "days">("monthly")

  const hasMonthly = monthlyData.length > 0
  const hasWeekly = weeklyData.length > 0
  const hasDaily = dayOfWeekData.length > 0

  if (!hasMonthly && !hasWeekly && !hasDaily) return null

  // Active years for monthly
  const monthlyYears = Array.from(new Set(monthlyData.map((d) => d.year))).sort((a, b) => b - a)
  const currentMonthlyYears = monthlyYears.slice(0, 3)

  // Active years for weekly
  const weeklyYears = Array.from(new Set(weeklyData.map((d) => d.year))).sort((a, b) => b - a)
  const currentWeeklyYears = weeklyYears.slice(0, 3)

  const maxMonthlyCount = Math.max(...monthlyData.map((d) => d.count), 1)
  const maxWeeklyCount = Math.max(...weeklyData.map((d) => d.count), 1)
  const maxDailyCount = Math.max(...dayOfWeekData.map((d) => d.count), 1)

  return (
    <Card className="flex flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-heading text-sm font-semibold tracking-wide text-foreground uppercase">
          {activeTab === "monthly"
            ? "Monthly Activity"
            : activeTab === "weekly"
              ? "Weekly Activity"
              : "Days of the Week"}
        </h3>

        <div className="flex items-center gap-1 rounded-xl border border-border/40 bg-background/50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("monthly")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              activeTab === "monthly"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("weekly")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              activeTab === "weekly"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("days")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              activeTab === "days"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Days of Week
          </button>
        </div>
      </div>

      {/* 1. Monthly Activity View */}
      {activeTab === "monthly" && (
        <div className="space-y-4">
          {currentMonthlyYears.map((year) => {
            const yearData = monthlyData.filter((d) => d.year === year)
            const monthMap: Record<number, number> = {}
            for (const d of yearData) {
              monthMap[d.month] = d.count
            }

            const yearTotal = yearData.reduce((sum, d) => sum + d.count, 0)

            return (
              <div key={year} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="font-heading text-foreground">{year}</span>
                  <span className="text-muted-foreground">{yearTotal.toLocaleString()} titles</span>
                </div>

                <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                  {MONTH_NAMES.map((name, idx) => {
                    const monthNum = idx + 1
                    const count = monthMap[monthNum] || 0
                    const ratio = count / maxMonthlyCount

                    let intensityClass = "bg-muted/30 text-muted-foreground border-border/30"
                    if (count > 0) {
                      if (ratio > 0.75) {
                        intensityClass = "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                      } else if (ratio > 0.4) {
                        intensityClass = "bg-primary/70 text-primary-foreground border-primary/60 font-semibold"
                      } else if (ratio > 0.15) {
                        intensityClass = "bg-primary/35 text-foreground border-primary/30"
                      } else {
                        intensityClass = "bg-primary/15 text-foreground border-primary/20"
                      }
                    }

                    return (
                      <div
                        key={name}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all hover:scale-105",
                          intensityClass
                        )}
                        title={`${name} ${year}: ${count} titles`}
                      >
                        <span className="text-[10px] uppercase">{name}</span>
                        <span className="font-heading text-xs mt-0.5">{count > 0 ? count : "—"}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 2. Weekly Activity View */}
      {activeTab === "weekly" && (
        <div className="space-y-6">
          {currentWeeklyYears.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No weekly activity data available.</p>
          ) : (
            currentWeeklyYears.map((year) => {
              const yearData = weeklyData.filter((d) => d.year === year)
              const weekMap: Record<number, number> = {}
              for (const d of yearData) {
                weekMap[d.week] = d.count
              }

              const yearTotal = yearData.reduce((sum, d) => sum + d.count, 0)

              const quarters = [
                { label: "Q1", range: "Jan–Mar", start: 1, end: 13 },
                { label: "Q2", range: "Apr–Jun", start: 14, end: 26 },
                { label: "Q3", range: "Jul–Sep", start: 27, end: 39 },
                { label: "Q4", range: "Oct–Dec", start: 40, end: 52 },
              ]

              return (
                <div key={year} className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="font-heading text-foreground">{year}</span>
                    <span className="text-muted-foreground">{yearTotal.toLocaleString()} titles</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {quarters.map((q) => {
                      const weeksInQuarter: number[] = []
                      let qTotal = 0
                      for (let w = q.start; w <= q.end; w++) {
                        weeksInQuarter.push(w)
                        qTotal += weekMap[w] || 0
                      }

                      return (
                        <div
                          key={q.label}
                          className="rounded-xl border border-border/40 bg-background/30 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                            <span>
                              {q.label} <span className="text-[10px] font-normal">({q.range})</span>
                            </span>
                            <span className="tabular-nums">{qTotal.toLocaleString()} titles</span>
                          </div>

                          <div className="grid grid-cols-7 gap-1">
                            {weeksInQuarter.map((weekNum) => {
                              const count = weekMap[weekNum] || 0
                              const ratio = count / maxWeeklyCount

                              let intensityClass = "bg-muted/20 border-border/20 text-muted-foreground/60"
                              if (count > 0) {
                                if (ratio > 0.75) {
                                  intensityClass =
                                    "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                                } else if (ratio > 0.4) {
                                  intensityClass =
                                    "bg-primary/70 text-primary-foreground border-primary/60 font-semibold"
                                } else if (ratio > 0.15) {
                                  intensityClass = "bg-primary/35 text-foreground border-primary/30"
                                } else {
                                  intensityClass = "bg-primary/15 text-foreground border-primary/20"
                                }
                              }

                              return (
                                <div
                                  key={weekNum}
                                  className={cn(
                                    "flex flex-col items-center justify-center h-8 rounded-lg border text-center transition-all hover:scale-110 cursor-default",
                                    intensityClass
                                  )}
                                  title={`Week ${weekNum} (${year}): ${count} titles`}
                                >
                                  <span className="text-[9px] font-mono leading-none">W{weekNum}</span>
                                  {count > 0 ? (
                                    <span className="text-[10px] font-heading font-semibold leading-none mt-0.5">
                                      {count}
                                    </span>
                                  ) : (
                                    <span className="text-[8px] opacity-40 leading-none mt-0.5">·</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* 3. Days of the Week View */}
      {activeTab === "days" && (
        <div className="space-y-2.5">
          {dayOfWeekData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No daily activity data available.</p>
          ) : (
            ORDERED_DAYS.map((od) => {
              const item = dayOfWeekData.find((d) => d.day === od.day)
              const count = item?.count || 0
              const percentage = item?.percentage || 0
              const isBusiest = count === maxDailyCount && count > 0

              return (
                <div
                  key={od.day}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-xl border border-border/40 bg-background/30 p-3 transition-colors hover:border-border/80",
                    isBusiest && "border-primary/40 bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{od.name}</span>
                      {isBusiest && (
                        <Badge
                          variant="secondary"
                          className="rounded-lg text-[10px] font-semibold bg-primary/15 text-primary border-primary/30 py-0"
                        >
                          Busiest Day
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-heading font-semibold text-foreground tabular-nums">
                        {count.toLocaleString()} {count === 1 ? "title" : "titles"}
                      </span>
                      <span className="text-muted-foreground tabular-nums w-12 text-end">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Visual distribution bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isBusiest ? "bg-primary" : "bg-primary/60"
                      )}
                      style={{ width: `${Math.min(100, (count / maxDailyCount) * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </Card>
  )
}
