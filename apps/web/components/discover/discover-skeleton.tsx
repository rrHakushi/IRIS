import React from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function DiscoverSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      {/* Media Nav Skeleton */}
      <div className="flex w-full items-center gap-2 border-b border-border/50 pb-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-2xl" />
        ))}
      </div>

      {/* Hero Banner Skeleton */}
      <div className="relative flex aspect-[21/9] max-h-[520px] min-h-[360px] w-full flex-col justify-end gap-3 overflow-hidden rounded-[min(var(--radius-4xl),24px)] border border-border/40 bg-muted/20 p-6 sm:p-10">
        <Skeleton className="h-6 w-32 rounded-2xl" />
        <Skeleton className="h-10 w-3/4 max-w-xl rounded-xl" />
        <Skeleton className="h-4 w-1/2 max-w-md rounded-md" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 w-28 rounded-2xl" />
          <Skeleton className="h-9 w-28 rounded-2xl" />
        </div>
      </div>

      {/* Genre Bar Skeleton */}
      <div className="flex gap-1.5 overflow-x-auto py-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-2xl" />
        ))}
      </div>

      {/* Section Carousels Skeleton */}
      {Array.from({ length: 3 }).map((_, secIdx) => (
        <div key={secIdx} className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <div className="flex gap-1">
              <Skeleton className="size-7 rounded-2xl" />
              <Skeleton className="size-7 rounded-2xl" />
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto py-1">
            {Array.from({ length: 7 }).map((_, itemIdx) => (
              <div
                key={itemIdx}
                className="flex w-[140px] shrink-0 flex-col gap-2 rounded-2xl border border-border/30 p-2 sm:w-[160px] md:w-[180px]"
              >
                <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-1/2 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
