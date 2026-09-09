"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
  IconCalendar,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { CalendarItemCard } from "./calendar-item-card"
import type { CalendarItem } from "./calendar-types"
import {
  getMonthGridDays,
  getItemDateKey,
  toDateKey,
  isSameDay,
  getMediaTypeColor,
} from "./calendar-utils"

interface CalendarMobileMonthViewProps {
  currentDate: Date
  items: CalendarItem[]
  titlePreference?: "primary" | "secondary" | "native"
  onSelectDay?: (date: Date, items: CalendarItem[]) => void
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function CalendarMobileMonthView({
  currentDate,
  items,
  titlePreference,
  onSelectDay,
}: CalendarMobileMonthViewProps) {
  const today = useMemo(() => new Date(), [])
  const days = useMemo(() => getMonthGridDays(currentDate), [currentDate])

  // Initialize selectedDate to today if today is in the current month; otherwise day 1 of current month
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const isCurrentMonthNow =
      today.getFullYear() === currentDate.getFullYear() &&
      today.getMonth() === currentDate.getMonth()
    return isCurrentMonthNow
      ? today
      : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  })

  // When currentDate changes (e.g. from header month arrows), sync selectedDate to that month
  useEffect(() => {
    setSelectedDate((prev) => {
      const isCurrentMonthNow =
        today.getFullYear() === currentDate.getFullYear() &&
        today.getMonth() === currentDate.getMonth()

      if (isCurrentMonthNow) return today

      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const prevDateNum = prev.getDate()
      const lastDay = new Date(year, month + 1, 0).getDate()
      return new Date(year, month, Math.min(prevDateNum, lastDay))
    })
  }, [currentDate, today])

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

  const selectedDateKey = useMemo(
    () => toDateKey(selectedDate),
    [selectedDate]
  )

  const selectedDayItems = useMemo(
    () => itemsByDate.get(selectedDateKey) || [],
    [itemsByDate, selectedDateKey]
  )

  const isSelectedToday = useMemo(
    () => isSameDay(selectedDate, today),
    [selectedDate, today]
  )

  const selectedFormattedDate = useMemo(() => {
    return selectedDate.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }, [selectedDate])

  const handleSelectDate = (d: Date) => {
    setSelectedDate(d)
    const dayItems = itemsByDate.get(toDateKey(d)) || []
    onSelectDay?.(d, dayItems)
  }

  const handleJumpToToday = () => {
    handleSelectDate(today)
  }

  const handlePrevDay = () => {
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    handleSelectDate(prev)
  }

  const handleNextDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    handleSelectDate(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Mini Month Interactive Matrix */}
      <div className="flex flex-col overflow-hidden rounded-3xl border border-border/40 bg-card p-3 shadow-2xs">
        {/* Weekday Row Header */}
        <div className="grid grid-cols-7 pb-2 text-center text-[11px] font-semibold text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* 7-column Date Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const dayItems = itemsByDate.get(day.dateKey) || []
            const isSelected = isSameDay(day.date, selectedDate)
            const hasReleases = dayItems.length > 0

            // Unique media types on this day for colored indicator dots
            const uniqueTypes = Array.from(
              new Set(dayItems.map((it) => it.mediaType))
            ).slice(0, 3)

            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => handleSelectDate(day.date)}
                className={cn(
                  "group relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl p-1 transition-all outline-none",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : day.isToday
                      ? "border border-primary/50 bg-primary/10 text-primary font-bold"
                      : day.isCurrentMonth
                        ? "text-foreground hover:bg-muted/60"
                        : "text-muted-foreground/40 hover:bg-muted/30"
                )}
                aria-label={`${day.date.toDateString()}${hasReleases ? `, ${dayItems.length} releases` : ""}`}
              >
                {/* Day Number */}
                <span className="text-xs leading-none">
                  {day.date.getDate()}
                </span>

                {/* Media Indicator Dots / Count */}
                <div className="mt-1 flex h-1.5 items-center justify-center gap-0.5">
                  {isSelected ? (
                    hasReleases && (
                      <span className="size-1 rounded-full bg-primary-foreground" />
                    )
                  ) : hasReleases ? (
                    uniqueTypes.map((type) => {
                      const color = getMediaTypeColor(type)
                      return (
                        <span
                          key={type}
                          className={cn("size-1 rounded-full", color.dot)}
                        />
                      )
                    })
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Selected Day Schedule Section */}
      <div className="flex flex-col gap-3">
        {/* Day Schedule Header */}
        <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-card px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              {isSelectedToday ? "Today" : selectedFormattedDate}
            </h3>
            {isSelectedToday && (
              <span className="text-xs text-muted-foreground font-normal">
                ({selectedFormattedDate})
              </span>
            )}
            <Badge
              variant={selectedDayItems.length > 0 ? "default" : "secondary"}
              className="h-5 px-1.5 font-mono text-[10px]"
            >
              {selectedDayItems.length}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            {!isSelectedToday && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleJumpToToday}
                className="h-7 gap-1 rounded-xl px-2 text-[11px] font-medium text-primary hover:bg-primary/10 hover:text-primary"
              >
                <IconCalendar className="size-3" />
                Today
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevDay}
              className="size-7 rounded-xl"
              aria-label="Previous day"
            >
              <IconChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextDay}
              className="size-7 rounded-xl"
              aria-label="Next day"
            >
              <IconChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Selected Day Releases List */}
        {selectedDayItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            {selectedDayItems.map((item) => (
              <CalendarItemCard
                key={item.id}
                item={item}
                variant="agenda"
                titlePreference={titlePreference}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border/60 bg-muted/10 p-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
              <IconCalendarEvent className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                No releases on this day
              </p>
              <p className="text-[11px] text-muted-foreground">
                Select a highlighted date with indicator dots above to view its releases.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
