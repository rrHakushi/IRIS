"use client"

import React, { useState, useEffect, useCallback, useTransition, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import {
  IconActivity,
  IconPlus,
  IconPlayerPlay,
  IconCheck,
  IconBookmark,
  IconStar,
  IconTrash,
  IconClock,
  IconLoader2,
  IconFilter,
  IconExternalLink,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { getMediaDetailHref } from "@/lib/media-routes"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  type UserProfileCustomization,
  type DisplayNameStyle,
} from "@IRIS/shared"
import { UserProfilePopover } from "@/components/navigation/settings-tabs/account/profile/profile-preview-card"
import type { MediaListType } from "./types"

export interface ListActivityAuthor {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarFrame: string | null
  bannerUrl?: string | null
  nameplateUrl?: string | null
  bio?: string | null
  statusText?: string | null
  pronouns?: string | null
  displayNameStyle?: DisplayNameStyle | null
}

export interface ListActivityItem {
  id: string
  userId: string
  type: string
  mediaType: string
  mediaId: number | null
  status: string | null
  progress: number | null
  progressVolumes: number | null
  score: number | null
  title: string | null
  content: string | null
  metadata?: {
    exactScore?: number | null
    prevStatus?: string | null
    prevProgress?: number | null
    prevScore?: number | null
    coverImage?: string | null
    bannerImage?: string | null
    format?: string | null
  } | null
  isPrivate: boolean
  createdAt: string
  user: ListActivityAuthor
  canDelete: boolean
}

export interface ListActivityTabProps {
  username: string
  mediaType: MediaListType
  isOwner: boolean
}

type ActivityActionFilter =
  "ALL" | "ADDED" | "PROGRESS" | "STATUS" | "COMPLETED" | "SCORE" | "REMOVED"

const FILTER_OPTIONS: Array<{
  id: ActivityActionFilter
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: "ALL", label: "All", icon: IconActivity },
  { id: "ADDED", label: "Added", icon: IconPlus },
  { id: "PROGRESS", label: "Progress", icon: IconPlayerPlay },
  { id: "STATUS", label: "Status", icon: IconBookmark },
  { id: "COMPLETED", label: "Completed", icon: IconCheck },
  { id: "SCORE", label: "Scored", icon: IconStar },
  { id: "REMOVED", label: "Removed", icon: IconTrash },
]

function isValidFrameUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false
  const trimmed = url.trim()
  return (
    trimmed !== "" &&
    trimmed !== "none" &&
    (trimmed.startsWith("/") ||
      trimmed.startsWith("http") ||
      trimmed.startsWith("data:"))
  )
}

function formatActivityDate(dateStr: string | Date): {
  relative: string
  full: string
} {
  try {
    const d = new Date(dateStr)
    const full = d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
    const now = Date.now()
    const diffMs = now - d.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 45) return { relative: "just now", full }
    if (diffMin < 60) return { relative: `${diffMin}m ago`, full }
    if (diffHour < 24) return { relative: `${diffHour}h ago`, full }
    if (diffDay < 7) return { relative: `${diffDay}d ago`, full }
    return {
      relative: d.toLocaleDateString(undefined, { dateStyle: "medium" }),
      full,
    }
  } catch {
    const fallback = String(dateStr)
    return { relative: fallback, full: fallback }
  }
}

function getMediaLink(
  mediaType: string,
  mediaId: number | null,
  format?: string | null
): string {
  if (!mediaId) return "#"
  return getMediaDetailHref(mediaType, mediaId, { format })
}

