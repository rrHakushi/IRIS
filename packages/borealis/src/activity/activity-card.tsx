"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import {
  IconCloudDownload,
  IconEye,
  IconEyeOff,
  IconFileImport,
  IconHeart,
  IconHeartFilled,
  IconLoader2,
  IconLock,
  IconMessageCircle,
  IconPlaylist,
  IconSend,
  IconSparkles,
  IconTrash,
  IconTrophy,
  IconUserPlus,
} from "@tabler/icons-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import {
  getDisplayNameEffectClasses,
  getDisplayNameStyleCss,
} from "@NamelessLiberty/shared"
import { toast } from "sonner"
import { useSession } from "@/context/session-context"
import { API_URL, elysia } from "@/lib/elysia"
import { getMediaDetailHref } from "@/lib/media-routes"
import { renderBadgeIcon } from "@/components/navigation/settings-tabs/account/profile/badge-showcase-card"
import { UserProfilePopover } from "@/components/navigation/settings-tabs/account/profile/profile-preview-card"
import {
  buildActivityDiffs,
  buildAuthorProfile,
  formatExactTimestamp,
  formatMediaTypeBadge,
  formatRelativeTime,
  isValidFrameUrl,
  resolveCoverUrl,
  type ActivityDiffPill,
  type ActivityItem,
  type ActivityReplyItem,
  type ActivityUserPreview,
} from "./types"

const DIFF_TONE_CLASSES: Record<ActivityDiffPill["tone"], string> = {
  success:
    "border-emerald-500/25 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  danger:
    "border-rose-500/25 bg-rose-500/12 text-rose-600 dark:text-rose-400",
  warning:
    "border-amber-500/25 bg-amber-500/12 text-amber-600 dark:text-amber-400",
  score:
    "border-amber-500/25 bg-amber-500/12 text-amber-600 dark:text-amber-300",
  info: "border-sky-500/25 bg-sky-500/12 text-sky-600 dark:text-sky-400",
  default: "border-border/60 bg-muted/70 text-foreground/85",
}

const VALID_MEDIA_ROUTE_TYPES = new Set([
  "ANIME",
  "MANGA",
  "MOVIE",
  "TV",
  "GAME",
  "BOOK",
  "MUSIC",
  "MUSIC_ALBUM",
  "MUSIC_TRACK",
  "OTHER",
])

function resolveSafeMediaHref(
  mediaType?: string | null,
  mediaId?: number | null,
  format?: string | null
): string | null {
  if (!mediaType || !mediaId) return null
  if (!VALID_MEDIA_ROUTE_TYPES.has(mediaType.toUpperCase())) return null
  return getMediaDetailHref(mediaType, mediaId, { format })
}

function getDisplayInitials(user: ActivityUserPreview): string {
  const base = user.displayName || user.username || "?"
  return base.slice(0, 2).toUpperCase()
}

function CompactAuthorTrigger({
  user,
  viewerUserId,
  size = "md",
}: {
  user: ActivityUserPreview
  viewerUserId?: string | null
  size?: "sm" | "md"
}) {
  const profile = buildAuthorProfile(user)
  const nameStyle = getDisplayNameStyleCss(profile.displayNameStyle)
  const effectClasses = getDisplayNameEffectClasses(profile.displayNameStyle?.effect)
  const displayName = user.displayName || user.username
  const avatarSrc = resolveCoverUrl(user.avatarUrl, API_URL)
  const frameSrc = resolveCoverUrl(user.avatarFrame, API_URL)
  const hasFrame = isValidFrameUrl(frameSrc)
  const [avatarError, setAvatarError] = useState(false)

  useEffect(() => {
    setAvatarError(false)
  }, [avatarSrc])

  const avatarSizeClass = size === "sm" ? "size-5" : "size-6"

  return (
    <UserProfilePopover
      profile={profile}
      username={user.username}
      userId={user.id}
      isOwner={Boolean(viewerUserId && viewerUserId === user.id)}
      placement="bottom start"
      openOnHover
      className="inline-flex max-w-full items-center gap-2 rounded-md align-middle transition-opacity hover:opacity-85"
    >
      <span
        className={cn(
          "relative inline-flex shrink-0",
          avatarSizeClass,
          hasFrame && "ms-0.5 me-0.5"
        )}
      >
        <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
          {avatarSrc && !avatarError ? (
            <img
              src={avatarSrc}
              alt={displayName}
              onError={() => setAvatarError(true)}
              className="size-full object-cover"
            />
          ) : (
            <span className="text-[10px] font-medium text-muted-foreground">
              {getDisplayInitials(user)}
            </span>
          )}
        </span>
        {hasFrame && frameSrc && (
          <img
            src={frameSrc}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -top-[15%] -start-[15%] z-10 size-[130%] max-w-none select-none object-contain"
          />
        )}
      </span>
      <span
        style={nameStyle}
        className={cn(
          "truncate text-xs font-semibold text-foreground",
          effectClasses
        )}
      >
        {displayName}
      </span>
    </UserProfilePopover>
  )
}

