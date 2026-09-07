"use client"

import React, { useMemo } from "react"
import { IconCalendarEvent } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { CalendarItemCard } from "./calendar-item-card"
import type { CalendarItem } from "./calendar-types"
import { isSameDay, getItemDate, getItemDateKey } from "./calendar-utils"

interface CalendarAgendaViewProps {
  items: CalendarItem[]
  titlePreference?: "primary" | "secondary" | "native"
}

export function CalendarAgendaView({
  items,
  titlePreference,
}: CalendarAgendaViewProps) {
  const today = useMemo(() => new Date(), [])

  // Group items by date string (YYYY-MM-DD)
  const groupedByDate = useMemo(() => {
    const map = new Map<string, { date: Date; items: CalendarItem[] }>()
    for (const item of items) {
      const dateKey = getItemDateKey(item.releaseDate)
      if (!dateKey) continue
      const existing = map.get(dateKey)
      if (existing) {
        existing.items.push(item)
      } else {
        map.set(dateKey, {
          date: getItemDate(item.releaseDate),
          items: [item],
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    )
  }, [items])

  if (groupedByDate.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border/60 p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          <IconCalendarEvent className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            No releases scheduled
          </h3>
          <p className="text-xs text-muted-foreground">
            No media releases found for the selected criteria and time range.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {groupedByDate.map(({ date, items: groupItems }) => {
        const isCurrentDay = isSameDay(date, today)
        const dateString = date.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        return (
          <div key={date.toISOString()} className="flex flex-col gap-2.5">
            {/* Date Section Header */}
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-bold text-foreground">
                {dateString}
              </h3>
              {isCurrentDay && (
                <Badge className="h-5 rounded-full bg-primary text-[10px] text-primary-foreground">
                  Today
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                ({groupItems.length})
              </span>
            </div>

            {/* List of items */}
            <div className="flex flex-col gap-2">
              {groupItems.map((item) => (
                <CalendarItemCard
                  key={item.id}
                  item={item}
                  variant="agenda"
                  titlePreference={titlePreference}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
