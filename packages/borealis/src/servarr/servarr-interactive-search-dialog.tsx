"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconDownload,
  IconAlertTriangle,
  IconArrowsSort,
  IconRefresh,
  IconFilter,
  IconServer,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

export interface ServarrInteractiveSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  provider: "SONARR" | "RADARR"
  mediaId: number
  mediaTitle: string
  seasonNumber?: number
  seasonTitle?: string
  episodeId?: number
  episodeTitle?: string
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "—"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatAge(ageHours?: number, publishDate?: string): string {
  if (typeof ageHours === "number") {
    if (ageHours < 24) return `${Math.max(1, Math.round(ageHours))}h ago`
    return `${Math.round(ageHours / 24)}d ago`
  }
  if (publishDate) {
    const diffMs = Date.now() - new Date(publishDate).getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return "Today"
    return `${diffDays}d ago`
  }
  return "—"
}

export function ServarrInteractiveSearchDialog({
  isOpen,
  onClose,
  provider,
  mediaId,
  mediaTitle,
  seasonNumber,
  seasonTitle,
  episodeId,
  episodeTitle,
}: ServarrInteractiveSearchDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [releases, setReleases] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIndexerId, setSelectedIndexerId] = useState<
    number | undefined
  >(undefined)
  const [availableIndexers, setAvailableIndexers] = useState<
    Array<{ id: number; name: string }>
  >([])
  const [searchFilter, setSearchFilter] = useState("")
  const [sortKey, setSortKey] = useState<
    "seeders" | "size" | "age" | "quality"
  >("seeders")
  const [sortAsc, setSortAsc] = useState(false)
  const [grabbingGuid, setGrabbingGuid] = useState<string | null>(null)

  // Compute initial default search string
  const defaultSearchTerm = useMemo(() => {
    if (!mediaTitle) return ""
    if (episodeTitle) {
      return `${mediaTitle} ${episodeTitle}`
    }
    if (seasonNumber !== undefined) {
      return `${mediaTitle} S${String(seasonNumber).padStart(2, "0")}`
    }
    return mediaTitle
  }, [mediaTitle, episodeTitle, seasonNumber])

  // Fetch configured indexers
  const fetchIndexers = async () => {
    try {
      let res: any
      if (provider === "RADARR") {
        res = await elysia.servarr.radarr.indexer.get({
          fetch: { credentials: "include" },
        })
      } else {
        res = await elysia.servarr.sonarr.indexer.get({
          fetch: { credentials: "include" },
        })
      }
      if (res?.data?.success && Array.isArray(res.data.indexers)) {
        setAvailableIndexers(
          res.data.indexers
            .filter(
              (idx: any) =>
                idx.enableRss ||
                idx.enableInteractiveSearch ||
                idx.enableAutomaticSearch ||
                idx.name
            )
            .map((idx: any) => ({
              id: idx.id,
              name: idx.name || `Indexer #${idx.id}`,
            }))
        )
      }
    } catch {
      // Fallback: indexers will be auto-extracted from release results
    }
  }

  // Fetch releases from indexers
  const fetchReleases = async () => {
    if (!mediaId) return
    setIsLoading(true)
    try {
      let res: any
      const trimmedTerm = searchTerm.trim()
      if (provider === "RADARR") {
        res = await elysia.servarr.radarr.release.get({
          query: {
            movieId: mediaId,
            ...(trimmedTerm ? { term: trimmedTerm } : {}),
            ...(selectedIndexerId ? { indexerId: selectedIndexerId } : {}),
          },
          fetch: { credentials: "include" },
        })
      } else {
        res = await elysia.servarr.sonarr.release.get({
          query: {
            seriesId: mediaId,
            ...(seasonNumber !== undefined ? { seasonNumber } : {}),
            ...(episodeId ? { episodeId } : {}),
            ...(trimmedTerm ? { term: trimmedTerm } : {}),
            ...(selectedIndexerId ? { indexerId: selectedIndexerId } : {}),
          },
          fetch: { credentials: "include" },
        })
      }

      if (res?.data?.success && Array.isArray(res.data.releases)) {
        setReleases(res.data.releases)

        // Merge any new indexers found in results into availableIndexers
        const foundIndexers = new Map<number, string>()
        res.data.releases.forEach((r: any) => {
          if (r.indexerId && r.indexer) {
            foundIndexers.set(r.indexerId, r.indexer)
          }
        })
        if (foundIndexers.size > 0) {
          setAvailableIndexers((prev) => {
            const map = new Map<number, string>()
            prev.forEach((i) => map.set(i.id, i.name))
            foundIndexers.forEach((name, id) => map.set(id, name))
            return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
          })
        }
      } else {
        setReleases([])
      }
    } catch {
      toast.error("Failed to query indexers for releases")
      setReleases([])
    } finally {
      setIsLoading(false)
    }
  }

  // Reset and initialize on open
  useEffect(() => {
    if (isOpen) {
      setSearchTerm(defaultSearchTerm)
      setSelectedIndexerId(undefined)
      setSearchFilter("")
      fetchIndexers()
      fetchReleases()
    } else {
      setReleases([])
      setSearchFilter("")
    }
  }, [isOpen, mediaId, seasonNumber, episodeId])

  const handleGrabRelease = async (release: any) => {
    const guid = release.guid || release.downloadUrl || release.title
    setGrabbingGuid(guid)
    try {
      let res: any
      if (provider === "RADARR") {
        res = await elysia.servarr.radarr.release.post(
          {
            guid: release.guid,
            indexerId: release.indexerId,
            title: release.title,
            downloadUrl: release.downloadUrl,
            protocol: release.protocol,
            publishDate: release.publishDate,
          },
          { fetch: { credentials: "include" } }
        )
      } else {
        res = await elysia.servarr.sonarr.release.post(
          {
            guid: release.guid,
            indexerId: release.indexerId,
            title: release.title,
            downloadUrl: release.downloadUrl,
            protocol: release.protocol,
            publishDate: release.publishDate,
          },
          { fetch: { credentials: "include" } }
        )
      }

      if (res?.error) {
        toast.error(
          (res.error.value as any)?.message || "Failed to grab release"
        )
      } else {
        toast.success(`Release "${release.title}" sent to download client!`)
        onClose()
      }
    } catch {
      toast.error("Failed to send release to download client")
    } finally {
      setGrabbingGuid(null)
    }
  }

  // Filter and sort releases client-side
  const filteredReleases = useMemo(() => {
    let list = [...releases]

    // Filter by selected indexer if not queried at indexer level
    if (selectedIndexerId) {
      list = list.filter((rel) => rel.indexerId === selectedIndexerId)
    }

    // Quick text filter
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim()
      list = list.filter(
        (rel) =>
          (rel.title || "").toLowerCase().includes(q) ||
          (rel.indexer || "").toLowerCase().includes(q) ||
          (rel.quality?.quality?.name || "").toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      let diff = 0
      if (sortKey === "seeders") {
        diff = (a.seeders ?? 0) - (b.seeders ?? 0)
      } else if (sortKey === "size") {
        diff = (a.size ?? 0) - (b.size ?? 0)
      } else if (sortKey === "age") {
        diff = (a.ageHours ?? 0) - (b.ageHours ?? 0)
      } else if (sortKey === "quality") {
        const qA = a.quality?.quality?.name || ""
        const qB = b.quality?.quality?.name || ""
        diff = qA.localeCompare(qB)
      }
      return sortAsc ? diff : -diff
    })

    return list
  }, [releases, selectedIndexerId, searchFilter, sortKey, sortAsc])

  const targetDescription = episodeTitle
    ? `Episode: "${episodeTitle}"`
    : seasonTitle
      ? `${seasonTitle} Release Packs`
      : seasonNumber !== undefined
        ? `Season ${seasonNumber} Release Packs`
        : provider === "SONARR"
          ? "All Series & Season Releases"
          : "Movie Releases"

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-4xl"
    >
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DialogHeader>
          <div className="flex items-center justify-between pe-8">
            <div>
              <DialogTitle className="flex items-center gap-2 font-heading text-base font-semibold">
                <IconSearch className="size-4 text-primary" />
                <span>Interactive Release Search</span>
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">
                  {mediaTitle}
                </span>
                {" • "}
                <span>{targetDescription}</span>
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReleases}
              disabled={isLoading}
              className="h-8 gap-1.5 rounded-xl text-xs"
            >
              {isLoading ? (
                <Spinner className="size-3.5" />
              ) : (
                <IconRefresh className="size-3.5" />
              )}
              <span>Refresh</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Primary Search Controls: Search String & Indexer Picker */}
        <div className="flex flex-col items-stretch gap-2 rounded-2xl border border-border/40 bg-muted/30 p-3 sm:flex-row sm:items-center">
          {/* Editable Search Query String */}
          <div className="relative min-w-[220px] flex-1">
            <IconSearch className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search query string..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchReleases()}
              className="h-8 w-full rounded-xl bg-background ps-8 font-mono text-xs"
            />
          </div>

          {/* Indexer Selection Dropdown */}
          <div className="flex shrink-0 items-center gap-1.5">
            <IconServer className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" />
            <select
              value={selectedIndexerId ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined
                setSelectedIndexerId(val)
              }}
              className="h-8 max-w-[180px] truncate rounded-xl border border-border/60 bg-background px-2.5 text-xs font-medium text-foreground outline-hidden"
            >
              <option value="" className="bg-popover text-foreground">
                All Indexers (
                {availableIndexers.length > 0
                  ? availableIndexers.length
                  : "Auto"}
                )
              </option>
              {availableIndexers.map((idx) => (
                <option
                  key={idx.id}
                  value={idx.id}
                  className="bg-popover text-foreground"
                >
                  {idx.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <Button
            size="sm"
            onClick={fetchReleases}
            disabled={isLoading}
            className="h-8 shrink-0 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            {isLoading ? (
              <Spinner className="size-3.5" />
            ) : (
              <IconSearch className="size-3.5" />
            )}
            <span>Search Indexers</span>
          </Button>
        </div>

        {/* Secondary Filter & Sort Toolbar */}
        <div className="flex w-full flex-wrap items-center justify-between gap-2.5 border-b border-border/40 pb-2.5">
          {/* Quick client-side filter */}
          <div className="relative w-56">
            <IconFilter className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter loaded releases..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-7 w-full rounded-xl ps-8 text-xs"
            />
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-[11px]">Sort:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="h-7 rounded-lg border border-border/60 bg-muted/30 px-2 py-0.5 text-xs font-medium text-foreground outline-hidden"
            >
              <option value="seeders" className="bg-popover text-foreground">
                Seeders / Peers
              </option>
              <option value="size" className="bg-popover text-foreground">
                Size
              </option>
              <option value="age" className="bg-popover text-foreground">
                Age
              </option>
              <option value="quality" className="bg-popover text-foreground">
                Quality
              </option>
            </select>
            <button
              type="button"
              onClick={() => setSortAsc(!sortAsc)}
              className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
              title={sortAsc ? "Ascending" : "Descending"}
            >
              <IconArrowsSort className="size-3.5" />
            </button>
            <span className="ms-1 font-mono text-[11px] text-muted-foreground/80">
              ({filteredReleases.length} release
              {filteredReleases.length !== 1 ? "s" : ""})
            </span>
          </div>
        </div>

        {/* Release Table / List */}
        <div className="max-h-[52vh] min-h-[240px] w-full overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner className="size-7 text-primary" />
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                Querying indexers with "{searchTerm || mediaTitle}"...
              </p>
            </div>
          ) : filteredReleases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconSearch className="mb-2 size-8 text-muted-foreground/40" />
              <p className="font-heading text-sm font-semibold text-foreground">
                No releases found
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                No indexed releases matched your query. Try modifying the search
                query string above and searching again.
              </p>
            </div>
          ) : (
            <div className="w-full divide-y divide-border/30">
              {filteredReleases.map((rel, idx) => {
                const isRejected =
                  Array.isArray(rel.rejections) && rel.rejections.length > 0
                const guid = rel.guid || rel.downloadUrl || String(idx)
                const isGrabbing = grabbingGuid === guid
                const qualityName =
                  rel.quality?.quality?.name || rel.quality?.name || "Unknown"

                return (
                  <div
                    key={guid}
                    className={cn(
                      "my-1.5 flex w-full flex-col gap-1.5 rounded-2xl border border-border/40 bg-card p-3.5 text-card-foreground shadow-xs ring-1 ring-foreground/5 transition-colors dark:ring-foreground/10",
                      isRejected
                        ? "bg-muted/20 opacity-80 hover:opacity-100"
                        : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-heading text-xs font-semibold break-all text-foreground">
                            {rel.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px] font-bold"
                          >
                            {qualityName}
                          </Badge>
                          {rel.protocol && (
                            <span className="rounded-md bg-muted/60 px-1 font-mono text-[10px] text-muted-foreground uppercase">
                              {rel.protocol}
                            </span>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="rounded-md border border-border/40 bg-muted/60 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-foreground/90">
                            {rel.indexer || "Indexer"}
                          </span>
                          <span>•</span>
                          <span className="font-mono">
                            {formatBytes(rel.size)}
                          </span>
                          <span>•</span>
                          <span>
                            {formatAge(rel.ageHours, rel.publishDate)}
                          </span>
                          {rel.seeders !== undefined && (
                            <>
                              <span>•</span>
                              <span className="font-mono font-semibold text-emerald-500">
                                ↑ {rel.seeders} seeders
                              </span>
                            </>
                          )}
                          {rel.leechers !== undefined && (
                            <span className="font-mono font-medium text-amber-500">
                              ↓ {rel.leechers} peers
                            </span>
                          )}
                        </div>

                        {/* Rejection Warnings */}
                        {isRejected && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-medium text-destructive">
                            <IconAlertTriangle className="size-3.5 shrink-0" />
                            <span className="line-clamp-1">
                              {rel.rejections.join("; ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Download / Grab Action */}
                      <Button
                        variant={isRejected ? "outline" : "default"}
                        size="sm"
                        disabled={isGrabbing}
                        onClick={() => handleGrabRelease(rel)}
                        className="h-8 shrink-0 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
                      >
                        {isGrabbing ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <IconDownload className="size-3.5" />
                        )}
                        <span>Grab</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
