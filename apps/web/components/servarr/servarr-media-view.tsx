"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import {
  IconRefresh,
  IconRss,
  IconSearch,
  IconFileImport,
  IconEdit,
  IconLayoutGrid,
  IconLayoutList,
  IconArrowsSort,
  IconFilter,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconExternalLink,
  IconMovie,
  IconDeviceTv,
  IconPlayerPlay,
  IconAlertCircle,
  IconLink,
  IconSettings,
  IconPlus,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { dedupGet, invalidateDedup } from "@/lib/request-dedup"
import { ServarrAddMediaDialog } from "./servarr-add-media-dialog"

export interface ServarrMediaItem {
  id: string | number
  title: string
  originalTitle?: string | null
  year?: number | null
  overview?: string | null
  monitored: boolean
  hasFile?: boolean
  qualityProfile?: string | null
  qualityProfileId?: number | null
  sizeOnDisk?: number | null
  status?: string | null
  added?: string | null
  posterUrl?: string | null
  fanartUrl?: string | null
  tmdbId?: number | null
  tvdbId?: number | null
  imdbId?: string | null
  path?: string | null
  genres?: string[] | null
  episodeCount?: number | null
  episodeFileCount?: number | null
  seasonCount?: number | null
}

export type ServarrViewMode = "poster" | "table" | "overview"
export type ServarrSortField = "title" | "added" | "year" | "status" | "quality"
export type ServarrFilter =
  "all" | "monitored" | "unmonitored" | "downloaded" | "missing"

interface ServarrMediaViewProps {
  provider: "RADARR" | "SONARR"
  pageTitle: string
  subtitle?: string
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Unknown"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return "Unknown"
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return "Unknown"
  }
}

