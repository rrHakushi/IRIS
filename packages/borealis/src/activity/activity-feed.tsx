"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { IconActivity, IconLoader2, IconRefresh } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { ActivityCard } from "./activity-card"
import type { ActivityItem, ActivityPagination } from "./types"

export interface ActivityFeedFetchResult {
  activities: ActivityItem[]
  pagination?: Partial<ActivityPagination> | null
}

export interface ActivityFeedProps {
  fetchPage: (page: number, limit: number) => Promise<ActivityFeedFetchResult>
  resetKey?: string | number
  limit?: number
  renderComposer?: (prependItem: (item: ActivityItem) => void) => React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  showRetentionNote?: boolean
  className?: string
}

export function ActivityFeed({
  fetchPage,
  resetKey,
  limit = 20,
  renderComposer,
  emptyTitle = "No activity recorded yet",
  emptyDescription = "Updates will appear here once items are tracked or posted.",
  showRetentionNote = true,
  className,
}: ActivityFeedProps): React.JSX.Element {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const inFlightRef = useRef(false)
  const requestEpochRef = useRef(0)

  const loadPage = useCallback(
    async (targetPage: number, append: boolean) => {
      if (inFlightRef.current && append) return
      const epoch = ++requestEpochRef.current
      inFlightRef.current = true

      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setError(null)
      }

      try {
        const result = await fetchPage(targetPage, limit)
        if (epoch !== requestEpochRef.current) return

        const incoming = Array.isArray(result?.activities)
          ? result.activities
          : []

        setItems((prev) => {
          if (!append) return incoming
          const seen = new Set(prev.map((a) => a.id))
          return [...prev, ...incoming.filter((a) => !seen.has(a.id))]
        })

        setPage(targetPage)
        const nextHasMore =
          typeof result?.pagination?.hasMore === "boolean"
            ? result.pagination.hasMore
            : incoming.length >= limit
        setHasMore(nextHasMore)
        setError(null)
      } catch (err: any) {
        if (epoch !== requestEpochRef.current) return
        setError(err?.message || "Failed to load activity feed")
      } finally {
        if (epoch === requestEpochRef.current) {
          inFlightRef.current = false
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [fetchPage, limit]
  )

  useEffect(() => {
    setItems([])
    setPage(1)
    setHasMore(false)
    inFlightRef.current = false
    void loadPage(1, false)
  }, [resetKey, loadPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || loading || loadingMore || error) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !inFlightRef.current) {
          void loadPage(page + 1, true)
        }
      },
      { rootMargin: "240px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, error, page, loadPage])

  const prependItem = useCallback((item: ActivityItem) => {
    setItems((prev) => [item, ...prev.filter((existing) => existing.id !== item.id)])
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const handleUpdated = useCallback((updated: ActivityItem) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    )
  }, [])

  return (
    <div className={cn("w-full space-y-4", className)}>
      {renderComposer?.(prependItem)}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/30 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={() => void loadPage(1, false)}
            className="gap-1.5"
          >
            <IconRefresh className="size-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/20 px-4 py-14 text-center">
          <IconActivity className="size-8 text-muted-foreground/45" />
          <h4 className="font-heading text-sm font-semibold text-foreground">
            {emptyTitle}
          </h4>
          <p className="max-w-sm text-xs text-muted-foreground">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ActivityCard
              key={item.id}
              item={item}
              onDeleted={handleDeleted}
              onUpdated={handleUpdated}
            />
          ))}

          {hasMore && (
            <div
              ref={sentinelRef}
              className="flex items-center justify-center py-4"
            >
              {loadingMore ? (
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <IconLoader2 className="size-4 animate-spin" />
                  <span>Loading older activity...</span>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onPress={() => void loadPage(page + 1, true)}
                  className="text-xs text-muted-foreground"
                >
                  Load more activity
                </Button>
              )}
            </div>
          )}

          {!hasMore && showRetentionNote && (
            <p className="pt-2 text-center text-[11px] text-muted-foreground/70">
              Showing activity from the past 30 days
            </p>
          )}
        </div>
      )}
    </div>
  )
}

