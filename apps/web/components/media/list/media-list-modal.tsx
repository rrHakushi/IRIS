"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useUser } from "@/context/user-context"
import {
  IconX,
  IconHeart,
  IconCheck,
  IconLoader2,
  IconChevronDown,
  IconChevronUp,
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconClock,
  IconEye,
  IconBook,
  IconBook2,
  IconPlayerPlay,
  IconHeadphones,
  IconPlayerPause,
  IconActivity,
  IconStar,
  IconRotate2,
  IconFileText,
  IconFolder,
  IconDeviceTv,
  IconAlertCircle,
} from "@tabler/icons-react"
import {
  ModalOverlay as AriaModalOverlay,
  Modal as AriaModal,
  Dialog as AriaDialog,
  Heading as AriaHeading,
} from "react-aria-components"
import {
  fetchFavoriteStatusDeduplicated,
  updateFavoriteCache,
} from "../favorite-button"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import type { NormalizedMediaData } from "../media-types"
import type {
  CanonicalMediaCategory,
  MediaListStatus,
  MediaListEntryData,
} from "./types"
import {
  toCanonicalCategory,
  toBackendMediaType,
  getAvailableStatuses,
  getInProgressStatus,
  formatDateToYmd,
} from "./types"
import { MediaListWatchlistsTab } from "./media-list-watchlists-tab"
import {
  MediaListTvTab,
  type TvSeasonItem,
  type WatchedEpisodeItem,
} from "./media-list-tv-tab"
import {
  MediaListConnectionsTab,
  type ConnectionItem,
} from "./media-list-connections-tab"
import { DatePicker } from "./date-picker"

function getRepeatLabel(category: CanonicalMediaCategory): {
  singular: string
  plural: string
} {
  switch (category) {
    case "manga":
    case "book":
      return { singular: "Reread", plural: "Rereads" }
    case "game":
      return { singular: "Replay", plural: "Replays" }
    case "music":
      return { singular: "Relisten", plural: "Relistens" }
    case "anime":
    case "tv":
    case "movie":
    default:
      return { singular: "Rewatch", plural: "Rewatches" }
  }
}

export interface RewatchHistoryItem {
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  notes?: string | null
}

export interface MediaListModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  media: NormalizedMediaData
  initialEntry?: MediaListEntryData | null
  onEntryUpdated?: (entry: MediaListEntryData | null) => void
}

type TabType = "general" | "watchlists" | "episodes" | "connections"

