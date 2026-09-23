"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  IconCornerDownRight,
  IconTrash,
  IconPencil,
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
import { renderBioMarkdown } from "../navigation/settings-tabs/account/profile/markdown-bio-editor"

export interface CommentAuthor {
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

export interface CommentReply {
  id: string
  commentId: string
  authorId: string
  content: string
  createdAt: string | Date
  updatedAt: string | Date
  author: CommentAuthor
}

export interface ProfileCommentItem {
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

export interface UserProfileCommentsProps {
  username: string
  isOwner: boolean
  pageSize?: number
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

export function UserProfileComments({
  username,
  isOwner,
  pageSize = 4,
}: UserProfileCommentsProps): React.JSX.Element {
  const { data: session, status } = useSession()
  const isAuthenticated =
    status === "authenticated" && Boolean(session?.user?.id)

  const [comments, setComments] = useState<ProfileCommentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalComments, setTotalComments] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [commentText, setCommentText] = useState("")
  const [isSpoiler, setIsSpoiler] = useState(false)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(
    new Set()
  )

  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editReplyText, setEditReplyText] = useState("")
  const [isSavingEditReply, setIsSavingEditReply] = useState(false)

  const [deleteCommentTarget, setDeleteCommentTarget] =
    useState<ProfileCommentItem | null>(null)
  const [isDeletingComment, setIsDeletingComment] = useState(false)

  const [deleteReplyTarget, setDeleteReplyTarget] =
    useState<CommentReply | null>(null)
  const [isDeletingReply, setIsDeletingReply] = useState(false)

  const isFetchingRef = useRef(false)

