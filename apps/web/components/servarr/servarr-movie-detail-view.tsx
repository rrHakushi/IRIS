"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconSparkles,
  IconFilePencil,
  IconFolder,
  IconTrash,
  IconArrowLeft,
  IconFileCheck,
  IconMovie,
  IconPhotoOff,
  IconClock,
  IconVideo,
  IconFolderOpen,
  IconBookmark,
  IconBookmarkOff,
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

export interface ServarrMovieDetailViewProps {
  movieId: number
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

export function ServarrMovieDetailView({
  movieId,
}: ServarrMovieDetailViewProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [movieData, setMovieData] = useState<any>(null)
  const [files, setFiles] = useState<any[]>([])
  const [posterError, setPosterError] = useState(false)
  const [bannerError, setBannerError] = useState(false)

  // Dialog States
  const [isInteractiveSearchOpen, setIsInteractiveSearchOpen] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false)
  const [isManualImportOpen, setIsManualImportOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const inFlightRef = React.useRef(false)
  const lastFetchedIdRef = React.useRef<number | null>(null)

  const fetchMovie = React.useCallback(
    async (force = false) => {
      if (!force && inFlightRef.current) return
      inFlightRef.current = true
      setIsLoading(true)
      try {
        const res = await dedupGet(
          `servarr:radarr:movie:${movieId}`,
          () => elysia.servarr.radarr.movies({ id: movieId }).get(),
          { force, ttlMs: 3000 }
        )
        if (res?.data?.success && res.data.movie) {
          setMovieData(res.data.movie)
          setFiles(res.data.files || [])
        } else {
          toast.error("Failed to load movie details", {
            description: res?.data?.message || "Unknown error",
          })
        }
      } catch (err: any) {
        toast.error("Error loading movie", { description: err.message })
      } finally {
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [movieId]
  )

  useEffect(() => {
    if (lastFetchedIdRef.current === movieId) return
    lastFetchedIdRef.current = movieId
    fetchMovie()
  }, [movieId, fetchMovie])

  const handleToggleMovieMonitoring = async () => {
    if (!movieData) return
    const newMonitored = !movieData.monitored
    setMovieData((prev: any) => ({ ...prev, monitored: newMonitored }))

    try {
      const res = await elysia.servarr.radarr.movies({ id: movieId }).put({
        ...movieData,
        monitored: newMonitored,
      })
      if (res?.data?.success) {
        toast.success(
          `Movie monitoring ${newMonitored ? "enabled" : "disabled"}`
        )
      } else {
        toast.error("Failed to update movie monitoring", {
          description: res?.data?.message || "Unknown error",
        })
        setMovieData((prev: any) => ({ ...prev, monitored: !newMonitored }))
      }
    } catch (err: any) {
      toast.error("Failed to update movie monitoring", {
        description: err.message,
      })
      setMovieData((prev: any) => ({ ...prev, monitored: !newMonitored }))
    }
  }

  const handleSearchMovie = async () => {
    try {
      await elysia.servarr.radarr.command.post({
        name: "MoviesSearch",
        movieIds: [movieId],
      })
      toast.success(`Automatic search started for ${movieData?.title}`)
    } catch (err: any) {
      toast.error("Search request failed", { description: err.message })
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Spinner className="size-8 text-primary" />
        <span className="text-xs font-medium">Loading movie details...</span>
      </div>
    )
  }

  if (!movieData) {
    return (
      <div className="mx-auto mt-8 max-w-4xl rounded-3xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
        <IconMovie className="mx-auto mb-3 size-12 opacity-40" />
        <p className="text-sm font-semibold text-foreground">Movie not found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The requested movie could not be loaded from Radarr.
        </p>
        <Link href="/IRIS-list/servarr/radarr">
          <Button variant="outline" size="sm" className="mt-4 gap-2 rounded-xl">
            <IconArrowLeft className="size-4" /> Return to Movies List
          </Button>
        </Link>
      </div>
    )
  }

  const poster =
    movieData.images?.find((img: any) => img.coverType === "poster")
      ?.remoteUrl ||
    movieData.images?.find((img: any) => img.coverType === "poster")?.url
  const fanart =
    movieData.images?.find((img: any) => img.coverType === "fanart")
      ?.remoteUrl ||
    movieData.images?.find((img: any) => img.coverType === "fanart")?.url

  const movieFile = movieData.movieFile || (files.length > 0 ? files[0] : null)
  const mediaInfo = movieFile?.mediaInfo
  const hasFile = movieData.hasFile || !!movieFile
  const isMovieMonitored = movieData.monitored !== false

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
              href="/IRIS-list/servarr/radarr"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs backdrop-blur-md transition-colors hover:bg-background hover:text-primary"
            >
              <IconArrowLeft className="size-3.5" />
              <span>Back to Movies</span>
            </Link>
          </div>
        </div>

        {/* Hero Content Container */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-16 pb-4 sm:-mt-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {/* Floating Poster */}
              <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-background/90 bg-muted shadow-lg sm:w-36 md:w-44">
                {poster && !posterError ? (
                  <img
                    src={poster}
                    alt={movieData.title}
                    onError={() => setPosterError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground/60">
                    <IconPhotoOff className="size-8" aria-hidden="true" />
                    <span className="text-center text-[10px] font-medium">
                      No Image
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column: Title + Metadata + Action Buttons */}
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                {/* Badges & Tags */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Interactive Movie Monitoring Toggle Badge */}
                  <button
                    type="button"
                    onClick={handleToggleMovieMonitoring}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isMovieMonitored
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
                        : "border-border/60 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                    title={`Click to ${isMovieMonitored ? "unmonitor" : "monitor"} movie`}
                  >
                    {isMovieMonitored ? (
                      <IconBookmark className="size-3 fill-emerald-500 text-emerald-500" />
                    ) : (
                      <IconBookmarkOff className="size-3 text-muted-foreground" />
                    )}
                    <span>
                      {isMovieMonitored ? "Monitored" : "Unmonitored"}
                    </span>
                  </button>

                  <Badge
                    variant="outline"
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                      hasFile
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500"
                        : "border-primary/30 bg-primary/10 text-primary"
                    )}
                  >
                    {hasFile ? "Downloaded" : "Wanted"}
                  </Badge>

                  {movieData.studio && (
                    <Badge
                      variant="secondary"
                      className="px-2 py-0.5 text-[10px] font-medium"
                    >
                      {movieData.studio}
                    </Badge>
                  )}

                  {movieData.year && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {movieData.year}
                    </span>
                  )}

                  {movieData.runtime > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <IconClock className="size-3 opacity-70" />
                      <span>
                        {Math.floor(movieData.runtime / 60)}h{" "}
                        {movieData.runtime % 60}m
                      </span>
                    </span>
                  )}
                </div>

                {/* Main Title */}
                <div>
                  <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                    {movieData.title}
                  </h1>
                  {movieData.originalTitle &&
                    movieData.originalTitle !== movieData.title && (
                      <p className="font-japanese mt-0.5 text-xs text-muted-foreground/80">
                        {movieData.originalTitle}
                      </p>
                    )}
                </div>

                {/* Overview Synopsis */}
                {movieData.overview && (
                  <p className="line-clamp-3 max-w-4xl text-xs leading-relaxed text-muted-foreground select-text sm:text-sm">
                    {movieData.overview}
                  </p>
                )}

                {/* Metadata Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                    <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase">
                      Path
                    </span>
                    <span className="max-w-[200px] truncate font-mono font-medium text-foreground sm:max-w-xs">
                      {movieData.path || "—"}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                    <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase">
                      Profile
                    </span>
                    <span className="font-medium text-foreground">
                      Profile #{movieData.qualityProfileId || 1}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                    <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase">
                      Disk Size
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {formatBytes(movieData.sizeOnDisk || movieFile?.size)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSearchMovie}
                    className="h-8 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
                  >
                    <IconSparkles className="size-3.5" />
                    <span>Auto Search</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsInteractiveSearchOpen(true)}
                    className="h-8 gap-1.5 rounded-xl text-xs font-medium"
                  >
                    <IconSearch className="size-3.5 text-primary" />
                    <span>Interactive Search</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRenameOpen(true)}
                    className="h-8 gap-1.5 rounded-xl text-xs font-medium"
                  >
                    <IconFilePencil className="size-3.5" />
                    <span>Rename Files</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFileManagerOpen(true)}
                    className="h-8 gap-1.5 rounded-xl text-xs font-medium"
                  >
                    <IconFolder className="size-3.5" />
                    <span>Manage Files</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManualImportOpen(true)}
                    className="h-8 gap-1.5 rounded-xl text-xs font-medium"
                  >
                    <IconFileCheck className="size-3.5" />
                    <span>Manual Import</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="ms-auto h-8 gap-1.5 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <IconTrash className="size-3.5" />
                    <span>Delete Movie</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Body: Media File & Stream Specifications */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {movieFile ? (
          <div className="space-y-5 rounded-3xl border border-border/40 bg-card p-6 text-card-foreground shadow-xs ring-1 ring-foreground/5 md:p-8 dark:ring-foreground/10">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-wide text-foreground">
                <IconVideo className="size-4 text-primary" />
                <span>Media File & Stream Specifications</span>
              </h3>
              <Badge
                variant="secondary"
                className="border border-emerald-500/30 bg-emerald-500/15 font-mono text-[10px] text-emerald-500"
              >
                {movieFile.quality?.quality?.name || "Standard Quality"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 font-mono text-xs sm:grid-cols-4">
              <div className="space-y-1 rounded-2xl border border-border/40 bg-muted/30 p-3.5">
                <span className="block font-sans text-[10px] font-bold text-muted-foreground/70 uppercase">
                  Resolution
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {mediaInfo?.resolution || "—"}
                </span>
              </div>

              <div className="space-y-1 rounded-2xl border border-border/40 bg-muted/30 p-3.5">
                <span className="block font-sans text-[10px] font-bold text-muted-foreground/70 uppercase">
                  Video Codec
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {mediaInfo?.videoCodec || "—"}
                </span>
              </div>

              <div className="space-y-1 rounded-2xl border border-border/40 bg-muted/30 p-3.5">
                <span className="block font-sans text-[10px] font-bold text-muted-foreground/70 uppercase">
                  Audio Channels
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {mediaInfo?.audioChannels
                    ? `${mediaInfo.audioChannels} Channels`
                    : "—"}
                </span>
              </div>

              <div className="space-y-1 rounded-2xl border border-border/40 bg-muted/30 p-3.5">
                <span className="block font-sans text-[10px] font-bold text-muted-foreground/70 uppercase">
                  File Size
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatBytes(movieFile.size)}
                </span>
              </div>
            </div>

            {/* Path details */}
            <div className="space-y-1 rounded-2xl border border-border/40 bg-muted/20 p-3.5">
              <span className="block flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/70 uppercase">
                <IconFolderOpen className="size-3.5 text-primary" />
                <span>Disk File Path</span>
              </span>
              <p className="font-mono text-xs break-all text-foreground select-text">
                {movieFile.path ||
                  movieFile.relativePath ||
                  movieData.path ||
                  "—"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-3xl border border-dashed border-border/60 p-12 text-center text-xs text-muted-foreground">
            <IconMovie className="mx-auto size-10 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium text-foreground">
              No Movie File Downloaded
            </p>
            <p className="mx-auto max-w-md text-muted-foreground">
              This movie is currently monitored in Radarr. Trigger an automatic
              or interactive search to download a release.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSearchMovie}
                className="gap-2 rounded-xl text-xs font-semibold shadow-xs"
              >
                <IconSparkles className="size-3.5" /> Auto Search Release
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInteractiveSearchOpen(true)}
                className="gap-2 rounded-xl text-xs font-medium"
              >
                <IconSearch className="size-3.5 text-primary" /> Interactive
                Search
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Sub-modals */}
      <ServarrDeleteMediaDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        provider="RADARR"
        mediaId={movieId}
        mediaTitle={movieData.title}
        path={movieData.path}
        fileCount={files.length}
        onDeleted={() => router.push("/IRIS-list/servarr/radarr")}
      />

      <ServarrInteractiveSearchDialog
        isOpen={isInteractiveSearchOpen}
        onClose={() => setIsInteractiveSearchOpen(false)}
        provider="RADARR"
        mediaId={movieId}
        mediaTitle={movieData.title}
      />

      <ServarrRenameDialog
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        provider="RADARR"
        mediaId={movieId}
        mediaTitle={movieData.title}
        onRenamed={() => fetchMovie(true)}
      />

      <ServarrFileManagerDialog
        isOpen={isFileManagerOpen}
        onClose={() => setIsFileManagerOpen(false)}
        provider="RADARR"
        mediaId={movieId}
        mediaTitle={movieData.title}
        onFilesChanged={() => fetchMovie(true)}
      />

      <ServarrManualImportDialog
        isOpen={isManualImportOpen}
        onClose={() => setIsManualImportOpen(false)}
        provider="RADARR"
        mediaId={movieId}
        mediaTitle={movieData.title}
        onImported={() => fetchMovie(true)}
      />
    </div>
  )
}
