"use client"

import React, { useEffect, useRef } from "react"
import { IconInbox, IconX } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Skeleton } from "@workspace/ui/components/skeleton"
import type { DiscoverCategory, DiscoverItem } from "./discover-types"
import { DiscoverMediaCard } from "./discover-media-card"

export interface DiscoverMediaGridProps {
  category: DiscoverCategory
  items: DiscoverItem[]
  isLoading: boolean
  isLoadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  mediaTitlePreference?: "primary" | "secondary" | "native"
  searchQuery?: string
  onClearFilters?: () => void
  className?: string
}

export function DiscoverMediaGrid({
  category,
  items,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  mediaTitlePreference = "primary",
  searchQuery,
  onClearFilters,
  className,
}: DiscoverMediaGridProps): React.JSX.Element {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore || !onLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: "400px" }
    )

    const el = sentinelRef.current
    if (el) observer.observe(el)

    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasMore, isLoading, isLoadingMore, onLoadMore])

  // Initial Loading Skeleton Grid
  if (isLoading) {
    const isMusic = category === "music"
    return (
      <div
        className={cn(
          "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-8",
          className
        )}
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-border/40 p-2"
          >
            <Skeleton
              className={cn(
                "w-full rounded-xl",
                isMusic ? "aspect-square" : "aspect-[2/3]"
              )}
            />
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  // Empty State
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
          <IconInbox className="size-7" />
        </div>
        <h3 className="mt-4 font-heading text-base font-semibold text-foreground">
          {searchQuery
            ? `No ${category} found matching "${searchQuery}"`
            : `No ${category} found`}
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {searchQuery
            ? "Try another keyword, or clear active filters to discover more media."
            : "No items match your selected filters. Try clearing some filters to broaden your discovery."}
        </p>
        {onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            onPress={onClearFilters}
            className="mt-4 gap-1.5 rounded-2xl border-border/60 text-xs"
          >
            <IconX className="size-3.5" />
            <span>Clear Filters</span>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* 8-Card Responsive Media Grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5 md:gap-3 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-8">
        {items.map((item, idx) => (
          <DiscoverMediaCard
            key={`${item.id}-${idx}`}
            item={item}
            category={category}
            mediaTitlePreference={mediaTitlePreference}
            priority={idx < 8}
          />
        ))}
      </div>

      {/* Infinite Scroll Sentinel & Loading Indicator */}
      <div
        ref={sentinelRef}
        className="flex h-14 w-full items-center justify-center"
      >
        {isLoadingMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-4" />
            <span>Loading more {category}…</span>
          </div>
        )}
      </div>
    </div>
  )
}