function ActivityThumbnailStrip({
  item,
  mediaHref,
}: {
  item: ActivityItem
  mediaHref: string | null
}) {
  const [imgError, setImgError] = useState(false)
  const meta = item.metadata ?? null
  const coverSrc = !imgError
    ? resolveCoverUrl(
        meta?.coverImage ||
          meta?.mediaCover ||
          meta?.targetCoverImage ||
          meta?.friendAvatarUrl,
        API_URL
      )
    : null

  if (item.type === "STATUS_POST" && !coverSrc) {
    return null
  }

  if (coverSrc) {
    const imgElement = (
      <img
        src={coverSrc}
        alt={item.title || "Cover"}
        onError={() => setImgError(true)}
        className="size-full object-cover transition-transform duration-300 group-hover/activity:scale-[1.03]"
      />
    )

    return (
      <div className="relative w-16 shrink-0 self-stretch overflow-hidden bg-muted/40 sm:w-20">
        {mediaHref ? (
          <Link href={mediaHref} className="block size-full">
            {imgElement}
          </Link>
        ) : (
          imgElement
        )}
      </div>
    )
  }

  if (item.type === "USER_MILESTONE") {
    const badgeColor =
      typeof meta?.badgeColor === "string" && meta.badgeColor
        ? meta.badgeColor
        : null
    return (
      <div
        className="flex w-14 shrink-0 flex-col items-center justify-center self-stretch border-e border-border/50 bg-muted/30 sm:w-16"
        style={
          badgeColor
            ? {
                backgroundColor: `${badgeColor}14`,
                color: badgeColor,
              }
            : undefined
        }
      >
        {meta?.milestoneKind === "BADGE" && meta?.badgeIcon ? (
          renderBadgeIcon(meta.badgeIcon, "size-6")
        ) : meta?.milestoneKind === "BADGE" ? (
          <IconSparkles className="size-6" />
        ) : (
          <IconTrophy className="size-6 text-amber-500" />
        )}
      </div>
    )
  }

  if (meta?.summaryKind === "CONNECTION_SYNC") {
    return (
      <div className="flex w-14 shrink-0 items-center justify-center self-stretch border-e border-border/50 bg-muted/30 text-sky-500 sm:w-16">
        <IconCloudDownload className="size-5" />
      </div>
    )
  }

  if (meta?.summaryKind === "BULK_IMPORT") {
    return (
      <div className="flex w-14 shrink-0 items-center justify-center self-stretch border-e border-border/50 bg-muted/30 text-emerald-500 sm:w-16">
        <IconFileImport className="size-5" />
      </div>
    )
  }

  if (item.type === "CUSTOM_LIST_CREATED" || meta?.customListId) {
    return (
      <div className="flex w-14 shrink-0 items-center justify-center self-stretch border-e border-border/50 bg-muted/30 text-muted-foreground sm:w-16">
        <IconPlaylist className="size-5" />
      </div>
    )
  }

  if (item.type === "FRIEND_ADDED") {
    return (
      <div className="flex w-14 shrink-0 items-center justify-center self-stretch border-e border-border/50 bg-muted/30 text-sky-500 sm:w-16">
        <IconUserPlus className="size-5" />
      </div>
    )
  }

  return null
}

function MediaTitleNode({
  title,
  href,
}: {
  title: string
  href: string | null
}) {
  if (href) {
    return (
      <Link
        href={href}
        className="font-semibold text-foreground hover:text-primary hover:underline underline-offset-2"
      >
        {title}
      </Link>
    )
  }
  return <span className="font-semibold text-foreground">{title}</span>
}

