"use client"

import React, { useEffect, useRef } from "react"
import { IconInbox, IconX } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { BorealisCard, BorealisCardGroup, type BorealisEntityType } from "@Runa/borealis"
import type { DiscoverCategory, DiscoverItem } from "./discover-types"

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

  // Infinite Scroll IntersectionObserver & Scroll Listener
  useEffect(() => {
    if (!hasMore || isLoading || isLoadingMore || !onLoadMore) return

    const handleCheck = () => {
      if (sentinelRef.current) {
        const rect = sentinelRef.current.getBoundingClientRect()
        if (rect.top <= window.innerHeight + 400) {
          onLoadMore()
        }
      }
    }

    // Capture phase catches scroll from any nested overflow-y container (e.g. SidebarInset)
    window.addEventListener("scroll", handleCheck, true)

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: "400px" }
    )

    const el = sentinelRef.current
    if (el) observer.observe(el)

    return () => {
      window.removeEventListener("scroll", handleCheck, true)
      if (el) observer.unobserve(el)
    }
  }, [hasMore, isLoading, isLoadingMore, onLoadMore])

  // Initial Loading Skeleton Grid
  if (isLoading) {
    const isMusic = category === "music"
    return (
      <div
        className={cn(
          "grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3 sm:gap-4 w-full",
          className
        )}
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-frost bg-frost p-2 shadow-xs backdrop-blur-md"
          >
            <Skeleton
              className={cn(
                "w-full rounded-xl",
                isMusic ? "aspect-square" : "aspect-[2/3]"
              )}
            />
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
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

  const cardType: BorealisEntityType =
    category === "characters"
      ? "character"
      : category === "studios"
        ? "studio"
        : (category as BorealisEntityType)

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Borealis Card Group Grid */}
      <BorealisCardGroup grid variant="none" gap="md" className="w-full">
        {items.map((item, idx) => (
          <BorealisCard
            key={`${item.id}-${idx}`}
            type={cardType}
            data={(item as any).raw ?? item}
            titlePreference={mediaTitlePreference}
            showSubtitle={false}
            showExtras={false}
            priority={idx < 8}
            className="w-full"
          />
        ))}
      </BorealisCardGroup>

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
