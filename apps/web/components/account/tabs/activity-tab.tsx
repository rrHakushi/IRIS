"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { elysia } from "@/lib/elysia"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  IconPlayerPlay,
  IconStar,
  IconTrash,
  IconSparkles,
  IconMessageCircle,
  IconHeart,
  IconList,
  IconBookmark,
  IconNotes,
  IconTrophy,
  IconUserHeart,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

export interface ActivityTabProps {
  username: string
  isOwner: boolean
}

export function ActivityTab({
  username,
  isOwner,
}: ActivityTabProps): React.JSX.Element {
  const [activities, setActivities] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const isFetchingRef = useRef(false)

  const fetchActivities = useCallback(
    async (page: number, append = false) => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true

      try {
        const res = await elysia.users({ username }).activity.get({
          query: {
            page,
            limit: 25,
          },
        })

        if (!res.error && res.data?.success && Array.isArray(res.data.activities)) {
          if (append) {
            setActivities((prev) => [...prev, ...(res.data.activities || [])])
          } else {
            setActivities(res.data.activities || [])
          }
          setTotalCount(res.data.pagination?.total ?? 0)
          setHasMore(Boolean(res.data.pagination?.hasMore))
        }
      } catch (err) {
        console.error("[ActivityTab] Error fetching activities:", err)
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [username]
  )

  useEffect(() => {
    setIsLoading(true)
    setCurrentPage(1)
    fetchActivities(1, false)
  }, [fetchActivities])

  const handleLoadMore = () => {
    const nextPage = currentPage + 1
    setCurrentPage(nextPage)
    fetchActivities(nextPage, true)
  }

  const handleDeleteActivity = async (id: string) => {
    try {
      const res = await elysia.users({ username }).activity({ id }).delete()

      if (!res.error) {
        setActivities((prev) => prev.filter((a) => a.id !== id))
        setTotalCount((c) => Math.max(0, c - 1))
        toast.success("Activity deleted.")
      }
    } catch {
      toast.error("Failed to delete activity.")
    }
  }

  const formatActivityDisplay = (act: any) => {
    switch (act.type) {
      case "LIST_ITEM_ADDED":
        return {
          actionText: "added to list",
          badgeText: act.mediaType || "MEDIA",
          icon: IconList,
        }
      case "LIST_COMPLETED":
        return {
          actionText: "completed",
          badgeText: act.mediaType || "MEDIA",
          icon: IconSparkles,
        }
      case "LIST_PROGRESS_UPDATED":
        return {
          actionText: "updated progress to",
          badgeText: act.mediaType || "MEDIA",
          icon: IconPlayerPlay,
        }
      case "LIST_SCORE_UPDATED":
        return {
          actionText: "rated",
          badgeText: act.mediaType || "MEDIA",
          icon: IconStar,
        }
      case "LIST_STATUS_UPDATED":
        return {
          actionText: "updated status of",
          badgeText: act.mediaType || "MEDIA",
          icon: IconList,
        }
      case "LIST_ITEM_REMOVED":
        return {
          actionText: "removed from list",
          badgeText: act.mediaType || "MEDIA",
          icon: IconTrash,
        }
      case "LIST_REWATCH_STARTED":
        return {
          actionText: "started re-consuming",
          badgeText: act.mediaType || "MEDIA",
          icon: IconPlayerPlay,
        }
      case "FAVORITE_ADDED":
        return {
          actionText: "added to favorites",
          badgeText: act.mediaType || "FAVORITE",
          icon: IconHeart,
        }
      case "FAVORITE_REMOVED":
        return {
          actionText: "removed from favorites",
          badgeText: act.mediaType || "FAVORITE",
          icon: IconHeart,
        }
      case "REVIEW_POSTED":
        return {
          actionText: "posted a review for",
          badgeText: "REVIEW",
          icon: IconNotes,
        }
      case "WATCHLIST_CREATED":
      case "CUSTOM_LIST_CREATED":
        return {
          actionText: "created a custom list",
          badgeText: "LIST",
          icon: IconBookmark,
        }
      case "STATUS_POST":
        return {
          actionText: "shared a status update",
          badgeText: "STATUS",
          icon: IconMessageCircle,
        }
      case "USER_MILESTONE":
        return {
          actionText: "achieved a milestone",
          badgeText: "MILESTONE",
          icon: IconTrophy,
        }
      case "FRIEND_ADDED":
        return {
          actionText: "became friends with",
          badgeText: "FRIEND",
          icon: IconUserHeart,
        }
      default:
        return {
          actionText: act.type.replace(/_/g, " ").toLowerCase(),
          badgeText: act.mediaType || "ACTIVITY",
          icon: IconSparkles,
        }
    }
  }

  return (
    <div className="space-y-4">
      {/* Activity Timeline Feed */}

      {/* Activity Timeline Feed */}
      {isLoading && activities.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex animate-pulse items-center justify-between rounded-2xl border border-border/40 bg-card/40 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-muted/70" />
                <div className="space-y-1.5">
                  <div className="h-3 w-44 rounded bg-muted/60" />
                  <div className="h-2.5 w-24 rounded bg-muted/40" />
                </div>
              </div>
              <div className="h-3 w-16 rounded bg-muted/50" />
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/20 py-16 text-center">
          <IconPlayerPlay className="size-8 text-muted-foreground/40" />
          <h4 className="font-heading text-sm font-bold text-foreground">
            No activity recorded yet
          </h4>
          <p className="text-xs text-muted-foreground">
            @{username} doesn&apos;t have any activity logs recorded on their profile yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => {
            const dateStr = new Date(act.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })

            const display = formatActivityDisplay(act)
            const ActionIcon = display.icon

            return (
              <div
                key={act.id}
                className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/60 p-4 shadow-xs transition-colors hover:bg-card/90 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Badge
                    variant="outline"
                    className="h-6 shrink-0 gap-1 px-2 text-[10px] font-bold uppercase tracking-wider text-primary border-primary/30 bg-primary/10"
                  >
                    <ActionIcon className="size-3" />
                    <span>{display.badgeText}</span>
                  </Badge>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground">
                      <span className="font-semibold">{username}</span>
                      <span className="text-muted-foreground">
                        {display.actionText}
                      </span>
                      {act.title && (
                        <span className="font-bold text-foreground truncate max-w-sm">
                          &ldquo;{act.title}&rdquo;
                        </span>
                      )}
                      {act.progress !== null && act.progress !== undefined && (
                        <Badge className="h-4.5 bg-primary/15 text-primary text-[10px] font-bold">
                          Unit {act.progress}
                        </Badge>
                      )}
                      {act.status && (
                        <Badge variant="secondary" className="h-4.5 text-[10px] font-bold capitalize">
                          {act.status.toLowerCase()}
                        </Badge>
                      )}
                      {act.score !== null && act.score !== undefined && (
                        <Badge className="h-4.5 bg-amber-500/15 text-amber-400 text-[10px] font-bold gap-0.5">
                          <IconStar className="size-2.5 fill-amber-400" />
                          <span>{act.score}</span>
                        </Badge>
                      )}
                    </div>

                    {act.content && (
                      <p className="text-xs text-foreground/80 leading-relaxed italic line-clamp-2">
                        &ldquo;{act.content}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 shrink-0 sm:justify-end pt-1 sm:pt-0 border-t border-border/30 sm:border-t-0">
                  <span className="text-[11px] text-muted-foreground">{dateStr}</span>
                  {act.canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDeleteActivity(act.id)}
                      className="cursor-pointer text-muted-foreground opacity-60 transition-opacity hover:text-destructive group-hover:opacity-100 sm:opacity-0"
                      title="Delete activity log"
                    >
                      <IconTrash className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                className="cursor-pointer rounded-xl px-6 text-xs font-semibold"
              >
                Load More Activities
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
