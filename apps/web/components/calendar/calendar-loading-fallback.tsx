import React from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function CalendarLoadingFallback() {
  return (
    <div className="flex w-full flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-4 border-b border-border/40 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-xl" />
              <Skeleton className="size-8 rounded-xl" />
              <Skeleton className="h-8 w-20 rounded-xl" />
              <Skeleton className="h-8 w-44 rounded-xl" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-36 rounded-2xl" />
              <Skeleton className="h-8 w-48 rounded-2xl" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-8 w-64 rounded-2xl" />
          </div>
        </div>

        {/* Grid Skeleton */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
