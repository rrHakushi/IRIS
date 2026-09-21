"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconSparkles,
  IconFilePencil,
  IconFolder,
  IconTrash,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconArrowLeft,
  IconFileCheck,
  IconPhotoOff,
  IconDeviceTv,
  IconFileText,
  IconBookmark,
  IconBookmarkOff,
  IconCheck,
  IconX,
  IconFilter,
  IconLayoutGrid,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { dedupGet, invalidateDedup } from "@/lib/request-dedup"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ServarrInteractiveSearchDialog } from "./servarr-interactive-search-dialog"
import { ServarrRenameDialog } from "./servarr-rename-dialog"
import { ServarrFileManagerDialog } from "./servarr-file-manager-dialog"
import { ServarrManualImportDialog } from "./servarr-manual-import-dialog"
import { ServarrDeleteMediaDialog } from "./servarr-delete-dialog"

export interface ServarrSeriesDetailViewProps {
  seriesId: number
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "—"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

export function ServarrSeriesDetailView({
  seriesId,
}: ServarrSeriesDetailViewProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [seriesData, setSeriesData] = useState<any>(null)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [activeSeason, setActiveSeason] = useState<number | null>(null)
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<number | null>(
    null
  )
  const [posterError, setPosterError] = useState(false)
  const [bannerError, setBannerError] = useState(false)

  // Season Picker & Navigation States
  const [isSeasonPickerOpen, setIsSeasonPickerOpen] = useState(false)
  const [seasonSearchQuery, setSeasonSearchQuery] = useState("")
  const pillsContainerRef = useRef<HTMLDivElement>(null)
  const seasonPickerRef = useRef<HTMLDivElement>(null)

  // Dialog States
  const [interactiveSearchTarget, setInteractiveSearchTarget] = useState<{
    type: "series" | "season" | "episode"
    seasonNumber?: number
    seasonTitle?: string
    episodeId?: number
    episodeTitle?: string
  } | null>(null)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false)
  const [isManualImportOpen, setIsManualImportOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const inFlightRef = useRef(false)
  const lastFetchedIdRef = useRef<number | null>(null)

  const fetchSeries = useCallback(
    async (force = false) => {
      if (!force && inFlightRef.current) return
      inFlightRef.current = true
      setIsLoading(true)
      try {
        const res = await dedupGet(
          `servarr:sonarr:series:${seriesId}`,
          () => elysia.servarr.sonarr.series({ id: seriesId }).get(),
          { force, ttlMs: 3000 }
        )
        if (res?.data?.success && res.data.series) {
          setSeriesData(res.data.series)
          setEpisodes(res.data.episodes || [])
          setFiles(res.data.files || [])

          // Default to first monitored season or highest season
          const seasons = res.data.series.seasons || []
          if (seasons.length > 0) {
            setActiveSeason((prev) => {
              if (
                prev !== null &&
                seasons.some((s: any) => s.seasonNumber === prev)
              )
                return prev
              const firstMonitored = seasons.find(
                (s: any) => s.seasonNumber > 0 && s.monitored
              )
              return firstMonitored
                ? firstMonitored.seasonNumber
                : seasons[seasons.length - 1].seasonNumber
            })
          }
        } else {
          toast.error("Failed to load series details", {
            description: res?.data?.message || "Unknown error",
          })
        }
      } catch (err: any) {
        toast.error("Error loading series", { description: err.message })
      } finally {
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [seriesId]
  )

  useEffect(() => {
    if (lastFetchedIdRef.current === seriesId) return
    lastFetchedIdRef.current = seriesId
    fetchSeries()
  }, [seriesId, fetchSeries])

  // Handle click outside for Season Picker Popover
  useEffect(() => {
    if (!isSeasonPickerOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (
        seasonPickerRef.current &&
        !seasonPickerRef.current.contains(event.target as Node)
      ) {
        setIsSeasonPickerOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isSeasonPickerOpen])

  // Auto-scroll active season pill into view
  useEffect(() => {
    if (!pillsContainerRef.current || activeSeason === null) return
    const activeEl = pillsContainerRef.current.querySelector(
      `[data-season-number="${activeSeason}"]`
    )
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      })
    }
  }, [activeSeason])

  // --- Monitoring Handlers ---
  const handleToggleSeriesMonitoring = async () => {
    if (!seriesData) return
    const newMonitored = !seriesData.monitored
    setSeriesData((prev: any) => ({ ...prev, monitored: newMonitored }))

    try {
      const res = await elysia.servarr.sonarr.series({ id: seriesId }).put({
        ...seriesData,
        monitored: newMonitored,
      })
      if (res?.data?.success) {
        toast.success(
          `Series monitoring ${newMonitored ? "enabled" : "disabled"}`
        )
      } else {
        toast.error("Failed to update series monitoring", {
          description: res?.data?.message || "Unknown error",
        })
        setSeriesData((prev: any) => ({ ...prev, monitored: !newMonitored }))
      }
    } catch (err: any) {
      toast.error("Failed to update series monitoring", {
        description: err.message,
      })
      setSeriesData((prev: any) => ({ ...prev, monitored: !newMonitored }))
    }
  }

  const handleToggleSeasonMonitoring = async (seasonNum: number) => {
    if (!seriesData) return
    const currentSeasonObj = seriesData.seasons?.find(
      (s: any) => s.seasonNumber === seasonNum
    )
    const newMonitored = currentSeasonObj ? !currentSeasonObj.monitored : true

    const updatedSeasons = (seriesData.seasons || []).map((s: any) =>
      s.seasonNumber === seasonNum ? { ...s, monitored: newMonitored } : s
    )

    setSeriesData((prev: any) => ({ ...prev, seasons: updatedSeasons }))

    try {
      const res = await elysia.servarr.sonarr.series({ id: seriesId }).put({
        ...seriesData,
        seasons: updatedSeasons,
      })
      if (res?.data?.success) {
        toast.success(
          `Season ${seasonNum} monitoring ${newMonitored ? "enabled" : "disabled"}`
        )
      } else {
        toast.error("Failed to update season monitoring", {
          description: res?.data?.message || "Unknown error",
        })
        fetchSeries()
      }
    } catch (err: any) {
      toast.error("Failed to update season monitoring", {
        description: err.message,
      })
      fetchSeries()
    }
  }

  const handleToggleEpisodeMonitoring = async (ep: any) => {
    const newMonitored = ep.monitored === false ? true : false

    // Optimistic update
    setEpisodes((prev) =>
      prev.map((e) => (e.id === ep.id ? { ...e, monitored: newMonitored } : e))
    )

    try {
      const res = await (elysia.servarr.sonarr as any)
        .episode({ id: ep.id })
        .put({
          ...ep,
          monitored: newMonitored,
        })
      if (res?.data?.success) {
        toast.success(
          `Episode ${ep.episodeNumber} ${newMonitored ? "monitored" : "unmonitored"}`
        )
      } else {
        toast.error("Failed to update episode monitoring", {
          description: res?.data?.message || "Unknown error",
        })
        setEpisodes((prev) =>
          prev.map((e) =>
            e.id === ep.id ? { ...e, monitored: !newMonitored } : e
          )
        )
      }
    } catch (err: any) {
      toast.error("Failed to update episode monitoring", {
        description: err.message,
      })
      setEpisodes((prev) =>
        prev.map((e) =>
          e.id === ep.id ? { ...e, monitored: !newMonitored } : e
        )
      )
    }
  }

  const handleSearchAll = async () => {
    try {
      await elysia.servarr.sonarr.command.post({
        name: "SeriesSearch",
        seriesId,
      })
      toast.success(`Automatic search started for ${seriesData?.title}`)
    } catch (err: any) {
      toast.error("Search request failed", { description: err.message })
    }
  }

  const handleSearchSeason = async (seasonNum: number) => {
    try {
      await elysia.servarr.sonarr.command.post({
        name: "SeasonSearch",
        seriesId,
        body: { seasonNumber: seasonNum },
      })
      toast.success(`Automatic search started for Season ${seasonNum}`)
    } catch (err: any) {
      toast.error("Season search request failed", { description: err.message })
    }
  }

  // Season Data & Filtering Calculations (Hooks must be called unconditionally)
  const seasonsList = useMemo(() => {
    const raw = seriesData?.seasons || []
    return [...raw].sort((a: any, b: any) => {
      if (a.seasonNumber === 0) return 1
      if (b.seasonNumber === 0) return -1
      return a.seasonNumber - b.seasonNumber
    })
  }, [seriesData?.seasons])

  const seasonStatsMap = useMemo(() => {
    const map = new Map<
      number,
      { total: number; downloaded: number; missing: number; monitored: boolean }
    >()
    if (!seriesData?.seasons) return map
    for (const s of seriesData.seasons) {
      const sEps = episodes.filter((e) => e.seasonNumber === s.seasonNumber)
      const downloaded = sEps.filter((e) => e.hasFile).length
      const missing = sEps.filter(
        (e) => !e.hasFile && e.monitored !== false
      ).length
      map.set(s.seasonNumber, {
        total: sEps.length,
        downloaded,
        missing,
        monitored: s.monitored !== false,
      })
    }
    return map
  }, [seriesData?.seasons, episodes])

  const filteredSeasonsList = useMemo(() => {
    if (!seasonSearchQuery.trim()) return seasonsList
    const q = seasonSearchQuery.toLowerCase().trim()
    return seasonsList.filter((s: any) => {
      const label =
        s.seasonNumber === 0 ? "specials" : `season ${s.seasonNumber}`
      return label.includes(q) || String(s.seasonNumber).includes(q)
    })
  }, [seasonsList, seasonSearchQuery])

  const currentSeasonIndex = seasonsList.findIndex(
    (s: any) => s.seasonNumber === activeSeason
  )
  const currentSeasonObj =
    seasonsList.find((s: any) => s.seasonNumber === activeSeason) ||
    seasonsList[0]
  const currentSeasonEpisodes = episodes.filter(
    (ep: any) => ep.seasonNumber === activeSeason
  )
  const currentSeasonStats =
    activeSeason !== null ? seasonStatsMap.get(activeSeason) : null
  const currentSeasonDownloaded = currentSeasonStats?.downloaded ?? 0
  const currentSeasonMissing = currentSeasonStats?.missing ?? 0
  const isCurrentSeasonMonitored = currentSeasonObj?.monitored !== false

  const scrollPills = (direction: "left" | "right") => {
    if (!pillsContainerRef.current) return
    const scrollAmount = 240
    pillsContainerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Spinner className="size-8 text-primary" />
        <span className="text-xs font-medium">Loading series details...</span>
      </div>
    )
  }

  if (!seriesData) {
    return (
      <div className="mx-auto mt-8 max-w-4xl rounded-3xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
        <IconDeviceTv className="mx-auto mb-3 size-12 opacity-40" />
        <p className="text-sm font-semibold text-foreground">
          Series not found
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The requested series could not be loaded from Sonarr.
        </p>
        <Link href="/IRIS-list/servarr/sonarr">
          <Button variant="outline" size="sm" className="mt-4 gap-2 rounded-xl">
            <IconArrowLeft className="size-4" /> Return to Series List
          </Button>
        </Link>
      </div>
    )
  }

  const poster =
    seriesData.images?.find((img: any) => img.coverType === "poster")
      ?.remoteUrl ||
    seriesData.images?.find((img: any) => img.coverType === "poster")?.url
  const fanart =
    seriesData.images?.find((img: any) => img.coverType === "fanart")
      ?.remoteUrl ||
    seriesData.images?.find((img: any) => img.coverType === "fanart")?.url

  // Map files by episodeFileId
  const fileMap = new Map<number, any>()
  files.forEach((f) => {
    fileMap.set(f.id, f)
  })

  const isContinuing = seriesData.status?.toLowerCase() === "continuing"
  const isAnime = seriesData.seriesType === "anime"
  const isSeriesMonitored = seriesData.monitored !== false

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* 1. IRIS Full-Bleed Media Hero Section */}
      <div className="relative w-full border-b border-border/40 bg-card/40">
        {/* Backdrop Banner */}
        <div className="relative h-36 w-full overflow-hidden bg-muted sm:h-48 md:h-56">
          {fanart && !bannerError ? (
            <img
              src={fanart}
              alt=""
              aria-hidden="true"
              onError={() => setBannerError(true)}
              className="h-full w-full object-cover object-center"
            />
          ) : poster && !posterError ? (
            <img
              src={poster}
              alt=""
              aria-hidden="true"
              className="h-full w-full scale-105 object-cover object-center opacity-40 blur-md"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-muted/60 to-background/90" />
          )}

