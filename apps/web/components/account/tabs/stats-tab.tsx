"use client"

import React, { useState } from "react"
import { MediaStatsTab } from "@/components/lists/stats/media-stats-tab"
import { CombinedStatsView } from "@/components/lists/stats/combined-stats-view"
import type { MediaListType } from "@/components/lists/types"
import {
  IconChartBar,
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconDeviceGamepad,
  IconHeadphones,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

export interface StatsTabProps {
  username: string
  isOwner: boolean
}

export type StatsCategoryType = "all" | MediaListType

const STATS_CATEGORIES: Array<{
  id: StatsCategoryType
  name: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "all", name: "All", icon: IconChartBar },
  { id: "anime", name: "Anime", icon: IconDeviceTv },
  { id: "manga", name: "Manga", icon: IconBook },
  { id: "movie", name: "Movies", icon: IconMovie },
  { id: "tv", name: "TV Series", icon: IconDeviceTv },
  { id: "game", name: "Games", icon: IconDeviceGamepad },
  { id: "book", name: "Books", icon: IconBook },
  { id: "music", name: "Music", icon: IconHeadphones },
]

export function StatsTab({ username }: StatsTabProps): React.JSX.Element {
  const [selectedType, setSelectedType] = useState<StatsCategoryType>("all")

  return (
    <div className="space-y-6">
      {/* Media Type Switcher Bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-card/60 p-3.5 shadow-xs">
        {STATS_CATEGORIES.map((type) => {
          const Icon = type.icon
          const isSelected = selectedType === type.id
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => setSelectedType(type.id)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                isSelected
                  ? "border border-primary bg-primary/15 font-bold text-primary shadow-2xs"
                  : "border border-border/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span>{type.name}</span>
            </button>
          )
        })}
      </div>

      {/* Overarching Combined Stats vs Media-Specific Stats */}
      {selectedType === "all" ? (
        <CombinedStatsView key={`${username}-combined`} username={username} />
      ) : (
        <MediaStatsTab
          key={`${username}-${selectedType}`}
          username={username}
          mediaType={selectedType}
        />
      )}
    </div>
  )
}

