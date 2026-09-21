"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconSparkles,
  IconRefresh,
  IconFilter,
  IconCheck,
  IconAlertTriangle,
  IconDownload,
  IconArrowsSort,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { dedupGet, invalidateDedup } from "@/lib/request-dedup"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"
import { ServarrInteractiveSearchDialog } from "./servarr-interactive-search-dialog"

export interface ServarrWantedViewProps {
  provider: "SONARR" | "RADARR"
}

export function ServarrWantedView({ provider }: ServarrWantedViewProps) {
  const [activeTab, setActiveTab] = useState<"missing" | "cutoff">("missing")
  const [isLoading, setIsLoading] = useState(true)
  const [records, setRecords] = useState<any[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isSearchingBatch, setIsSearchingBatch] = useState(false)

  // Interactive search state
  const [interactiveSearchTarget, setInteractiveSearchTarget] = useState<{
    mediaId: number
    mediaTitle: string
    episodeId?: number
    episodeTitle?: string
  } | null>(null)

  const inFlightRef = React.useRef(false)
  const lastLoadedKeyRef = React.useRef<string | null>(null)

  const fetchWanted = React.useCallback(
    async (force = false) => {
      if (!force && inFlightRef.current) return
      inFlightRef.current = true
      setIsLoading(true)
      try {
        const cacheKey = `servarr:${provider}:wanted:${activeTab}:${page}:${pageSize}`
        const res = await dedupGet(
          cacheKey,
          async () => {
            if (provider === "SONARR") {
              if (activeTab === "missing") {
                return elysia.servarr.sonarr.wanted.missing.get({
                  query: {
                    page,
                    pageSize,
                    sortKey: "airDateUtc",
                    sortDirection: "descending",
                  },
                })
              } else {
                return elysia.servarr.sonarr.wanted.cutoff.get({
                  query: {
                    page,
                    pageSize,
                    sortKey: "airDateUtc",
                    sortDirection: "descending",
                  },
                })
              }
            } else {
              if (activeTab === "missing") {
                return elysia.servarr.radarr.wanted.missing.get({
                  query: {
                    page,
                    pageSize,
                    sortKey: "physicalRelease",
                    sortDirection: "descending",
                  },
                })
              } else {
                return elysia.servarr.radarr.wanted.cutoff.get({
                  query: {
                    page,
                    pageSize,
                    sortKey: "title",
                    sortDirection: "ascending",
                  },
                })
              }
            }
          },
          { force, ttlMs: 2500 }
        )

        if (res?.data?.success && Array.isArray(res.data.records)) {
          setRecords(res.data.records)
          setTotalRecords(res.data.totalRecords || res.data.records.length)
        } else {
          setRecords([])
          setTotalRecords(0)
        }
      } catch (err: any) {
        toast.error("Failed to load wanted media", {
          description: err.message || "Network error",
        })
      } finally {
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [provider, activeTab, page, pageSize]
  )

  useEffect(() => {
    const key = `${provider}-${activeTab}-${page}`
    if (lastLoadedKeyRef.current === key) return
    lastLoadedKeyRef.current = key
    setSelectedIds(new Set())
    fetchWanted()
  }, [provider, activeTab, page, fetchWanted])

  const handleToggleSelect = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleToggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set())
    } else {
      const all = new Set<number>(records.map((r) => r.id).filter(Boolean))
      setSelectedIds(all)
    }
  }

  const handleBatchSearch = async () => {
    if (selectedIds.size === 0) return

    setIsSearchingBatch(true)
    try {
      const idArray = Array.from(selectedIds)
      let res: any
      if (provider === "SONARR") {
        res = await elysia.servarr.sonarr.command.post({
          name: "EpisodeSearch",
          episodeIds: idArray,
        })
      } else {
        res = await elysia.servarr.radarr.command.post({
          name: "MoviesSearch",
          movieIds: idArray,
        })
      }

      if (res?.data?.success) {
        toast.success(`Search triggered for ${idArray.length} items`)
        setSelectedIds(new Set())
      } else {
        toast.error("Search failed", {
          description: res?.data?.message || "Unknown error",
        })
      }
    } catch (err: any) {
      toast.error("Search request error", {
        description: err.message || "Network error",
      })
    } finally {
      setIsSearchingBatch(false)
    }
  }

  const filteredRecords = records.filter((rec) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const title = (rec.title || rec.series?.title || "").toLowerCase()
    const episodeTitle = (rec.episodeTitle || "").toLowerCase()
    return title.includes(term) || episodeTitle.includes(term)
  })

  return (
    <div className="space-y-6">
      {/* Header controls & tabs */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 self-start rounded-xl border border-border/40 bg-muted/40 p-1">
          <Button
            variant={activeTab === "missing" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("missing")
              setPage(1)
            }}
            className={cn(
              "rounded-lg px-4 text-xs font-semibold transition-all",
              activeTab === "missing"
                ? "bg-rose-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Missing Releases
          </Button>
          <Button
            variant={activeTab === "cutoff" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("cutoff")
              setPage(1)
            }}
            className={cn(
              "rounded-lg px-4 text-xs font-semibold transition-all",
              activeTab === "cutoff"
                ? "bg-rose-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Cutoff Unmet Upgrades
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="default"
              size="sm"
              disabled={isSearchingBatch}
              onClick={handleBatchSearch}
              className="gap-2 bg-rose-600 text-white shadow-sm hover:bg-rose-700"
            >
              {isSearchingBatch ? (
                <Spinner className="size-4" />
              ) : (
                <IconSparkles className="size-4" />
              )}
              Search Selected ({selectedIds.size})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchWanted(true)}
            disabled={isLoading}
            className="gap-2"
          >
            <IconRefresh
              className={cn("size-4", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter search bar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <IconSearch className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by title..."
            className="h-9 rounded-xl border-border/60 bg-background/50 pl-10 text-xs"
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {totalRecords} items awaiting release
        </span>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Spinner className="size-6 text-rose-500" />
          <span className="text-sm font-medium">
            Scanning wanted records...
          </span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/50 bg-card/20 py-20 text-center text-muted-foreground">
          <IconCheck className="size-10 text-emerald-500" />
          <div>
            <h3 className="text-base font-bold text-foreground">
              No Wanted Items
            </h3>
            <p className="mt-1 max-w-sm text-xs">
              {activeTab === "missing"
                ? "Your library currently has no monitored missing releases."
                : "All existing media files meet or exceed quality cutoff profiles."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card text-card-foreground shadow-xs ring-1 ring-foreground/5 dark:ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/40 font-semibold text-muted-foreground">
                  <th className="w-10 p-3.5 text-center">
                    <Checkbox
                      isSelected={
                        selectedIds.size === filteredRecords.length &&
                        filteredRecords.length > 0
                      }
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th className="p-3.5">Media Title</th>
                  {provider === "SONARR" && <th className="p-3.5">Episode</th>}
                  <th className="p-3.5">Air / Release Date</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredRecords.map((item) => {
                  const isSelected = selectedIds.has(item.id)
                  const mediaTitle =
                    item.series?.title || item.title || "Unknown"
                  const epNumber =
                    item.seasonNumber !== undefined &&
                    item.episodeNumber !== undefined
                      ? `S${String(item.seasonNumber).padStart(2, "0")}E${String(
                          item.episodeNumber
                        ).padStart(2, "0")}`
                      : null
                  const dateStr =
                    item.airDateUtc ||
                    item.physicalRelease ||
                    item.digitalRelease ||
                    item.inCinemas
                  const formattedDate = dateStr
                    ? new Date(dateStr).toLocaleDateString()
                    : "—"

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleToggleSelect(item.id)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/30",
                        isSelected && "bg-primary/5 dark:bg-primary/10"
                      )}
                    >
                      <td
                        className="p-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          isSelected={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                        />
                      </td>

                      <td className="p-3.5 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="max-w-xs truncate font-heading font-semibold">
                            {mediaTitle}
                          </span>
                        </div>
                      </td>

                      {provider === "SONARR" && (
                        <td className="p-3.5 font-mono text-muted-foreground">
                          <span className="font-semibold text-primary">
                            {epNumber}
                          </span>
                          {item.title && (
                            <span className="ml-2 inline-block max-w-[180px] truncate align-middle font-sans text-foreground/80">
                              {item.title}
                            </span>
                          )}
                        </td>
                      )}

                      <td className="p-3.5 text-muted-foreground">
                        {formattedDate}
                      </td>

                      <td className="p-3.5">
                        <Badge
                          variant="outline"
                          className="border-primary/20 bg-primary/10 py-0 text-[10px] text-primary"
                        >
                          {activeTab === "missing" ? "Missing" : "Cutoff Unmet"}
                        </Badge>
                      </td>

                      <td
                        className="p-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Interactive Search"
                            onClick={() =>
                              setInteractiveSearchTarget({
                                mediaId:
                                  item.seriesId || item.movieId || item.id,
                                mediaTitle,
                                episodeId:
                                  provider === "SONARR" ? item.id : undefined,
                                episodeTitle: item.title,
                              })
                            }
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                          >
                            <IconSearch className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Automatic Search"
                            onClick={async () => {
                              try {
                                if (provider === "SONARR") {
                                  await elysia.servarr.sonarr.command.post({
                                    name: "EpisodeSearch",
                                    episodeIds: [item.id],
                                  })
                                } else {
                                  await elysia.servarr.radarr.command.post({
                                    name: "MoviesSearch",
                                    movieIds: [item.id],
                                  })
                                }
                                toast.success(
                                  `Search triggered for ${mediaTitle}`
                                )
                              } catch (err: any) {
                                toast.error("Search failed", {
                                  description: err.message,
                                })
                              }
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                          >
                            <IconSparkles className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Search Release Modal */}
      {interactiveSearchTarget && (
        <ServarrInteractiveSearchDialog
          isOpen={!!interactiveSearchTarget}
          onClose={() => setInteractiveSearchTarget(null)}
          provider={provider}
          mediaId={interactiveSearchTarget.mediaId}
          mediaTitle={interactiveSearchTarget.mediaTitle}
          episodeId={interactiveSearchTarget.episodeId}
          episodeTitle={interactiveSearchTarget.episodeTitle}
        />
      )}
    </div>
  )
}
