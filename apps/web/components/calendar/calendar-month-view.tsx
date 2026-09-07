"use client"

import React, { useMemo } from "react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { CalendarItemCard } from "./calendar-item-card"
import type { CalendarItem } from "./calendar-types"
import { getMonthGridDays, getItemDateKey } from "./calendar-utils"

interface CalendarMonthViewProps {
  currentDate: Date
  items: CalendarItem[]
  titlePreference?: "primary" | "secondary" | "native"
  onSelectDay: (date: Date, items: CalendarItem[]) => void
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function CalendarMonthView({
  currentDate,
  items,
  titlePreference,
  onSelectDay,
}: CalendarMonthViewProps) {
  const days = useMemo(() => getMonthGridDays(currentDate), [currentDate])

  // Group items by date key (YYYY-MM-DD)
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of items) {
      const dateKey = getItemDateKey(item.releaseDate)
      if (!dateKey) continue
      const existing = map.get(dateKey) || []
      existing.push(item)
      map.set(dateKey, existing)
    }
    return map
  }, [items])

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-border/40 bg-card shadow-2xs">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-border/40 bg-muted/40 py-2.5 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="truncate">
            {day}
          </div>
        ))}
      </div>

      {/* Month Calendar Grid */}
      <div className="grid flex-1 grid-cols-7 divide-x divide-y divide-border/30 bg-background/50">
        {days.map((day) => {
          const dayItems = itemsByDate.get(day.dateKey) || []
          const maxVisible = 3
          const visibleItems = dayItems.slice(0, maxVisible)
          const hiddenCount = Math.max(0, dayItems.length - maxVisible)

          return (
            <div
              key={day.dateKey}
              onClick={() =>
                dayItems.length > 0 && onSelectDay(day.date, dayItems)
              }
              className={cn(
                "group relative flex min-h-[110px] flex-col gap-1 p-1.5 transition-colors sm:min-h-[130px] sm:p-2",
                !day.isCurrentMonth && "bg-muted/15 opacity-50",
                day.isToday && "bg-primary/5",
                dayItems.length > 0 && "cursor-pointer hover:bg-muted/30"
              )}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold select-none",
                    day.isToday
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : day.isCurrentMonth
                        ? "text-foreground group-hover:text-primary"
                        : "text-muted-foreground"
                  )}
                >
                  {day.date.getDate()}
                </span>

                {dayItems.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {dayItems.length}
                  </span>
                )}
              </div>

              {/* Day Releases List */}
              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                {visibleItems.map((item) => (
                  <CalendarItemCard
                    key={item.id}
                    item={item}
                    variant="compact"
                    titlePreference={titlePreference}
                  />
                ))}

                {/* +N more overflow badge */}
                {hiddenCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectDay(day.date, dayItems)
                    }}
                    className="h-5 justify-start rounded-lg px-1.5 text-[10px] font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    +{hiddenCount} more
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