function ActivityHeadline({
  item,
  mediaHref,
}: {
  item: ActivityItem
  mediaHref: string | null
}) {
  const meta = item.metadata ?? null
  const primaryTitle =
    meta?.itemTitle || meta?.mediaTitle || item.title || "Untitled"

  if (
    item.type === "LIST_ITEM_ADDED" &&
    (meta?.summaryKind === "BULK_IMPORT" || meta?.summaryKind === "CONNECTION_SYNC")
  ) {
    return (
      <span className="font-semibold text-foreground">
        {item.title || "Updated library collection"}
      </span>
    )
  }

  if (item.type === "USER_MILESTONE") {
    if (meta?.milestoneKind === "BADGE" && meta?.badgeName) {
      return (
        <>
          <span className="text-muted-foreground">unlocked badge </span>
          <span className="font-semibold text-foreground">{meta.badgeName}</span>
        </>
      )
    }
    return (
      <span className="font-semibold text-foreground">
        {item.title || "Reached a collection milestone"}
      </span>
    )
  }

  if (item.type === "RECOMMENDATION_POSTED") {
    const targetTitle =
      meta?.targetTitle ||
      (meta?.targetMediaType && meta?.targetMediaId
        ? `${meta.targetMediaType} #${meta.targetMediaId}`
        : "a title")
    const targetHref = resolveSafeMediaHref(
      meta?.targetMediaType,
      meta?.targetMediaId
    )
    const sourceTitle =
      meta?.mediaTitle || meta?.itemTitle || "a title"
    return (
      <>
        <span className="text-muted-foreground">recommended </span>
        <MediaTitleNode title={targetTitle} href={targetHref} />
        <span className="text-muted-foreground"> if you liked </span>
        <MediaTitleNode title={sourceTitle} href={mediaHref} />
      </>
    )
  }

  if (item.type === "STATUS_POST") {
    if (mediaHref && item.title) {
      return (
        <>
          <span className="text-muted-foreground">posted about </span>
          <MediaTitleNode title={item.title} href={mediaHref} />
        </>
      )
    }
    return <span className="text-muted-foreground">posted a status update</span>
  }

  if (item.type === "CUSTOM_LIST_CREATED") {
    const listName = meta?.listName || item.title || "Custom List"
    if (meta?.action === "COLLABORATOR_ADDED") {
      return (
        <>
          <span className="text-muted-foreground">invited </span>
          <span className="font-semibold text-foreground">
            @{meta.targetUsername || "collaborator"}
          </span>
          <span className="text-muted-foreground"> to </span>
          <span className="font-semibold text-foreground">{listName}</span>
        </>
      )
    }
    if (meta?.action === "LIST_UPDATED") {
      return (
        <>
          <span className="text-muted-foreground">updated custom list </span>
          <span className="font-semibold text-foreground">{listName}</span>
        </>
      )
    }
    return (
      <>
        <span className="text-muted-foreground">created custom list </span>
        <span className="font-semibold text-foreground">{listName}</span>
      </>
    )
  }

  if (item.type === "LIST_ITEM_ADDED" && meta?.customListId) {
    return (
      <>
        <span className="text-muted-foreground">added </span>
        <MediaTitleNode title={primaryTitle} href={mediaHref} />
        <span className="text-muted-foreground"> to </span>
        <span className="font-semibold text-foreground">
          {meta.listName || "custom list"}
        </span>
      </>
    )
  }

  if (item.type === "LIST_ITEM_REMOVED" && meta?.customListId) {
    return (
      <>
        <span className="text-muted-foreground">removed </span>
        <MediaTitleNode title={primaryTitle} href={mediaHref} />
        <span className="text-muted-foreground"> from </span>
        <span className="font-semibold text-foreground">
          {meta.listName || "custom list"}
        </span>
      </>
    )
  }

  if (item.type === "FRIEND_ADDED") {
    const friendLabel =
      meta?.friendDisplayName ||
      (meta?.friendUsername ? `@${meta.friendUsername}` : "a new friend")
    return (
      <>
        <span className="text-muted-foreground">became friends with </span>
        {meta?.friendId ? (
          <Link
            href={`/carina/users/${encodeURIComponent(meta.friendId)}`}
            className="font-semibold text-foreground hover:text-primary hover:underline underline-offset-2"
          >
            {friendLabel}
          </Link>
        ) : (
          <span className="font-semibold text-foreground">{friendLabel}</span>
        )}
      </>
    )
  }

  if (item.type === "FAVORITE_ADDED" || item.type === "FAVORITE_REMOVED") {
    const favName = meta?.itemTitle || item.title || "an item"
    return (
      <>
        <span className="text-muted-foreground">
          {item.type === "FAVORITE_ADDED" ? "favorited " : "unfavorited "}
        </span>
        <MediaTitleNode title={favName} href={mediaHref} />
      </>
    )
  }

  if (item.type === "LIST_REWATCH_STARTED") {
    const mt = item.mediaType?.toUpperCase()
    const verb =
      mt === "MANGA" || mt === "BOOK"
        ? "started rereading "
        : mt === "GAME"
          ? "started replaying "
          : mt === "MUSIC"
            ? "started relistening to "
            : "started rewatching "
    return (
      <>
        <span className="text-muted-foreground">{verb}</span>
        <MediaTitleNode title={primaryTitle} href={mediaHref} />
      </>
    )
  }

  const verbMap: Record<string, string> = {
    LIST_ITEM_ADDED: "added ",
    LIST_ITEM_REMOVED: "removed ",
    LIST_COMPLETED: "completed ",
    LIST_STATUS_UPDATED: "updated ",
    LIST_PROGRESS_UPDATED: "updated progress on ",
    LIST_SCORE_UPDATED: "rated ",
    REVIEW_POSTED: "reviewed ",
    REVIEW_VOTED: "voted on a review for ",
    WATCHLIST_CREATED: "created watchlist ",
  }

  const verb = verbMap[item.type]
  if (verb) {
    return (
      <>
        <span className="text-muted-foreground">{verb}</span>
        <MediaTitleNode title={primaryTitle} href={mediaHref} />
      </>
    )
  }

  return (
    <span className="text-foreground">
      {item.title || "Updated activity"}
    </span>
  )
}

