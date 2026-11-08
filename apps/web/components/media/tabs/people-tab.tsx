"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  IconStar,
  IconPlayerPlay,
  IconCheck,
  IconClock,
  IconPlayerPause,
  IconX,
  IconFilter,
  IconUsers,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  getDisplayNameStyleCss,
  getDisplayNameEffectClasses,
  getProfileCustomization,
} from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"
import { elysia, API_URL } from "@/lib/elysia"

export interface PeopleTabProps {
  mediaCategory: string
  mediaId: number
}

interface PersonMediaEntry {
  id: number
  userId: string
  status: string
  score: number | null
  progress: number | null
  volumesProgress: number | null
  updatedAt: string
  user: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
    avatarFrame: string | null
    displayNameStyle?: any
    customization?: any
  }
}

// In-flight request cache to deduplicate concurrent requests (e.g. React StrictMode)
const inFlightPeopleRequests = new Map<string, Promise<any>>()

export function PeopleTab({ mediaCategory, mediaId }: PeopleTabProps): React.JSX.Element {
  const [people, setPeople] = useState<PersonMediaEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const isReading = mediaCategory === "manga" || mediaCategory === "book"
  const isPlaying = mediaCategory === "game"
  const isListening = mediaCategory === "music"

  const inProgressLabel = isReading
    ? "Reading"
    : isPlaying
      ? "Playing"
      : isListening
        ? "Listening"
        : "Watching"

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const key = `${mediaCategory}:${mediaId}:${selectedStatus}:${page}`
    let requestPromise = inFlightPeopleRequests.get(key)

    if (!requestPromise) {
      const queryParams = new URLSearchParams()
      queryParams.set("page", String(page))
      queryParams.set("limit", "40")
      if (selectedStatus !== "ALL") {
        queryParams.set("status", selectedStatus)
      }

      requestPromise = fetch(
        `${API_URL}/borealis/media/${encodeURIComponent(mediaCategory)}/${encodeURIComponent(mediaId)}/people?${queryParams.toString()}`,
        { credentials: "include" }
      )
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Failed to load community members: ${res.statusText}`)
          }
          return await res.json()
        })
        .finally(() => {
          inFlightPeopleRequests.delete(key)
        })

      inFlightPeopleRequests.set(key, requestPromise)
    }

    requestPromise
      .then((json: any) => {
        if (cancelled) return
        if (json?.success) {
          if (page === 1) {
            setPeople(json.people || [])
          } else {
            setPeople((prev) => [...prev, ...(json.people || [])])
          }
          setTotalCount(json.total || 0)
          setHasMore(Boolean(json.hasMore))
        }
      })
      .catch((err: any) => {
        if (cancelled) return
        console.error("[PeopleTab] Error fetching media community members:", err)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [mediaCategory, mediaId, selectedStatus, page])

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status)
    setPage(1)
  }

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
      case "IN_PROGRESS":
      case "WATCHING":
      case "READING":
      case "PLAYING":
      case "LISTENING":
      case "CURRENT":
        return (
          <Badge className="gap-1 rounded-lg border-blue-500/30 bg-blue-500/15 text-[10px] font-bold text-blue-400">
            <IconPlayerPlay className="size-3 fill-blue-400" />
            <span>{inProgressLabel}</span>
          </Badge>
        )
      case "PLANNED":
      case "PLANNING":
        return (
          <Badge variant="secondary" className="gap-1 rounded-lg text-[10px] font-semibold">
            <IconClock className="size-3" />
            <span>Planning</span>
          </Badge>
        )
      case "PAUSED":
      case "ON_HOLD":
        return (
          <Badge className="gap-1 rounded-lg border-amber-500/30 bg-amber-500/15 text-[10px] font-bold text-amber-400">
            <IconPlayerPause className="size-3" />
            <span>On Hold</span>
          </Badge>
        )
      case "DROPPED":
        return (
          <Badge variant="outline" className="gap-1 rounded-lg border-destructive/40 text-[10px] font-semibold text-destructive">
            <IconX className="size-3" />
            <span>Dropped</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="rounded-lg text-[10px] font-medium uppercase">
            {statusStr}
          </Badge>
        )
    }
  }

  const renderProgress = (p: PersonMediaEntry) => {
    if (isReading) {
      if (p.progress === null && p.volumesProgress === null) return null
      return (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
          {p.volumesProgress ? `V${p.volumesProgress} ` : ""}
          {p.progress !== null ? `CH ${p.progress}` : ""}
        </Badge>
      )
    }
    if (isPlaying) {
      if (p.progress === null) return null
      return (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
          {p.progress} Hrs
        </Badge>
      )
    }
    if (isListening) {
      if (p.progress === null) return null
      return (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
          {p.progress} Plays
        </Badge>
      )
    }
    if (p.progress !== null && p.progress !== undefined) {
      return (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
          Ep {p.progress}
        </Badge>
      )
    }
    return null
  }

  const statusOptions = [
    { key: "ALL", label: "All" },
    { key: "IN_PROGRESS", label: inProgressLabel },
    { key: "COMPLETED", label: "Completed" },
    { key: "PLANNING", label: "Planning" },
    { key: "ON_HOLD", label: "On Hold" },
    { key: "DROPPED", label: "Dropped" },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Status Filter Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="me-1 flex items-center gap-1 text-xs text-muted-foreground">
          <IconFilter className="size-3.5" aria-hidden="true" />
          <span>Status:</span>
        </span>
        {statusOptions.map((opt) => {
            const isActive = selectedStatus === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleStatusFilter(opt.key)}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium outline-none transition-colors select-none ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

      {/* Main Grid Content */}
      {isLoading && people.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-border/40 bg-card/60 p-4"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex justify-between border-t border-border/40 pt-2.5">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-12 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center">
          <IconUsers className="mx-auto size-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-foreground">No users found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedStatus === "ALL"
              ? "No public list entries found for this media title yet."
              : `No users currently have this title marked as ${statusOptions.find((o) => o.key === selectedStatus)?.label}.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {people.map((person) => {
              const profile = getProfileCustomization(person.user.customization)
              const nameToShow = profile.displayName || person.user.displayName || person.user.username
              const initial = nameToShow.charAt(0).toUpperCase()
              const nameStyle = getDisplayNameStyleCss(
                profile.displayNameStyle || person.user.displayNameStyle
              )
              const nameEffect = getDisplayNameEffectClasses(
                (profile.displayNameStyle || person.user.displayNameStyle)?.effect
              )

              const dateStr = new Date(person.updatedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })

              return (
                <div
                  key={`${person.id}-${person.userId}`}
                  className="group flex flex-col justify-between gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-xs transition-colors hover:border-primary/40 hover:bg-card"
                >
                  {/* Top: Avatar & User Info */}
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-border bg-card">
                      {profile.avatarUrl || person.user.avatarUrl ? (
                        <Image
                          src={profile.avatarUrl || person.user.avatarUrl!}
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
                      {(profile.avatarFrame || person.user.avatarFrame) && (
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
                            src={profile.avatarFrame || person.user.avatarFrame!}
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
                          href={`/carina/users/${person.user.id}`}
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
                        @{person.user.username}
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Status & Progress & Score */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(person.status)}
                      {renderProgress(person)}
                    </div>

                    <div className="flex items-center gap-2">
                      {person.score !== null && person.score !== undefined && person.score > 0 && (
                        <Badge className="h-5 gap-1 bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-400">
                          <IconStar className="size-3 fill-amber-400" />
                          <span>{person.score}</span>
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

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                isDisabled={isLoading}
                onPress={() => setPage((p) => p + 1)}
              >
                {isLoading ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

