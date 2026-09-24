"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession, signIn } from "next-auth/react"
import { elysia } from "@/lib/elysia"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  IconUsers,
  IconStar,
  IconPlayerPlay,
  IconCheck,
  IconClock,
  IconArrowRight,
  IconLock,
  IconUserHeart,
  IconPencil,
} from "@tabler/icons-react"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  getProfileCustomization,
} from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"

export interface FriendsMediaTabProps {
  mediaCategory: string
  mediaId: number
}

interface FriendMediaEntry {
  id: string
  friendId: string
  nickname: string | null
  user: {
    id: string
    username: string
    customization: any
  }
  status: string
  progress?: number | null
  progressVolumes?: number | null
  score?: number | null
  updatedAt: string
}

// In-flight request cache to deduplicate concurrent requests without locking state
const inFlightRequests = new Map<string, Promise<any>>()

export function FriendsMediaTab({
  mediaCategory,
  mediaId,
}: FriendsMediaTabProps): React.JSX.Element {
  const { data: session, status: authStatus } = useSession()
  const isAuthenticated =
    authStatus === "authenticated" && Boolean(session?.user?.id)

  const [friendsData, setFriendsData] = useState<FriendMediaEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authStatus === "loading") {
      return
    }

    if (!isAuthenticated) {
      setIsLoading(false)
      return
    }

    const key = `${mediaCategory}:${mediaId}`
    let cancelled = false
    setIsLoading(true)

    let requestPromise = inFlightRequests.get(key)
    if (!requestPromise) {
      requestPromise = elysia.friends
        .media({ mediaType: mediaCategory })({ id: Number(mediaId) })
        .get()
        .finally(() => {
          inFlightRequests.delete(key)
        })
      inFlightRequests.set(key, requestPromise)
    }

    requestPromise
      .then((res: any) => {
        if (cancelled) return
        if (!res.error && res.data?.success) {
          setFriendsData(res.data.friends || [])
        }
      })
      .catch((err: any) => {
        if (cancelled) return
        console.error("[FriendsMediaTab] Failed to fetch friends media:", err)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authStatus, isAuthenticated, mediaCategory, mediaId])

  const getStatusBadge = (statusStr: string) => {
    const s = statusStr.toUpperCase()
    switch (s) {
      case "COMPLETED":
        return (
          <Badge className="gap-1 rounded-lg border-emerald-500/30 bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
            <IconCheck className="size-3" />
            <span>Completed</span>
          </Badge>
        )
      case "WATCHING":
      case "READING":
      case "LISTENING":
      case "PLAYING":
        return (
          <Badge className="gap-1 rounded-lg border-primary/30 bg-primary/15 text-[10px] font-bold text-primary">
            <IconPlayerPlay className="size-3" />
            <span className="capitalize">{statusStr.toLowerCase()}</span>
          </Badge>
        )
      case "ON_HOLD":
        return (
          <Badge className="gap-1 rounded-lg border-amber-500/30 bg-amber-500/15 text-[10px] font-bold text-amber-400">
            <IconClock className="size-3" />
            <span>On Hold</span>
          </Badge>
        )
      case "DROPPED":
        return (
          <Badge
            variant="destructive"
            className="rounded-lg text-[10px] font-bold"
          >
            <span>Dropped</span>
          </Badge>
        )
      case "PLANNING":
      default:
        return (
          <Badge
            variant="secondary"
            className="rounded-lg text-[10px] font-bold"
          >
            <span>Planning</span>
          </Badge>
        )
    }
  }

  if (authStatus === "loading" || isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-border/40 bg-card/40"
          />
        ))}
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/20 p-12 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
          <IconLock className="size-6" />
        </div>
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Log In to View Friends
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Log in to see how your friends are progressing, what scores they gave,
          and their statuses for this title.
        </p>
        <Button
          size="sm"
          onClick={() => signIn()}
          className="mt-4 cursor-pointer rounded-xl text-xs font-bold"
        >
          <span>Log In</span>
        </Button>
      </div>
    )
  }

  if (friendsData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/20 p-12 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
          <IconUsers className="size-6" />
        </div>
        <h3 className="font-heading text-sm font-semibold text-foreground">
          No Friends Tracking Yet
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          None of your friends have added this to their library yet. Recommend
          it to them to start a conversation!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <IconUsers className="size-4.5 text-primary" />
          <h3 className="font-heading text-base font-bold text-foreground">
            Friends Activity ({friendsData.length})
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {friendsData.map((f) => {
          const profile = getProfileCustomization(f.user.customization)
          const nameToShow = profile.displayName || f.user.username
          const initial = nameToShow.charAt(0).toUpperCase()
          const nameStyle = getDisplayNameStyleCss(profile.displayNameStyle)
          const nameEffect = getDisplayNameEffectClasses(
            profile.displayNameStyle?.effect
          )

          const dateStr = new Date(f.updatedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })

          return (
            <div
              key={f.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-xs transition-colors hover:border-primary/40 hover:bg-card"
            >
              {/* Top: Avatar & User Info */}
              <div className="flex min-w-0 items-start gap-3">
                <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-border bg-card">
                  {profile.avatarUrl ? (
                    <Image
                      src={profile.avatarUrl}
                      alt={nameToShow}
                      fill
                      sizes="44px"
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-primary/15 font-heading text-xs font-bold text-primary uppercase">
                      {initial}
                    </div>
                  )}
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
                        alt="Frame"
                        fill
                        sizes="58px"
                        unoptimized
                        className="size-full object-contain"
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/IRIS-account/users/${f.user.username}`}
                      className={cn(
                        "max-w-[150px] truncate font-heading text-xs font-bold text-foreground hover:underline",
                        nameEffect
                      )}
                      style={nameStyle}
                    >
                      {nameToShow}
                    </Link>
                  </div>

                  <p className="font-mono text-[11px] text-muted-foreground">
                    @{f.user.username}
                  </p>

                  {f.nickname && (
                    <Badge
                      variant="outline"
                      className="h-4 gap-0.5 border-primary/30 bg-primary/10 px-1.5 text-[9px] font-semibold text-primary"
                    >
                      <IconPencil className="size-2" />
                      <span>{f.nickname}</span>
                    </Badge>
                  )}
                </div>
              </div>

              {/* Bottom: Status & Progress & Score */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-xs">
                <div className="flex items-center gap-1.5">
                  {getStatusBadge(f.status)}

                  {f.progress !== null && f.progress !== undefined && (
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px] font-bold"
                    >
                      Unit {f.progress}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {f.score !== null && f.score !== undefined && (
                    <Badge className="h-5 gap-1 bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-400">
                      <IconStar className="size-3 fill-amber-400" />
                      <span>{f.score}</span>
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {dateStr}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
