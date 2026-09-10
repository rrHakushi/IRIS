"use client"

import React from "react"
import {
  IconDeviceTv,
  IconBook2,
  IconClock,
  IconCalendarEvent,
  IconStar,
  IconChartDots,
  IconPlayerPlay,
  IconCheck,
} from "@tabler/icons-react"
import { Card } from "@workspace/ui/components/card"
import type { MediaListType } from "../types"

export interface StatsOverviewData {
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

interface StatsOverviewCardsProps {
  mediaType: MediaListType
  overview: StatsOverviewData
}

export function StatsOverviewCards({
  mediaType,
  overview,
}: StatsOverviewCardsProps): React.JSX.Element {
  const getUnitLabel = () => {
    switch (mediaType) {
      case "anime":
      case "tv":
        return "Episodes"
      case "manga":
        return "Chapters"
      case "book":
        return "Pages"
      case "game":
        return "Playtime (Hrs)"
      case "movie":
        return "Movies Watched"
      case "music":
        return "Plays"
      default:
        return "Units"
    }
  }

  const hoursConsumed = Math.round((overview.totalTimeMinutes / 60) * 10) / 10

  const cards = [
    {
      label: "Total Titles",
      value: overview.totalCount.toLocaleString(),
      subtext: `${overview.completedCount.toLocaleString()} completed`,
      icon: mediaType === "manga" || mediaType === "book" ? IconBook2 : IconDeviceTv,
      iconColor: "text-rose-500",
    },
    {
      label: getUnitLabel(),
      value: overview.totalUnits.toLocaleString(),
      subtext: `${overview.currentCount.toLocaleString()} in progress`,
      icon: IconCheck,
      iconColor: "text-emerald-500",
    },
    {
      label: "Time Consumed",
      value: `${overview.daysConsumed}d`,
      subtext: `${hoursConsumed.toLocaleString()} hours`,
      icon: IconClock,
      iconColor: "text-amber-500",
    },
    {
      label: "Days Planned",
      value: `${overview.daysPlanned}d`,
      subtext: `${overview.planningCount.toLocaleString()} planned titles`,
      icon: IconCalendarEvent,
      iconColor: "text-blue-500",
    },
    {
      label: "Mean Score",
      value: overview.meanScore > 0 ? overview.meanScore.toFixed(1) : "—",
      subtext: `From ${overview.scoredCount.toLocaleString()} scored`,
      icon: IconStar,
      iconColor: "text-yellow-500",
    },
    {
      label: "Standard Deviation",
      value: overview.standardDeviation > 0 ? `±${overview.standardDeviation.toFixed(2)}` : "—",
      subtext: "Rating variance",
      icon: IconChartDots,
      iconColor: "text-purple-500",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => {
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
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {card.subtext}
              </p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
