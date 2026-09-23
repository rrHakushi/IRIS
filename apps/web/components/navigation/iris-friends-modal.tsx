"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@workspace/ui/components/dropdown-menu"
import {
  IconUsers,
  IconUserPlus,
  IconUserCheck,
  IconUserX,
  IconSearch,
  IconCheck,
  IconX,
  IconTrash,
  IconPencil,
  IconEye,
  IconEyeOff,
  IconShieldLock,
  IconDotsVertical,
  IconSend,
  IconClock,
  IconArrowRight,
  IconLock,
  IconSparkles,
  IconAlertCircle,
  IconUserHeart,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  getBadgeById,
  getProfileCustomization,
  type UserProfileCustomization,
} from "@IRIS/shared"
import { renderBadgeIcon } from "./settings-tabs/account/profile/badge-showcase-card"

export interface IrisFriendsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FriendsTabKey = "friends" | "requests" | "add" | "blocked"

interface FriendItem {
  id: string
  friendId: string
  nickname: string | null
  isPrivate: boolean
  createdAt: string
  user: {
    id: string
    username: string
    customization: any
    createdAt: string
  }
}

interface IncomingRequestItem {
  id: string
  senderId: string
  message: string | null
  createdAt: string
  sender: {
    id: string
    username: string
    customization: any
    createdAt: string
  }
}

interface OutgoingRequestItem {
  id: string
  receiverId: string
  message: string | null
  createdAt: string
  receiver: {
    id: string
    username: string
    customization: any
    createdAt: string
  }
}

interface BlockedItem {
  id: string
  blockedId: string
  createdAt: string
  blocked: {
    id: string
    username: string
    customization: any
    createdAt: string
  }
}