export function MediaListModal({
  isOpen,
  onOpenChange,
  media,
  initialEntry,
  onEntryUpdated,
}: MediaListModalProps) {
  const isMobile = useIsMobile()
  const { data: session } = useSession()
  const { user } = useUser()
  const username = user?.username || (session?.user as { username?: string })?.username

  const category = toCanonicalCategory(media.category)
  const backendMediaType = toBackendMediaType(category)
  const availableStatuses = useMemo(() => getAvailableStatuses(category), [category])
  const inProgressStatus = useMemo(() => getInProgressStatus(category), [category])
  const maxUnits = media.episodeCount && media.episodeCount > 0 ? media.episodeCount : null
  const maxChapters =
    media.chapterCount && media.chapterCount > 0
      ? media.chapterCount
      : (category === "manga" || category === "book") && media.episodeCount && media.episodeCount > 0
        ? media.episodeCount
        : null
  const maxVolumes =
    media.volumeCount && media.volumeCount > 0
      ? media.volumeCount
      : null
  const repeatLabel = useMemo(() => getRepeatLabel(category), [category])

  const effectiveTvSeasons: TvSeasonItem[] = useMemo(() => {
    if (category !== "tv") return []
    if (media.seasons && media.seasons.length > 0) {
      return media.seasons as unknown as TvSeasonItem[]
    }
    if (media.episodeCount && media.episodeCount > 0) {
      return [
        {
          seasonNumber: 1,
          title: "Season 1",
          episodeCount: media.episodeCount,
        },
      ]
    }
    return []
  }, [category, media.seasons, media.episodeCount])

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>("general")

  // Form State
  const [status, setStatus] = useState<MediaListStatus>(
    initialEntry?.status || "PLANNING"
  )
  const [progress, setProgress] = useState<number>(initialEntry?.progress ?? 0)
  const [chaptersProgress, setChaptersProgress] = useState<number>(() => {
    const raw = (initialEntry as any)?.chaptersProgress ?? initialEntry?.progress ?? 0
    return maxChapters && maxChapters > 0 ? Math.min(maxChapters, raw) : raw
  })
  const [volumesProgress, setVolumesProgress] = useState<number>(() => {
    const raw = (initialEntry as any)?.volumesProgress ?? 0
    return maxVolumes && maxVolumes > 0 ? Math.min(maxVolumes, raw) : raw
  })
  const [score, setScore] = useState<number | null>(initialEntry?.score ?? null)
  const [notes, setNotes] = useState<string>(initialEntry?.notes || "")
  const [isPrivate, setIsPrivate] = useState<boolean>(initialEntry?.private ?? false)
  const [startedAt, setStartedAt] = useState<string>(
    formatDateToYmd(initialEntry?.startedAt)
  )
  const [completedAt, setCompletedAt] = useState<string>(
    formatDateToYmd(initialEntry?.completedAt)
  )
  const [rewatched, setRewatched] = useState<number>(
    (initialEntry as any)?.reread ??
      (initialEntry as any)?.replayed ??
      initialEntry?.rewatched ??
      0
  )
  const [rewatchHistory, setRewatchHistory] = useState<RewatchHistoryItem[]>(
    ((initialEntry as any)?.rereadHistory ??
      (initialEntry as any)?.replayHistory ??
      initialEntry?.rewatchHistory) || []
  )
  const [watchedEpisodes, setWatchedEpisodes] = useState<WatchedEpisodeItem[]>(
    initialEntry?.watchedEpisodes || []
  )
  const [connections, setConnections] = useState<Record<string, ConnectionItem>>(
    (initialEntry?.connections as Record<string, ConnectionItem>) || {}
  )

  // Rewatch carousel state (1 at once)
  const [activeRewatchIdx, setActiveRewatchIdx] = useState(0)
  const rewatchScrollRef = useRef<HTMLDivElement>(null)

  const scrollToRewatch = (idx: number) => {
    const target = Math.max(0, Math.min(rewatched - 1, idx))
    setActiveRewatchIdx(target)
    if (rewatchScrollRef.current) {
      const width = rewatchScrollRef.current.clientWidth
      rewatchScrollRef.current.scrollTo({
        left: target * width,
        behavior: "smooth",
      })
    }
  }

  const handleRewatchedChange = (newVal: number) => {
    const clamped = Math.max(0, newVal)
    setRewatched(clamped)
    if (activeRewatchIdx >= clamped && clamped > 0) {
      setActiveRewatchIdx(clamped - 1)
    }
    setRewatchHistory((prev) => {
      if (clamped === prev.length) return prev
      if (clamped > prev.length) {
        const additions: RewatchHistoryItem[] = Array.from(
          { length: clamped - prev.length },
          () => ({
            startedAt: null,
            completedAt: null,
          })
        )
        return [...prev, ...additions]
      }
      return prev.slice(0, clamped)
    })
  }

  // Status dropdown toggle
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  // Favorite State
  const [isFavorited, setIsFavorited] = useState(false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)

  // Saving / Deleting states
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Sync initial state on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab("general")
      setStatusDropdownOpen(false)
      setActiveRewatchIdx(0)
      if (initialEntry) {
        setStatus(initialEntry.status)
        const rawChapters =
          initialEntry.chaptersProgress ?? initialEntry.progress ?? 0
        setChaptersProgress(
          maxChapters && maxChapters > 0
            ? Math.min(maxChapters, rawChapters)
            : rawChapters
        )
        const rawVolumes = initialEntry.volumesProgress ?? 0
        setVolumesProgress(
          maxVolumes && maxVolumes > 0
            ? Math.min(maxVolumes, rawVolumes)
            : rawVolumes
        )
        setScore(initialEntry.score ?? null)
        setNotes(initialEntry.notes || "")
        setIsPrivate(initialEntry.private ?? false)
        setStartedAt(formatDateToYmd(initialEntry.startedAt))
        setCompletedAt(formatDateToYmd(initialEntry.completedAt))
        setRewatched(
          initialEntry.reread ??
            initialEntry.replayed ??
            initialEntry.rewatched ??
            0
        )
        setRewatchHistory(
          (initialEntry.rereadHistory as RewatchHistoryItem[]) ||
            (initialEntry.replayHistory as RewatchHistoryItem[]) ||
            (initialEntry.rewatchHistory as RewatchHistoryItem[]) ||
            []
        )
        setWatchedEpisodes(initialEntry.watchedEpisodes || [])
        setConnections(
          (initialEntry.connections as Record<string, ConnectionItem>) || {}
        )
      } else {
        setStatus("PLANNING")
        setProgress(0)
        setChaptersProgress(0)
        setVolumesProgress(0)
        setScore(null)
        setNotes("")
        setIsPrivate(false)
        setStartedAt("")
        setCompletedAt("")
        setRewatched(0)
        setRewatchHistory([])
        setWatchedEpisodes([])
        setConnections({})
      }
    }
  }, [isOpen, initialEntry, media, maxChapters, maxVolumes])

  // Fetch favorite status when modal opens (deduplicated)
  useEffect(() => {
    if (isOpen && username && media.id) {
      let isMounted = true
      fetchFavoriteStatusDeduplicated(username, backendMediaType, Number(media.id))
        .then((fav) => {
          if (isMounted) setIsFavorited(fav)
        })
        .catch(() => {})
      return () => {
        isMounted = false
      }
    }
  }, [isOpen, username, media.id, backendMediaType])

  // Listen for favorite updates from external FavoriteButton
  useEffect(() => {
    const handleFavoriteUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        targetId: number
        type: string
        isFavorited: boolean
      }>
      if (
        customEvent.detail &&
        customEvent.detail.targetId === Number(media.id) &&
        customEvent.detail.type === backendMediaType
      ) {
        setIsFavorited(customEvent.detail.isFavorited)
        if (username) {
          updateFavoriteCache(
            username,
            backendMediaType,
            Number(media.id),
            customEvent.detail.isFavorited
          )
        }
      }
    }

    window.addEventListener("iris:favorite-updated", handleFavoriteUpdate)
    return () => {
      window.removeEventListener("iris:favorite-updated", handleFavoriteUpdate)
    }
  }, [username, media.id, backendMediaType])

  const todayIsoDate = () => new Date().toISOString().slice(0, 10)

  // Auto-dating on status change
  const handleStatusChange = (newStatus: MediaListStatus) => {
    setStatus(newStatus)

    if (newStatus === inProgressStatus) {
      if (!startedAt) {
        setStartedAt(todayIsoDate())
      }
    } else if (newStatus === "COMPLETED") {
      if (!completedAt) {
        setCompletedAt(todayIsoDate())
      }
      if (!startedAt) {
        setStartedAt(todayIsoDate())
      }
      if (maxUnits && progress < maxUnits) {
        setProgress(maxUnits)
      }
      if (maxChapters && maxChapters > 0 && chaptersProgress < maxChapters) {
        setChaptersProgress(maxChapters)
      }
      if (maxVolumes && maxVolumes > 0 && volumesProgress < maxVolumes) {
        setVolumesProgress(maxVolumes)
      }
      if (category === "tv" && effectiveTvSeasons.length > 0) {
        const now = new Date().toISOString()
        const existingSet = new Set(
          watchedEpisodes.map((we) => `${we.seasonNumber}_${we.episodeNumber}`)
        )
        const allWatched: WatchedEpisodeItem[] = [...watchedEpisodes]

        effectiveTvSeasons.forEach((s) => {
          const sNum = s.seasonNumber ?? 1
          const epCount = s.episodes?.length || s.episodeCount || 0
          for (let ep = 1; ep <= epCount; ep++) {
            const key = `${sNum}_${ep}`
            if (!existingSet.has(key)) {
              allWatched.push({
                seasonNumber: sNum,
                episodeNumber: ep,
                watchedAt: now,
              })
              existingSet.add(key)
            }
          }
        })

        setWatchedEpisodes(allWatched)
        setProgress(allWatched.length)
      }
    }
  }

  // Favorite toggle
  const handleToggleFavorite = async () => {
    if (!username) {
      toast.info("Please sign in to favorite this item")
      return
    }
    if (isTogglingFavorite) return
    setIsTogglingFavorite(true)

    const prev = isFavorited
    setIsFavorited(!prev)

    try {
      const { data, error } = await elysia
        .user({ username })
        .favorites({ targetId: media.id })
        .post({
          type: backendMediaType as any,
          title: media.titlePrimary,
        })

      if (error || !data) {
        setIsFavorited(prev)
        toast.error("Failed to update favorite")
        return
      }
      const newStatus = Boolean(data.isFavorited)
      setIsFavorited(newStatus)
      updateFavoriteCache(username, backendMediaType, Number(media.id), newStatus)
      window.dispatchEvent(
        new CustomEvent("iris:favorite-updated", {
          detail: {
            targetId: Number(media.id),
            type: backendMediaType,
            isFavorited: newStatus,
          },
        })
      )
      toast.success(
        !prev ? `Added to favorites` : `Removed from favorites`
      )
    } catch {
      setIsFavorited(prev)
      toast.error("Failed to update favorite")
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  // Validation: Score is required if status is COMPLETED
  const isCompletedWithoutScore =
    status === "COMPLETED" && (score === null || score === undefined || score <= 0)

  const isSaveDisabled = isSaving || isCompletedWithoutScore

  // Save handler
  const handleSave = async () => {
    if (!username) {
      toast.error("Please sign in to save your list")
      return
    }

    if (isCompletedWithoutScore) {
      toast.warning("Please provide a score to mark this as Completed")
      return
    }

    setIsSaving(true)

    const commonPayload = {
      status,
      score: score !== null && score > 0 ? Number(score) : null,
      notes: notes.trim() || null,
      private: isPrivate,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      completedAt: completedAt ? new Date(completedAt).toISOString() : null,
      connections: Object.keys(connections).length > 0 ? connections : null,
    }

    try {
      let res: { data?: any; error?: any }

      switch (category) {
        case "anime":
          res = await elysia
            .user({ username })
            .lists.anime({ id: media.id })
            .put({
              ...commonPayload,
              progress,
              rewatched,
              rewatchHistory: rewatchHistory.length > 0 ? rewatchHistory : null,
              watchedEpisodes,
            } as any)
          break
        case "manga":
          res = await elysia
            .user({ username })
            .lists.manga({ id: media.id })
            .put({
              ...commonPayload,
              chaptersProgress,
              volumesProgress,
              reread: rewatched,
              rereadHistory: rewatchHistory.length > 0 ? rewatchHistory : null,
            } as any)
          break
        case "movie":
          res = await elysia
            .user({ username })
            .lists.movie({ id: media.id })
            .put({
              ...commonPayload,
              progress: 0,
              rewatched,
              rewatchHistory: rewatchHistory.length > 0 ? rewatchHistory : null,
            } as any)
          break
        case "tv": {
          const seasonsPayload = effectiveTvSeasons.map((s) => {
            const epCount = s.episodes?.length || s.episodeCount || 0
            const watchedCount = watchedEpisodes.filter(
              (we) => we.seasonNumber === (s.seasonNumber ?? 1)
            ).length
            const isSeasonCompleted =
              status === "COMPLETED" || (epCount > 0 && watchedCount >= epCount)
            return {
              seasonNumber: s.seasonNumber ?? 1,
              status: isSeasonCompleted
                ? "COMPLETED"
                : watchedCount > 0
                  ? "WATCHING"
                  : "PLANNING",
              progress: isSeasonCompleted ? epCount : watchedCount,
              score: null,
            }
          })

          res = await elysia
            .user({ username })
            .lists.tv({ id: media.id })
            .put({
              ...commonPayload,
              progress,
              rewatched,
              rewatchHistory: rewatchHistory.length > 0 ? rewatchHistory : null,
              watchedEpisodes,
              seasons: seasonsPayload.length > 0 ? seasonsPayload : undefined,
            } as any)
          break
        }
        case "game":
          res = await elysia
            .user({ username })
            .lists.game({ id: media.id })
            .put({
              ...commonPayload,
              progress,
              replayed: rewatched,
              replayHistory: rewatchHistory.length > 0 ? rewatchHistory : null,
            } as any)
          break
        case "book":
          res = await elysia
            .user({ username })
            .lists.book({ id: media.id })
            .put({
              ...commonPayload,
              progressChapters: chaptersProgress,
              progressVolumes: volumesProgress,
              reread: rewatched,
              rereadHistory: rewatchHistory.length > 0 ? rewatchHistory : null,
            } as any)
          break
        case "music":
          res = await elysia
            .user({ username })
            .lists.music({ id: media.id })
            .put({
              ...commonPayload,
              progress,
              rewatched,
            } as any)
          break
      }

      if (res.error) {
        throw new Error(res.error.value?.message || "Failed to update list entry")
      }

      const updatedEntry: MediaListEntryData = {
        id: res.data?.entry?.id,
        status,
        progress: category === "manga" ? chaptersProgress : progress,
        chaptersProgress,
        volumesProgress,
        score,
        notes,
        private: isPrivate,
        rewatched,
        reread: rewatched,
        replayed: rewatched,
        startedAt,
        completedAt,
        rewatchHistory,
        rereadHistory: rewatchHistory,
        replayHistory: rewatchHistory,
        connections,
        watchedEpisodes,
      }

      onEntryUpdated?.(updatedEntry)
      toast.success(
        initialEntry ? "List entry updated" : `Added ${media.titlePrimary} to list`
      )
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to save list entry")
    } finally {
      setIsSaving(false)
    }
  }

  // Delete handler
  const handleDelete = async () => {
    if (!username) return
    setIsDeleting(true)

    try {
      let res: { data?: any; error?: any }

      switch (category) {
        case "anime":
          res = await elysia.user({ username }).lists.anime({ id: media.id }).delete()
          break
        case "manga":
          res = await elysia.user({ username }).lists.manga({ id: media.id }).delete()
          break
        case "movie":
          res = await elysia.user({ username }).lists.movie({ id: media.id }).delete()
          break
        case "tv":
          res = await elysia.user({ username }).lists.tv({ id: media.id }).delete()
          break
        case "game":
          res = await elysia.user({ username }).lists.game({ id: media.id }).delete()
          break
        case "book":
          res = await elysia.user({ username }).lists.book({ id: media.id }).delete()
          break
        case "music":
          res = await elysia.user({ username }).lists.music({ id: media.id }).delete()
          break
      }

      if (res.error) {
        throw new Error(res.error.value?.message || "Failed to remove entry")
      }

      onEntryUpdated?.(null)
      toast.info(`Removed ${media.titlePrimary} from your list`)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to remove from list")
    } finally {
      setIsDeleting(false)
    }
  }

  const currentStatusConfig =
    availableStatuses.find((st) => st.value === status) ??
    availableStatuses[0] ?? {
      value: status,
      label: status,
    }

  // Status icon mapping
  const getStatusIcon = (st: MediaListStatus) => {
    switch (st) {
      case "PLANNING":
        return IconClock
      case "WATCHING":
        return IconPlayerPlay
      case "READING":
        return IconBook
      case "PLAYING":
        return IconPlayerPlay
      case "LISTENING":
        return IconHeadphones
      case "COMPLETED":
        return IconCheck
      case "ON_HOLD":
        return IconPlayerPause
      case "DROPPED":
        return IconX
    }
  }

  const StatusIcon = getStatusIcon(status)

  // Converted 0-10 score representation
  const scoreIn10 = score !== null ? (score / 10).toFixed(1).replace(/\.0$/, "") : ""

  const bannerImg = media.bannerImage || media.coverImage

  // Modal Inner JSX
  const content = (
    <div className="relative flex flex-col overflow-hidden bg-background text-foreground">
      {/* Top Banner Header with Backdrop Image and Overlay Vignette */}
      <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-muted">
        {bannerImg ? (
          <img
            src={bannerImg}
            alt=""
            aria-hidden="true"
            className="size-full object-cover object-center brightness-60"
          />
        ) : (
          <div className="size-full bg-muted" />
        )}
        {/* Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Circular Close Button (top-right) */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-3.5 right-3.5 z-30 flex size-8 cursor-pointer items-center justify-center rounded-full border border-border/40 bg-background/60 text-foreground backdrop-blur-md transition-colors hover:bg-background/90"
          aria-label="Close"
        >
          <IconX className="size-4" />
        </button>

        {/* Header Content: Poster + Title + Category Badge + Right Buttons */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-4 sm:p-5">
          <div className="flex items-end gap-3 sm:gap-4 min-w-0">
            {/* Poster thumbnail */}
            <div className="relative aspect-[2/3] w-20 sm:w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-border bg-muted shadow-2xl">
              {media.coverImage ? (
                <img
                  src={media.coverImage}
                  alt={media.titlePrimary}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-muted text-muted-foreground text-xs">
                  No Image
                </div>
              )}
            </div>

            {/* Title */}
            <div className="flex flex-col min-w-0 pb-1">
              <AriaHeading
                slot="title"
                id="media-list-modal-title"
                className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight line-clamp-2"
              >
                {media.titlePrimary}
              </AriaHeading>
            </div>
          </div>

          {/* Right Header Buttons: Favorite + Save */}
          <div className="flex shrink-0 items-center gap-2 pb-1">
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={isTogglingFavorite}
              className={`flex size-9 cursor-pointer items-center justify-center rounded-2xl border backdrop-blur-md transition-all ${
                isFavorited
                  ? "border-primary/60 bg-primary/20 text-primary"
                  : "border-border/40 bg-background/60 text-foreground/80 hover:border-border hover:text-foreground"
              }`}
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <IconHeart
                className={`size-4.5 ${isFavorited ? "fill-primary text-primary" : ""}`}
              />
            </button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isSaveDisabled}
              onClick={handleSave}
              className="h-9 cursor-pointer rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-5 text-xs shadow-lg transition-all"
            >
              {isSaving ? (
                <IconLoader2 className="size-3.5 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Body Area */}
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {/* Navigation Tabs Pill Bar */}
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 p-1 backdrop-blur-md w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "general"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            General
          </button>
          {(category === "tv" || category === "anime") && (
            <button
              type="button"
              onClick={() => setActiveTab("episodes")}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "episodes"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Episodes ({progress}/{maxUnits || "?"})
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("connections")}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "connections"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Connections
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("watchlists")}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "watchlists"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Custom Lists
          </button>
        </div>

        {/* Tab 1: General */}
        {activeTab === "general" && (
          <div className="space-y-3.5">
            {/* Card 1: Status, Score, Rewatches, Start Date, Finish Date */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-xs">
              {/* Row 1: STATUS, SCORE (0-10), TOTAL REWATCHES */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. STATUS */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <IconActivity className="size-3" />
                    STATUS
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                      className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-border/80"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <StatusIcon className="size-3.5 text-primary" />
                        <span className="truncate">{currentStatusConfig.label}</span>
                      </div>
                      <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>

                    {statusDropdownOpen && (
                      <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-popover p-1 shadow-xl text-popover-foreground">
                        {availableStatuses.map((st) => {
                          const IconComp = getStatusIcon(st.value)
                          return (
                            <button
                              key={st.value}
                              type="button"
                              onClick={() => {
                                handleStatusChange(st.value)
                                setStatusDropdownOpen(false)
                              }}
                              className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-xs font-medium transition-colors ${
                                status === st.value
                                  ? "bg-primary/15 text-primary font-semibold"
                                  : "text-foreground hover:bg-muted/40"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <IconComp className="size-3 text-muted-foreground" />
                                <span>{st.label}</span>
                              </div>
                              {status === st.value && (
                                <IconCheck className="size-3 text-primary" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. SCORE (0 - 10) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <IconStar className="size-3 text-muted-foreground" />
                    SCORE (0 - 10)
                    {status === "COMPLETED" && (
                      <span className="text-destructive font-bold">*</span>
                    )}
                  </label>
                  <div
                    className={`flex items-center justify-between rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors ${
                      isCompletedWithoutScore
                        ? "border-destructive focus-within:ring-1 focus-within:ring-destructive"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      placeholder="0"
                      value={scoreIn10}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : Number(e.target.value)
                        if (val === null) setScore(null)
                        else setScore(Math.min(100, Math.max(0, Math.round(val * 10))))
                      }}
                      className="w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="flex flex-col gap-0.5 text-muted-foreground ps-2">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = score !== null ? score / 10 : 0
                          const next = Math.min(10, cur + 1)
                          setScore(Math.round(next * 10))
                        }}
                        className="cursor-pointer hover:text-foreground"
                      >
                        <IconChevronUp className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = score !== null ? score / 10 : 0
                          const next = Math.max(0, cur - 1)
                          setScore(Math.round(next * 10))
                        }}
                        className="cursor-pointer hover:text-foreground"
                      >
                        <IconChevronDown className="size-2.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. REPEAT COUNT (REWATCHES / REREADS / REPLAYS) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <IconRotate2 className="size-3 text-muted-foreground" />
                    {repeatLabel.plural.toUpperCase()}
                  </label>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-border/80">
                    <input
                      type="number"
                      min={0}
                      value={rewatched}
                      onChange={(e) =>
                        handleRewatchedChange(Number(e.target.value))
                      }
                      className="w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="flex flex-col gap-0.5 text-muted-foreground ps-2">
                      <button
                        type="button"
                        onClick={() => handleRewatchedChange(rewatched + 1)}
                        className="cursor-pointer hover:text-foreground"
                      >
                        <IconChevronUp className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRewatchedChange(rewatched - 1)}
                        className="cursor-pointer hover:text-foreground"
                      >
                        <IconChevronDown className="size-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress: Manga / Books (Chapters, Volumes) */}
              {(category === "manga" || category === "book") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* CHAPTERS PROGRESS */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                      <IconBook className="size-3 text-muted-foreground" />
                      CHAPTERS PROGRESS
                    </label>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-border/80">
                      <input
                        type="number"
                        min={0}
                        max={maxChapters && maxChapters > 0 ? maxChapters : undefined}
                        value={chaptersProgress}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (isNaN(val)) return
                          const clamped = Math.max(
                            0,
                            maxChapters && maxChapters > 0
                              ? Math.min(maxChapters, val)
                              : val
                          )
                          setChaptersProgress(clamped)
                        }}
                        className="w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {Boolean(maxChapters && maxChapters > 0) && (
                        <span className="text-[11px] font-medium text-muted-foreground pe-1.5 shrink-0">
                          / {maxChapters}
                        </span>
                      )}
                      <div className="flex flex-col gap-0.5 text-muted-foreground ps-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next = chaptersProgress + 1
                            setChaptersProgress(
                              maxChapters && maxChapters > 0
                                ? Math.min(maxChapters, next)
                                : next
                            )
                          }}
                          className="cursor-pointer hover:text-foreground"
                          aria-label="Increment chapters"
                        >
                          <IconChevronUp className="size-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setChaptersProgress(Math.max(0, chaptersProgress - 1))
                          }
                          className="cursor-pointer hover:text-foreground"
                          aria-label="Decrement chapters"
                        >
                          <IconChevronDown className="size-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* VOLUMES PROGRESS */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                      <IconBook2 className="size-3 text-muted-foreground" />
                      VOLUMES PROGRESS
                    </label>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-border/80">
                      <input
                        type="number"
                        min={0}
                        max={maxVolumes && maxVolumes > 0 ? maxVolumes : undefined}
                        value={volumesProgress}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (isNaN(val)) return
                          const clamped = Math.max(
                            0,
                            maxVolumes && maxVolumes > 0
                              ? Math.min(maxVolumes, val)
                              : val
                          )
                          setVolumesProgress(clamped)
                        }}
                        className="w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {Boolean(maxVolumes && maxVolumes > 0) && (
                        <span className="text-[11px] font-medium text-muted-foreground pe-1.5 shrink-0">
                          / {maxVolumes}
                        </span>
                      )}
                      <div className="flex flex-col gap-0.5 text-muted-foreground ps-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next = volumesProgress + 1
                            setVolumesProgress(
                              maxVolumes && maxVolumes > 0
                                ? Math.min(maxVolumes, next)
                                : next
                            )
                          }}
                          className="cursor-pointer hover:text-foreground"
                          aria-label="Increment volumes"
                        >
                          <IconChevronUp className="size-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVolumesProgress(Math.max(0, volumesProgress - 1))
                          }
                          className="cursor-pointer hover:text-foreground"
                          aria-label="Decrement volumes"
                        >
                          <IconChevronDown className="size-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress: Games (Playtime in Hours) */}
              {category === "game" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                      <IconClock className="size-3 text-muted-foreground" />
                      PLAYTIME (HOURS)
                    </label>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-border/80">
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={progress}
                        onChange={(e) =>
                          setProgress(Math.max(0, Number(e.target.value)))
                        }
                        className="w-full bg-transparent text-xs font-semibold text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[11px] font-medium text-muted-foreground pe-1.5 shrink-0">
                        hrs
                      </span>
                      <div className="flex flex-col gap-0.5 text-muted-foreground ps-2">
                        <button
                          type="button"
                          onClick={() => setProgress(progress + 1)}
                          className="cursor-pointer hover:text-foreground"
                          aria-label="Increment playtime"
                        >
                          <IconChevronUp className="size-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProgress(Math.max(0, progress - 1))}
                          className="cursor-pointer hover:text-foreground"
                          aria-label="Decrement playtime"
                        >
                          <IconChevronDown className="size-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 2: START DATE, FINISH DATE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* START DATE */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <IconCalendar className="size-3 text-muted-foreground" />
                    START DATE
                  </label>
                  <DatePicker
                    value={startedAt}
                    onChange={(val) => setStartedAt(val || "")}
                    placeholder="Pick date"
                    ariaLabel="Start date"
                  />
                </div>

                {/* FINISH DATE */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <IconCalendar className="size-3 text-muted-foreground" />
                    FINISH DATE
                  </label>
                  <DatePicker
                    value={completedAt}
                    onChange={(val) => setCompletedAt(val || "")}
                    placeholder="Pick date"
                    ariaLabel="Finish date"
                    align="end"
                  />
                </div>
              </div>
            </div>

            {/* Card: REPEAT DATES (scrollable, only show 1 at once) */}
            {rewatched > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    <IconRotate2 className="size-3 text-muted-foreground" />
                    {repeatLabel.plural.toUpperCase()} DATES ({rewatched})
                  </label>
                  {rewatched > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={activeRewatchIdx === 0}
                        onClick={() => scrollToRewatch(activeRewatchIdx - 1)}
                        className="flex size-6 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Previous ${repeatLabel.singular.toLowerCase()}`}
                      >
                        <IconChevronLeft className="size-3.5" />
                      </button>
                      <span className="text-[11px] font-mono text-muted-foreground px-1">
                        {activeRewatchIdx + 1} / {rewatched}
                      </span>
                      <button
                        type="button"
                        disabled={activeRewatchIdx === rewatched - 1}
                        onClick={() => scrollToRewatch(activeRewatchIdx + 1)}
                        className="flex size-6 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Next ${repeatLabel.singular.toLowerCase()}`}
                      >
                        <IconChevronRight className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div
                  ref={rewatchScrollRef}
                  onScroll={(e) => {
                    const el = e.currentTarget
                    const width = el.clientWidth
                    if (width > 0) {
                      const idx = Math.round(el.scrollLeft / width)
                      if (idx !== activeRewatchIdx && idx >= 0 && idx < rewatched) {
                        setActiveRewatchIdx(idx)
                      }
                    }
                  }}
                  className="flex w-full snap-x snap-mandatory overflow-x-auto no-scrollbar scroll-smooth"
                >
                  {Array.from({ length: rewatched }, (_, idx) => {
                    const item = rewatchHistory[idx] || {}
                    const itemStartedAt = formatDateToYmd(item.startedAt)
                    const itemCompletedAt = formatDateToYmd(item.completedAt)

                    return (
                      <div
                        key={idx}
                        className="w-full shrink-0 snap-center space-y-2 rounded-xl border border-border bg-muted/20 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-foreground">
                            {repeatLabel.singular} #{idx + 1}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {idx + 1} of {rewatched}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Repeat Start Date */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              Start Date
                            </span>
                            <DatePicker
                              value={itemStartedAt}
                              onChange={(val) => {
                                const updated = [...rewatchHistory]
                                updated[idx] = {
                                  ...updated[idx],
                                  startedAt: val
                                    ? new Date(val).toISOString()
                                    : null,
                                }
                                setRewatchHistory(updated)
                              }}
                              placeholder="Pick date"
                              ariaLabel={`${repeatLabel.singular} ${idx + 1} start date`}
                            />
                          </div>

                          {/* Repeat Finish Date */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              Finish Date
                            </span>
                            <DatePicker
                              value={itemCompletedAt}
                              onChange={(val) => {
                                const updated = [...rewatchHistory]
                                updated[idx] = {
                                  ...updated[idx],
                                  completedAt: val
                                    ? new Date(val).toISOString()
                                    : null,
                                }
                                setRewatchHistory(updated)
                              }}
                              placeholder="Pick date"
                              ariaLabel={`${repeatLabel.singular} ${idx + 1} finish date`}
                              align="end"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Card 2: NOTES */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <label className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <IconFileText className="size-3 text-muted-foreground" />
                NOTES
              </label>
              <textarea
                placeholder="Your thoughts, reviews, or private notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              />
            </div>

            {/* Bottom Row: Error Alongside Delete Button */}
            <div className="flex items-center justify-between gap-3 pt-1 min-h-[32px]">
              <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                {isCompletedWithoutScore && (
                  <>
                    <IconAlertCircle className="size-4 shrink-0 text-destructive" />
                    <span>A score is required to mark as Completed.</span>
                  </>
                )}
              </div>

              {initialEntry && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="cursor-pointer rounded-xl border border-border bg-secondary text-secondary-foreground px-4 py-1.5 text-xs font-medium hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Watchlists */}
        {activeTab === "watchlists" && (
          <MediaListWatchlistsTab
            mediaId={media.id}
            category={category}
            titlePrimary={media.titlePrimary}
          />
        )}

        {/* Tab 3: Episodes / Seasons (TV / Anime) */}
        {activeTab === "episodes" && (
          <MediaListTvTab
            mediaId={media.id}
            category={category}
            seasons={effectiveTvSeasons}
            episodes={media.episodes as any}
            episodeCount={media.episodeCount}
            progress={progress}
            onProgressChange={(newProgress) => {
              setProgress(newProgress)
              if (maxUnits && newProgress >= maxUnits) {
                handleStatusChange("COMPLETED")
              } else if (newProgress > 0 && status === "PLANNING") {
                handleStatusChange(inProgressStatus)
              }
            }}
            watchedEpisodes={watchedEpisodes}
            onWatchedEpisodesChange={(newWatched) => {
              setWatchedEpisodes(newWatched)
              const totalTvEpisodes = effectiveTvSeasons.reduce(
                (sum, s) => sum + (s.episodes?.length || s.episodeCount || 0),
                0
              )
              if (totalTvEpisodes > 0 && newWatched.length >= totalTvEpisodes) {
                handleStatusChange("COMPLETED")
              }
            }}
          />
        )}

        {/* Tab 4: Connections */}
        {activeTab === "connections" && (
          <MediaListConnectionsTab
            media={media}
            category={category}
            connections={connections}
            onConnectionsChange={setConnections}
            inheritedStatus={status}
            inheritedProgress={progress}
            inheritedStartedAt={startedAt}
            inheritedCompletedAt={completedAt}
            progressUnitLabel={
              category === "tv" || category === "anime"
                ? "Ep"
                : category === "manga"
                  ? "Ch"
                  : ""
            }
          />
        )}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <AriaModalOverlay
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        isDismissable
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-entering:opacity-0 data-exiting:opacity-0 supports-backdrop-filter:backdrop-blur-sm"
      >
        <AriaModal
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-3xl border-t border-border bg-background p-0 text-foreground overflow-y-auto no-scrollbar outline-none transition duration-200 ease-in-out data-entering:translate-y-[2.5rem] data-exiting:translate-y-[2.5rem]"
        >
          <AriaDialog
            aria-label={`Edit ${media.titlePrimary} in list`}
            aria-labelledby="media-list-modal-title"
            className="[display:inherit] h-full max-h-[inherit] [flex-direction:inherit] [gap:inherit] outline-none"
          >
            <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-muted-foreground/20" />
            {content}
          </AriaDialog>
        </AriaModal>
      </AriaModalOverlay>
    )
  }

  return (
    <AriaModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 isolate z-50 bg-black/40 duration-100 data-entering:animate-in data-entering:fade-in-0 data-exiting:animate-out data-exiting:fade-out-0 supports-backdrop-filter:backdrop-blur-sm"
    >
      <AriaModal
        className="fixed start-1/2 top-1/2 z-50 grid w-full max-w-xl sm:max-w-2xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-background p-0 shadow-2xl text-foreground overflow-y-auto no-scrollbar outline-none data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 rtl:translate-x-1/2"
      >
        <AriaDialog
          aria-label={`Edit ${media.titlePrimary} in list`}
          aria-labelledby="media-list-modal-title"
          className="[display:inherit] [gap:inherit] outline-none"
        >
          {content}
        </AriaDialog>
      </AriaModal>
    </AriaModalOverlay>
  )
}