          {/* Smooth Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-radial from-transparent to-background/30" />

          {/* Floating Back Navigation Pill */}
          <div className="absolute start-3 top-3 z-20 sm:start-6 sm:top-4">
            <Link
              href="/IRIS-list/servarr/sonarr"
              className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md transition-colors hover:border-border hover:bg-background"
            >
              <IconArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Series</span>
            </Link>
          </div>
        </div>

        {/* Hero Meta Container */}
        <div className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:gap-6">
            {/* Floating Poster */}
            <div className="relative z-10 -mt-16 w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-background/80 bg-muted shadow-xl ring-1 ring-border/50 sm:-mt-20 sm:w-36 md:w-44">
              <div className="aspect-[2/3] w-full">
                {poster && !posterError ? (
                  <img
                    src={poster}
                    alt={seriesData.title}
                    className="h-full w-full object-cover"
                    onError={() => setPosterError(true)}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center text-muted-foreground/60">
                    <IconPhotoOff className="mb-1.5 size-8 opacity-50" />
                    <span className="line-clamp-2 text-[10px] font-medium">
                      {seriesData.title}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Header Information & Actions */}
            <div className="flex min-w-0 flex-1 flex-col justify-end gap-3">
              {/* Title and Badges */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">
                    {seriesData.title}
                  </h1>
                  {seriesData.year && (
                    <span className="font-heading text-lg font-normal text-muted-foreground sm:text-xl">
                      ({seriesData.year})
                    </span>
                  )}
                </div>

                {seriesData.originalTitle &&
                  seriesData.originalTitle !== seriesData.title && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {seriesData.originalTitle}
                    </p>
                  )}

                {/* Metadata Tags */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <Badge
                    variant={isContinuing ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] font-semibold",
                      isContinuing &&
                        "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20"
                    )}
                  >
                    {seriesData.status || "Unknown Status"}
                  </Badge>

