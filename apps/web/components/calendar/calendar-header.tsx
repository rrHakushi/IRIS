"use client"

import React from "react"
import {
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconSearch,
  IconBookmark,
  IconSparkles,
  IconBook2,
  IconDeviceTv,
  IconMovie,
  IconDeviceGamepad2,
  IconBook,
  IconMusic,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { Tabs, TabList, Tab } from "@workspace/ui/components/tabs"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import type {
  CalendarViewMode,
  CalendarMediaTypeFilter,
} from "./calendar-types"

interface CalendarHeaderProps {
  currentDate: Date
  viewMode: CalendarViewMode
  onViewModeChange: (mode: CalendarViewMode) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  activeType: CalendarMediaTypeFilter
  onTypeChange: (type: CalendarMediaTypeFilter) => void
  onlyInLists: boolean
  onOnlyInListsChange: (enabled: boolean) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  counts: Record<string, number>
  isAuthenticated: boolean
}

const MEDIA_FILTERS: {
  key: CalendarMediaTypeFilter
  label: string
  icon: React.ReactNode
}[] = [
  { key: "all", label: "All", icon: <IconSparkles className="size-3.5" /> },
  { key: "anime", label: "Anime", icon: <IconSparkles className="size-3.5" /> },
  { key: "manga", label: "Manga", icon: <IconBook2 className="size-3.5" /> },
  { key: "tv", label: "TV", icon: <IconDeviceTv className="size-3.5" /> },
  { key: "movie", label: "Movies", icon: <IconMovie className="size-3.5" /> },
  {
    key: "game",
    label: "Games",
    icon: <IconDeviceGamepad2 className="size-3.5" />,
  },
  { key: "book", label: "Books", icon: <IconBook className="size-3.5" /> },
  { key: "music", label: "Music", icon: <IconMusic className="size-3.5" /> },
]

export function CalendarHeader({
  currentDate,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
  activeType,
  onTypeChange,
  onlyInLists,
  onOnlyInListsChange,
  searchQuery,
  onSearchChange,
  counts,
  isAuthenticated,
}: CalendarHeaderProps) {
  const monthTitle = currentDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const totalCount = Object.values(counts).reduce((acc, c) => acc + c, 0)

  return (
    <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:gap-4">
      {/* Top Row: Date Navigation & Controls */}
      <div className="flex items-center justify-between gap-2">
        {/* Date heading */}
        <h2
          suppressHydrationWarning
          className="text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl"
        >
          {monthTitle}
        </h2>

        {/* Prev / Today / Next Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrev}
            className="size-7.5 rounded-xl sm:size-8"
            aria-label="Previous period"
          >
            <IconChevronLeft className="size-3.5 sm:size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNext}
            className="size-7.5 rounded-xl sm:size-8"
            aria-label="Next period"
          >
            <IconChevronRight className="size-3.5 sm:size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="h-7.5 gap-1.5 rounded-xl px-2.5 text-xs font-medium sm:h-8"
          >
            <IconCalendar className="size-3.5" />
            <span>Today</span>
          </Button>
        </div>
      </div>

      {/* Second Row: View Switcher and "Only in Lists" Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* View Mode Tabs */}
        <Tabs
          selectedKey={viewMode}
          onSelectionChange={(key) =>
            onViewModeChange(key as CalendarViewMode)
          }
          className="w-auto"
        >
          <TabList className="h-8 rounded-2xl bg-muted/60 p-1">
            <Tab id="month" className="cursor-pointer rounded-xl px-2.5 py-1 text-xs">
              Month
            </Tab>
            <Tab id="week" className="cursor-pointer rounded-xl px-2.5 py-1 text-xs">
              Week
            </Tab>
            <Tab id="agenda" className="cursor-pointer rounded-xl px-2.5 py-1 text-xs">
              Agenda
            </Tab>
          </TabList>
        </Tabs>

        {/* Only in Lists Toggle */}
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => onOnlyInListsChange(!onlyInLists)}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-2xl border px-3 text-xs font-medium transition-colors",
              onlyInLists
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/40 bg-card text-muted-foreground hover:border-border hover:text-foreground"
            )}
            aria-label="Only in my lists"
          >
            <IconBookmark
              className={cn(
                "size-3.5",
                onlyInLists && "fill-primary text-primary"
              )}
            />
            <span>Only in lists</span>
          </button>
        ) : (
          <TooltipTrigger>
            <div className="flex h-8 items-center gap-1.5 rounded-2xl border border-border/40 bg-card px-3 text-xs font-medium text-muted-foreground opacity-60">
              <IconBookmark className="size-3.5" />
              <span>Only in lists</span>
            </div>
            <Tooltip>
              Sign in to filter releases by your tracked lists
            </Tooltip>
          </TooltipTrigger>
        )}
      </div>

      {/* Third Row: Media Type Filter Pills & Search Input */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        {/* Media Filter Chips */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5">
          {MEDIA_FILTERS.map((f) => {
            const count = f.key === "all" ? totalCount : (counts[f.key] ?? 0)
            const isSelected = activeType === f.key

            return (
              <Button
                key={f.key}
                variant="ghost"
                size="sm"
                onClick={() => onTypeChange(f.key)}
                className={cn(
                  "h-7 shrink-0 cursor-pointer gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {f.icon}
                <span>{f.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "ms-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </Button>
            )
          })}
        </div>

        {/* Real-time search filter */}
        <div className="relative w-full lg:w-72">
          <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter releases by title..."
            className="h-8 rounded-2xl bg-muted/30 ps-8 text-xs focus:bg-background"
          />
        </div>
      </div>
    </div>
  )
}
