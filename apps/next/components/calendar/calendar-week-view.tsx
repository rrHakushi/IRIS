"use client"

import React, { useMemo } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { CalendarItemCard } from "./calendar-item-card"
import type { CalendarItem } from "./calendar-types"
import { getWeekDays, getItemDateKey } from "./calendar-utils"

interface CalendarWeekViewProps {
  currentDate: Date
  items: CalendarItem[]
  titlePreference?: "primary" | "secondary" | "native"
}

export function CalendarWeekView({
  currentDate,
  items,
  titlePreference,
}: CalendarWeekViewProps) {
  const days = useMemo(() => getWeekDays(currentDate), [currentDate])

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
    <div className="grid flex-1 grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
      {days.map((day) => {
        const dayItems = itemsByDate.get(day.dateKey) || []
        const weekdayName = day.date.toLocaleDateString(undefined, {
          weekday: "short",
        })

        return (
          <div
            key={day.dateKey}
            className={cn(
              "flex flex-col gap-2.5 rounded-3xl border border-border/40 bg-card p-3 shadow-2xs transition-colors",
              day.isToday && "border-primary/40 bg-primary/2"
            )}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-border/30 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                    day.isToday
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted text-foreground"
                  )}
                >
                  {day.date.getDate()}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {weekdayName}
                </span>
              </div>

              {dayItems.length > 0 && (
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 text-[10px] font-semibold"
                >
                  {dayItems.length}
                </Badge>
              )}
            </div>

            {/* Column Items */}
            <div className="flex flex-1 flex-col gap-2">
              {dayItems.length > 0 ? (
                dayItems.map((item) => (
                  <CalendarItemCard
                    key={item.id}
                    item={item}
                    variant="detailed"
                    titlePreference={titlePreference}
                  />
                ))
              ) : (
                <div className="flex flex-1 items-center justify-center py-8 text-center text-xs text-muted-foreground/60 select-none">
                  No releases
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