function formatStatusText(status?: string | null): string {
  if (!status) return ""
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getActivityActionPhrasing(
  activity: ListActivityItem,
  mediaType: MediaListType
) {
  const title = activity.title || "Media"
  const formattedStatus = formatStatusText(activity.status)
  const exactScore =
    activity.metadata?.exactScore ??
    (activity.score !== null && activity.score !== undefined
      ? activity.score / 10
      : null)

  switch (activity.type) {
    case "LIST_ITEM_ADDED":
      return {
        actionText: "added",
        detailText: formattedStatus ? `to ${formattedStatus}` : "to list",
        badgeVariant: "default" as const,
        badgeLabel: formattedStatus || "Added",
        colorClass: "text-emerald-500 dark:text-emerald-400",
      }
    case "LIST_COMPLETED":
      return {
        actionText: "completed",
        detailText: undefined,
        badgeVariant: "secondary" as const,
        badgeLabel: "Completed",
        colorClass: "text-purple-500 dark:text-purple-400",
      }
    case "LIST_PROGRESS_UPDATED": {
      let unit = "progress"
      if (mediaType === "anime" || mediaType === "tv") unit = "episode"
      else if (mediaType === "manga" || mediaType === "book") unit = "chapter"
      else if (mediaType === "game") unit = "hours"
      else if (mediaType === "music") unit = "plays"

      return {
        actionText:
          mediaType === "anime" || mediaType === "tv"
            ? "watched"
            : mediaType === "manga" || mediaType === "book"
              ? "read"
              : mediaType === "game"
                ? "played"
                : mediaType === "music"
                  ? "listened to"
                  : "updated",
        detailText:
          activity.progress !== null && activity.progress !== undefined
            ? `${unit} ${activity.progress}`
            : undefined,
        badgeVariant: "outline" as const,
        badgeLabel:
          activity.progress !== null && activity.progress !== undefined
            ? `${unit.slice(0, 2)}. ${activity.progress}`
            : "Progress",
        colorClass: "text-blue-500 dark:text-blue-400",
      }
    }
    case "LIST_STATUS_UPDATED":
      return {
        actionText: "moved",
        detailText: formattedStatus ? `to ${formattedStatus}` : undefined,
        badgeVariant: "outline" as const,
        badgeLabel: formattedStatus || "Updated",
        colorClass: "text-amber-500 dark:text-amber-400",
      }
    case "LIST_SCORE_UPDATED":
      return {
        actionText: "rated",
        detailText: exactScore !== null ? `${exactScore} / 10` : undefined,
        badgeVariant: "outline" as const,
        badgeLabel: exactScore !== null ? `★ ${exactScore}` : "Rated",
        colorClass: "text-yellow-500 dark:text-yellow-400",
      }
    case "LIST_ITEM_REMOVED":
      return {
        actionText: "removed",
        detailText: "from list",
        badgeVariant: "destructive" as const,
        badgeLabel: "Removed",
        colorClass: "text-rose-500 dark:text-rose-400",
      }
    default:
      return {
        actionText: "updated",
        detailText: formattedStatus || undefined,
        badgeVariant: "outline" as const,
        badgeLabel: "Updated",
        colorClass: "text-primary",
      }
  }
}

export function ListActivityTab({
  username,
  mediaType,
  isOwner,
}: ListActivityTabProps): React.JSX.Element {
  const [activities, setActivities] = useState<ListActivityItem[]>([])
  const [selectedFilter, setSelectedFilter] =
    useState<ActivityActionFilter>("ALL")
  const [page, setPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [hasMore, setHasMore] = useState<boolean>(false)

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()

  // Deletion state
  const [deleteTarget, setDeleteTarget] = useState<ListActivityItem | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  // Request deduplication refs (React 19 StrictMode safety)
  const isFetchingRef = useRef<boolean>(false)
  const lastFetchedKeyRef = useRef<string | null>(null)

  const fetchActivities = useCallback(
    async (
      targetPage: number,
      actionFilter: ActivityActionFilter,
      isAppend = false,
      force = false
    ) => {
      if (!username || !mediaType) return

      const requestKey = `${username}:${mediaType}:${targetPage}:${actionFilter}`
      if (
        !force &&
        !isAppend &&
        (lastFetchedKeyRef.current === requestKey || isFetchingRef.current)
      ) {
        return
      }

      lastFetchedKeyRef.current = requestKey
      isFetchingRef.current = true

      try {
        if (targetPage === 1 && !isAppend) {
          setIsLoading(true)
        } else {
          setIsLoadingMore(true)
        }

        const res = await elysia
          .lists({ username })({ mediaType })
          .activity.get({
            query: {
              page: targetPage,
              limit: 15,
              ...(actionFilter !== "ALL" ? { action: actionFilter } : {}),
            },
          })

        if (
          !res.error &&
          res.data?.success &&
          Array.isArray(res.data.activities)
        ) {
          const fetched = res.data.activities as unknown as ListActivityItem[]
          if (isAppend) {
            setActivities((prev) => [...prev, ...fetched])
          } else {
            setActivities(fetched)
          }

          if (res.data.pagination) {
            setPage(res.data.pagination.page)
            setTotalPages(res.data.pagination.totalPages)
            setTotalCount(res.data.pagination.total)
            setHasMore(res.data.pagination.hasMore)
          }
        } else {
          if (!isAppend) setActivities([])
        }
      } catch (err) {
        lastFetchedKeyRef.current = null
        console.error("[ListActivityTab] Error loading activity stream:", err)
        toast.error("Failed to load activity log.")
      } finally {
        isFetchingRef.current = false
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [username, mediaType]
  )

  useEffect(() => {
    fetchActivities(1, selectedFilter, false)
  }, [fetchActivities, selectedFilter])

  const handleFilterChange = (filter: ActivityActionFilter) => {
    setSelectedFilter(filter)
    setPage(1)
  }

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return
    const nextPage = page + 1
    fetchActivities(nextPage, selectedFilter, true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await elysia
        .lists({ username })({ mediaType })
        .activity({ id: deleteTarget.id })
        .delete()

      if (!res.error) {
        toast.success("Activity removed.")
        setActivities((prev) => prev.filter((a) => a.id !== deleteTarget.id))
        setTotalCount((prev) => Math.max(0, prev - 1))
        setDeleteTarget(null)
      } else {
        const rawErr =
          res.error && typeof res.error === "object" && "value" in res.error
            ? (res.error as { value: { message?: string } | string }).value
            : null
        const msg =
          typeof rawErr === "string"
            ? rawErr
            : rawErr?.message || "Failed to delete activity."
        toast.error(msg)
      }
    } catch {
      toast.error("An unexpected error occurred while deleting activity.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ==================================================================== */}
      {/* 1. Header Toolbar: Action Filters + 30-Day Retention Notice          */}
      {/* ==================================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Pills */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-1">
          {FILTER_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isSelected = selectedFilter === opt.id
            return (
              <Button
                key={opt.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onPress={() => handleFilterChange(opt.id)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-xs font-semibold tracking-wide transition-all",
                  isSelected
                    ? "shadow-xs"
                    : "border-border/60 bg-background/50 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{opt.label}</span>
              </Button>
            )
          })}
        </div>

        {/* 30-Day Retention Banner */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
          <IconClock className="size-3.5 text-primary" />
          <span className="font-medium">Last 30 days</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. Activity Feed Stream                                              */}
      {/* ==================================================================== */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card/60 p-4 shadow-xs"
            >
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3 rounded-md" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        /* Empty State */
        <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/60 p-8 text-center shadow-xs backdrop-blur-md">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border/50 bg-muted/30 text-muted-foreground">
            <IconActivity className="size-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            No recent activity
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {selectedFilter !== "ALL"
              ? `No "${selectedFilter.toLowerCase()}" activities recorded for this ${mediaType} list in the last 30 days.`
              : `No updates, progress changes, or additions have been made to this ${mediaType} list in the last 30 days.`}
          </p>
          <div className="mt-4 flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-3 py-1 text-[11px] text-muted-foreground">
            <IconClock className="size-3 text-primary" />
            <span>Activity logs are automatically kept for 30 days</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activities.map((activity) => {
            const phrasing = getActivityActionPhrasing(activity, mediaType)
            const dateInfo = formatActivityDate(activity.createdAt)
            const author = activity.user
            const authorDisplayName =
              author.displayName && author.displayName.trim() !== ""
                ? author.displayName
                : author.username
            const isUserOwner =
              author.username.toLowerCase() === username.toLowerCase()

            const authorProfile: UserProfileCustomization = {
              displayName: author.displayName || "",
              displayNameStyle: author.displayNameStyle || {
                font: "default",
                effect: "solid",
                color: "currentColor",
                color2: "#8b5cf6",
                colors: ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
              },
              pronouns: author.pronouns || "",
              statusText: author.statusText || "",
              bio: author.bio || "",
              avatarUrl: author.avatarUrl,
              bannerUrl: author.bannerUrl || null,
              nameplateUrl: author.nameplateUrl || null,
              sidebarBannerUrl: author.nameplateUrl || null,
              avatarFrame: author.avatarFrame,
            }

            const mediaLink = getMediaLink(
              activity.mediaType,
              activity.mediaId,
              activity.metadata?.format
            )

            const coverUrl = activity.metadata?.coverImage

            return (
              <div
                key={activity.id}
                className="group relative flex flex-col rounded-2xl border border-border/50 bg-card/60 p-4 shadow-xs backdrop-blur-md transition-all hover:border-border/80 hover:bg-card/80 sm:flex-row sm:items-start sm:gap-4"
              >
                {/* User Avatar with Profile Popover */}
                <div className="flex items-center justify-between sm:block">
                  <div className="flex items-center gap-2.5">
                    <UserProfilePopover
                      profile={authorProfile}
                      username={author.username}
                      isOwner={isUserOwner}
                      placement="right top"
                      className="group/avatar relative flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-hidden"
                    >
                      <Avatar className="size-9 border border-border/80 bg-background shadow-xs sm:size-10">
                        {author.avatarUrl ? (
                          <AvatarImage
                            src={author.avatarUrl}
                            alt={authorDisplayName}
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary/15 text-xs font-black text-primary uppercase">
                          {authorDisplayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isValidFrameUrl(author.avatarFrame) && (
                        <div className="pointer-events-none absolute -inset-1.5 z-10 size-12 select-none">
                          <Image
                            src={author.avatarFrame}
                            alt="Avatar Frame"
                            fill
                            sizes="48px"
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                      )}
                    </UserProfilePopover>

                    {/* Mobile username and timestamp display */}
                    <div className="sm:hidden">
                      <UserProfilePopover
                        profile={authorProfile}
                        username={author.username}
                        isOwner={isUserOwner}
                        placement="bottom start"
                        className="cursor-pointer text-xs font-bold text-foreground hover:underline"
                      >
                        {authorDisplayName}
                      </UserProfilePopover>
                      <span className="ms-1.5 text-[11px] text-muted-foreground">
                        {dateInfo.relative}
                      </span>
                    </div>
                  </div>

                  {/* Mobile delete button */}
                  {(activity.canDelete || isOwner) && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onPress={() => setDeleteTarget(activity)}
                      className="size-7 rounded-full text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive sm:hidden"
                      aria-label="Delete activity"
                    >
                      <IconTrash className="size-3.5" />
                    </Button>
                  )}
                </div>

                {/* Main Activity Content */}
                <div className="mt-3 min-w-0 flex-1 sm:mt-0">
                  {/* Top Row: Action Phrase & Time & Delete */}
                  <div className="hidden items-center justify-between gap-2 sm:flex">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <UserProfilePopover
                        profile={authorProfile}
                        username={author.username}
                        isOwner={isUserOwner}
                        placement="right top"
                        className="cursor-pointer font-bold text-foreground transition-colors hover:underline focus:outline-hidden"
                      >
                        {authorDisplayName}
                      </UserProfilePopover>
                      <span className="font-normal text-muted-foreground">
                        {phrasing.actionText}
                      </span>
                      {phrasing.detailText && (
                        <span
                          className={cn("font-medium", phrasing.colorClass)}
                        >
                          {phrasing.detailText}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <TooltipTrigger delay={300}>
                        <button
                          type="button"
                          className="cursor-default border-0 bg-transparent p-0 text-start text-[11px] font-medium text-muted-foreground outline-none hover:underline focus-visible:underline"
                        >
                          {dateInfo.relative}
                        </button>
                        <Tooltip className="rounded-xl px-2.5 py-1 text-xs">
                          {dateInfo.full}
                        </Tooltip>
                      </TooltipTrigger>

                      {(activity.canDelete || isOwner) && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onPress={() => setDeleteTarget(activity)}
                          className="size-6 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete activity"
                        >
                          <IconTrash className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Mobile phrase details */}
                  <div className="mb-2.5 flex items-center gap-1.5 text-xs sm:hidden">
                    <span className="font-normal text-muted-foreground">
                      {phrasing.actionText}
                    </span>
                    {phrasing.detailText && (
                      <span className={cn("font-medium", phrasing.colorClass)}>
                        {phrasing.detailText}
                      </span>
                    )}
                  </div>

                  {/* Media Reference Card (AniList Style) */}
                  <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-border/40 bg-background/50 p-2.5 transition-colors hover:bg-background/80">
                    {/* Media Poster Thumbnail */}
                    <Link
                      href={mediaLink}
                      className="group/poster relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted shadow-xs sm:size-14"
                    >
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={activity.title || "Cover"}
                          fill
                          sizes="56px"
                          unoptimized
                          className="object-cover transition-transform duration-300 group-hover/poster:scale-105"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                          <IconActivity className="size-5" />
                        </div>
                      )}
                    </Link>

                    {/* Media Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={mediaLink}
                          className="truncate text-xs font-bold text-foreground transition-colors hover:text-primary hover:underline sm:text-sm"
                        >
                          {activity.title || "Untitled Media"}
                        </Link>
                        {activity.metadata?.format && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 px-1.5 py-0 text-[10px] font-semibold uppercase"
                          >
                            {activity.metadata.format}
                          </Badge>
                        )}
                      </div>

                      {/* Status / Score / Progress Tag */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {activity.status && (
                          <Badge
                            variant={phrasing.badgeVariant}
                            className="px-2 py-0 text-[10px] font-medium"
                          >
                            {formatStatusText(activity.status)}
                          </Badge>
                        )}

                        {activity.progress !== null &&
                          activity.progress !== undefined &&
                          activity.progress > 0 && (
                            <span className="font-semibold text-foreground">
                              {mediaType === "anime" || mediaType === "tv"
                                ? `Ep ${activity.progress}`
                                : mediaType === "manga" || mediaType === "book"
                                  ? `Ch ${activity.progress}`
                                  : `${activity.progress} plays`}
                            </span>
                          )}

                        {activity.score !== null &&
                          activity.score !== undefined && (
                            <span className="flex items-center gap-0.5 font-bold text-amber-500">
                              <IconStar className="size-3 fill-amber-500 text-amber-500" />
                              <span>
                                {activity.metadata?.exactScore ??
                                  (activity.score / 10).toFixed(1)}
                              </span>
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Quick Visit Arrow */}
                    <Link
                      href={mediaLink}
                      className="me-1 hidden shrink-0 text-muted-foreground transition-colors hover:text-foreground sm:block"
                      aria-label="View media page"
                    >
                      <IconExternalLink className="size-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Load More Trigger */}
          {hasMore && (
            <div className="mt-2 flex justify-center pb-4">
              <Button
                variant="outline"
                size="sm"
                onPress={handleLoadMore}
                disabled={isLoadingMore}
                className="rounded-full px-5 text-xs font-semibold shadow-xs"
              >
                {isLoadingMore ? (
                  <>
                    <IconLoader2 className="size-3.5 animate-spin" />
                    <span>Loading more activities...</span>
                  </>
                ) : (
                  <span>
                    Load More ({totalCount - activities.length} remaining)
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. Delete Confirmation Dialog                                        */}
      {/* ==================================================================== */}
      <Dialog
        isOpen={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
            <IconTrash className="size-4" />
            Delete Activity Log
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to remove this activity entry from your log?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onPress={() => setDeleteTarget(null)}
            disabled={isDeleting}
            className="rounded-2xl text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onPress={handleConfirmDelete}
            disabled={isDeleting}
            className="rounded-2xl text-xs shadow-xs"
          >
            {isDeleting ? (
              <>
                <IconLoader2 className="size-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete</span>
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
