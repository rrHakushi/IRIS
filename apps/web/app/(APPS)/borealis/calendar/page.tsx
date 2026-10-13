import { Suspense } from "react"
import type { Metadata } from "next"
import { CalendarPageClient } from "@/components/calendar/calendar-page-client"
import { CalendarLoadingFallback } from "@/components/calendar/calendar-loading-fallback"

export const metadata: Metadata = {
  title: "Media Release Calendar | IRIS List",
  description:
    "Track upcoming and recent media releases across anime airing schedules, manga publications, TV series episodes, movie premieres, video games, books, and music.",
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarLoadingFallback />}>
      <CalendarPageClient />
    </Suspense>
  )
}
