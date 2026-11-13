import type { CalendarMediaType } from "./calendar-types"
import { getMediaDetailHref } from "@/lib/media-routes"

export function getMediaHref(
  mediaType: CalendarMediaType,
  mediaId: number
): string {
  return getMediaDetailHref(mediaType, mediaId)
}

export function getMediaTypeColor(mediaType: CalendarMediaType): {
  bg: string
  text: string
  border: string
  dot: string
} {
  switch (mediaType) {
    case "anime":
      return {
        bg: "bg-rose-500/10 dark:bg-rose-500/15",
        text: "text-rose-600 dark:text-rose-400",
        border: "border-rose-500/20",
        dot: "bg-rose-500",
      }
    case "manga":
      return {
        bg: "bg-amber-500/10 dark:bg-amber-500/15",
        text: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/20",
        dot: "bg-amber-500",
      }
    case "tv":
      return {
        bg: "bg-blue-500/10 dark:bg-blue-500/15",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-500/20",
        dot: "bg-blue-500",
      }
    case "movie":
      return {
        bg: "bg-purple-500/10 dark:bg-purple-500/15",
        text: "text-purple-600 dark:text-purple-400",
        border: "border-purple-500/20",
        dot: "bg-purple-500",
      }
    case "game":
      return {
        bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
        text: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-500/20",
        dot: "bg-emerald-500",
      }
    case "book":
      return {
        bg: "bg-orange-500/10 dark:bg-orange-500/15",
        text: "text-orange-600 dark:text-orange-400",
        border: "border-orange-500/20",
        dot: "bg-orange-500",
      }
    case "music":
      return {
        bg: "bg-pink-500/10 dark:bg-pink-500/15",
        text: "text-pink-600 dark:text-pink-400",
        border: "border-pink-500/20",
        dot: "bg-pink-500",
      }
  }
}

export function getItemDate(releaseDate: string | Date | unknown): Date {
  if (releaseDate instanceof Date) return releaseDate
  if (typeof releaseDate === "string") return new Date(releaseDate)
  return new Date(String(releaseDate))
}

export function getItemDateKey(releaseDate: string | Date | unknown): string {
  const d = getItemDate(releaseDate)
  if (isNaN(d.getTime())) return ""
  return toDateKey(d)
}

export function formatReleaseTime(
  releaseDate: string | Date | unknown
): string {
  const date = getItemDate(releaseDate)
  if (isNaN(date.getTime())) return ""

  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()

  // If time is midnight 00:00, usually represents a date-only entry
  if (hours === 0 && minutes === 0) {
    return ""
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export interface MonthGridDay {
  date: Date
  dateKey: string
  isCurrentMonth: boolean
  isToday: boolean
}

export function getMonthGridDays(currentDate: Date): MonthGridDay[] {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)

  const today = new Date()

  // Monday as starting day of the week (0 = Monday, ..., 6 = Sunday)
  let startDayOfWeek = firstDayOfMonth.getDay() - 1
  if (startDayOfWeek === -1) startDayOfWeek = 6

  const days: MonthGridDay[] = []

  // Preceding month padding
  for (let i = startDayOfWeek; i > 0; i--) {
    const d = new Date(year, month, 1 - i)
    days.push({
      date: d,
      dateKey: toDateKey(d),
      isCurrentMonth: false,
      isToday: isSameDay(d, today),
    })
  }

  // Current month days
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    const d = new Date(year, month, i)
    days.push({
      date: d,
      dateKey: toDateKey(d),
      isCurrentMonth: true,
      isToday: isSameDay(d, today),
    })
  }

  // Trailing month padding to fill complete 7-day rows (up to 35 or 42 cells)
  const remainder = days.length % 7
  if (remainder > 0) {
    const padCount = 7 - remainder
    for (let i = 1; i <= padCount; i++) {
      const d = new Date(year, month + 1, i)
      days.push({
        date: d,
        dateKey: toDateKey(d),
        isCurrentMonth: false,
        isToday: isSameDay(d, today),
      })
    }
  }

  return days
}

export function getWeekDays(referenceDate: Date): MonthGridDay[] {
  const today = new Date()
  const dayOfWeek = referenceDate.getDay() // 0 = Sun, 1 = Mon...
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const monday = new Date(referenceDate)
  monday.setDate(referenceDate.getDate() + distanceToMonday)

  const days: MonthGridDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push({
      date: d,
      dateKey: toDateKey(d),
      isCurrentMonth: d.getMonth() === referenceDate.getMonth(),
      isToday: isSameDay(d, today),
    })
  }

  return days
}
