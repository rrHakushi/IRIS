"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { elysia } from "@/lib/elysia"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useUser } from "@/context/user-context"
import { getMediaPreferences } from "@IRIS/shared"
import { CalendarHeader } from "./calendar-header"
import { CalendarMonthView } from "./calendar-month-view"
import { CalendarWeekView } from "./calendar-week-view"
import { CalendarAgendaView } from "./calendar-agenda-view"
import { CalendarDayDialog } from "./calendar-day-dialog"
import type {
  CalendarItem,
  CalendarViewMode,
  CalendarMediaTypeFilter,
} from "./calendar-types"
import { getMonthGridDays } from "./calendar-utils"
import { CalendarLoadingFallback } from "./calendar-loading-fallback"

export function CalendarPageClient() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { status } = useSession()
  const { user } = useUser()
  const isAuthenticated = status === "authenticated" && Boolean(user?.username)

  const mediaTitlePreference =
    getMediaPreferences(user?.customization).title || "primary"

  // URL state synchronization
  const initialView = (searchParams.get("view") as CalendarViewMode) || "month"
  const initialType =
    (searchParams.get("type") as CalendarMediaTypeFilter) || "all"
  const initialOnlyLists = searchParams.get("lists") === "true"

  const urlDateParam = searchParams.get("date")
  const initialDate = useMemo(() => {
    if (urlDateParam) {
      const parsed = new Date(urlDateParam)
      if (!isNaN(parsed.getTime())) return parsed
    }
    return new Date()
  }, [urlDateParam])

  const [currentDate, setCurrentDate] = useState<Date>(initialDate)
  const [viewMode, setViewMode] = useState<CalendarViewMode>(initialView)
  const [activeType, setActiveType] =
    useState<CalendarMediaTypeFilter>(initialType)
  const [onlyInLists, setOnlyInLists] = useState<boolean>(initialOnlyLists)
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Data fetching state
  const [items, setItems] = useState<CalendarItem[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Day dialog state
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null)
  const [selectedDayItems, setSelectedDayItems] = useState<CalendarItem[]>([])
  const [isDayDialogOpen, setIsDayDialogOpen] = useState<boolean>(false)

  // Deduplication refs for React 19 StrictMode
  const lastFetchedKeyRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)

  // Calculate range bounds for the current month view grid
  const dateRange = useMemo(() => {
    const gridDays = getMonthGridDays(currentDate)
    const start = gridDays[0]?.date || new Date()
    const end = gridDays[gridDays.length - 1]?.date || new Date()

    const startISO = new Date(
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0)
    ).toISOString()

    const endISO = new Date(
      Date.UTC(
        end.getFullYear(),
        end.getMonth(),
        end.getDate(),
        23,
        59,
        59,
        999
      )
    ).toISOString()

    return { start: startISO, end: endISO }
  }, [currentDate])

  // Fetch releases from Elysia via Eden Treaty
  useEffect(() => {
    const fetchKey = `${dateRange.start}_${dateRange.end}_${onlyInLists}_${isAuthenticated}`
    if (lastFetchedKeyRef.current === fetchKey || isFetchingRef.current) {
      return
    }

    lastFetchedKeyRef.current = fetchKey
    isFetchingRef.current = true
    let isMounted = true

    async function loadReleases() {
      setIsLoading(true)
      try {
        const { data, error } = await elysia.media.calendar.get({
          query: {
            start: dateRange.start,
            end: dateRange.end,
            onlyInLists: onlyInLists ? "true" : undefined,
          },
        })

        if (isMounted && !error && data?.success) {
          setItems(data.items)
          setCounts(data.meta.counts)
        }
      } catch {
        // Silently handle error
      } finally {
        isFetchingRef.current = false
        if (isMounted) setIsLoading(false)
      }
    }

    loadReleases()

    return () => {
      isMounted = false
    }
  }, [dateRange, onlyInLists, isAuthenticated])

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (viewMode === "week") {
        next.setDate(next.getDate() - 7)
      } else {
        next.setMonth(next.getMonth() - 1)
      }
      return next
    })
  }, [viewMode])

  const handleNext = useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (viewMode === "week") {
        next.setDate(next.getDate() + 7)
      } else {
        next.setMonth(next.getMonth() + 1)
      }
      return next
    })
  }, [viewMode])

  const handleToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  // Filter items based on active media category and client-side title search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeType !== "all" && item.mediaType !== activeType) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const titleMatch =
          item.title.toLowerCase().includes(q) ||
          item.titleSecondary?.toLowerCase().includes(q) ||
          item.titleNative?.toLowerCase().includes(q) ||
          item.detail?.toLowerCase().includes(q)

        if (!titleMatch) return false
      }

      return true
    })
  }, [items, activeType, searchQuery])

  const handleSelectDay = useCallback(
    (date: Date, dayItems: CalendarItem[]) => {
      setSelectedDayDate(date)
      setSelectedDayItems(dayItems)
      setIsDayDialogOpen(true)
    },
    []
  )

  if (!isMounted) {
    return <CalendarLoadingFallback />
  }

  return (
    <div className="flex w-full flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Navigation & Filters */}
        <CalendarHeader
          currentDate={currentDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          activeType={activeType}
          onTypeChange={setActiveType}
          onlyInLists={onlyInLists}
          onOnlyInListsChange={setOnlyInLists}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          counts={counts}
          isAuthenticated={isAuthenticated}
        />

        {/* Content Area with Loading Skeleton */}
        {isLoading ? (
          <div className="flex flex-1 flex-col gap-3">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-2xl" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            {viewMode === "month" && (
              <CalendarMonthView
                currentDate={currentDate}
                items={filteredItems}
                titlePreference={mediaTitlePreference}
                onSelectDay={handleSelectDay}
              />
            )}

            {viewMode === "week" && (
              <CalendarWeekView
                currentDate={currentDate}
                items={filteredItems}
                titlePreference={mediaTitlePreference}
              />
            )}

            {viewMode === "agenda" && (
              <CalendarAgendaView
                items={filteredItems}
                titlePreference={mediaTitlePreference}
              />
            )}
          </div>
        )}

        {/* Day Releases Dialog for +N more items */}
        <CalendarDayDialog
          open={isDayDialogOpen}
          onOpenChange={setIsDayDialogOpen}
          date={selectedDayDate}
          items={selectedDayItems}
          titlePreference={mediaTitlePreference}
        />
      </div>
    </div>
  )
}
