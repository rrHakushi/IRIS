"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { elysia } from "@/lib/elysia"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  IconUsers,
  IconSearch,
  IconEyeOff,
  IconArrowRight,
  IconPencil,
  IconX,
  IconUserHeart,
} from "@tabler/icons-react"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  getBadgeById,
  getProfileCustomization,
} from "@IRIS/shared"
import { renderBadgeIcon } from "../../navigation/settings-tabs/account/profile/badge-showcase-card"
import { cn } from "@workspace/ui/lib/utils"

export interface ProfileFriendsTabProps {
  username: string
  isOwner: boolean
}

interface FriendCardItem {
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

export function ProfileFriendsTab({
  username,
  isOwner,
}: ProfileFriendsTabProps): React.JSX.Element {
  const [friends, setFriends] = useState<FriendCardItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchUserFriends = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await elysia.users({ username }).friends.get()
      if (!res.error && res.data?.success) {
        setFriends(res.data.friends || [])
      }
    } catch (err) {
      console.error("[ProfileFriendsTab] Error fetching friends:", err)
    } finally {
      setIsLoading(false)
    }
  }, [username])

  useEffect(() => {
    fetchUserFriends()
  }, [fetchUserFriends])

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

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <IconUsers className="size-5 text-primary" />
          <h3 className="font-heading text-lg font-bold text-foreground">
            {isOwner ? "My Friends" : `@${username}'s Friends`}
          </h3>
          <Badge
            variant="outline"
            className="h-5 rounded-full border-border/70 bg-muted/40 px-2 text-[10px] font-bold"
          >
            {friends.length}
          </Badge>
        </div>

        {/* Filter Input */}
        {friends.length > 0 && (
          <div className="relative w-full sm:w-64">
            <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 rounded-xl bg-background/80 ps-8 text-xs"
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

      {/* Content Grid */}
      {isLoading ? (
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
            {searchQuery
              ? "No friends match your search"
              : isOwner
                ? "You haven't added any friends yet"
                : `@${username} has no public friends`}
          </h4>
          <p className="max-w-sm text-xs text-muted-foreground">
            {searchQuery
              ? "Try searching with a different username or display name."
              : isOwner
                ? "Send friend requests to other members to start building your IRIS community!"
                : "When this user connects with friends publicly, they will appear here."}
          </p>
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
                {/* Banner */}
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

                  {/* Private badge if isOwner */}
                  {isOwner && f.isPrivate && (
                    <div className="absolute end-2 top-2 z-10">
                      <Badge
                        variant="secondary"
                        className="gap-1 rounded-lg border border-border/60 bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground shadow-2xs backdrop-blur-md"
                        title="Private Friend (only visible to you)"
                      >
                        <IconEyeOff className="size-3 text-amber-400" />
                        <span>Private</span>
                      </Badge>
                    </div>
                  )}
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
                      className="mb-1 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Profile</span>
                      <IconArrowRight className="size-3" />
                    </Link>
                  </div>

                  {/* Name + Username */}
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

                    {isOwner && f.nickname && (
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
  )
}
