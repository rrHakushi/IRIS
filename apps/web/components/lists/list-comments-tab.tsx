"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  IconCornerDownRight,
  IconTrash,
  IconPencil,
  IconAlertTriangle,
  IconEye,
  IconEyeOff,
  IconCrown,
  IconSend,
  IconCheck,
  IconLoader2,
  IconMessages,
  IconLock,
  IconClock,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Textarea } from "@workspace/ui/components/textarea"
import { Switch } from "@workspace/ui/components/switch"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import { cn } from "@workspace/ui/lib/utils"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  type UserProfileCustomization,
  type DisplayNameStyle,
} from "@IRIS/shared"
import { UserProfilePopover } from "@/components/navigation/settings-tabs/account/profile/profile-preview-card"
import type { MediaListType } from "./types"

export interface CommentAuthor {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  avatarFrame: string | null
  bannerUrl?: string | null
  nameplateUrl?: string | null
  sidebarBannerUrl?: string | null
  bio?: string | null
  statusText?: string | null
  pronouns?: string | null
  displayNameStyle?: DisplayNameStyle | null
}

export interface CommentReply {
  id: string
  commentId: string
  authorId: string
  content: string
  createdAt: string | Date
  updatedAt: string | Date
  author: CommentAuthor
}

export interface ListCommentItem {
  id: string
  listOwnerId: string
  mediaType: string
  authorId: string
  content: string
  isSpoiler: boolean
  createdAt: string | Date
  updatedAt: string | Date
  author: CommentAuthor
  reply: CommentReply | null
}

export interface ListCommentsTabProps {
  username: string
  mediaType: MediaListType
  isOwner: boolean
}

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

function formatCommentDate(dateStr: string | Date): {
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

function getPaginationPages(
  currentPage: number,
  totalPages: number
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages]
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ]
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ]
}

