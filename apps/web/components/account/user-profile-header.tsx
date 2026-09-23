"use client"

import React, { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSession } from "next-auth/react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  IconCake,
  IconMapPin,
  IconClock,
  IconWorld,
  IconSparkles,
  IconPencil,
  IconShare,
  IconCheck,
  IconCopy,
  IconLink,
  IconUserPlus,
  IconUserCheck,
  IconTrash,
  IconSend,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  getBadgeById,
  type UserProfileCustomization,
} from "@IRIS/shared"
import {
  SocialFaviconIcon,
  getDomainFromUrl,
} from "../navigation/settings-tabs/account/profile/social-links-card"
import { renderBadgeIcon } from "../navigation/settings-tabs/account/profile/badge-showcase-card"
import { ProviderIcon } from "../navigation/settings-tabs/account/connections/icons"
import { cn } from "@workspace/ui/lib/utils"

export interface UserProfileHeaderProps {
  username: string
  profile: UserProfileCustomization
  createdAt?: string
  isOwner: boolean
  connections?: any[]
  onEditProfile?: () => void
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

export function UserProfileHeader({
  username,
  profile,
  createdAt,
  isOwner,
  connections = [],
  onEditProfile,
}: UserProfileHeaderProps): React.JSX.Element {
  const { data: session } = useSession()
  const [copied, setCopied] = useState(false)

  // Friend status state for non-owner viewing
  const [friendStatus, setFriendStatus] = useState<{
    isFriend: boolean
    isPendingIncoming: boolean
    isPendingOutgoing: boolean
    isBlocked: boolean
    isBlockedBy: boolean
    friendId?: string | null
    nickname?: string | null
    requestId?: string | null
  } | null>(null)
  const [isFriendActionLoading, setIsFriendActionLoading] = useState(false)

  // Add friend dialog state
  const [addFriendDialogOpen, setAddFriendDialogOpen] = useState(false)
  const [addFriendMessage, setAddFriendMessage] = useState("")
  const [isSendingRequest, setIsSendingRequest] = useState(false)

  // Edit nickname dialog state
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false)
  const [nicknameInput, setNicknameInput] = useState("")
  const [isSavingNickname, setIsSavingNickname] = useState(false)

  const fetchFriendStatus = React.useCallback(async () => {
    if (isOwner || !session?.user) return
    try {
      const res = await elysia.friends.status({ username }).get()
      if (!res.error && res.data?.success) {
        setFriendStatus(res.data)
      }
    } catch {
      // Ignore
    }
  }, [isOwner, session?.user, username])