  const fetchComments = useCallback(
    async (pageToFetch: number) => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true

      try {
        const res = await elysia
          .users({ username })
          .comments.get({
            query: {
              page: pageToFetch,
              limit: pageSize,
            },
          })

        if (!res.error && res.data?.success && Array.isArray(res.data.comments)) {
          setComments(res.data.comments as any)
          const pagination = res.data.pagination
          if (pagination) {
            setTotalComments(pagination.total ?? 0)
            setTotalPages(Math.max(1, pagination.totalPages ?? 1))
          }
        }
      } catch (err) {
        console.error("[UserProfileComments] Error fetching comments:", err)
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [username]
  )

  useEffect(() => {
    setIsLoading(true)
    fetchComments(currentPage)
  }, [currentPage, fetchComments])

  const toggleSpoiler = (commentId: string) => {
    setRevealedSpoilers((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  // Rate limiting countdown
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null)
  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRateLimitCountdown = (seconds: number) => {
    if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current)
    setRateLimitSeconds(seconds)
    toast.error(`Please wait ${seconds}s before commenting again.`)

    let remaining = seconds
    rateLimitTimerRef.current = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current)
        setRateLimitSeconds(null)
      } else {
        setRateLimitSeconds(remaining)
      }
    }, 1000)
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !isAuthenticated) return

    if (rateLimitSeconds) {
      toast.error(`Please wait ${rateLimitSeconds}s before commenting again.`)
      return
    }

    setIsSubmittingComment(true)
    try {
      const res = await elysia
        .users({ username })
        .comments.post({
          content: commentText.trim(),
          isSpoiler,
        })

      if (res.status === 429) {
        startRateLimitCountdown(60)
        return
      }

      if (!res.error && res.data?.success) {
        setCommentText("")
        setIsSpoiler(false)
        toast.success("Comment posted!")
        if (currentPage === 1) {
          fetchComments(1)
        } else {
          setCurrentPage(1)
        }
      } else {
        const rawErr = (res.error as any)?.value?.message || (res.error as any)?.message
        toast.error(rawErr || "Failed to post comment.")
      }
    } catch {
      toast.error("Failed to post comment.")
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handlePostReply = async (commentId: string) => {
    if (!replyText.trim()) return
    setIsSubmittingReply(true)
    try {
      const res = await elysia
        .users({ username })
        .comments({ id: commentId })
        .reply.post({ content: replyText.trim() })

      const createdReply = res.data?.reply || res.data?.data
      if (!res.error && res.data?.success && createdReply) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, reply: createdReply as any } : c
          )
        )
        setReplyingToId(null)
        setReplyText("")
        toast.success("Reply posted!")
      } else {
        toast.error("Failed to post reply.")
      }
    } catch {
      toast.error("Failed to post reply.")
    } finally {
      setIsSubmittingReply(false)
    }
  }

  const handleSaveEditReply = async (commentId: string) => {
    if (!editReplyText.trim()) return
    setIsSavingEditReply(true)
    try {
      const res = await elysia
        .users({ username })
        .comments({ id: commentId })
        .reply.put({ content: editReplyText.trim() })

      const updatedReply = res.data?.reply || res.data?.data
      if (!res.error && res.data?.success && updatedReply) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, reply: updatedReply as any } : c
          )
        )
        setEditingReplyId(null)
        setEditReplyText("")
        toast.success("Reply updated!")
      } else {
        toast.error("Failed to update reply.")
      }
    } catch {
      toast.error("Failed to update reply.")
    } finally {
      setIsSavingEditReply(false)
    }
  }

  const handleConfirmDeleteReply = async () => {
    if (!deleteReplyTarget) return
    setIsDeletingReply(true)
    try {
      const res = await elysia
        .users({ username })
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
        toast.error("Failed to delete reply.")
      }
    } catch {
      toast.error("Failed to delete reply.")
    } finally {
      setIsDeletingReply(false)
    }
  }

  const handleConfirmDeleteComment = async () => {
    if (!deleteCommentTarget) return
    setIsDeletingComment(true)
    try {
      const res = await elysia
        .users({ username })
        .comments({ id: deleteCommentTarget.id })
        .delete()

      if (!res.error) {
        toast.success("Comment deleted.")
        setDeleteCommentTarget(null)
        fetchComments(currentPage)
      } else {
        toast.error("Failed to delete comment.")
      }
    } catch {
      toast.error("Failed to delete comment.")
    } finally {
      setIsDeletingComment(false)
    }
  }

  const [isFocused, setIsFocused] = useState(false)
  const isInputActive = isFocused || Boolean(commentText.trim()) || isSpoiler

  return (
    <div className="space-y-4">
      {/* Header & Post Form */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconMessages className="size-4 text-primary" />
            <h3 className="font-heading text-sm font-bold text-foreground">
              Comments
            </h3>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {totalComments} {totalComments === 1 ? "comment" : "comments"}
          </span>
        </div>

        {isAuthenticated ? (
          <form onSubmit={handlePostComment} className="space-y-2.5">
            <Textarea
              placeholder={`Leave a message for @${username}...`}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                if (!commentText.trim() && !isSpoiler) {
                  setIsFocused(false)
                }
              }}
              rows={isInputActive ? 3 : 1}
              className="w-full resize-none border-border/60 bg-muted/20 text-xs shadow-none placeholder:text-muted-foreground/60 transition-all duration-200"
              maxLength={5000}
              disabled={isSubmittingComment}
            />

            {isInputActive && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 animate-in fade-in-50 duration-200">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground select-none hover:text-foreground">
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
                    <span className={cn(isSpoiler && "font-semibold text-destructive")}>
                      Mark as spoiler
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCommentText("")
                      setIsSpoiler(false)
                      setIsFocused(false)
                    }}
                    disabled={isSubmittingComment}
                    className="h-7 cursor-pointer rounded-xl px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    variant="default"
                    size="sm"
                    disabled={isSubmittingComment || !commentText.trim() || Boolean(rateLimitSeconds)}
                    className="h-7 cursor-pointer gap-1.5 rounded-xl px-3 text-xs shadow-xs"
                  >
                    {isSubmittingComment ? (
                      <>
                        <IconLoader2 className="size-3.5 animate-spin" />
                        <span>Posting...</span>
                      </>
                    ) : rateLimitSeconds ? (
                      <>
                        <IconClock className="size-3.5 animate-pulse" />
                        <span>Wait {rateLimitSeconds}s</span>
                      </>
                    ) : (
                      <>
                        <IconSend className="size-3.5" />
                        <span>Post Comment</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-3 text-xs text-muted-foreground">
            <IconLock className="size-3.5" />
            <span>Sign in to leave a message on @{username}&apos;s profile.</span>
          </div>
        )}
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse items-start gap-3 rounded-2xl border border-border/40 bg-card/30 p-4">
              <div className="size-9 shrink-0 rounded-full bg-muted/70" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-muted/60" />
                <div className="h-3 w-3/4 rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/60 bg-card/20 py-8 text-center">
          <IconMessages className="size-6 text-muted-foreground/40" />
          <p className="text-xs font-medium text-muted-foreground">
            No comments yet. Be the first to say hello!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isRevealed = revealedSpoilers.has(comment.id)
            const commentDate = formatCommentDate(comment.createdAt)
            const authorStyle = getDisplayNameStyleCss(comment.author.displayNameStyle ?? undefined)
            const authorEffect = getDisplayNameEffectClasses(comment.author.displayNameStyle?.effect ?? undefined)
            const authorName = comment.author.displayName || comment.author.username
            const authorInitial = authorName.charAt(0).toUpperCase()
            const hasAuthorFrame = isValidFrameUrl(comment.author.avatarFrame)
            const isCommentAuthor = session?.user?.id === comment.authorId
            const canDeleteComment = isOwner || isCommentAuthor

            const reply = comment.reply
            const replyDate = reply ? formatCommentDate(reply.createdAt) : null
            const replyAuthorName = reply ? (reply.author.displayName || reply.author.username) : ""

            return (
              <div
                key={comment.id}
                className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-4 shadow-xs"
              >
                {/* Comment author info row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Link
                      href={`/IRIS-account/users/${comment.author.username}`}
                      className="group relative flex shrink-0 cursor-pointer items-center justify-center rounded-full"
                    >
                      <Avatar className="size-9 border border-border/60">
                        {comment.author.avatarUrl ? (
                          <AvatarImage src={comment.author.avatarUrl} alt={authorName} />
                        ) : null}
                        <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary uppercase">
                          {authorInitial}
                        </AvatarFallback>
                      </Avatar>
                      {hasAuthorFrame && (
                        <div className="pointer-events-none absolute -inset-1 z-10 size-11 max-w-none select-none">
                          <Image
                            src={comment.author.avatarFrame!}
                            alt="Frame"
                            fill
                            sizes="44px"
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                      )}
                    </Link>

                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/IRIS-account/users/${comment.author.username}`}
                          className={cn("text-xs font-bold hover:underline", authorEffect)}
                          style={authorStyle}
                        >
                          {authorName}
                        </Link>
                        {comment.author.username.toLowerCase() === username.toLowerCase() && (
                          <Badge className="h-4 gap-0.5 border-amber-500/30 bg-amber-500/10 px-1 text-[8px] font-bold text-amber-400">
                            <IconCrown className="size-2.5" />
                            <span>Owner</span>
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground" title={commentDate.full}>
                          • {commentDate.relative}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        @{comment.author.username}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Delete for owner/author) */}
                  {canDeleteComment && (
                    <button
                      type="button"
                      onClick={() => setDeleteCommentTarget(comment)}
                      className="cursor-pointer text-muted-foreground opacity-60 transition-opacity hover:text-destructive hover:opacity-100"
                      title="Delete comment"
                    >
                      <IconTrash className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Comment body */}
                <div className="mt-2.5 pl-12 text-xs leading-relaxed text-foreground">
                  {comment.isSpoiler && !isRevealed ? (
                    <div
                      onClick={() => toggleSpoiler(comment.id)}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15 select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <IconEyeOff className="size-3.5" />
                        <span>Spoiler warning: Click to reveal message</span>
                      </div>
                      <span className="text-[10px] underline">Reveal</span>
                    </div>
                  ) : (
                    <div>
                      {renderBioMarkdown(comment.content, "")}
                      {comment.isSpoiler && (
                        <button
                          type="button"
                          onClick={() => toggleSpoiler(comment.id)}
                          className="mt-1.5 flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          <IconEye className="size-3" />
                          <span>Hide spoiler</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Owner Reply Section */}
                {reply ? (
                  <div className="mt-3 ml-8 rounded-xl border border-border/40 bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <IconCornerDownRight className="size-3.5 text-primary" />
                        <span className="text-xs font-bold text-foreground">
                          {replyAuthorName}
                        </span>
                        <Badge className="h-3.5 border-amber-500/30 bg-amber-500/10 px-1 text-[8px] font-bold text-amber-400">
                          Owner Reply
                        </Badge>
                        <span className="text-[10px] text-muted-foreground" title={replyDate?.full}>
                          • {replyDate?.relative}
                        </span>
                      </div>

                      {isOwner && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReplyId(reply.id)
                              setEditReplyText(reply.content)
                            }}
                            className="cursor-pointer text-muted-foreground hover:text-foreground"
                            title="Edit reply"
                          >
                            <IconPencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteReplyTarget(reply)}
                            className="cursor-pointer text-muted-foreground hover:text-destructive"
                            title="Delete reply"
                          >
                            <IconTrash className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {editingReplyId === reply.id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editReplyText}
                          onChange={(e) => setEditReplyText(e.target.value)}
                          rows={2}
                          className="min-h-[40px] text-xs"
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingReplyId(null)}
                            className="h-6 text-[10px]"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            disabled={isSavingEditReply || !editReplyText.trim()}
                            onClick={() => handleSaveEditReply(comment.id)}
                            className="h-6 text-[10px]"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-xs text-foreground">
                        {renderBioMarkdown(reply.content, "")}
                      </div>
                    )}
                  </div>
                ) : isOwner && replyingToId !== comment.id ? (
                  <div className="mt-2 pl-12">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingToId(comment.id)
                        setReplyText("")
                      }}
                      className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <IconCornerDownRight className="size-3" />
                      <span>Reply to comment</span>
                    </button>
                  </div>
                ) : isOwner && replyingToId === comment.id ? (
                  <div className="mt-3 ml-8 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <Textarea
                      placeholder="Write your reply as profile owner..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      className="min-h-[44px] text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReplyingToId(null)}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isSubmittingReply || !replyText.trim()}
                        onClick={() => handlePostReply(comment.id)}
                        className="h-7 gap-1 text-xs"
                      >
                        <IconSend className="size-3" />
                        <span>Reply</span>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      isDisabled={currentPage <= 1}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={currentPage === p}
                        onPress={() => setCurrentPage(p)}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      isDisabled={currentPage >= totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}

      {/* Delete Comment Confirmation Dialog */}
      <Dialog
        isOpen={Boolean(deleteCommentTarget)}
        onOpenChange={(open) => !open && setDeleteCommentTarget(null)}
        className="rounded-3xl border border-border/80 bg-background/95 p-4 backdrop-blur-xl sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Delete Comment</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to delete this comment? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteCommentTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isDeletingComment}
            onClick={handleConfirmDeleteComment}
          >
            {isDeletingComment ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete Reply Confirmation Dialog */}
      <Dialog
        isOpen={Boolean(deleteReplyTarget)}
        onOpenChange={(open) => !open && setDeleteReplyTarget(null)}
        className="rounded-3xl border border-border/80 bg-background/95 p-4 backdrop-blur-xl sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Delete Reply</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to remove your reply?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteReplyTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isDeletingReply}
            onClick={handleConfirmDeleteReply}
          >
            {isDeletingReply ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