export function ListCommentsTab({
  username,
  mediaType,
  isOwner,
}: ListCommentsTabProps): React.JSX.Element {
  const { data: session, status } = useSession()
  const isAuthenticated =
    status === "authenticated" && Boolean(session?.user?.id)

  const [comments, setComments] = useState<ListCommentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Pagination State (6 comments per page from API, stored in URL e.g. ?page=1)
  const COMMENTS_PER_PAGE = 6
  const [currentPage, setCurrentPage] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const pageParam = parseInt(params.get("page") || "1", 10)
      if (!isNaN(pageParam) && pageParam >= 1) {
        return pageParam
      }
    }
    return 1
  })
  const [totalComments, setTotalComments] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const paginationPages = getPaginationPages(currentPage, totalPages)

  // Navigate to a page and update URL search parameters
  const navigateToPage = useCallback(
    (newPage: number, replace: boolean = false) => {
      setCurrentPage(newPage)
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href)
        url.searchParams.set("page", String(newPage))
        if (replace) {
          window.history.replaceState({}, "", url.toString())
        } else {
          window.history.pushState({}, "", url.toString())
        }
      }
    },
    []
  )

  // Ensure ?page= is persisted in the URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      const pageInUrl = url.searchParams.get("page")
      if (pageInUrl !== String(currentPage)) {
        url.searchParams.set("page", String(currentPage))
        window.history.replaceState({}, "", url.toString())
      }
    }
  }, [currentPage])

  // Listen to browser popstate (back/forward) navigation for page changes
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const pageParam = parseInt(params.get("page") || "1", 10)
      const validPage = !isNaN(pageParam) && pageParam >= 1 ? pageParam : 1
      setCurrentPage((prev) => (prev !== validPage ? validPage : prev))
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // New Comment Form State
  const [commentText, setCommentText] = useState("")
  const [isSpoiler, setIsSpoiler] = useState(false)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  // Revealing Spoilers State
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(
    new Set()
  )

  // Inline Reply Form (Owner only)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

  // Inline Edit Reply State (Owner only)
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editReplyText, setEditReplyText] = useState("")
  const [isSavingEditReply, setIsSavingEditReply] = useState(false)

  // Delete Modals State
  const [deleteCommentTarget, setDeleteCommentTarget] =
    useState<ListCommentItem | null>(null)
  const [isDeletingComment, setIsDeletingComment] = useState(false)

  const [deleteReplyTarget, setDeleteReplyTarget] =
    useState<CommentReply | null>(null)
  const [isDeletingReply, setIsDeletingReply] = useState(false)

  // Data fetching
  const isFetchingRef = useRef(false)

  const fetchComments = useCallback(
    async (pageToFetch: number) => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true

      try {
        const res = await elysia
          .lists({ username })({ mediaType })
          .comments.get({
            query: {
              page: pageToFetch,
              limit: COMMENTS_PER_PAGE,
            },
          })

        console.log(res)

        if (
          !res.error &&
          res.data?.success &&
          Array.isArray(res.data.comments)
        ) {
          setComments(res.data.comments)
          const pagination = res.data.pagination
          if (pagination) {
            const total = pagination.total ?? 0
            const calculatedTotalPages = Math.max(1, pagination.totalPages ?? 1)
            setTotalComments(total)
            setTotalPages(calculatedTotalPages)
            if (pageToFetch > calculatedTotalPages && total > 0) {
              navigateToPage(calculatedTotalPages, true)
            }
          } else {
            setTotalComments(res.data.comments.length)
            setTotalPages(1)
          }
        } else if (res.error) {
          console.error("[ListCommentsTab] Error fetching comments:", res.error)
        }
      } catch (err) {
        console.error("[ListCommentsTab] Unexpected fetch error:", err)
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [username, mediaType, navigateToPage]
  )

  useEffect(() => {
    setIsLoading(true)
    fetchComments(currentPage)
  }, [currentPage, fetchComments])

  const toggleSpoiler = (commentId: string) => {
    setRevealedSpoilers((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) {
        next.delete(commentId)
      } else {
        next.add(commentId)
      }
      return next
    })
  }

  // Rate limiting state (429 handling)
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null)
  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rateLimitToastId = "comment-rate-limit-toast"

  const startRateLimitCountdown = useCallback((seconds: number) => {
    if (rateLimitTimerRef.current) {
      clearInterval(rateLimitTimerRef.current)
      rateLimitTimerRef.current = null
    }

    setRateLimitSeconds(seconds)

    toast.error(
      `Rate limit reached: Please wait ${seconds}s before commenting again.`,
      {
        id: rateLimitToastId,
        duration: 4000,
      }
    )

    let remaining = seconds
    rateLimitTimerRef.current = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        if (rateLimitTimerRef.current) {
          clearInterval(rateLimitTimerRef.current)
          rateLimitTimerRef.current = null
        }
        setRateLimitSeconds(null)
        toast.success("Rate limit ended. You can now post comments again.", {
          id: rateLimitToastId,
          duration: 5000,
        })
      } else {
        setRateLimitSeconds(remaining)
      }
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) {
        clearInterval(rateLimitTimerRef.current)
      }
    }
  }, [])

  // Handle Post Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    if (!isAuthenticated) {
      toast.error("Please sign in to post a comment.")
      return
    }

    if (rateLimitSeconds !== null && rateLimitSeconds > 0) {
      toast.error(
        `Rate limit active: Please wait ${rateLimitSeconds}s before commenting again.`,
        {
          id: rateLimitToastId,
          duration: 3000,
        }
      )
      return
    }

    setIsSubmittingComment(true)
    try {
      const res = await elysia
        .lists({ username })({ mediaType })
        .comments.post({
          content: commentText.trim(),
          isSpoiler,
        })

      const isRateLimited = res.status === 429

      if (isRateLimited) {
        startRateLimitCountdown(60)
        return
      }

      if (!res.error && res.data?.success && res.data.comment) {
        setCommentText("")
        setIsSpoiler(false)
        toast.success("Comment posted successfully.")
        if (currentPage === 1) {
          setIsLoading(true)
          fetchComments(1)
        } else {
          navigateToPage(1, true)
        }
      } else {
        const rawErr =
          res.error && typeof res.error === "object" && "value" in res.error
            ? (res.error as { value: { message?: string } | string }).value
            : null
        const errMessage =
          typeof rawErr === "string"
            ? rawErr
            : rawErr?.message || "Failed to post comment."
        toast.error(errMessage)
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while posting your comment."
      )
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // Handle Post Reply (Owner only, 1 reply max)
  const handlePostReply = async (commentId: string) => {
    if (!replyText.trim()) return

    setIsSubmittingReply(true)
    try {
      const res = await elysia
        .lists({ username })({ mediaType })
        .comments({ id: commentId })
        .reply.post({
          content: replyText.trim(),
        })

      const createdReply = res.data?.reply || res.data?.data
      if (!res.error && res.data?.success && createdReply) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, reply: createdReply } : c))
        )
        setReplyingToId(null)
        setReplyText("")
        toast.success("Reply posted successfully.")
      } else {
        const rawErr =
          res.error && typeof res.error === "object" && "value" in res.error
            ? (res.error as { value: { message?: string } | string }).value
            : null
        const errMessage =
          typeof rawErr === "string"
            ? rawErr
            : rawErr?.message || "Failed to post reply."
        toast.error(errMessage)
      }
    } catch {
      toast.error("An unexpected error occurred while posting your reply.")
    } finally {
      setIsSubmittingReply(false)
    }
  }

  // Handle Edit Reply (Owner only)
  const handleSaveEditReply = async (commentId: string) => {
    if (!editReplyText.trim()) return

    setIsSavingEditReply(true)
    try {
      const res = await elysia
        .lists({ username })({ mediaType })
        .comments({ id: commentId })
        .reply.put({
          content: editReplyText.trim(),
        })

      const updatedReply = res.data?.reply || res.data?.data
      if (!res.error && res.data?.success && updatedReply) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, reply: updatedReply } : c))
        )
        setEditingReplyId(null)
        setEditReplyText("")
        toast.success("Reply updated successfully.")
      } else {
        const rawErr =
          res.error && typeof res.error === "object" && "value" in res.error
            ? (res.error as { value: { message?: string } | string }).value
            : null
        const errMessage =
          typeof rawErr === "string"
            ? rawErr
            : rawErr?.message || "Failed to update reply."
        toast.error(errMessage)
      }
    } catch {
      toast.error("An unexpected error occurred while updating the reply.")
    } finally {
      setIsSavingEditReply(false)
    }
  }

  // Handle Delete Reply (Owner only)
  const handleConfirmDeleteReply = async () => {
    if (!deleteReplyTarget) return

    setIsDeletingReply(true)
    try {
      const res = await elysia
        .lists({ username })({ mediaType })
        .comments({ id: deleteReplyTarget.commentId })
        .reply.delete()

      if (!res.error) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === deleteReplyTarget.commentId ? { ...c, reply: null } : c
          )
        )
        toast.success("Reply deleted.")
        setDeleteReplyTarget(null)
      } else {
        const rawErr =
          res.error && typeof res.error === "object" && "value" in res.error
            ? (res.error as { value: { message?: string } | string }).value
            : null
        const errMessage =
          typeof rawErr === "string"
            ? rawErr
            : rawErr?.message || "Failed to delete reply."
        toast.error(errMessage)
      }
    } catch {
      toast.error("An unexpected error occurred while deleting the reply.")
    } finally {
      setIsDeletingReply(false)
    }
  }

  // Handle Delete Comment (Owner only, cascades to delete reply)
  const handleConfirmDeleteComment = async () => {
    if (!deleteCommentTarget) return

    setIsDeletingComment(true)
    try {
      const res = await elysia
        .lists({ username })({ mediaType })
        .comments({ id: deleteCommentTarget.id })
        .delete()

      if (!res.error) {
        toast.success("Comment and any replies deleted.")
        setDeleteCommentTarget(null)
        if (comments.length <= 1 && currentPage > 1) {
          navigateToPage(currentPage - 1, true)
        } else {
          setIsLoading(true)
          fetchComments(currentPage)
        }
      } else {
        const rawErr =
          res.error && typeof res.error === "object" && "value" in res.error
            ? (res.error as { value: { message?: string } | string }).value
            : null
        const errMessage =
          typeof rawErr === "string"
            ? rawErr
            : rawErr?.message || "Failed to delete comment."
        toast.error(errMessage)
      }
    } catch {
      toast.error("An unexpected error occurred while deleting the comment.")
    } finally {
      setIsDeletingComment(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Comment Input Box */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-3 shadow-xs transition-colors focus-within:border-primary/50 focus-within:bg-card/70">
        {isAuthenticated ? (
          <form onSubmit={handlePostComment} className="space-y-2">
            <Textarea
              placeholder={`Leave a comment on ${username}'s ${mediaType} list...`}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={2}
              className="min-h-[44px] w-full resize-none border-0 bg-transparent p-0.5 text-sm shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
              maxLength={5000}
              disabled={isSubmittingComment}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-2">
              {/* Spoiler Toggle */}
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors select-none hover:text-foreground">
                <Switch
                  isSelected={isSpoiler}
                  onChange={setIsSpoiler}
                  isDisabled={isSubmittingComment}
                />
                <div className="flex items-center gap-1">
                  {isSpoiler ? (
                    <IconEyeOff className="size-3.5 text-destructive" />
                  ) : (
                    <IconEye className="size-3.5" />
                  )}
                  <span
                    className={cn(
                      isSpoiler && "font-semibold text-destructive"
                    )}
                  >
                    Mark as spoiler
                  </span>
                </div>
              </label>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={
                  isSubmittingComment ||
                  !commentText.trim() ||
                  Boolean(rateLimitSeconds)
                }
                className="h-7 gap-1.5 rounded-xl px-3 text-xs shadow-xs"
              >
                {isSubmittingComment ? (
                  <>
                    <IconLoader2 className="size-3.5 animate-spin" />
                    <span>Posting...</span>
                  </>
                ) : rateLimitSeconds ? (
                  <>
                    <IconClock className="size-3.5 animate-pulse" />
                    <span>Rate limit ({rateLimitSeconds}s)</span>
                  </>
                ) : (
                  <>
                    <IconSend className="size-3.5" />
                    <span>Post Comment</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-center">
            <IconLock className="size-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Sign in to join the discussion on {username}&apos;s list.
            </p>
          </div>
        )}
      </div>

      {/* Comments Feed */}
      {isLoading ? (
        <div className="divide-y divide-border/30 rounded-2xl border border-border/50 bg-card/30">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse items-start gap-3 p-3.5">
              <div className="size-8 shrink-0 rounded-full bg-muted/70" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-24 rounded-md bg-muted/70" />
                  <div className="h-2.5 w-12 rounded-md bg-muted/50" />
                </div>
                <div className="h-3 w-3/4 rounded-md bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/50 bg-card/20 py-8 text-center">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <IconMessages className="size-4.5" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">
            No comments yet
          </h3>
          <p className="max-w-xs text-xs text-muted-foreground">
            Be the first to share your thoughts on {username}&apos;s {mediaType}{" "}
            list.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30 rounded-2xl border border-border/50 bg-card/30">
          {comments.map((comment) => {
            const isRevealed = revealedSpoilers.has(comment.id)
            const commentDate = formatCommentDate(comment.createdAt)
            const authorStyle = getDisplayNameStyleCss(
              comment.author.displayNameStyle ?? undefined
            )
            const authorEffect = getDisplayNameEffectClasses(
              comment.author.displayNameStyle?.effect ?? undefined
            )

            const authorHasDisplayName = Boolean(
              comment.author.displayName &&
              comment.author.displayName.trim() !== ""
            )
            const authorNameToDisplay = authorHasDisplayName
              ? comment.author.displayName!
              : comment.author.username

            const isAuthorListOwner =
              comment.author.username.toLowerCase() === username.toLowerCase()

            const authorProfile: UserProfileCustomization = {
              displayName: comment.author.displayName || "",
              displayNameStyle: comment.author.displayNameStyle || {
                font: "default",
                effect: "solid",
                color: "currentColor",
                color2: "#8b5cf6",
                colors: ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
              },
              pronouns: comment.author.pronouns || "",
              statusText: comment.author.statusText || "",
              bio: comment.author.bio || "",
              avatarUrl: comment.author.avatarUrl,
              bannerUrl: comment.author.bannerUrl || null,
              nameplateUrl: comment.author.nameplateUrl || null,
              sidebarBannerUrl: comment.author.nameplateUrl || null,
              avatarFrame: comment.author.avatarFrame,
            }

            const reply = comment.reply
            const replyHasDisplayName = Boolean(
              reply?.author.displayName &&
              reply.author.displayName.trim() !== ""
            )
            const replyAuthorNameToDisplay = replyHasDisplayName
              ? reply!.author.displayName!
              : reply?.author.username || ""

            const replyAuthorProfile: UserProfileCustomization | null = reply
              ? {
                displayName: reply.author.displayName || "",
                displayNameStyle: reply.author.displayNameStyle || {
                  font: "default",
                  effect: "solid",
                  color: "currentColor",
                  color2: "#8b5cf6",
                  colors: [
                    "#a855f7",
                    "#3b82f6",
                    "#10b981",
                    "#f59e0b",
                    "#ef4444",
                  ],
                },
                pronouns: reply.author.pronouns || "",
                statusText: reply.author.statusText || "",
                bio: reply.author.bio || "",
                avatarUrl: reply.author.avatarUrl,
                bannerUrl: reply.author.bannerUrl || null,
                nameplateUrl: reply.author.nameplateUrl || null,
                sidebarBannerUrl: reply.author.sidebarBannerUrl || null,
                avatarFrame: reply.author.avatarFrame,
              }
              : null

            return (
              <div
                key={comment.id}
                className="p-3.5 transition-colors hover:bg-muted/10 sm:p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar with Profile Popover */}
                  <UserProfilePopover
                    profile={authorProfile}
                    username={comment.author.username}
                    isOwner={isAuthorListOwner}
                    placement="right top"
                    className="group relative flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-hidden"
                  >
                    <Avatar className="size-8 border border-border/80 bg-background shadow-xs sm:size-9">
                      {comment.author.avatarUrl ? (
                        <AvatarImage
                          src={comment.author.avatarUrl}
                          alt={authorNameToDisplay}
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/15 text-xs font-black text-primary uppercase">
                        {authorNameToDisplay.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isValidFrameUrl(comment.author.avatarFrame) && (
                      <div className="pointer-events-none absolute -inset-1.5 z-10 size-11 select-none">
                        <Image
                          src={comment.author.avatarFrame}
                          alt="Avatar Frame"
                          fill
                          sizes="44px"
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    )}
                  </UserProfilePopover>

                  {/* Right Column: Author Info, Actions, Comment Body & Reply */}
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <UserProfilePopover
                          profile={authorProfile}
                          username={comment.author.username}
                          isOwner={isAuthorListOwner}
                          placement="right top"
                          className={cn(
                            "cursor-pointer text-start text-xs font-semibold tracking-tight transition-all hover:underline focus:outline-hidden sm:text-sm",
                            authorEffect
                          )}
                          style={authorStyle}
                        >
                          {authorNameToDisplay}
                        </UserProfilePopover>

                        {comment.isSpoiler && (
                          <Badge
                            variant="destructive"
                            className="h-4 px-1.5 text-[10px] font-semibold"
                          >
                            Spoiler
                          </Badge>
                        )}

                        <TooltipTrigger delay={300}>
                          <button
                            type="button"
                            className="cursor-default border-0 bg-transparent p-0 text-start text-[11px] text-muted-foreground outline-none hover:underline focus-visible:underline"
                          >
                            {commentDate.relative}
                          </button>
                          <Tooltip className="rounded-xl px-2.5 py-1 text-xs">
                            {commentDate.full}
                          </Tooltip>
                        </TooltipTrigger>
                      </div>

                      {/* Owner Action Buttons */}
                      {isOwner && (
                        <div className="flex items-center gap-0.5">
                          {/* Reply Button (Only shown if no reply exists yet; 1 reply max) */}
                          {!comment.reply && replyingToId !== comment.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingToId(comment.id)
                                setReplyText("")
                              }}
                              className="h-6 gap-1 rounded-xl px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              <IconCornerDownRight className="size-3" />
                              <span>Reply</span>
                            </Button>
                          )}

                          {/* Delete Comment Button */}
                          <TooltipTrigger delay={300}>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setDeleteCommentTarget(comment)}
                              className="size-6 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <IconTrash className="size-3" />
                            </Button>
                            <Tooltip className="rounded-xl text-xs">
                              Delete comment
                            </Tooltip>
                          </TooltipTrigger>
                        </div>
                      )}
                    </div>

                    {/* Comment Body */}
                    {comment.isSpoiler && !isRevealed ? (
                      <button
                        type="button"
                        onClick={() => toggleSpoiler(comment.id)}
                        className="group flex w-full cursor-pointer items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-start transition-all hover:bg-destructive/10"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <IconAlertTriangle className="size-3.5 shrink-0" />
                          <span>This comment contains spoilers</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground underline underline-offset-2 group-hover:text-foreground">
                          Reveal
                        </span>
                      </button>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground sm:text-sm">
                          {comment.content}
                        </p>
                        {comment.isSpoiler && isRevealed && (
                          <button
                            type="button"
                            onClick={() => toggleSpoiler(comment.id)}
                            className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Hide spoiler
                          </button>
                        )}
                      </div>
                    )}

                    {/* Inline Reply Form for List Owner */}
                    {isOwner && replyingToId === comment.id && (
                      <div className="mt-2.5 space-y-2 rounded-xl border border-primary/30 bg-muted/20 p-2.5">
                        <Textarea
                          placeholder="Write your official reply as the list owner..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={2}
                          className="min-h-[40px] w-full resize-none border-0 bg-transparent p-1 text-xs shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 sm:text-sm"
                          disabled={isSubmittingReply}
                          maxLength={5000}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-1.5 border-t border-border/30 pt-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReplyingToId(null)
                              setReplyText("")
                            }}
                            disabled={isSubmittingReply}
                            className="h-6 rounded-xl px-2 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handlePostReply(comment.id)}
                            disabled={isSubmittingReply || !replyText.trim()}
                            className="h-6 gap-1 rounded-xl px-2.5 text-xs shadow-xs"
                          >
                            {isSubmittingReply ? (
                              <>
                                <IconLoader2 className="size-3 animate-spin" />
                                <span>Replying...</span>
                              </>
                            ) : (
                              <>
                                <IconCornerDownRight className="size-3" />
                                <span>Reply</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Owner Reply Block */}
                    {reply && replyAuthorProfile && (
                      <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-border/40 bg-muted/20 p-2.5 sm:p-3">
                        {/* Owner Avatar */}
                        <UserProfilePopover
                          profile={replyAuthorProfile}
                          username={reply.author.username}
                          isOwner={true}
                          placement="right top"
                          className="group relative flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-hidden"
                        >
                          <Avatar className="size-7 border border-primary/40 bg-background shadow-xs">
                            {reply.author.avatarUrl ? (
                              <AvatarImage
                                src={reply.author.avatarUrl}
                                alt={replyAuthorNameToDisplay}
                              />
                            ) : null}
                            <AvatarFallback className="bg-primary/15 text-[10px] font-black text-primary uppercase">
                              {replyAuthorNameToDisplay.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {isValidFrameUrl(reply.author.avatarFrame) && (
                            <div className="pointer-events-none absolute -inset-1 z-10 size-9 select-none">
                              <Image
                                src={reply.author.avatarFrame}
                                alt="Avatar Frame"
                                fill
                                sizes="36px"
                                unoptimized
                                className="object-contain"
                              />
                            </div>
                          )}
                        </UserProfilePopover>

                        {/* Reply Content Column */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <UserProfilePopover
                                profile={replyAuthorProfile}
                                username={reply.author.username}
                                isOwner={true}
                                placement="right top"
                                className={cn(
                                  "cursor-pointer text-start text-xs font-semibold text-foreground hover:underline focus:outline-hidden",
                                  getDisplayNameEffectClasses(
                                    reply.author.displayNameStyle?.effect ?? undefined
                                  )
                                )}
                                style={getDisplayNameStyleCss(
                                  reply.author.displayNameStyle ?? undefined
                                )}
                              >
                                {replyAuthorNameToDisplay}
                              </UserProfilePopover>

                              <Badge
                                variant="outline"
                                className="h-3.5 gap-0.5 border-primary/40 bg-primary/10 px-1 text-[9px] font-bold text-primary"
                              >
                                <IconCrown className="size-2.5" />
                                <span>Owner</span>
                              </Badge>

                              <TooltipTrigger delay={300}>
                                <button
                                  type="button"
                                  className="cursor-default border-0 bg-transparent p-0 text-start text-[10px] text-muted-foreground outline-none hover:underline focus-visible:underline"
                                >
                                  {formatCommentDate(reply.createdAt).relative}
                                </button>
                                <Tooltip className="rounded-xl px-2 py-0.5 text-xs">
                                  {formatCommentDate(reply.createdAt).full}
                                </Tooltip>
                              </TooltipTrigger>
                            </div>

                            {/* Owner Reply Controls */}
                            {isOwner && editingReplyId !== reply.id && (
                              <div className="flex items-center gap-0.5">
                                <TooltipTrigger delay={300}>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => {
                                      setEditingReplyId(reply.id)
                                      setEditReplyText(reply.content)
                                    }}
                                    className="size-5 rounded-lg text-muted-foreground hover:text-foreground"
                                  >
                                    <IconPencil className="size-2.5" />
                                  </Button>
                                  <Tooltip className="rounded-xl text-xs">
                                    Edit reply
                                  </Tooltip>
                                </TooltipTrigger>

                                <TooltipTrigger delay={300}>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => setDeleteReplyTarget(reply)}
                                    className="size-5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <IconTrash className="size-2.5" />
                                  </Button>
                                  <Tooltip className="rounded-xl text-xs">
                                    Delete reply
                                  </Tooltip>
                                </TooltipTrigger>
                              </div>
                            )}
                          </div>

                          {/* Reply Text or Inline Edit */}
                          {isOwner && editingReplyId === reply.id ? (
                            <div className="space-y-1.5 pt-0.5">
                              <Textarea
                                value={editReplyText}
                                onChange={(e) =>
                                  setEditReplyText(e.target.value)
                                }
                                rows={2}
                                className="min-h-[38px] w-full resize-none border-0 bg-transparent p-1 text-xs shadow-none focus-visible:ring-0"
                                disabled={isSavingEditReply}
                                maxLength={5000}
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-1.5 border-t border-border/30 pt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingReplyId(null)
                                    setEditReplyText("")
                                  }}
                                  disabled={isSavingEditReply}
                                  className="h-6 rounded-xl px-2 text-xs"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    handleSaveEditReply(comment.id)
                                  }
                                  disabled={
                                    isSavingEditReply || !editReplyText.trim()
                                  }
                                  className="h-6 gap-1 rounded-xl px-2.5 text-xs shadow-xs"
                                >
                                  {isSavingEditReply ? (
                                    <>
                                      <IconLoader2 className="size-3 animate-spin" />
                                      <span>Saving...</span>
                                    </>
                                  ) : (
                                    <>
                                      <IconCheck className="size-3" />
                                      <span>Save</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground sm:text-sm">
                              {reply.content}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Comments Pagination */}
      {!isLoading && totalComments > 0 && totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(currentPage - 1) * COMMENTS_PER_PAGE + 1}–
              {Math.min(
                (currentPage - 1) * COMMENTS_PER_PAGE + comments.length,
                totalComments
              )}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">{totalComments}</span>{" "}
            comments
          </p>

          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  isDisabled={currentPage <= 1 || isLoading}
                  className={cn(
                    "cursor-pointer",
                    (currentPage <= 1 || isLoading) &&
                    "pointer-events-none opacity-40"
                  )}
                  onPress={() => {
                    if (currentPage > 1 && !isLoading) {
                      navigateToPage(currentPage - 1)
                    }
                  }}
                />
              </PaginationItem>

              {paginationPages.map((page, idx) => (
                <PaginationItem
                  key={page === "ellipsis" ? `ellipsis-${idx}` : page}
                >
                  {page === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      isActive={page === currentPage}
                      isDisabled={isLoading}
                      className={cn(
                        "cursor-pointer",
                        page === currentPage &&
                        "border-primary/40 font-semibold text-primary"
                      )}
                      onPress={() => {
                        if (!isLoading && page !== currentPage) {
                          navigateToPage(page)
                        }
                      }}
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  isDisabled={currentPage >= totalPages || isLoading}
                  className={cn(
                    "cursor-pointer",
                    (currentPage >= totalPages || isLoading) &&
                    "pointer-events-none opacity-40"
                  )}
                  onPress={() => {
                    if (currentPage < totalPages && !isLoading) {
                      navigateToPage(currentPage + 1)
                    }
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* 4. Delete Comment Confirmation Dialog */}
      <Dialog
        isOpen={Boolean(deleteCommentTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteCommentTarget(null)
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
            <IconTrash className="size-4" />
            Delete Comment
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to delete this comment? Deleting the comment
            will also permanently remove any owner replies attached to it, and a
            notification will be sent to the commentator informing them their
            comment was removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteCommentTarget(null)}
            disabled={isDeletingComment}
            className="rounded-2xl text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirmDeleteComment}
            disabled={isDeletingComment}
            className="rounded-2xl text-xs shadow-xs"
          >
            {isDeletingComment ? (
              <>
                <IconLoader2 className="size-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Comment</span>
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 5. Delete Reply Confirmation Dialog */}
      <Dialog
        isOpen={Boolean(deleteReplyTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteReplyTarget(null)
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
            <IconTrash className="size-4" />
            Delete Reply
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to delete your reply? You will be able to post
            a new reply to this comment afterward.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteReplyTarget(null)}
            disabled={isDeletingReply}
            className="rounded-2xl text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirmDeleteReply}
            disabled={isDeletingReply}
            className="rounded-2xl text-xs shadow-xs"
          >
            {isDeletingReply ? (
              <>
                <IconLoader2 className="size-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Reply</span>
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