  React.useEffect(() => {
    fetchFriendStatus()
  }, [fetchFriendStatus])

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user) {
      toast.error("Please log in to send a friend request.")
      return
    }
    setIsSendingRequest(true)
    try {
      const res = await elysia.friends.request.post({
        targetUsername: username,
        message: addFriendMessage.trim() || undefined,
      })
      if (!res.error && res.data?.success) {
        toast.success(res.data.message || `Friend request sent to @${username}!`)
        setAddFriendDialogOpen(false)
        setAddFriendMessage("")
        fetchFriendStatus()
      } else {
        const errorMsg = (res.error as any)?.value?.message || "Failed to send friend request."
        toast.error(errorMsg)
      }
    } catch {
      toast.error("Failed to send friend request.")
    } finally {
      setIsSendingRequest(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!friendStatus?.requestId) return
    setIsFriendActionLoading(true)
    try {
      const res = await elysia.friends.requests({ id: friendStatus.requestId }).delete()
      if (!res.error) {
        toast.success("Friend request cancelled.")
        fetchFriendStatus()
      } else {
        toast.error("Failed to cancel request.")
      }
    } catch {
      toast.error("Failed to cancel request.")
    } finally {
      setIsFriendActionLoading(false)
    }
  }

  const handleAcceptRequest = async () => {
    if (!friendStatus?.requestId) return
    setIsFriendActionLoading(true)
    try {
      const res = await elysia.friends.requests({ id: friendStatus.requestId }).respond.post({
        action: "ACCEPT",
      })
      if (!res.error) {
        toast.success(res.data?.message || "Friend request accepted!")
        fetchFriendStatus()
      } else {
        toast.error("Failed to accept request.")
      }
    } catch {
      toast.error("Failed to accept request.")
    } finally {
      setIsFriendActionLoading(false)
    }
  }

  const handleRemoveFriend = async () => {
    if (!friendStatus?.friendId) return
    setIsFriendActionLoading(true)
    try {
      const res = await elysia.friends({ id: friendStatus.friendId }).delete()
      if (!res.error) {
        toast.success(`Removed @${username} from friends.`)
        fetchFriendStatus()
      } else {
        toast.error("Failed to remove friend.")
      }
    } catch {
      toast.error("Failed to remove friend.")
    } finally {
      setIsFriendActionLoading(false)
    }
  }

  const handleSaveNickname = async () => {
    if (!friendStatus?.friendId) return
    setIsSavingNickname(true)
    const newNick = nicknameInput.trim() || null
    try {
      const res = await elysia.friends({ id: friendStatus.friendId }).patch({
        nickname: newNick,
      })
      if (!res.error) {
        toast.success(newNick ? `Nickname set to "${newNick}"` : "Nickname cleared.")
        setNicknameDialogOpen(false)
        fetchFriendStatus()
      } else {
        toast.error("Failed to update nickname.")
      }
    } catch {
      toast.error("Failed to update nickname.")
    } finally {
      setIsSavingNickname(false)
    }
  }

  const nameToShow = profile.displayName || username
  const initial = nameToShow.charAt(0).toUpperCase()
  const nameStyle = getDisplayNameStyleCss(profile.displayNameStyle)
  const nameEffect = getDisplayNameEffectClasses(
    profile.displayNameStyle?.effect
  )
  const hasValidFrame = isValidFrameUrl(profile.avatarFrame)

  const customAccentColor = profile.accentColor

  const formattedJoinDate = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
      })
    : null

  // Birthday formatting
  const formattedBirthday = profile.birthday
    ? (() => {
        try {
          const parts = profile.birthday.split("-")
          if (parts.length === 3) {
            const year = parts[0] || "2000"
            const month = parseInt(parts[1] || "1", 10)
            const day = parseInt(parts[2] || "1", 10)
            const dateObj = new Date(parseInt(year, 10), month - 1, day)
            return dateObj.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: profile.showBirthdayYear ? "numeric" : undefined,
            })
          }
          return profile.birthday
        } catch {
          return profile.birthday
        }
      })()
    : null

  const isBirthdayVisible =
    Boolean(formattedBirthday) &&
    (profile.privacy?.showBirthday === "public" ||
      (profile.privacy?.showBirthday === "friends" && !isOwner) ||
      isOwner)

  const isLocationVisible =
    Boolean(profile.location) &&
    (profile.privacy?.showLocation === "public" ||
      (profile.privacy?.showLocation === "friends" && !isOwner) ||
      isOwner)

  const handleShare = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        toast.success("Profile link copied to clipboard")
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      toast.error("Failed to copy profile link")
    }
  }

  return (
    <div className="relative w-full border-b border-border/60 bg-card/20">
      {/* Centered Constrained Container keeping 16:5.5 Ratio Scaled Down */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* 1. Hero Banner with exact 16:5.5 Aspect Ratio */}
        <div
          className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-border/60 bg-linear-to-r from-primary/30 via-primary/10 to-muted/50 shadow-md min-h-[120px] sm:min-h-[220px]"
          style={{ aspectRatio: "16 / 5.5" }}
        >
          {profile.bannerUrl ? (
            <Image
              src={profile.bannerUrl}
              alt="Profile Banner"
              fill
              sizes="(max-width: 1280px) 100vw, 1280px"
              priority
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-end bg-gradient-to-br from-card via-background to-muted/30 pr-8 select-none">
              <span className="font-heading text-7xl md:text-8xl font-black tracking-tighter opacity-15">
                IRIS
              </span>
            </div>
          )}

          {/* Custom Transparent Banner Overlay Asset */}
          {profile.bannerOverlayUrl && (
            <div className="pointer-events-none absolute inset-0 z-1 select-none">
              <Image
                src={profile.bannerOverlayUrl}
                alt="Banner Overlay"
                fill
                sizes="(max-width: 1280px) 100vw, 1280px"
                priority
                unoptimized
                className="object-cover"
              />
            </div>
          )}

          {/* Dynamic bottom gradient fade */}
          <div className="absolute inset-0 z-2 bg-gradient-to-t from-background/70 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* 2. Profile Details Bar */}
        <div className="relative z-10 w-full px-1 pb-6 sm:px-2">
          {/* Top Floating Row: Avatar on Left, Action Toolbar on Right */}
          <div className="-mt-10 sm:-mt-12 flex flex-wrap items-end justify-between gap-4 pb-4">
            {/* Avatar + Frame + Status Speech Bubble */}
            <div className="flex items-end gap-3 sm:gap-4">
              <div className="relative size-20 sm:size-24 shrink-0">
                {/* Avatar Circle Container */}
                <div className="relative size-full overflow-hidden rounded-full border-3 border-background bg-card shadow-2xl ring-1 ring-border/50">
                  {profile.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt={nameToShow}
                      fill
                      sizes="(max-width: 640px) 80px, 96px"
                      priority
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-primary/15 font-heading text-xl sm:text-2xl font-black text-primary uppercase select-none">
                      {initial}
                    </div>
                  )}
                </div>

                {/* Avatar Decoration Frame */}
                {hasValidFrame && (
                  <div
                    className="pointer-events-none absolute z-20 select-none"
                    style={{
                      width: "130%",
                      height: "130%",
                      top: "-15%",
                      left: "-15%",
                    }}
                  >
                    <Image
                      src={profile.avatarFrame!}
                      alt="Avatar Frame"
                      fill
                      sizes="(max-width: 640px) 104px, 125px"
                      unoptimized
                      priority
                      className="size-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Status text speech bubble */}
              {profile.statusText && (
                <div className="hidden sm:flex mb-1.5 max-w-sm items-center">
                  <div className="flex shrink-0 items-center gap-0.5 pe-1.5 select-none">
                    <span className="size-1 rounded-full bg-border" />
                    <span className="size-1.5 rounded-full bg-border/90" />
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md">
                    {profile.statusText}
                  </div>
                </div>
              )}
            </div>

          {/* Action Toolbar on Right */}
          <div className="flex items-center gap-2 pb-1">
            {isOwner ? (
              onEditProfile && (
                <Button
                  size="sm"
                  onClick={onEditProfile}
                  className="cursor-pointer gap-1.5 rounded-xl font-bold shadow-xs transition-all hover:scale-[1.02]"
                >
                  <IconPencil className="size-4" />
                  <span>Edit Profile</span>
                </Button>
              )
            ) : (
              /* Non-owner: Friend Action Button */
              <>
                {friendStatus?.isFriend ? (
                  <DropdownMenuTrigger>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="cursor-pointer gap-1.5 rounded-xl border border-primary/30 bg-primary/10 font-bold text-primary shadow-xs transition-all hover:bg-primary/20"
                    >
                      <IconUserCheck className="size-4" />
                      <span>{friendStatus.nickname ? `Friends (${friendStatus.nickname})` : "Friends"}</span>
                    </Button>
                    <DropdownMenu placement="bottom end" className="w-44 rounded-xl p-1">
                      <DropdownMenuItem
                        onAction={() => {
                          setNicknameInput(friendStatus.nickname || "")
                          setNicknameDialogOpen(true)
                        }}
                        className="cursor-pointer gap-2"
                      >
                        <IconPencil className="size-3.5" />
                        <span>{friendStatus.nickname ? "Edit Nickname" : "Add Nickname"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onAction={handleRemoveFriend}
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                      >
                        <IconTrash className="size-3.5" />
                        <span>Remove Friend</span>
                      </DropdownMenuItem>
                    </DropdownMenu>
                  </DropdownMenuTrigger>
                ) : friendStatus?.isPendingOutgoing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isFriendActionLoading}
                    onClick={handleCancelRequest}
                    className="cursor-pointer gap-1.5 rounded-xl border-amber-500/30 bg-amber-500/10 font-semibold text-amber-500 shadow-2xs hover:bg-amber-500/20"
                  >
                    <IconClock className="size-4" />
                    <span>Request Sent</span>
                  </Button>
                ) : friendStatus?.isPendingIncoming ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      disabled={isFriendActionLoading}
                      onClick={handleAcceptRequest}
                      className="cursor-pointer gap-1.5 rounded-xl font-bold shadow-xs"
                    >
                      <IconCheck className="size-4" />
                      <span>Accept Request</span>
                    </Button>
                  </div>
                ) : friendStatus?.isBlocked ? (
                  <Badge variant="destructive" className="rounded-xl px-2.5 py-1 text-xs">
                    Blocked
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!session?.user) {
                        toast.error("Please log in to send friend requests.")
                        return
                      }
                      setAddFriendDialogOpen(true)
                    }}
                    className="cursor-pointer gap-1.5 rounded-xl font-bold shadow-xs transition-all hover:scale-[1.02]"
                  >
                    <IconUserPlus className="size-4" />
                    <span>Add Friend</span>
                  </Button>
                )}
              </>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="cursor-pointer gap-1.5 rounded-xl border-border/70 bg-card/60 backdrop-blur-xs transition-all hover:bg-muted/80 shadow-2xs"
            >
              {copied ? (
                <>
                  <IconCheck className="size-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <IconShare className="size-4" />
                  <span>Share</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Status Text */}
        {profile.statusText && (
          <div className="sm:hidden mb-3">
            <div className="inline-block rounded-xl border border-border/70 bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md">
              {profile.statusText}
            </div>
          </div>
        )}

        {/* 2-Column Responsive Information Row */}
        <div className="flex flex-col gap-4 pt-1 lg:flex-row lg:items-end lg:justify-between">
          {/* Left Column: Identity & Metadata Badges */}
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className={cn(
                  "font-heading text-2xl sm:text-3xl font-bold tracking-tight",
                  nameEffect
                )}
                style={nameStyle}
              >
                {nameToShow}
              </h1>

              {profile.pronouns && (
                <Badge
                  variant="secondary"
                  className="rounded-xl px-2.5 py-0.5 text-xs font-medium"
                >
                  {profile.pronouns}
                </Badge>
              )}

              <span className="font-mono text-sm font-medium text-muted-foreground">
                @{username}
              </span>
            </div>

            {/* Quick Metadata Chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {isLocationVisible && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-medium">
                  <IconMapPin className="size-3.5 text-emerald-400" />
                  <span>{profile.location}</span>
                </div>
              )}

              {isBirthdayVisible && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-medium">
                  <IconCake className="size-3.5 text-rose-400" />
                  <span>{formattedBirthday}</span>
                </div>
              )}

              {profile.timezone && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-medium">
                  <IconClock className="size-3.5 text-indigo-400" />
                  <span>{profile.timezone}</span>
                </div>
              )}

              {formattedJoinDate && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 font-medium">
                  <span className="size-1.5 rounded-full bg-primary/70" />
                  <span>Joined {formattedJoinDate}</span>
                </div>
              )}

              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1 font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <IconWorld className="size-3.5" />
                  <span className="max-w-[180px] truncate">
                    {profile.website.replace(/^https?:\/\//, "")}
                  </span>
                </a>
              )}
            </div>

            {/* Showcased Badges Strip (Up to 10 badges) */}
            {profile.showcaseBadgeIds && profile.showcaseBadgeIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {profile.showcaseBadgeIds.slice(0, 10).map((id) => {
                  const badge = getBadgeById(id)
                  if (!badge) return null
                  return (
                    <TooltipTrigger key={badge.id} delay={150}>
                      <button
                        type="button"
                        aria-label={badge.name}
                        className="group relative flex size-7.5 shrink-0 items-center justify-center rounded-xl border bg-card/80 shadow-2xs backdrop-blur-xs transition-all duration-200 hover:scale-110 cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        style={{
                          borderColor: `${badge.color}60`,
                          backgroundColor: `${badge.color}15`,
                          color: badge.color,
                        }}
                      >
                        {renderBadgeIcon(badge.icon, "size-4")}
                      </button>
                      <Tooltip className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-popover px-2.5 py-1.5 text-start shadow-xl backdrop-blur-md">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: badge.color }}
                          />
                          <span className="text-xs font-bold text-popover-foreground">
                            {badge.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {badge.description}
                        </span>
                      </Tooltip>
                    </TooltipTrigger>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column: Social Links & Connected Services */}
          <div className="flex flex-col items-start gap-2.5 lg:items-end">
            {/* Social Links Pill Bar */}
            {profile.socialLinks && profile.socialLinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {profile.socialLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary shadow-2xs backdrop-blur-xs"
                  >
                    <SocialFaviconIcon url={link.url} className="size-3.5" />
                    <span className="max-w-[130px] truncate">
                      {link.label || getDomainFromUrl(link.url)}
                    </span>
                  </a>
                ))}
              </div>
            )}

            {/* Connected Services Quick Preview */}
            {connections && connections.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
                <span className="text-[11px] font-medium me-1 shrink-0">Connected:</span>
                <div className="flex max-w-[270px] items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                  {connections.map((conn) => {
                    const content = (
                      <div
                        title={`${conn.provider}: ${conn.displayName || "Account"}`}
                        className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-card p-0.5 shadow-2xs transition-all hover:scale-110 hover:border-primary/50"
                      >
                        <ProviderIcon provider={conn.provider} iconUrl={conn.iconUrl} className="size-3.5" />
                      </div>
                    )

                    return conn.profileUrl ? (
                      <a
                        key={conn.id}
                        href={conn.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 cursor-pointer"
                      >
                        {content}
                      </a>
                    ) : (
                      <div key={conn.id} className="shrink-0">
                        {content}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ========================================================================= */}
    {/* 3. ADD FRIEND DIALOG                                                      */}
    {/* ========================================================================= */}
    {addFriendDialogOpen && (
      <Dialog
        isOpen={addFriendDialogOpen}
        onOpenChange={setAddFriendDialogOpen}
        className="max-w-md rounded-2xl p-6"
      >
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
          <DialogDescription>
            Send a friend request to @{username} ({nameToShow}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSendFriendRequest} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-foreground">
                Optional Message
              </label>
              <span className="font-mono text-[10px] text-muted-foreground">
                {addFriendMessage.length}/50
              </span>
            </div>
            <Input
              type="text"
              maxLength={50}
              placeholder="Say hello (max 50 chars)..."
              value={addFriendMessage}
              onChange={(e) => setAddFriendMessage(e.target.value.slice(0, 50))}
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddFriendDialogOpen(false)}
              className="cursor-pointer rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSendingRequest}
              className="cursor-pointer rounded-xl text-xs font-bold"
            >
              <IconSend className="mr-1.5 size-3.5" />
              <span>{isSendingRequest ? "Sending..." : "Send Request"}</span>
            </Button>
          </div>
        </form>
      </Dialog>
    )}

    {/* ========================================================================= */}
    {/* 4. EDIT NICKNAME DIALOG                                                   */}
    {/* ========================================================================= */}
    {nicknameDialogOpen && (
      <Dialog
        isOpen={nicknameDialogOpen}
        onOpenChange={setNicknameDialogOpen}
        className="max-w-md rounded-2xl p-6"
      >
        <DialogHeader>
          <DialogTitle>Friend Nickname</DialogTitle>
          <DialogDescription>
            Assign a private custom nickname for @{username}. Only you will see this.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Input
            type="text"
            maxLength={30}
            placeholder="e.g. Bestie, Anime Buddy"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            className="h-9 rounded-xl text-xs"
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNicknameDialogOpen(false)}
              className="cursor-pointer rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSavingNickname}
              onClick={handleSaveNickname}
              className="cursor-pointer rounded-xl text-xs font-bold"
            >
              Save Nickname
            </Button>
          </div>
        </div>
      </Dialog>
    )}
  </div>
  )
}
