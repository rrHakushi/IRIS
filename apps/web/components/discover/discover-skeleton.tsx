import React from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function DiscoverSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 py-4">
      {/* Status Card Skeleton */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/90 p-3 shadow-sm">
        {/* Top Row: Media Type Pills + Browse History */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="hidden h-7 w-28 rounded-full sm:block" />
        </div>

        {/* Bottom Row: Search Input & Filter Dropdowns */}
        <div className="flex flex-col gap-3 pt-3 border-t border-border/40 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-9 w-full max-w-md rounded-2xl" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-2xl" />
            ))}
            <Skeleton className="h-8 w-28 rounded-2xl" />
            <Skeleton className="size-8 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Media Grid Skeleton */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-8">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-border/40 p-2"
          >
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
