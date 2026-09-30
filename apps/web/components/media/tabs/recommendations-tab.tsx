"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import Image from "next/image"
import { useSession, signIn } from "next-auth/react"
import { elysia } from "@/lib/elysia"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import {
  IconSparkles,
  IconSend,
  IconUsers,
  IconSearch,
  IconSquare,
  IconSquareCheck,
  IconCheck,
  IconLock,
  IconX,
  IconStar,
  IconPlayerPlay,
} from "@tabler/icons-react"
import {
  getProfileCustomization,
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
} from "@IRIS/shared"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"
import type { NormalizedMediaData } from "../media-types"

export interface RecommendationsMediaTabProps {
  media: NormalizedMediaData
}

interface FriendItem {
  id: string
  friendId: string
  nickname: string | null
  user: {
    id: string
    username: string
    customization: any
  }
}

export function RecommendationsMediaTab({
  media,
}: RecommendationsMediaTabProps): React.JSX.Element {
  const { data: session, status: authStatus } = useSession()
  const isAuthenticated = authStatus === "authenticated" && Boolean(session?.user?.id)

  const [modalOpen, setModalOpen] = useState(false)
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [isLoadingFriends, setIsLoadingFriends] = useState(false)
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [searchFriendQuery, setSearchFriendQuery] = useState("")
  const [recommendMessage, setRecommendMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Fetch friends when modal opens
  const fetchFriends = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoadingFriends(true)
    try {
      const res = await elysia.friends.get()
      if (!res.error && res.data?.success) {
        setFriends(res.data.friends || [])
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingFriends(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (modalOpen && isAuthenticated) {
      fetchFriends()
    }
  }, [modalOpen, isAuthenticated, fetchFriends])

  const filteredFriends = useMemo(() => {
    if (!searchFriendQuery.trim()) return friends
    const q = searchFriendQuery.toLowerCase()
    return friends.filter(
      (f) =>
        f.user.username.toLowerCase().includes(q) ||
        (f.nickname && f.nickname.toLowerCase().includes(q)) ||
        (f.user.customization?.displayName &&
          String(f.user.customization.displayName).toLowerCase().includes(q))
    )
  }, [friends, searchFriendQuery])

  const handleToggleSelectFriend = (friendId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    )
  }

  const handleSelectAll = () => {
    setSelectedFriendIds(filteredFriends.map((f) => f.friendId))
  }

  const handleClearAll = () => {
    setSelectedFriendIds([])
  }

  const handleSendRecommendation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFriendIds.length === 0) {
      toast.error("Please select at least one friend.")
      return
    }

    setIsSending(true)
    try {
      const res = await elysia.friends.recommend.post({
        friendIds: selectedFriendIds,
        mediaType: media.category,
        mediaId: media.id,
        mediaTitle: media.titlePrimary,
        mediaCover: media.coverImage || undefined,
        message: recommendMessage.trim() || undefined,
      })

      if (!res.error && res.data?.success) {
        toast.success(res.data.message || "Recommendation sent successfully!")
        setModalOpen(false)
        setSelectedFriendIds([])
        setRecommendMessage("")
      } else {
        const err = (res.error as any)?.value?.message || "Failed to send recommendation"
        toast.error(err)
      }
    } catch {
      toast.error("Failed to send recommendation.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Action Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-linear-to-r from-primary/10 via-card/70 to-card/40 p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <IconSparkles className="size-5 text-primary" />
            <h3 className="font-heading text-base font-bold text-foreground">
              Recommend to Friends
            </h3>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">
            Share &ldquo;{media.titlePrimary}&rdquo; directly with your friends. We&apos;ll notify them with your personal score, progress, and thoughts!
          </p>
        </div>

        <Button
          onClick={() => {
            if (!isAuthenticated) {
              toast.error("Please log in to recommend titles to friends.")
              signIn()
              return
            }
            setModalOpen(true)
          }}
          className="cursor-pointer gap-2 rounded-xl font-bold shadow-xs transition-all hover:scale-[1.02] sm:shrink-0"
        >
          <IconSend className="size-4" />
          <span>Recommend to a Friend</span>
        </Button>
      </div>

      {/* Community Recommendations Section */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/20 p-12 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
          <IconSparkles className="size-6" />
        </div>
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Community Recommendations
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Cross-media recommendations and user-voted pairings will appear here.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* RECOMMEND TO A FRIEND DIALOG                                              */}
      {/* ========================================================================= */}
      {modalOpen && (
        <Dialog
          isOpen={modalOpen}
          onOpenChange={setModalOpen}
          className="max-w-lg rounded-3xl p-0 overflow-hidden"
        >
          <header className="border-b border-border/60 bg-card/60 p-5 pe-12 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                  <IconSend className="size-4.5" />
                </div>
                <div>
                  <DialogTitle className="font-heading text-base font-bold text-foreground">
                    Recommend to Friends
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                    {media.titlePrimary}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </header>

          <form onSubmit={handleSendRecommendation} className="p-5 space-y-4">
            {/* Friends Selector Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <IconUsers className="size-3.5 text-primary" />
                  <span>Select Friends</span>
                  {selectedFriendIds.length > 0 && (
                    <Badge variant="default" className="h-4 px-1.5 text-[10px] font-bold">
                      {selectedFriendIds.length} selected
                    </Badge>
                  )}
                </label>

                {friends.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="cursor-pointer text-primary hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-muted-foreground/40">•</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Friend Filter Search */}
              {friends.length > 4 && (
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute start-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search friends..."
                    value={searchFriendQuery}
                    onChange={(e) => setSearchFriendQuery(e.target.value)}
                    className="h-7.5 rounded-xl bg-background/80 ps-7 text-xs"
                  />
                </div>
              )}

              {/* Friends Checkable List */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl border border-border/60 bg-muted/20 p-2 scrollbar-none">
                {isLoadingFriends ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Loading friends...
                  </div>
                ) : friends.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    You haven&apos;t added any friends yet.
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    No friends matching &ldquo;{searchFriendQuery}&rdquo;.
                  </div>
                ) : (
                  filteredFriends.map((f) => {
                    const isSelected = selectedFriendIds.includes(f.friendId)
                    const profile = getProfileCustomization(f.user.customization)
                    const nameToShow = profile.displayName || f.user.username

                    return (
                      <button
                        key={f.friendId}
                        type="button"
                        onClick={() => handleToggleSelectFriend(f.friendId)}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl p-2 text-start transition-colors",
                          isSelected
                            ? "border border-primary/40 bg-primary/15 font-semibold text-primary"
                            : "border border-border/40 bg-card/60 text-foreground hover:bg-card hover:border-border"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border bg-card">
                            {profile.avatarUrl ? (
                              <Image
                                src={profile.avatarUrl}
                                alt={nameToShow}
                                fill
                                sizes="32px"
                                unoptimized
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center bg-primary/15 text-[10px] font-bold text-primary uppercase">
                                {nameToShow.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold leading-tight">
                              {nameToShow}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground leading-tight">
                              @{f.user.username} {f.nickname && `• ${f.nickname}`}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <IconSquareCheck className="size-4.5 text-primary" />
                          ) : (
                            <IconSquare className="size-4.5 text-muted-foreground/50" />
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Optional message input (max 250 chars) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-foreground">
                  Personal Message (Optional)
                </label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {recommendMessage.length}/250
                </span>
              </div>
              <textarea
                maxLength={250}
                rows={3}
                placeholder="Why do you recommend this title? (e.g. Amazing soundtrack and emotional story arc!)"
                value={recommendMessage}
                onChange={(e) => setRecommendMessage(e.target.value.slice(0, 250))}
                className="w-full rounded-2xl border border-border bg-background p-3 text-xs outline-hidden focus:border-primary/60 focus:ring-1 focus:ring-primary/40 resize-none"
              />
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="cursor-pointer rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSending || selectedFriendIds.length === 0}
                className="cursor-pointer rounded-xl font-bold text-xs"
              >
                <IconSend className="mr-1.5 size-3.5" />
                <span>
                  {isSending
                    ? "Sending..."
                    : `Send to ${selectedFriendIds.length} friend${selectedFriendIds.length === 1 ? "" : "s"}`}
                </span>
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  )
}