                  <Badge
                    variant="outline"
                    className="border-border/70 text-[10px] font-semibold"
                  >
                    {isAnime ? "Anime" : "Standard TV"}
                  </Badge>

                  {/* Interactive Series Monitoring Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleSeriesMonitoring}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-xl border px-2 py-0.5 text-[10px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSeriesMonitored
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                        : "border-border/60 bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                    title={
                      isSeriesMonitored
                        ? "Click to Unmonitor Series"
                        : "Click to Monitor Series"
                    }
                  >
                    {isSeriesMonitored ? (
                      <IconBookmark className="size-3 fill-emerald-500 text-emerald-500" />
                    ) : (
                      <IconBookmarkOff className="size-3" />
                    )}
                    <span>
                      {isSeriesMonitored
                        ? "Series Monitored"
                        : "Series Unmonitored"}
                    </span>
                  </button>

                  {seriesData.network && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium text-muted-foreground"
                    >
                      {seriesData.network}
                    </Badge>
                  )}

                  {seriesData.genres?.map((g: string) => (
                    <Badge
                      key={g}
                      variant="outline"
                      className="border-border/40 text-[10px] text-muted-foreground/80"
                    >
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Series Path & Overview */}
              {seriesData.overview && (
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:line-clamp-3">
                  {seriesData.overview}
                </p>
              )}

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSearchAll}
                    className="h-8 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
                  >
                    <IconSearch className="size-3.5" />
                    <span>Search Series</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setInteractiveSearchTarget({
                        type: "series",
                        seasonTitle: "Entire Series",
                      })
                    }
                    className="h-8 gap-1.5 rounded-xl border-primary/30 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    <IconSearch className="size-3.5" />
                    <span>Interactive Search</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRenameOpen(true)}
                    className="h-8 gap-1.5 rounded-xl text-xs font-medium"
                  >
                    <IconFilePencil className="size-3.5 text-amber-500" />
                    <span>Rename Files</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFileManagerOpen(true)}
                    className="h-8 gap-1.5 rounded-xl text-xs font-medium"
                  >
                    <IconFolder className="size-3.5 text-blue-500" />
                    <span>Manage Files</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManualImportOpen(true)}
                    className="h-8 gap-1.5 rounded-xl text-xs font-medium"
                  >
                    <IconFileCheck className="size-3.5 text-emerald-500" />
                    <span>Manual Import</span>
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="h-8 gap-1.5 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <IconTrash className="size-3.5" />
                  <span>Delete Series</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Body: Season Control Hub & Episode Cards */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Modern Elevated Season Control Hub */}
        <div className="flex flex-col gap-4 rounded-3xl border border-border/50 bg-card/60 p-4 shadow-xs ring-1 ring-foreground/5 backdrop-blur-xs sm:p-5 dark:ring-foreground/10">
          {/* Top Row: Quick-Jumper Dropdown + Navigation Controls + Scrollable Pills */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Left: Quick-Jumper Dropdown Trigger + Step Previous/Next Buttons */}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Season Picker Dropdown Anchor */}
              <div className="relative" ref={seasonPickerRef}>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsSeasonPickerOpen((prev) => !prev)}
                  className={cn(
                    "h-9 gap-2 rounded-2xl border-border/70 bg-background/90 px-3 text-xs font-semibold shadow-xs transition-all hover:border-primary/50",
                    isSeasonPickerOpen &&
                      "border-primary ring-2 ring-primary/20"
                  )}
                  aria-expanded={isSeasonPickerOpen}
                  aria-label="Select Season"
                >
                  <IconDeviceTv className="size-4 text-primary" />
                  <span className="font-heading font-bold">
                    {currentSeasonObj?.seasonNumber === 0
                      ? "Specials"
                      : `Season ${activeSeason}`}
                  </span>
                  <Badge
                    variant="secondary"
                    className="rounded-lg bg-muted px-1.5 py-0 font-mono text-[10px] font-bold"
                  >
                    {currentSeasonDownloaded}/{currentSeasonEpisodes.length}
                  </Badge>
                  <IconChevronDown
                    className={cn(
                      "size-3.5 opacity-60 transition-transform duration-200",
                      isSeasonPickerOpen &&
                        "rotate-180 text-primary opacity-100"
                    )}
                  />
                </Button>

                {/* Rich Season Picker Floating Popover */}
                {isSeasonPickerOpen && (
                  <div className="absolute start-0 top-full z-50 mt-2 w-80 animate-in rounded-3xl border border-border/70 bg-popover/95 p-3.5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 backdrop-blur-2xl duration-150 fade-in-0 zoom-in-95 sm:w-96">
                    {/* Popover Header */}
                    <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                      <div className="flex items-center gap-2">
                        <IconLayoutGrid className="size-4 text-primary" />
                        <span className="font-heading text-xs font-bold text-foreground">
                          Select Season
                        </span>
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 font-mono text-[10px]"
                        >
                          {seasonsList.length} total
                        </Badge>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSeasonPickerOpen(false)}
                        className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Close season picker"
                      >
                        <IconX className="size-3.5" />
                      </button>
                    </div>

                    {/* Quick Search Filter for large season counts */}
                    {seasonsList.length > 5 && (
                      <div className="relative mt-2.5">
                        <IconSearch className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Filter seasons (e.g. 15, specials)..."
                          value={seasonSearchQuery}
                          onChange={(e) => setSeasonSearchQuery(e.target.value)}
                          className="h-8 rounded-xl border-border/60 bg-background/50 ps-8 text-xs"
                          autoFocus
                        />
                      </div>
                    )}

                    {/* Scrollable Seasons Grid */}
                    <div className="mt-2.5 no-scrollbar max-h-72 space-y-1.5 overflow-y-auto pe-0.5">
                      {filteredSeasonsList.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                          No seasons match &quot;{seasonSearchQuery}&quot;
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {filteredSeasonsList.map((s: any) => {
                            const isSel = activeSeason === s.seasonNumber
                            const stats = seasonStatsMap.get(
                              s.seasonNumber
                            ) || {
                              total: 0,
                              downloaded: 0,
                              missing: 0,
                              monitored: true,
                            }
                            const isComplete =
                              stats.total > 0 &&
                              stats.downloaded === stats.total
                            const isMonitored = s.monitored !== false

                            return (
                              <button
                                key={s.seasonNumber}
                                type="button"
                                onClick={() => {
                                  setActiveSeason(s.seasonNumber)
                                  setIsSeasonPickerOpen(false)
                                  setSeasonSearchQuery("")
                                }}
                                className={cn(
                                  "group flex cursor-pointer flex-col rounded-2xl border p-2.5 text-start transition-all",
                                  isSel
                                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                                    : "border-border/50 bg-background/60 hover:border-border hover:bg-muted/40"
                                )}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5">
                                    {isMonitored ? (
                                      <IconBookmark
                                        className={cn(
                                          "size-3",
                                          isSel
                                            ? "fill-primary text-primary"
                                            : "fill-emerald-500/30 text-emerald-500"
                                        )}
                                      />
                                    ) : (
                                      <IconBookmarkOff className="size-3 text-muted-foreground opacity-60" />
                                    )}
                                    <span
                                      className={cn(
                                        "font-heading text-xs font-semibold",
                                        isSel
                                          ? "text-primary"
                                          : "text-foreground"
                                      )}
                                    >
                                      {s.seasonNumber === 0
                                        ? "Specials"
                                        : `Season ${s.seasonNumber}`}
                                    </span>
                                  </div>
                                  {isSel && (
                                    <IconCheck className="size-3.5 shrink-0 text-primary" />
                                  )}
                                </div>

                                {/* Mini Progress & Counts */}
                                <div className="mt-2 flex items-center justify-between text-[10px]">
                                  <span className="font-mono text-muted-foreground">
                                    {stats.downloaded}/{stats.total} eps
                                  </span>
                                  <span
                                    className={cn(
                                      "font-mono text-[9px] font-semibold",
                                      isComplete
                                        ? "text-emerald-500"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {isComplete
                                      ? "Complete"
                                      : stats.total > 0
                                        ? `${Math.round((stats.downloaded / stats.total) * 100)}%`
                                        : "0%"}
                                  </span>
                                </div>

                                {/* Progress bar */}
                                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted/60">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      isComplete
                                        ? "bg-emerald-500"
                                        : isSel
                                          ? "bg-primary"
                                          : "bg-primary/70"
                                    )}
                                    style={{
                                      width:
                                        stats.total > 0
                                          ? `${Math.min(100, (stats.downloaded / stats.total) * 100)}%`
                                          : "0%",
                                    }}
                                  />
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Prev Season Step Button */}
              <Button
                variant="outline"
                size="icon"
                type="button"
                disabled={currentSeasonIndex <= 0}
                onClick={() => {
                  if (currentSeasonIndex > 0) {
                    setActiveSeason(
                      seasonsList[currentSeasonIndex - 1].seasonNumber
                    )
                  }
                }}
                className="size-9 rounded-2xl border-border/70 bg-background/90 shadow-xs"
                aria-label={
                  currentSeasonIndex > 0
                    ? `Previous (${seasonsList[currentSeasonIndex - 1].seasonNumber === 0 ? "Specials" : `Season ${seasonsList[currentSeasonIndex - 1].seasonNumber}`})`
                    : "First Season"
                }
              >
                <IconChevronLeft className="size-4" />
              </Button>

              {/* Next Season Step Button */}
              <Button
                variant="outline"
                size="icon"
                type="button"
                disabled={currentSeasonIndex >= seasonsList.length - 1}
                onClick={() => {
                  if (currentSeasonIndex < seasonsList.length - 1) {
                    setActiveSeason(
                      seasonsList[currentSeasonIndex + 1].seasonNumber
                    )
                  }
                }}
                className="size-9 rounded-2xl border-border/70 bg-background/90 shadow-xs"
                aria-label={
                  currentSeasonIndex < seasonsList.length - 1
                    ? `Next (${seasonsList[currentSeasonIndex + 1].seasonNumber === 0 ? "Specials" : `Season ${seasonsList[currentSeasonIndex + 1].seasonNumber}`})`
                    : "Last Season"
                }
              >
                <IconChevronRight className="size-4" />
              </Button>
            </div>

            {/* Right / Center: Smooth Horizontal Pill Strip with Arrow Controls */}
            <div className="relative flex min-w-0 flex-1 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => scrollPills("left")}
                className="hidden size-8 shrink-0 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
                aria-label="Scroll Seasons Left"
              >
                <IconChevronLeft className="size-4" />
              </Button>

              {/* Pills Scroll Container */}
              <div
                ref={pillsContainerRef}
                className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scroll-smooth px-0.5 py-1 select-none"
                onWheel={(e) => {
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY
                  }
                }}
              >
                {seasonsList.map((season: any) => {
                  const isActive = activeSeason === season.seasonNumber
                  const stats = seasonStatsMap.get(season.seasonNumber) || {
                    total: 0,
                    downloaded: 0,
                    missing: 0,
                    monitored: true,
                  }
                  const isMonitored = season.monitored !== false

                  return (
                    <button
                      key={season.seasonNumber}
                      data-season-number={season.seasonNumber}
                      type="button"
                      onClick={() => setActiveSeason(season.seasonNumber)}
                      className={cn(
                        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "bg-primary font-bold text-primary-foreground shadow-xs ring-2 ring-primary/30"
                          : "border border-border/40 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {isMonitored ? (
                        <IconBookmark
                          className={cn(
                            "size-3.5",
                            isActive
                              ? "fill-primary-foreground text-primary-foreground"
                              : "fill-emerald-500/50 text-emerald-500"
                          )}
                        />
                      ) : (
                        <IconBookmarkOff
                          className={cn(
                            "size-3.5 opacity-60",
                            isActive
                              ? "text-primary-foreground"
                              : "text-muted-foreground"
                          )}
                        />
                      )}
                      <span>
                        {season.seasonNumber === 0
                          ? "Specials"
                          : `Season ${season.seasonNumber}`}
                      </span>
                      <span
                        className={cn(
                          "py-0.2 rounded-full px-1.5 font-mono text-[10px] font-bold",
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-background/80 text-muted-foreground"
                        )}
                      >
                        {stats.downloaded}/{stats.total}
                      </span>
                    </button>
                  )
                })}
              </div>

              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => scrollPills("right")}
                className="hidden size-8 shrink-0 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
                aria-label="Scroll Seasons Right"
              >
                <IconChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Bottom Row: Active Season Stats & Season Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
            {/* Active Season Information & Breakdown */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <IconDeviceTv className="size-4 text-primary" />
                <span className="font-heading text-sm font-bold text-foreground">
                  {currentSeasonObj?.seasonNumber === 0
                    ? "Specials"
                    : `Season ${activeSeason}`}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "ms-1 rounded-lg py-0.5 text-[10px] font-semibold",
                    isCurrentSeasonMonitored
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                      : "border-border/60 bg-muted text-muted-foreground"
                  )}
                >
                  {isCurrentSeasonMonitored ? "Monitored" : "Unmonitored"}
                </Badge>
              </div>

              <span className="hidden text-muted-foreground/40 sm:inline">
                •
              </span>

              <span className="font-medium text-muted-foreground">
                {currentSeasonEpisodes.length} Episodes
              </span>

              <span className="hidden text-muted-foreground/40 sm:inline">
                •
              </span>

              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="font-semibold text-emerald-500">
                  {currentSeasonDownloaded} Downloaded
                </span>
                {currentSeasonMissing > 0 && (
                  <span className="font-semibold text-amber-500">
                    ({currentSeasonMissing} Missing)
                  </span>
                )}
              </div>
            </div>

            {/* Season-level Action Buttons */}
            {activeSeason !== null && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Season Monitoring Toggle Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleSeasonMonitoring(activeSeason)}
                  className={cn(
                    "h-8 gap-1.5 rounded-xl text-xs font-semibold shadow-2xs",
                    isCurrentSeasonMonitored
                      ? "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                      : "border-border/60 text-muted-foreground hover:bg-muted"
                  )}
                  aria-label={
                    isCurrentSeasonMonitored
                      ? `Unmonitor Season ${activeSeason}`
                      : `Monitor Season ${activeSeason}`
                  }
                >
                  {isCurrentSeasonMonitored ? (
                    <IconBookmark className="size-3.5 fill-emerald-500 text-emerald-500" />
                  ) : (
                    <IconBookmarkOff className="size-3.5" />
                  )}
                  <span>
                    {isCurrentSeasonMonitored
                      ? `Season ${activeSeason === 0 ? "Specials" : activeSeason} Monitored`
                      : `Season ${activeSeason === 0 ? "Specials" : activeSeason} Unmonitored`}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setInteractiveSearchTarget({
                      type: "season",
                      seasonNumber: activeSeason,
                      seasonTitle:
                        activeSeason === 0
                          ? "Specials"
                          : `Season ${activeSeason}`,
                    })
                  }
                  className="h-8 gap-1.5 rounded-xl border-primary/30 text-xs font-semibold text-primary shadow-2xs hover:bg-primary/10"
                >
                  <IconSearch className="size-3.5" />
                  <span>
                    Interactive{" "}
                    {activeSeason === 0 ? "Specials" : `Season ${activeSeason}`}{" "}
                    Search
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSearchSeason(activeSeason)}
                  className="h-8 gap-1.5 rounded-xl text-xs font-semibold shadow-2xs"
                >
                  <IconSparkles className="size-3.5 text-amber-500" />
                  <span>
                    Auto Search{" "}
                    {activeSeason === 0 ? "Specials" : `Season ${activeSeason}`}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Episodes List View */}
        <section aria-labelledby="episodes-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="episodes-heading"
              className="flex items-center gap-2 font-heading text-sm font-semibold tracking-wide text-foreground"
            >
              <IconDeviceTv className="size-4 text-primary" />
              <span>Season {activeSeason} Episodes</span>
              <span className="font-mono text-xs font-normal text-muted-foreground">
                ({currentSeasonEpisodes.length})
              </span>
            </h2>
          </div>

          {currentSeasonEpisodes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-xs text-muted-foreground">
              No episodes recorded for Season {activeSeason}.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {currentSeasonEpisodes.map((ep) => {
                const epFile = ep.episodeFileId
                  ? fileMap.get(ep.episodeFileId)
                  : null
                const mediaInfo = epFile?.mediaInfo
                const hasFile = ep.hasFile || !!epFile
                const isExpanded = expandedEpisodeId === ep.id
                const formattedDate = formatDate(ep.airDateUtc)
                const hasOverview = Boolean(
                  ep.overview && ep.overview.trim().length > 0
                )
                const isEpMonitored = ep.monitored !== false

                return (
                  <div
                    key={ep.id}
                    className={cn(
                      "flex flex-col rounded-2xl border border-border/40 bg-card/70 px-3.5 py-2.5 shadow-xs ring-1 ring-foreground/5 transition-all dark:ring-foreground/10",
                      isExpanded
                        ? "border-primary/40 bg-card shadow-sm"
                        : "hover:border-border/60 hover:bg-card"
                    )}
                  >
                    {/* Main Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Left: Monitor Button + Episode Number + Title + Overview Preview */}
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {/* Interactive Episode Monitoring Toggle */}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={
                            isEpMonitored
                              ? "Unmonitor Episode"
                              : "Monitor Episode"
                          }
                          onClick={() => handleToggleEpisodeMonitoring(ep)}
                          className={cn(
                            "size-7 shrink-0 rounded-lg p-0 transition-colors",
                            isEpMonitored
                              ? "text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                              : "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
                          )}
                        >
                          {isEpMonitored ? (
                            <IconBookmark className="size-4 fill-emerald-500 text-emerald-500" />
                          ) : (
                            <IconBookmarkOff className="size-4" />
                          )}
                        </Button>

                        {/* Number Badge */}
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-heading text-xs font-bold text-primary">
                          {String(ep.episodeNumber).padStart(2, "0")}
                        </div>

                        {/* Title & Overview snippet */}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-foreground sm:text-sm">
                              {ep.title || `Episode ${ep.episodeNumber}`}
                            </span>
                            {!isEpMonitored && (
                              <Badge
                                variant="outline"
                                className="border-border/60 px-1 py-0 text-[9px] text-muted-foreground"
                              >
                                Unmonitored
                              </Badge>
                            )}
                          </div>
                          {ep.overview && (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                              {ep.overview}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Center-Right: Air Date + Specs + File Size */}
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {/* Air Date */}
                        <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                          {formattedDate}
                        </span>

                        {/* Quality & Specs Pills */}
                        {hasFile ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className="border border-emerald-500/30 bg-emerald-500/15 px-2 py-0 font-mono text-[10px] font-semibold text-emerald-500"
                            >
                              {epFile?.quality?.quality?.name || "Downloaded"}
                            </Badge>
                            {mediaInfo?.videoCodec && (
                              <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {mediaInfo.videoCodec}
                              </span>
                            )}
                            {mediaInfo?.audioChannels && (
                              <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {mediaInfo.audioChannels}ch
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-primary/25 bg-primary/10 px-2 py-0 text-[10px] font-semibold text-primary"
                          >
                            Missing
                          </Badge>
                        )}

                        {/* File Size */}
                        <span className="min-w-[55px] text-end font-mono text-[11px] text-muted-foreground">
                          {formatBytes(epFile?.size)}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Interactive Search Episode"
                            onClick={() =>
                              setInteractiveSearchTarget({
                                type: "episode",
                                seasonNumber: ep.seasonNumber,
                                episodeId: ep.id,
                                episodeTitle:
                                  ep.title || `Episode ${ep.episodeNumber}`,
                              })
                            }
                            className="size-7 rounded-lg p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <IconSearch className="size-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Automatic Search Episode"
                            onClick={async () => {
                              try {
                                await elysia.servarr.sonarr.command.post({
                                  name: "EpisodeSearch",
                                  episodeIds: [ep.id],
                                })
                                toast.success(
                                  `Search triggered for ${ep.title}`
                                )
                              } catch (err: any) {
                                toast.error("Search failed", {
                                  description: err.message,
                                })
                              }
                            }}
                            className="size-7 rounded-lg p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <IconSparkles className="size-3.5" />
                          </Button>

                          {/* Expand details button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={
                              isExpanded ? "Hide Details" : "Show Details"
                            }
                            onClick={() =>
                              setExpandedEpisodeId(isExpanded ? null : ep.id)
                            }
                            className="size-7 rounded-lg p-0 text-muted-foreground hover:text-foreground"
                          >
                            <IconChevronDown
                              className={cn(
                                "size-3.5 transition-transform duration-200",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Episode Details Pane */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2.5 border-t border-border/30 pt-3 text-xs">
                        {hasOverview && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                              <IconFileText className="size-3 text-primary" />
                              <span>Synopsis</span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground/90 select-text">
                              {ep.overview}
                            </p>
                          </div>
                        )}

                        {epFile && (
                          <div className="grid grid-cols-1 gap-2 border-t border-border/20 pt-1 font-mono text-[11px] sm:grid-cols-2">
                            <div>
                              <span className="block text-[10px] text-muted-foreground/70">
                                File Path
                              </span>
                              <span className="break-all text-foreground">
                                {epFile.path || epFile.relativePath || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-muted-foreground/70">
                                Media Info
                              </span>
                              <span className="text-foreground">
                                {mediaInfo?.resolution || "—"} •{" "}
                                {mediaInfo?.videoCodec || "—"} •{" "}
                                {mediaInfo?.audioCodec || "—"} (
                                {mediaInfo?.audioChannels || "—"}ch)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* Sub-modals */}
      {interactiveSearchTarget && (
        <ServarrInteractiveSearchDialog
          isOpen={!!interactiveSearchTarget}
          onClose={() => setInteractiveSearchTarget(null)}
          provider="SONARR"
          mediaId={seriesId}
          mediaTitle={seriesData.title}
          seasonNumber={interactiveSearchTarget.seasonNumber}
          seasonTitle={interactiveSearchTarget.seasonTitle}
          episodeId={interactiveSearchTarget.episodeId}
          episodeTitle={interactiveSearchTarget.episodeTitle}
        />
      )}

      <ServarrRenameDialog
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        provider="SONARR"
        mediaId={seriesId}
        mediaTitle={seriesData.title}
        seasonNumber={activeSeason || undefined}
        onRenamed={() => fetchSeries(true)}
      />

      <ServarrFileManagerDialog
        isOpen={isFileManagerOpen}
        onClose={() => setIsFileManagerOpen(false)}
        provider="SONARR"
        mediaId={seriesId}
        mediaTitle={seriesData.title}
        onFilesChanged={() => fetchSeries(true)}
      />

      <ServarrManualImportDialog
        isOpen={isManualImportOpen}
        onClose={() => setIsManualImportOpen(false)}
        provider="SONARR"
        mediaId={seriesId}
        mediaTitle={seriesData.title}
        onImported={() => fetchSeries(true)}
      />

      <ServarrDeleteMediaDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        provider="SONARR"
        mediaId={seriesId}
        mediaTitle={seriesData.title}
        path={seriesData.path}
        fileCount={files.length}
        onDeleted={() => router.push("/IRIS-list/servarr/sonarr")}
      />
    </div>
  )
}
