"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useUser } from "@/context/user-context"
import {
  IconBookmark,
  IconPlus,
  IconCheck,
  IconLoader2,
  IconEye,
  IconBook,
  IconPlayerPlay,
  IconHeadphones,
  IconPlayerPause,
  IconX,
  IconClock,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import type { NormalizedMediaData } from "../media-types"
import type {
  CanonicalMediaCategory,
  MediaListEntryData,
  MediaListStatus,
} from "./types"
import {
  toCanonicalCategory,
  toBackendMediaType,
  getInProgressStatus,
} from "./types"
import { MediaListModal } from "./media-list-modal"
import type { TvSeasonItem } from "./media-list-tv-tab"

interface ListActionButtonsProps {
  media: NormalizedMediaData
  className?: string
}

export function ListActionButtons({
  media,
  className,
}: ListActionButtonsProps) {
  const { data: session, status: authStatus } = useSession()
  const { user } = useUser()
  const username =
    user?.username || (session?.user as { username?: string })?.username
  const isAuthenticated = authStatus === "authenticated" && Boolean(username)

  const category: CanonicalMediaCategory = toCanonicalCategory(media.category)
  const [entry, setEntry] = useState<MediaListEntryData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isQuickAdding, setIsQuickAdding] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const lastFetchedKeyRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)

  // Fetch initial list entry status for this media item
  const fetchListStatus = useCallback(async () => {
    if (!isAuthenticated || !username || !media.id) return

    const fetchKey = `${username}:${category}:${media.id}`
    if (lastFetchedKeyRef.current === fetchKey || isFetchingRef.current) return

    lastFetchedKeyRef.current = fetchKey
    isFetchingRef.current = true
    setIsLoading(true)

    try {
      let res: { data?: any; error?: any }

      switch (category) {
        case "anime":
          res = await elysia
            .user({ username })
            .lists.anime({ id: media.id })
            .get()
          break
        case "manga":
          res = await elysia
            .user({ username })
            .lists.manga({ id: media.id })
            .get()
          break
        case "movie":
          res = await elysia
            .user({ username })
            .lists.movie({ id: media.id })
            .get()
          break
        case "tv":
          res = await elysia.user({ username }).lists.tv({ id: media.id }).get()
          break
        case "game":
          res = await elysia
            .user({ username })
            .lists.game({ id: media.id })
            .get()
          break
        case "book":
          res = await elysia
            .user({ username })
            .lists.book({ id: media.id })
            .get()
          break
        case "music":
          res = await elysia
            .user({ username })
            .lists.music({ id: media.id })
            .get()
          break
      }

      if (!res.error && res.data?.inList && res.data.entry) {
        const e = res.data.entry
        setEntry({
          id: e.id,
          status: e.status as MediaListStatus,
          progress: e.progress ?? 0,
          score: e.score ?? null,
          notes: e.notes ?? null,
          rewatched: e.rewatched ?? 0,
          private: e.private ?? false,
          startedAt: e.startedAt ?? null,
          completedAt: e.completedAt ?? null,
          rewatchHistory: e.rewatchHistory ?? null,
          connections: e.connections ?? null,
          seasons: e.seasons,
          watchedEpisodes: e.watchedEpisodes,
        })
      } else {
        setEntry(null)
      }
    } catch {
      // Silently ignore if unavailable
    } finally {
      isFetchingRef.current = false
      setIsLoading(false)
    }
  }, [isAuthenticated, username, category, media.id])

  useEffect(() => {
    fetchListStatus()
  }, [fetchListStatus])

  // Quick Add Button Handler
  const handleQuickAdd = async () => {
    if (!isAuthenticated || !username) {
      toast.info("Please sign in to add this item to your list")
      return
    }

    if (isQuickAdding) return
    setIsQuickAdding(true)

    // Optimistically update entry (LISTENING for music, PLANNING for other media)
    const initialStatus = category === "music" ? "LISTENING" : "PLANNING"
    const optimisticEntry: MediaListEntryData = {
      status: initialStatus,
      progress: 0,
      score: null,
      notes: null,
      rewatched: 0,
      private: false,
      startedAt: null,
      completedAt: null,
    }
    setEntry(optimisticEntry)

    try {
      let res: { data?: any; error?: any }

      switch (category) {
        case "anime":
          res = await elysia
            .user({ username })
            .lists.anime({ id: media.id })
            ["quick-add"].post()
          break
        case "manga":
          res = await elysia
            .user({ username })
            .lists.manga({ id: media.id })
            ["quick-add"].post()
          break
        case "movie":
          res = await elysia
            .user({ username })
            .lists.movie({ id: media.id })
            ["quick-add"].post()
          break
        case "tv":
          res = await elysia
            .user({ username })
            .lists.tv({ id: media.id })
            ["quick-add"].post()
          break
        case "game":
          res = await elysia
            .user({ username })
            .lists.game({ id: media.id })
            ["quick-add"].post()
          break
        case "book":
          res = await elysia
            .user({ username })
            .lists.book({ id: media.id })
            ["quick-add"].post()
          break
        case "music":
          res = await (
            elysia
              .user({ username })
              .lists.music({ id: media.id })
              ["quick-add"] as any
          ).post(undefined, {
            query: {
              type: media.format === "TRACK" ? "TRACK" : "ALBUM",
            },
          })
          break
      }

      if (res.error) {
        throw new Error(res.error.value?.message || "Failed to quick add")
      }

      toast.success(
        res.data?.message ||
          `Added ${media.titlePrimary} to ${category === "music" ? "Listening" : "Planning"}`
      )
    } catch (err: any) {
      // Revert optimistic state
      setEntry(null)
      toast.error(err.message || "Failed to add to list")
    } finally {
      setIsQuickAdding(false)
    }
  }

  // Helper for Status Icon and Label
  const getStatusIconAndLabel = (st: MediaListStatus) => {
    switch (st) {
      case "PLANNING":
        return {
          icon: IconClock,
          label: "Planning",
          btnClass:
            "border-border bg-muted/60 text-muted-foreground hover:bg-muted/90",
        }
      case "WATCHING":
        return {
          icon: IconEye,
          label: "Watching",
          btnClass:
            "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
        }
      case "READING":
        return {
          icon: IconBook,
          label: "Reading",
          btnClass:
            "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
        }
      case "PLAYING":
        return {
          icon: IconPlayerPlay,
          label: "Playing",
          btnClass:
            "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
        }
      case "LISTENING":
        return {
          icon: IconHeadphones,
          label: "Listening",
          btnClass:
            "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
        }
      case "COMPLETED":
        return {
          icon: IconCheck,
          label: "Completed",
          btnClass:
            "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
        }
      case "ON_HOLD":
        return {
          icon: IconPlayerPause,
          label: "On Hold",
          btnClass:
            "border-border bg-muted/60 text-muted-foreground hover:bg-muted/90",
        }
      case "DROPPED":
        return {
          icon: IconX,
          label: "Dropped",
          btnClass:
            "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
        }
    }
  }

  // Format progress text for status button badge
  const formatProgressSummary = () => {
    if (!entry) return ""
    if (entry.status === "COMPLETED") {
      return entry.score ? `• ${entry.score}★` : ""
    }
    if (category === "anime" || category === "tv") {
      if (entry.progress > 0) {
        return `• ${entry.progress}${media.episodeCount ? `/${media.episodeCount}` : ""} ep`
      }
    } else if (category === "manga") {
      if (entry.progress > 0) {
        return `• ch ${entry.progress}`
      }
    } else if (category === "game") {
      if (entry.progress > 0) {
        return `• ${entry.progress}h`
      }
    }
    return ""
  }

  const inList = Boolean(entry)
  const statusMeta = entry ? getStatusIconAndLabel(entry.status) : null
  const StatusIcon = statusMeta?.icon || IconBookmark

  return (
    <>
      <div className={`flex shrink-0 items-center gap-2 ${className || ""}`}>
        {/* Main Action Button: If in list, shows transformed status button; if not, shows "Add to List" */}
        {inList && statusMeta ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className={`h-8 gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-2xs transition-all ${statusMeta.btnClass}`}
          >
            <StatusIcon className="size-3.5" aria-hidden="true" />
            <span>
              {statusMeta.label} {formatProgressSummary()}
            </span>
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              if (!isAuthenticated) {
                toast.info("Please sign in to add this item to your list")
                return
              }
              setIsModalOpen(true)
            }}
            className="h-8 gap-1.5 rounded-xl px-3 text-xs font-semibold shadow-xs"
          >
            <IconBookmark className="size-3.5" aria-hidden="true" />
            <span>Add to List</span>
          </Button>
        )}

        {/* Quick Add Button: Only visible when NOT in list */}
        {!inList && (
          <Button
            variant="secondary"
            size="sm"
            disabled={isQuickAdding}
            onClick={handleQuickAdd}
            className="h-8 gap-1.5 rounded-xl px-3 text-xs font-medium"
          >
            {isQuickAdding ? (
              <IconLoader2 className="size-3.5 animate-spin" />
            ) : (
              <IconPlus className="size-3.5" aria-hidden="true" />
            )}
            <span>Quick Add</span>
          </Button>
        )}
      </div>

      {/* Add / Edit List Modal & Mobile Drawer */}
      <MediaListModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        media={media}
        initialEntry={entry}
        onEntryUpdated={(updated) => setEntry(updated)}
      />
    </>
  )
}