export function ServarrMediaView({
  provider,
  pageTitle,
  subtitle,
}: ServarrMediaViewProps): React.JSX.Element {
  const { data: session, status: authStatus } = useSession()
  const username = session?.user?.username

  const [items, setItems] = useState<ServarrMediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isRssSyncing, setIsRssSyncing] = useState(false)
  const [isSearchingAll, setIsSearchingAll] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [hostUrl, setHostUrl] = useState<string | null>(null)

  // Filters and sorting
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ServarrViewMode>("poster")
  const [sortField, setSortField] = useState<ServarrSortField>("added")
  const [sortAsc, setSortAsc] = useState(false)
  const [filter, setFilter] = useState<ServarrFilter>("all")

  const providerLower = provider.toLowerCase()
  const inFlightRef = React.useRef(false)
  const lastLoadedKeyRef = React.useRef<string | null>(null)

  const loadMedia = useCallback(
    async (silent = false, force = false) => {
      if (authStatus === "loading") return
      if (!silent && inFlightRef.current) return
      inFlightRef.current = true
      if (!silent) setIsLoading(true)

      try {
        const { data, error } = await dedupGet(
          `servarr:${provider}:library`,
          () =>
            provider === "RADARR"
              ? elysia.servarr.radarr.library.get({
                  fetch: { credentials: "include" },
                })
              : elysia.servarr.sonarr.library.get({
                  fetch: { credentials: "include" },
                }),
          { force, ttlMs: 3000 }
        )

        if (error) {
          setIsConnected(false)
          setItems([])
        } else if (data) {
          setIsConnected(data.connected)
          setHostUrl(data.hostUrl || null)
          setItems(data.items || [])
        }
      } catch {
        setIsConnected(false)
        setItems([])
      } finally {
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [provider, authStatus]
  )

  useEffect(() => {
    if (authStatus === "loading") return
    if (lastLoadedKeyRef.current === provider) return
    lastLoadedKeyRef.current = provider
    loadMedia()
  }, [authStatus, provider, loadMedia])

  // Bulk Actions
  const handleUpdateAll = async () => {
    setIsUpdating(true)
    try {
      const res =
        provider === "RADARR"
          ? await elysia.servarr.radarr.command.post(
              { command: "refresh" },
              { fetch: { credentials: "include" } }
            )
          : await elysia.servarr.sonarr.command.post(
              { command: "refresh" },
              { fetch: { credentials: "include" } }
            )

      if (res?.error) {
        toast.error(
          (res.error.value as any)?.message ||
            `Failed to update library in ${pageTitle}`
        )
      } else {
        toast.success(`Library update triggered for ${pageTitle}`)
      }
    } catch {
      toast.error("Failed to trigger update")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRssSync = async () => {
    setIsRssSyncing(true)
    try {
      const res =
        provider === "RADARR"
          ? await elysia.servarr.radarr.command.post(
              { command: "rssSync" },
              { fetch: { credentials: "include" } }
            )
          : await elysia.servarr.sonarr.command.post(
              { command: "rssSync" },
              { fetch: { credentials: "include" } }
            )

      if (res?.error) {
        toast.error(
          (res.error.value as any)?.message ||
            `Failed to trigger RSS sync in ${pageTitle}`
        )
      } else {
        toast.success(`RSS Sync triggered for ${pageTitle}`)
      }
    } catch {
      toast.error("Failed to trigger RSS sync")
    } finally {
      setIsRssSyncing(false)
    }
  }

  const handleSearchAll = async () => {
    setIsSearchingAll(true)
    try {
      let res: any
      if (provider === "RADARR") {
        res = await elysia.servarr.radarr.command.post(
          { command: "searchMissing" },
          { fetch: { credentials: "include" } }
        )
      } else {
        res = await elysia.servarr.sonarr.command.post(
          { command: "searchMissing" },
          { fetch: { credentials: "include" } }
        )
      }

      if (res?.error) {
        toast.error(
          res.error.value?.message || `Failed to execute search in ${pageTitle}`
        )
      } else {
        toast.success(`Search command queued for missing items in ${pageTitle}`)
      }
    } catch {
      toast.error("Failed to execute search")
    } finally {
      setIsSearchingAll(false)
    }
  }

  // Filtered and sorted items
  const processedItems = useMemo(() => {
    let list = [...items]

    // 1. Text Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.originalTitle?.toLowerCase().includes(q) ||
          item.year?.toString().includes(q) ||
          item.genres?.some((g) => g.toLowerCase().includes(q))
      )
    }

    // 2. Category Filter
    if (filter === "monitored") {
      list = list.filter((i) => i.monitored)
    } else if (filter === "unmonitored") {
      list = list.filter((i) => !i.monitored)
    } else if (filter === "downloaded") {
      list = list.filter((i) => i.hasFile)
    } else if (filter === "missing") {
      list = list.filter((i) => !i.hasFile && i.monitored)
    }

    // 3. Sorting
    list.sort((a, b) => {
      let res = 0
      if (sortField === "title") {
        res = a.title.localeCompare(b.title)
      } else if (sortField === "year") {
        res = (a.year || 0) - (b.year || 0)
      } else if (sortField === "added") {
        const timeA = a.added ? new Date(a.added).getTime() : 0
        const timeB = b.added ? new Date(b.added).getTime() : 0
        res = timeA - timeB
      } else if (sortField === "quality") {
        res = (a.qualityProfile || "").localeCompare(b.qualityProfile || "")
      } else if (sortField === "status") {
        res = (a.status || "").localeCompare(b.status || "")
      }
      return sortAsc ? res : -res
    })

    return list
  }, [items, searchQuery, filter, sortField, sortAsc])

  return (
    <div className="flex w-full flex-1 flex-col overflow-x-hidden p-4 md:p-6">
      {/* Top Servarr Toolbar Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 pb-3.5">
        {/* Left Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            className="h-8 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            <IconPlus className="size-3.5" />
            <span>Add {provider === "RADARR" ? "Movie" : "Series"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isUpdating}
            onClick={handleUpdateAll}
            className="h-8 gap-1.5 rounded-xl text-xs font-medium"
          >
            {isUpdating ? (
              <Spinner className="size-3.5" />
            ) : (
              <IconRefresh className="size-3.5 text-primary" />
            )}
            <span>Update All</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isRssSyncing}
            onClick={handleRssSync}
            className="h-8 gap-1.5 rounded-xl text-xs font-medium"
          >
            {isRssSyncing ? (
              <Spinner className="size-3.5" />
            ) : (
              <IconRss className="size-3.5 text-amber-500" />
            )}
            <span>RSS Sync</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isSearchingAll}
            onClick={handleSearchAll}
            className="h-8 gap-1.5 rounded-xl text-xs font-medium"
          >
            {isSearchingAll ? (
              <Spinner className="size-3.5" />
            ) : (
              <IconSearch className="size-3.5 text-primary" />
            )}
            <span>Search All</span>
          </Button>
        </div>

        {/* Right Toolbar Controls (Search, View, Sort, Filter) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-40 sm:w-56">
            <IconSearch className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Filter ${provider === "RADARR" ? "movies" : "series"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-xl ps-8 text-xs"
            />
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center rounded-xl border border-border/60 bg-muted/40 p-0.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "downloaded", label: "Downloaded" },
                { id: "missing", label: "Wanted" },
                { id: "unmonitored", label: "Unmonitored" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-all select-none",
                  filter === f.id
                    ? "bg-background font-semibold text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort Toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
            <IconArrowsSort className="size-3.5 shrink-0" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as ServarrSortField)}
              className="cursor-pointer bg-transparent text-xs font-medium text-foreground outline-hidden"
            >
              <option value="added" className="bg-popover text-foreground">
                Added Date
              </option>
              <option value="title" className="bg-popover text-foreground">
                Title
              </option>
              <option value="year" className="bg-popover text-foreground">
                Release Year
              </option>
              <option value="quality" className="bg-popover text-foreground">
                Quality Profile
              </option>
              <option value="status" className="bg-popover text-foreground">
                Status
              </option>
            </select>
            <button
              type="button"
              onClick={() => setSortAsc(!sortAsc)}
              className="cursor-pointer rounded p-0.5 hover:text-foreground"
              title={sortAsc ? "Sort Ascending" : "Sort Descending"}
            >
              {sortAsc ? "↑" : "↓"}
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border/60 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("poster")}
              className={cn(
                "cursor-pointer rounded-lg p-1 transition-all",
                viewMode === "poster"
                  ? "bg-background text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Poster Grid View"
            >
              <IconLayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "cursor-pointer rounded-lg p-1 transition-all",
                viewMode === "table"
                  ? "bg-background text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Table View"
            >
              <IconLayoutList className="size-4" />
            </button>
          </div>

          {/* Quick External Servarr Web UI Link (Icon Only) */}
          {hostUrl && (
            <a
              href={hostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-8 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
              title={`Open ${pageTitle} Web UI (${hostUrl})`}
              aria-label={`Open ${pageTitle} Web UI`}
            >
              <IconExternalLink className="size-4" />
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center py-24">
          <Spinner className="size-8 text-primary" />
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Loading {pageTitle} library...
          </p>
        </div>
      ) : !isConnected ? (
        /* Disconnected State */
        <Card className="mx-auto max-w-lg rounded-3xl border border-border/40 bg-card p-8 text-center text-card-foreground shadow-xs ring-1 ring-foreground/5 dark:ring-foreground/10">
          <CardContent className="space-y-4 pt-2">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-border/50 bg-muted/50 text-muted-foreground">
              <IconLink className="size-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-heading text-base font-semibold text-foreground">
                {pageTitle} Not Connected
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Connect your {pageTitle} instance using your Host URL and API
                Key in Account Connections to browse and manage your media
                library.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/settings?tab=connections"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-opacity hover:opacity-90"
              >
                <IconSettings className="size-4" />
                <span>Configure Connections</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : processedItems.length === 0 ? (
        /* Empty Results State */
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border/50 bg-muted/40 text-muted-foreground">
            {provider === "RADARR" ? (
              <IconMovie className="size-6" />
            ) : (
              <IconDeviceTv className="size-6" />
            )}
          </div>
          <h3 className="mt-3 font-heading text-sm font-semibold text-foreground">
            No {provider === "RADARR" ? "movies" : "series"} found
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {searchQuery
              ? `No results match "${searchQuery}". Try a different filter.`
              : `Your ${pageTitle} library currently has no media items.`}
          </p>
        </div>
      ) : viewMode === "poster" ? (
        /* IRIS Native Poster Grid View */
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
          {processedItems.map((item) => {
            const isDownloaded = item.hasFile
            const isMonitored = item.monitored

            return (
              <div
                key={item.id}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/40 bg-card text-card-foreground shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                <Link
                  href={`/IRIS-list/servarr/${providerLower}/${item.id}`}
                  className="flex flex-1 flex-col rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {/* Cover Image Container */}
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted select-none">
                    {item.posterUrl ? (
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = "none"
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center text-muted-foreground/60">
                        <IconPlayerPlay className="mb-1.5 size-8 opacity-50" />
                        <span className="line-clamp-2 text-[10px] font-medium">
                          {item.title}
                        </span>
                      </div>
                    )}

                    {/* Top Overlay Badges */}
                    <div className="absolute start-2 top-2 flex flex-wrap gap-1">
                      {item.year && (
                        <Badge
                          variant="secondary"
                          className="bg-background/85 px-1.5 py-0 text-[10px] font-semibold shadow-xs backdrop-blur-xs"
                        >
                          {item.year}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-1.5 py-0 text-[10px] font-semibold backdrop-blur-xs",
                          isDownloaded
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500"
                            : isMonitored
                              ? "border-primary/30 bg-primary/15 text-primary"
                              : "border-border/60 bg-background/80 text-muted-foreground"
                        )}
                      >
                        {isDownloaded
                          ? "Downloaded"
                          : isMonitored
                            ? "Wanted"
                            : "Unmonitored"}
                      </Badge>
                    </div>

                    {/* Bottom Right Size Badge */}
                    {item.sizeOnDisk ? (
                      <div className="absolute end-2 bottom-2">
                        <Badge
                          variant="secondary"
                          className="bg-background/85 px-1.5 py-0 font-mono text-[9px] shadow-xs backdrop-blur-xs"
                        >
                          {formatBytes(item.sizeOnDisk)}
                        </Badge>
                      </div>
                    ) : null}
                  </div>

                  {/* Card Metadata */}
                  <div className="flex flex-1 flex-col p-2.5">
                    <h3
                      title={item.title}
                      className="line-clamp-1 font-heading text-xs font-semibold text-foreground transition-colors group-hover:text-primary"
                    >
                      {item.title}
                    </h3>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="truncate">
                        {item.qualityProfile || "Any Quality"}
                      </span>
                      {item.added && (
                        <span className="ms-1 shrink-0 opacity-70">
                          {formatDate(item.added)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      ) : (
        /* IRIS Native Table View */
        <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card text-card-foreground shadow-xs ring-1 ring-foreground/5 dark:ring-foreground/10">
          <table className="w-full border-collapse text-start text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-muted/40 font-semibold text-muted-foreground">
                <th className="p-3.5 text-start">Title</th>
                <th className="p-3.5 text-start">Year</th>
                <th className="p-3.5 text-start">Status</th>
                <th className="p-3.5 text-start">Quality Profile</th>
                <th className="p-3.5 text-start">Size</th>
                <th className="p-3.5 text-start">Added Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {processedItems.map((item) => (
                <tr
                  key={item.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="p-3.5 font-medium text-foreground">
                    <Link
                      href={`/IRIS-list/servarr/${providerLower}/${item.id}`}
                      className="flex items-center gap-3 transition-colors hover:text-primary"
                    >
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="size-8 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                          {provider === "RADARR" ? (
                            <IconMovie className="size-4" />
                          ) : (
                            <IconDeviceTv className="size-4" />
                          )}
                        </div>
                      )}
                      <span className="font-heading text-xs font-semibold">
                        {item.title}
                      </span>
                    </Link>
                  </td>
                  <td className="p-3.5 font-mono text-muted-foreground">
                    {item.year || "—"}
                  </td>
                  <td className="p-3.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "py-0 text-[10px] font-semibold",
                        item.hasFile
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                          : item.monitored
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.hasFile
                        ? "Downloaded"
                        : item.monitored
                          ? "Wanted"
                          : "Unmonitored"}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-muted-foreground">
                    {item.qualityProfile || "—"}
                  </td>
                  <td className="p-3.5 font-mono text-muted-foreground">
                    {formatBytes(item.sizeOnDisk)}
                  </td>
                  <td className="p-3.5 text-muted-foreground">
                    {formatDate(item.added)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Media Dialog */}
      <ServarrAddMediaDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        provider={provider}
        onAdded={() => loadMedia(true, true)}
      />
    </div>
  )
}