export function IrisFriendsModal({
  open,
  onOpenChange,
}: IrisFriendsModalProps): React.JSX.Element {
  const { data: session, status } = useSession()
  const isAuthenticated = status === "authenticated" && Boolean(session?.user?.id)

  const [activeTab, setActiveTab] = useState<FriendsTabKey>("friends")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Data lists
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequestItem[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequestItem[]>([])
  const [blockedUsers, setBlockedUsers] = useState<BlockedItem[]>([])

  // Nickname editor modal state
  const [nicknameModal, setNicknameModal] = useState<{
    open: boolean
    friend: FriendItem | null
    value: string
    isSaving: boolean
  }>({
    open: false,
    friend: null,
    value: "",
    isSaving: false,
  })

  // Add friend tab state
  const [addUsername, setAddUsername] = useState("")
  const [addMessage, setAddMessage] = useState("")
  const [isSearchingUser, setIsSearchingUser] = useState(false)
  const [searchedUser, setSearchedUser] = useState<any | null>(null)
  const [searchUserError, setSearchUserError] = useState<string | null>(null)
  const [isSendingRequest, setIsSendingRequest] = useState(false)

  // Action loading states by item ID
  const [actionLoadingIds, setActionLoadingIds] = useState<Record<string, boolean>>({})

  // Fetch all friend relations
  const fetchFriendsData = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    try {
      const res = await elysia.friends.get()
      if (!res.error && res.data?.success) {
        setFriends(res.data.friends || [])
        setIncomingRequests(res.data.incomingRequests || [])
        setOutgoingRequests(res.data.outgoingRequests || [])
        setBlockedUsers(res.data.blockedUsers || [])
      }
    } catch (err) {
      console.error("[IrisFriendsModal] Failed to fetch friends:", err)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (open && isAuthenticated) {
      fetchFriendsData()
    }
  }, [open, isAuthenticated, fetchFriendsData])

  // Filtered friends
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends
    const q = searchQuery.toLowerCase()
    return friends.filter(
      (f) =>
        f.user.username.toLowerCase().includes(q) ||
        (f.nickname && f.nickname.toLowerCase().includes(q)) ||
        (f.user.customization?.displayName &&
          String(f.user.customization.displayName).toLowerCase().includes(q))
    )
  }, [friends, searchQuery])

  // Handle toggle private
  const handleTogglePrivate = async (friend: FriendItem) => {
    const nextPrivate = !friend.isPrivate
    // Optimistic update
    setFriends((prev) =>
      prev.map((f) => (f.id === friend.id ? { ...f, isPrivate: nextPrivate } : f))
    )
    try {
      const res = await elysia.friends({ id: friend.id }).patch({
        isPrivate: nextPrivate,
      })
      if (res.error) {
        // Rollback
        setFriends((prev) =>
          prev.map((f) =>
            f.id === friend.id ? { ...f, isPrivate: friend.isPrivate } : f
          )
        )
        toast.error("Failed to update privacy setting")
      } else {
        toast.success(
          nextPrivate
            ? `Friend marked as private (hidden from public profile)`
            : `Friend visibility set to public`
        )
      }
    } catch {
      setFriends((prev) =>
        prev.map((f) =>
          f.id === friend.id ? { ...f, isPrivate: friend.isPrivate } : f
        )
      )
      toast.error("Failed to update privacy setting")
    }
  }

  // Handle save nickname
  const handleSaveNickname = async () => {
    if (!nicknameModal.friend) return
    const target = nicknameModal.friend
    const newNick = nicknameModal.value.trim() || null
    setNicknameModal((prev) => ({ ...prev, isSaving: true }))

    try {
      const res = await elysia.friends({ id: target.id }).patch({
        nickname: newNick,
      })
      if (!res.error) {
        setFriends((prev) =>
          prev.map((f) => (f.id === target.id ? { ...f, nickname: newNick } : f))
        )
        toast.success(newNick ? `Nickname set to "${newNick}"` : `Nickname cleared`)
        setNicknameModal({ open: false, friend: null, value: "", isSaving: false })
      } else {
        toast.error("Failed to update nickname")
      }
    } catch {
      toast.error("Failed to update nickname")
    } finally {
      setNicknameModal((prev) => ({ ...prev, isSaving: false }))
    }
  }

  // Handle remove friend
  const handleRemoveFriend = async (friend: FriendItem) => {
    try {
      const res = await elysia.friends({ id: friend.id }).delete()
      if (!res.error) {
        setFriends((prev) => prev.filter((f) => f.id !== friend.id))
        toast.success(`Removed @${friend.user.username} from friends.`)
      } else {
        toast.error("Failed to remove friend.")
      }
    } catch {
      toast.error("Failed to remove friend.")
    }
  }

  // Handle respond to request (accept / decline / block)
  const handleRespondRequest = async (
    requestId: string,
    action: "ACCEPT" | "DECLINE" | "BLOCK"
  ) => {
    setActionLoadingIds((prev) => ({ ...prev, [requestId]: true }))
    try {
      const res = await elysia.friends
        .requests({ id: requestId })
        .respond.post({ action })

      if (!res.error) {
        setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId))
        toast.success(res.data?.message || `Request ${action.toLowerCase()}ed`)
        fetchFriendsData()
      } else {
        toast.error("Failed to process friend request.")
      }
    } catch {
      toast.error("Failed to process friend request.")
    } finally {
      setActionLoadingIds((prev) => ({ ...prev, [requestId]: false }))
    }
  }

  // Handle cancel outgoing request
  const handleCancelOutgoing = async (requestId: string) => {
    setActionLoadingIds((prev) => ({ ...prev, [requestId]: true }))
    try {
      const res = await elysia.friends.requests({ id: requestId }).delete()
      if (!res.error) {
        setOutgoingRequests((prev) => prev.filter((r) => r.id !== requestId))
        toast.success("Friend request cancelled.")
      } else {
        toast.error("Failed to cancel request.")
      }
    } catch {
      toast.error("Failed to cancel request.")
    } finally {
      setActionLoadingIds((prev) => ({ ...prev, [requestId]: false }))
    }
  }

  // Handle block user
  const handleBlockUser = async (username: string) => {
    try {
      const res = await elysia.friends.block.post({ targetUsername: username })
      if (!res.error) {
        toast.success(`Blocked @${username}.`)
        fetchFriendsData()
      } else {
        toast.error("Failed to block user.")
      }
    } catch {
      toast.error("Failed to block user.")
    }
  }

  // Handle unblock user
  const handleUnblockUser = async (blockId: string, username: string) => {
    setActionLoadingIds((prev) => ({ ...prev, [blockId]: true }))
    try {
      const res = await elysia.friends.block({ id: blockId }).delete()
      if (!res.error) {
        setBlockedUsers((prev) => prev.filter((b) => b.id !== blockId))
        toast.success(`Unblocked @${username}.`)
      } else {
        toast.error("Failed to unblock user.")
      }
    } catch {
      toast.error("Failed to unblock user.")
    } finally {
      setActionLoadingIds((prev) => ({ ...prev, [blockId]: false }))
    }
  }

  // Handle search user preview in Add Friend tab
  const handleSearchUser = async (usernameToFind: string) => {
    const trimmed = usernameToFind.trim()
    if (!trimmed) {
      setSearchedUser(null)
      setSearchUserError(null)
      return
    }
    setIsSearchingUser(true)
    setSearchUserError(null)
    try {
      const res = await elysia.users({ username: trimmed }).get()
      if (!res.error && res.data?.success && res.data.user) {
        setSearchedUser(res.data.user)
      } else {
        setSearchedUser(null)
        setSearchUserError(`User @${trimmed} not found.`)
      }
    } catch {
      setSearchedUser(null)
      setSearchUserError(`User @${trimmed} not found.`)
    } finally {
      setIsSearchingUser(false)
    }
  }

  // Handle send friend request
  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const target = addUsername.trim()
    if (!target) return
    if (!isAuthenticated) {
      toast.error("You must be logged in to send friend requests.")
      return
    }

    setIsSendingRequest(true)
    try {
      const res = await elysia.friends.request.post({
        targetUsername: target,
        message: addMessage.trim() || undefined,
      })

      if (!res.error && res.data?.success) {
        toast.success(res.data.message || `Friend request sent to @${target}!`)
        setAddUsername("")
        setAddMessage("")
        setSearchedUser(null)
        setActiveTab("requests")
        fetchFriendsData()
      } else {
        const errorVal = (res.error as any)?.value?.message || "Failed to send friend request"
        toast.error(errorVal)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send friend request.")
    } finally {
      setIsSendingRequest(false)
    }
  }

  return (
    <>
      <Dialog
        isOpen={open}
        onOpenChange={onOpenChange}
        className="inset-0 top-0 left-0 h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none p-0 sm:fixed sm:inset-auto sm:start-1/2 sm:top-1/2 sm:h-[88vh] sm:max-h-[88vh] sm:w-[85vw] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:h-full [&>[data-slot=dialog]]:min-h-0 [&>[data-slot=dialog]]:flex-col [&>[data-slot=dialog]]:overflow-hidden"
      >
        {/* ========================================================================= */}
        {/* 1. HEADER                                                                 */}
        {/* ========================================================================= */}
        <header className="flex shrink-0 flex-col gap-3 border-b border-border/60 bg-card/60 px-4 py-4 pe-12 backdrop-blur-xl sm:px-6 sm:pe-14">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-2xs">
                <IconUsers className="size-5" />
              </div>
              <DialogTitle className="font-heading text-lg font-bold text-foreground">
                Friends
              </DialogTitle>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="h-6 rounded-xl border-border/70 bg-background/80 px-2.5 text-xs font-semibold text-muted-foreground"
              >
                {friends.length} {friends.length === 1 ? "Friend" : "Friends"}
              </Badge>
            </div>
          </div>

          {/* Tab Navigation Pill Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("friends")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                  activeTab === "friends"
                    ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <IconUsers className="size-3.5" />
                <span>All Friends</span>
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 py-0 text-[10px] font-bold"
                >
                  {friends.length}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("requests")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                  activeTab === "requests"
                    ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <IconUserPlus className="size-3.5" />
                <span>Requests</span>
                {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
                  <Badge
                    variant={incomingRequests.length > 0 ? "default" : "secondary"}
                    className="h-4 px-1.5 py-0 text-[10px] font-bold"
                  >
                    {incomingRequests.length + outgoingRequests.length}
                  </Badge>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("add")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                  activeTab === "add"
                    ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <IconSend className="size-3.5" />
                <span>Add Friend</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("blocked")}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                  activeTab === "blocked"
                    ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <IconShieldLock className="size-3.5" />
                <span>Blocked</span>
                {blockedUsers.length > 0 && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1.5 py-0 text-[10px] font-mono"
                  >
                    {blockedUsers.length}
                  </Badge>
                )}
              </button>
            </div>

            {/* Friends Search Input */}
            {activeTab === "friends" && (
              <div className="relative w-full sm:w-64">
                <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter friends or nicknames..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 rounded-xl bg-background/80 ps-8 text-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <IconX className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. MAIN CONTENT BODY                                                      */}
        {/* ========================================================================= */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <IconLock className="size-10 text-muted-foreground/50" />
              <h3 className="font-heading text-base font-bold text-foreground">
                Authentication Required
              </h3>
              <p className="max-w-sm text-xs text-muted-foreground">
                Please log in to your IRIS account to view, add, and manage friends.
              </p>
            </div>
          ) : (
            <>
              {/* ------------------------------------------------------------------- */}
              {/* TAB 1: ALL FRIENDS                                                  */}
              {/* ------------------------------------------------------------------- */}
              {activeTab === "friends" && (
                <div className="space-y-4">
                  {isLoading && friends.length === 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className="h-44 animate-pulse rounded-2xl border border-border/40 bg-card/40"
                        />
                      ))}
                    </div>
                  ) : filteredFriends.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/20 py-16 text-center">
                      <IconUserHeart className="size-10 text-muted-foreground/40" />
                      <h4 className="font-heading text-sm font-bold text-foreground">
                        {searchQuery ? "No friends match your search" : "No friends added yet"}
                      </h4>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        {searchQuery
                          ? "Try searching with a different username or nickname."
                          : "Connect with other community members by sending them a friend request!"}
                      </p>
                      {!searchQuery && (
                        <Button
                          size="sm"
                          onClick={() => setActiveTab("add")}
                          className="mt-2 cursor-pointer gap-1.5 rounded-xl text-xs font-bold"
                        >
                          <IconUserPlus className="size-4" />
                          <span>Add Your First Friend</span>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredFriends.map((f) => {
                        const profile = getProfileCustomization(f.user.customization)
                        const nameToShow = profile.displayName || f.user.username
                        const initial = nameToShow.charAt(0).toUpperCase()
                        const nameStyle = getDisplayNameStyleCss(profile.displayNameStyle)
                        const nameEffect = getDisplayNameEffectClasses(
                          profile.displayNameStyle?.effect
                        )

                        const accentColor = profile.accentColor
                        const cardAccentStyles = accentColor
                          ? ({
                              "--primary": accentColor,
                              "--ring": accentColor,
                            } as React.CSSProperties)
                          : undefined

                        return (
                          <div
                            key={f.id}
                            style={cardAccentStyles}
                            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-xs transition-all hover:border-primary/40 hover:bg-card hover:shadow-md"
                          >
                            {/* Card Hero Banner */}
                            <div
                              className="relative h-20 w-full overflow-hidden bg-muted/40"
                              style={{
                                background: profile.bannerUrl
                                  ? undefined
                                  : accentColor
                                    ? `linear-gradient(135deg, ${accentColor}30 0%, var(--card) 100%)`
                                    : undefined,
                              }}
                            >
                              {profile.bannerUrl && (
                                <Image
                                  src={profile.bannerUrl}
                                  alt="Banner"
                                  fill
                                  sizes="320px"
                                  unoptimized
                                  className="object-cover opacity-80 transition-transform duration-300 group-hover:scale-105"
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />

                              {/* Top Badges / Privacy status */}
                              <div className="absolute end-2 top-2 z-10 flex items-center gap-1.5">
                                {f.isPrivate && (
                                  <Badge
                                    variant="secondary"
                                    className="gap-1 rounded-lg border border-border/60 bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-2xs backdrop-blur-md"
                                    title="Private Friend (only visible to you)"
                                  >
                                    <IconEyeOff className="size-3 text-amber-400" />
                                    <span>Private</span>
                                  </Badge>
                                )}

                                {/* Card Dropdown Actions Menu */}
                                <DropdownMenuTrigger>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 cursor-pointer rounded-lg border border-border/40 bg-background/80 p-0 text-muted-foreground shadow-2xs backdrop-blur-md hover:bg-background hover:text-foreground"
                                  >
                                    <IconDotsVertical className="size-3.5" />
                                  </Button>
                                  <DropdownMenu placement="bottom end" className="w-48 rounded-xl p-1">
                                    <DropdownMenuItem
                                      href={`/IRIS-account/users/${f.user.username}`}
                                      onClick={() => onOpenChange(false)}
                                    >
                                      <IconArrowRight className="size-3.5" />
                                      <span>View Profile</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onAction={() =>
                                        setNicknameModal({
                                          open: true,
                                          friend: f,
                                          value: f.nickname || "",
                                          isSaving: false,
                                        })
                                      }
                                    >
                                      <IconPencil className="size-3.5" />
                                      <span>{f.nickname ? "Edit Nickname" : "Add Nickname"}</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onAction={() => handleTogglePrivate(f)}
                                    >
                                      {f.isPrivate ? (
                                        <>
                                          <IconEye className="size-3.5 text-emerald-400" />
                                          <span>Make Public</span>
                                        </>
                                      ) : (
                                        <>
                                          <IconEyeOff className="size-3.5 text-amber-400" />
                                          <span>Make Private</span>
                                        </>
                                      )}
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    <DropdownMenuItem
                                      variant="destructive"
                                      onAction={() => handleBlockUser(f.user.username)}
                                    >
                                      <IconShieldLock className="size-3.5" />
                                      <span>Block User</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      variant="destructive"
                                      onAction={() => handleRemoveFriend(f)}
                                    >
                                      <IconTrash className="size-3.5" />
                                      <span>Remove Friend</span>
                                    </DropdownMenuItem>
                                  </DropdownMenu>
                                </DropdownMenuTrigger>
                              </div>
                            </div>

                            {/* Avatar + Main Details */}
                            <div className="relative -mt-7 flex flex-1 flex-col px-3.5 pb-3.5">
                              <div className="flex items-end justify-between gap-2">
                                <div className="relative size-14 shrink-0">
                                  <div className="relative size-full overflow-hidden rounded-full border-2 border-background bg-card shadow-md">
                                    {profile.avatarUrl ? (
                                      <Image
                                        src={profile.avatarUrl}
                                        alt={nameToShow}
                                        fill
                                        sizes="56px"
                                        unoptimized
                                        className="size-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex size-full items-center justify-center bg-primary/15 font-heading text-sm font-black text-primary uppercase select-none">
                                        {initial}
                                      </div>
                                    )}
                                  </div>
                                  {profile.avatarFrame && (
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
                                        src={profile.avatarFrame}
                                        alt="Avatar Frame"
                                        fill
                                        sizes="72px"
                                        unoptimized
                                        className="size-full object-contain"
                                      />
                                    </div>
                                  )}
                                </div>

                                <Link
                                  href={`/IRIS-account/users/${f.user.username}`}
                                  onClick={() => onOpenChange(false)}
                                  className="mb-1 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                                >
                                  <span>Profile</span>
                                  <IconArrowRight className="size-3" />
                                </Link>
                              </div>

                              {/* Display Name / Nickname */}
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4
                                    className={cn(
                                      "font-heading text-sm font-bold truncate max-w-[170px]",
                                      nameEffect
                                    )}
                                    style={nameStyle}
                                  >
                                    {nameToShow}
                                  </h4>
                                  {profile.pronouns && (
                                    <Badge
                                      variant="secondary"
                                      className="h-4 px-1 py-0 text-[9px] font-medium"
                                    >
                                      {profile.pronouns}
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="font-mono">@{f.user.username}</span>
                                </div>

                                {f.nickname && (
                                  <div className="flex items-center gap-1 pt-0.5">
                                    <Badge
                                      variant="outline"
                                      className="h-4.5 gap-1 border-primary/30 bg-primary/10 px-1.5 text-[10px] font-semibold text-primary"
                                    >
                                      <IconPencil className="size-2.5" />
                                      <span>{f.nickname}</span>
                                    </Badge>
                                  </div>
                                )}

                                {profile.statusText && (
                                  <p className="line-clamp-1 pt-1 text-[11px] italic text-muted-foreground">
                                    &ldquo;{profile.statusText}&rdquo;
                                  </p>
                                )}
                              </div>

                              {/* Badges Strip */}
                              {profile.showcaseBadgeIds && profile.showcaseBadgeIds.length > 0 && (
                                <div className="mt-auto flex items-center gap-1 pt-3">
                                  {profile.showcaseBadgeIds.slice(0, 5).map((id) => {
                                    const badge = getBadgeById(id)
                                    if (!badge) return null
                                    return (
                                      <TooltipTrigger key={badge.id} delay={150}>
                                        <div
                                          className="flex size-5.5 items-center justify-center rounded-lg border bg-card/80 p-0.5"
                                          style={{
                                            borderColor: `${badge.color}50`,
                                            backgroundColor: `${badge.color}15`,
                                            color: badge.color,
                                          }}
                                        >
                                          {renderBadgeIcon(badge.icon, "size-3")}
                                        </div>
                                        <Tooltip className="rounded-lg border border-border/60 bg-popover px-2 py-1 text-[10px] shadow-md">
                                          {badge.name}
                                        </Tooltip>
                                      </TooltipTrigger>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* TAB 2: PENDING REQUESTS                                             */}
              {/* ------------------------------------------------------------------- */}
              {activeTab === "requests" && (
                <div className="space-y-6">
                  {/* Section A: Incoming Requests */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <IconUserPlus className="size-4 text-primary" />
                        <h4 className="font-heading text-sm font-bold text-foreground">
                          Incoming Requests ({incomingRequests.length})
                        </h4>
                      </div>
                    </div>

                    {incomingRequests.length === 0 ? (
                      <p className="py-4 text-xs text-muted-foreground italic">
                        No pending incoming friend requests.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {incomingRequests.map((req) => {
                          const profile = getProfileCustomization(
                            req.sender.customization
                          )
                          const nameToShow = profile.displayName || req.sender.username
                          const isActing = actionLoadingIds[req.id]

                          return (
                            <div
                              key={req.id}
                              className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-3.5 shadow-2xs transition-colors hover:bg-card"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-border bg-card">
                                  {profile.avatarUrl ? (
                                    <Image
                                      src={profile.avatarUrl}
                                      alt={nameToShow}
                                      fill
                                      sizes="48px"
                                      unoptimized
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex size-full items-center justify-center bg-primary/15 font-heading text-xs font-bold text-primary uppercase">
                                      {nameToShow.charAt(0)}
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <h5 className="font-heading text-xs font-bold text-foreground truncate">
                                    {nameToShow}
                                  </h5>
                                  <p className="font-mono text-[11px] text-muted-foreground">
                                    @{req.sender.username}
                                  </p>
                                  {req.message && (
                                    <p className="mt-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] italic text-foreground/90">
                                      &ldquo;{req.message}&rdquo;
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  size="sm"
                                  disabled={isActing}
                                  onClick={() => handleRespondRequest(req.id, "ACCEPT")}
                                  className="h-7.5 flex-1 cursor-pointer rounded-xl text-xs font-semibold"
                                >
                                  <IconCheck className="mr-1 size-3.5" />
                                  <span>Accept</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isActing}
                                  onClick={() => handleRespondRequest(req.id, "DECLINE")}
                                  className="h-7.5 flex-1 cursor-pointer rounded-xl text-xs font-semibold"
                                >
                                  <IconX className="mr-1 size-3.5" />
                                  <span>Decline</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={isActing}
                                  onClick={() => handleRespondRequest(req.id, "BLOCK")}
                                  className="h-7.5 cursor-pointer rounded-xl px-2.5 text-xs font-semibold"
                                  aria-label="Block User"
                                >
                                  <IconShieldLock className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section B: Outgoing Requests */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <IconClock className="size-4 text-muted-foreground" />
                        <h4 className="font-heading text-sm font-bold text-foreground">
                          Outgoing Requests Sent ({outgoingRequests.length})
                        </h4>
                      </div>
                    </div>

                    {outgoingRequests.length === 0 ? (
                      <p className="py-4 text-xs text-muted-foreground italic">
                        No outgoing friend requests pending.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {outgoingRequests.map((req) => {
                          const profile = getProfileCustomization(
                            req.receiver.customization
                          )
                          const nameToShow = profile.displayName || req.receiver.username
                          const isActing = actionLoadingIds[req.id]

                          return (
                            <div
                              key={req.id}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 shadow-2xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-border bg-card">
                                  {profile.avatarUrl ? (
                                    <Image
                                      src={profile.avatarUrl}
                                      alt={nameToShow}
                                      fill
                                      sizes="40px"
                                      unoptimized
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex size-full items-center justify-center bg-primary/15 font-heading text-xs font-bold text-primary uppercase">
                                      {nameToShow.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                  <h5 className="font-heading text-xs font-bold text-foreground truncate">
                                    {nameToShow}
                                  </h5>
                                  <p className="font-mono text-[11px] text-muted-foreground">
                                    @{req.receiver.username}
                                  </p>
                                  {req.message && (
                                    <p className="line-clamp-1 text-[10px] italic text-muted-foreground">
                                      &ldquo;{req.message}&rdquo;
                                    </p>
                                  )}
                                </div>
                              </div>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isActing}
                                onClick={() => handleCancelOutgoing(req.id)}
                                className="h-7 cursor-pointer rounded-xl px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
                              >
                                <span>Cancel</span>
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* TAB 3: ADD FRIEND                                                   */}
              {/* ------------------------------------------------------------------- */}
              {activeTab === "add" && (
                <div className="mx-auto max-w-xl space-y-6 py-2">
                  <div className="space-y-1 text-center">
                    <h3 className="font-heading text-base font-bold text-foreground">
                      Send a Friend Request
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Enter the username of the member you would like to connect with.
                    </p>
                  </div>

                  <form onSubmit={handleSendFriendRequest} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-foreground">
                        Username <span className="text-destructive">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                            @
                          </span>
                          <Input
                            type="text"
                            placeholder="username"
                            required
                            value={addUsername}
                            onChange={(e) => {
                              const val = e.target.value.replace(/^@/, "")
                              setAddUsername(val)
                              handleSearchUser(val)
                            }}
                            className="h-9 rounded-xl ps-7 text-xs"
                          />
                        </div>
                      </div>
                      {searchUserError && (
                        <p className="text-[11px] text-destructive flex items-center gap-1">
                          <IconAlertCircle className="size-3" />
                          <span>{searchUserError}</span>
                        </p>
                      )}
                    </div>

                    {/* Searched User Preview Card */}
                    {searchedUser && (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-primary/40 bg-card">
                            {searchedUser.customization?.avatarUrl ? (
                              <Image
                                src={searchedUser.customization.avatarUrl}
                                alt={searchedUser.username}
                                fill
                                sizes="48px"
                                unoptimized
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center bg-primary/20 font-heading text-xs font-bold text-primary uppercase">
                                {searchedUser.username.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <h4 className="font-heading text-xs font-bold text-foreground truncate">
                              {searchedUser.customization?.displayName ||
                                searchedUser.username}
                            </h4>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              @{searchedUser.username}
                            </p>
                            {searchedUser.customization?.statusText && (
                              <p className="line-clamp-1 text-[10px] italic text-muted-foreground">
                                &ldquo;{searchedUser.customization.statusText}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Optional short message (max 50 chars) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-semibold text-foreground">
                          Optional Note / Message
                        </label>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {addMessage.length}/50
                        </span>
                      </div>
                      <Input
                        type="text"
                        maxLength={50}
                        placeholder="Say hello (max 50 chars)..."
                        value={addMessage}
                        onChange={(e) => setAddMessage(e.target.value.slice(0, 50))}
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSendingRequest || !addUsername.trim()}
                      className="h-9.5 w-full cursor-pointer rounded-xl font-bold shadow-xs text-xs"
                    >
                      <IconSend className="mr-1.5 size-4" />
                      <span>{isSendingRequest ? "Sending..." : "Send Request"}</span>
                    </Button>
                  </form>
                </div>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* TAB 4: BLOCKED USERS                                                */}
              {/* ------------------------------------------------------------------- */}
              {activeTab === "blocked" && (
                <div className="space-y-4">
                  <div className="border-b border-border/50 pb-2">
                    <h4 className="font-heading text-sm font-bold text-foreground">
                      Blocked Members ({blockedUsers.length})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Blocked members cannot send you friend requests or interact with your profile.
                    </p>
                  </div>

                  {blockedUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <IconShieldLock className="size-8 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">
                        Your blocked list is empty.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {blockedUsers.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold text-muted-foreground">
                              {b.blocked.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-heading text-xs font-bold text-foreground truncate">
                                @{b.blocked.username}
                              </h5>
                              <span className="text-[10px] text-muted-foreground">
                                Blocked on {new Date(b.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionLoadingIds[b.id]}
                            onClick={() => handleUnblockUser(b.id, b.blocked.username)}
                            className="h-7 cursor-pointer rounded-xl px-3 text-xs font-semibold"
                          >
                            <span>Unblock</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* ========================================================================= */}
        {/* 3. FOOTER                                                                 */}
        {/* ========================================================================= */}
        <footer className="flex shrink-0 items-center justify-between border-t border-border/60 bg-card/40 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-[11px]">
              {friends.length} active connection{friends.length === 1 ? "" : "s"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer rounded-xl text-xs"
          >
            Close
          </Button>
        </footer>
      </Dialog>

      {/* ========================================================================= */}
      {/* 4. SET NICKNAME DIALOG                                                    */}
      {/* ========================================================================= */}
      {nicknameModal.open && nicknameModal.friend && (
        <Dialog
          isOpen={nicknameModal.open}
          onOpenChange={(open) =>
            setNicknameModal((prev) => ({ ...prev, open }))
          }
          className="max-w-md rounded-2xl p-6"
        >
          <DialogHeader>
            <DialogTitle>Set Friend Nickname</DialogTitle>
            <DialogDescription>
              Assign a private custom nickname for @{nicknameModal.friend.user.username}.
              Only you will see this nickname.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <Input
              type="text"
              placeholder="e.g. Bestie, Anime Buddy"
              maxLength={30}
              value={nicknameModal.value}
              onChange={(e) =>
                setNicknameModal((prev) => ({ ...prev, value: e.target.value }))
              }
              className="h-9 rounded-xl text-xs"
            />

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setNicknameModal({
                    open: false,
                    friend: null,
                    value: "",
                    isSaving: false,
                  })
                }
                className="cursor-pointer rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={nicknameModal.isSaving}
                onClick={handleSaveNickname}
                className="cursor-pointer rounded-xl text-xs font-bold"
              >
                Save Nickname
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}