export interface ActivityCardProps {
  item: ActivityItem
  onDeleted?: (id: string) => void
  onUpdated?: (item: ActivityItem) => void
  className?: string
}

export function ActivityCard({
  item,
  onDeleted,
  onUpdated,
  className,
}: ActivityCardProps): React.JSX.Element {
  const { data: session } = useSession()
  const viewerUserId = session?.user?.id ?? null

  const [isLiked, setIsLiked] = useState(item.isLiked)
  const [likeCount, setLikeCount] = useState(item.likeCount)
  const [replyCount, setReplyCount] = useState(item.replyCount)
  const [liking, setLiking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [spoilerRevealed, setSpoilerRevealed] = useState(false)

  const [repliesOpen, setRepliesOpen] = useState(false)
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [repliesLoading, setRepliesLoading] = useState(false)
  const [replies, setReplies] = useState<ActivityReplyItem[]>([])
  const [repliesHasMore, setRepliesHasMore] = useState(false)
  const [repliesPage, setRepliesPage] = useState(1)
  const [replyInput, setReplyInput] = useState("")
  const [submittingReply, setSubmittingReply] = useState(false)
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null)

  useEffect(() => {
    setIsLiked(item.isLiked)
    setLikeCount(item.likeCount)
    setReplyCount(item.replyCount)
  }, [item.isLiked, item.likeCount, item.replyCount])

  const meta = item.metadata ?? null
  const mediaHref = resolveSafeMediaHref(
    item.mediaType,
    item.mediaId,
    meta?.format
  )
  const diffPills = buildActivityDiffs(item)
  const mediaTypeBadge = formatMediaTypeBadge(item.mediaType)

  const loadReplies = async (page: number, append: boolean) => {
    setRepliesLoading(true)
    try {
      const { data, error } = await elysia.carina
        .activity({ id: item.id })
        .replies.get({ query: { page, limit: 20 } })
      if (error || !data) {
        toast.error("Failed to load replies")
        return
      }
      const next = (data.replies || []) as ActivityReplyItem[]
      setReplies((prev) => {
        if (!append) return next
        const existingIds = new Set(prev.map((r) => r.id))
        return [...prev, ...next.filter((r) => !existingIds.has(r.id))]
      })
      setRepliesPage(page)
      setRepliesHasMore(Boolean(data.pagination?.hasMore))
      setRepliesLoaded(true)
    } catch {
      toast.error("Failed to load replies")
    } finally {
      setRepliesLoading(false)
    }
  }

  const handleToggleReplies = () => {
    const nextOpen = !repliesOpen
    setRepliesOpen(nextOpen)
    if (nextOpen && !repliesLoaded && !repliesLoading) {
      void loadReplies(1, false)
    }
  }

  const handleToggleLike = async () => {
    if (!viewerUserId) {
      toast.error("Sign in to like activity updates")
      return
    }
    if (liking) return

    const prevLiked = isLiked
    const prevCount = likeCount
    const nextLiked = !prevLiked
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1))

    setIsLiked(nextLiked)
    setLikeCount(nextCount)
    setLiking(true)

    try {
      const { data, error } = await elysia.carina
        .activity({ id: item.id })
        .like.post()

      if (error || !data) {
        setIsLiked(prevLiked)
        setLikeCount(prevCount)
        toast.error("Could not update like")
        return
      }

      setIsLiked(data.liked)
      setLikeCount(data.likeCount)
      onUpdated?.({
        ...item,
        isLiked: data.liked,
        likeCount: data.likeCount,
        replyCount,
      })
    } catch {
      setIsLiked(prevLiked)
      setLikeCount(prevCount)
      toast.error("Could not update like")
    } finally {
      setLiking(false)
    }
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = replyInput.trim()
    if (!trimmed || submittingReply || !viewerUserId) return

    setSubmittingReply(true)
    try {
      const { data, error } = await elysia.carina
        .activity({ id: item.id })
        .replies.post({ content: trimmed })

      if (error || !data?.reply) {
        toast.error("Failed to post reply")
        return
      }

      const created = data.reply as ActivityReplyItem
      setReplies((prev) => [...prev, created])
      setReplyCount(data.replyCount)
      setReplyInput("")
      setRepliesLoaded(true)
      onUpdated?.({
        ...item,
        isLiked,
        likeCount,
        replyCount: data.replyCount,
      })
    } catch {
      toast.error("Failed to post reply")
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleDeleteReply = async (replyId: string) => {
    if (deletingReplyId) return
    setDeletingReplyId(replyId)
    try {
      const { data, error } = await elysia.carina
        .activity({ id: item.id })
        .replies({ replyId })
        .delete()
      if (error || !data) {
        toast.error("Failed to delete reply")
        return
      }
      setReplies((prev) => prev.filter((r) => r.id !== replyId))
      setReplyCount(data.replyCount)
      onUpdated?.({
        ...item,
        isLiked,
        likeCount,
        replyCount: data.replyCount,
      })
    } catch {
      toast.error("Failed to delete reply")
    } finally {
      setDeletingReplyId(null)
    }
  }

  const handleDeleteActivity = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      const { error } = await elysia.carina.users
        .activity({ id: item.id })
        .delete()
      if (error) {
        toast.error("Failed to delete activity")
        return
      }
      toast.success("Activity deleted")
      onDeleted?.(item.id)
    } catch {
      toast.error("Failed to delete activity")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article
      className={cn(
        "group/activity overflow-hidden rounded-2xl border border-border/60 bg-card/45 transition-colors hover:border-border/90",
        className
      )}
    >
      <div className="flex items-stretch">
        <ActivityThumbnailStrip item={item} mediaHref={mediaHref} />

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3.5 sm:p-4">
          {/* Header Row: Author + Action + Timestamp + Privacy */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 text-[13px] leading-snug">
              <span className="inline-flex items-center align-middle me-1.5">
                <CompactAuthorTrigger
                  user={item.user}
                  viewerUserId={viewerUserId}
                />
              </span>
              <ActivityHeadline item={item} mediaHref={mediaHref} />
            </div>

            <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
              {item.isPrivate && (
                <Badge
                  variant="outline"
                  className="h-5 gap-1 rounded-md border-border/70 px-1.5 text-[10px] font-medium text-muted-foreground"
                >
                  <IconLock className="size-2.5" />
                  <span>Private</span>
                </Badge>
              )}

              <TooltipTrigger delay={200}>
                <button
                  type="button"
                  tabIndex={0}
                  className="cursor-default rounded-sm text-[11px] tabular-nums text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
                >
                  <time dateTime={item.createdAt}>
                    {formatRelativeTime(item.createdAt)}
                  </time>
                </button>
                <Tooltip>{formatExactTimestamp(item.createdAt)}</Tooltip>
              </TooltipTrigger>
            </div>
          </div>

          {/* Diff Pills + Domain Tag */}
          {(diffPills.length > 0 ||
            (mediaTypeBadge && item.type !== "STATUS_POST")) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {mediaTypeBadge && item.type !== "STATUS_POST" && (
                <span className="inline-flex items-center rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {mediaTypeBadge}
                </span>
              )}
              {diffPills.map((pill) => (
                <span
                  key={pill.key}
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums",
                    DIFF_TONE_CLASSES[pill.tone]
                  )}
                >
                  {pill.label}
                </span>
              ))}
            </div>
          )}

          {/* Optional Body Text (Status Post / Recommendation / Milestone / Sync Summary) */}
          {item.content && (
            <div className="pt-0.5">
              {item.isSpoiler && !spoilerRevealed ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <IconEyeOff className="size-3.5" />
                    <span>Spoiler content hidden</span>
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onPress={() => setSpoilerRevealed(true)}
                  >
                    <IconEye className="size-3" />
                    <span>Reveal</span>
                  </Button>
                </div>
              ) : (
                <p
                  className={cn(
                    "whitespace-pre-wrap break-words leading-relaxed",
                    item.type === "STATUS_POST"
                      ? "text-sm text-foreground"
                      : "text-xs text-muted-foreground"
                  )}
                >
                  {item.content}
                </p>
              )}
            </div>
          )}

          {/* Action Footer: Like, Replies, Delete */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onPress={() => void handleToggleLike()}
              aria-label={isLiked ? "Unlike activity" : "Like activity"}
              className={cn(
                "h-6 gap-1 rounded-md px-2 text-xs tabular-nums",
                isLiked
                  ? "text-rose-500 hover:text-rose-500"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isLiked ? (
                <IconHeartFilled className="size-3.5" />
              ) : (
                <IconHeart className="size-3.5" />
              )}
              <span>{likeCount}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="xs"
              onPress={handleToggleReplies}
              aria-expanded={repliesOpen}
              aria-label="Toggle replies"
              className={cn(
                "h-6 gap-1 rounded-md px-2 text-xs tabular-nums",
                repliesOpen
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <IconMessageCircle className="size-3.5" />
              <span>{replyCount}</span>
            </Button>

            {item.canDelete && (
              <div className="ms-auto">
                <AlertDialogTrigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={deleting}
                    aria-label="Delete activity"
                    className="text-muted-foreground/70 opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover/activity:opacity-100 focus-visible:opacity-100"
                  >
                    {deleting ? (
                      <IconLoader2 className="size-3.5 animate-spin" />
                    ) : (
                      <IconTrash className="size-3.5" />
                    )}
                  </Button>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete activity?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this activity entry and its
                        replies.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onPress={() => void handleDeleteActivity()}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialogTrigger>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Inline Replies Drawer */}
      {repliesOpen && (
        <div className="border-t border-border/50 bg-muted/20 px-3.5 py-3 sm:px-4">
          {repliesLoading && replies.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <IconLoader2 className="size-3.5 animate-spin" />
              <span>Loading replies...</span>
            </div>
          ) : replies.length === 0 ? (
            <p className="py-1.5 text-xs text-muted-foreground">
              No replies yet. Be the first to chime in.
            </p>
          ) : (
            <div className="space-y-2.5">
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className="group/reply flex items-start justify-between gap-2 rounded-xl border border-border/40 bg-background/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <CompactAuthorTrigger
                        user={reply.user}
                        viewerUserId={viewerUserId}
                        size="sm"
                      />
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {formatRelativeTime(reply.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">
                      {reply.content}
                    </p>
                  </div>

                  {reply.canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={deletingReplyId === reply.id}
                      onPress={() => void handleDeleteReply(reply.id)}
                      aria-label="Delete reply"
                      className="shrink-0 text-muted-foreground/60 opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover/reply:opacity-100 focus-visible:opacity-100"
                    >
                      {deletingReplyId === reply.id ? (
                        <IconLoader2 className="size-3 animate-spin" />
                      ) : (
                        <IconTrash className="size-3" />
                      )}
                    </Button>
                  )}
                </div>
              ))}

              {repliesHasMore && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={repliesLoading}
                  onPress={() => void loadReplies(repliesPage + 1, true)}
                  className="text-xs text-muted-foreground"
                >
                  {repliesLoading ? "Loading..." : "Load older replies"}
                </Button>
              )}
            </div>
          )}

          {viewerUserId ? (
            <form
              onSubmit={(e) => void handleSubmitReply(e)}
              className="mt-2.5 flex items-center gap-2"
            >
              <Input
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                placeholder="Write a reply..."
                maxLength={1000}
                className="h-8 flex-1 text-xs"
              />
              <Button
                type="submit"
                size="xs"
                disabled={submittingReply || !replyInput.trim()}
                className="h-8 shrink-0 gap-1 px-2.5"
              >
                {submittingReply ? (
                  <IconLoader2 className="size-3.5 animate-spin" />
                ) : (
                  <IconSend className="size-3.5" />
                )}
                <span>Reply</span>
              </Button>
            </form>
          ) : null}
        </div>
      )}
    </article>
  )
}
