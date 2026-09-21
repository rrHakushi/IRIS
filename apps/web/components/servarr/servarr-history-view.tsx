"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconRefresh,
  IconHistory,
  IconDownload,
  IconFileCheck,
  IconTrash,
  IconFilePencil,
  IconAlertCircle,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { dedupGet, invalidateDedup } from "@/lib/request-dedup"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

export interface ServarrHistoryViewProps {
  provider: "SONARR" | "RADARR"
}

function getEventTypeBadge(eventType?: string | number) {
  const typeStr = String(eventType || "").toLowerCase()
  if (typeStr.includes("grab") || typeStr === "1") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-500"
      >
        <IconDownload className="size-3" /> Grabbed
      </Badge>
    )
  }
  if (typeStr.includes("import") || typeStr === "3") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-blue-500/20 bg-blue-500/10 text-[10px] text-blue-500"
      >
        <IconFileCheck className="size-3" /> Imported
      </Badge>
    )
  }
  if (typeStr.includes("delete") || typeStr === "4") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-rose-500/20 bg-rose-500/10 text-[10px] text-rose-500"
      >
        <IconTrash className="size-3" /> Deleted
      </Badge>
    )
  }
  if (typeStr.includes("rename") || typeStr === "5") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/20 bg-amber-500/10 text-[10px] text-amber-500"
      >
        <IconFilePencil className="size-3" /> Renamed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      {typeStr || "Event"}
    </Badge>
  )
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "—"
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function ServarrHistoryView({ provider }: ServarrHistoryViewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [records, setRecords] = useState<any[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [searchTerm, setSearchTerm] = useState("")
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all")

  const inFlightRef = React.useRef(false)
  const lastLoadedKeyRef = React.useRef<string | null>(null)

  const fetchHistory = React.useCallback(
    async (force = false) => {
      if (!force && inFlightRef.current) return
      inFlightRef.current = true
      setIsLoading(true)
      try {
        const cacheKey = `servarr:${provider}:history:${eventTypeFilter}:${page}:${pageSize}`
        const res = await dedupGet(
          cacheKey,
          () =>
            provider === "SONARR"
              ? elysia.servarr.sonarr.history.get({
                  query: {
                    page,
                    pageSize,
                    sortKey: "date",
                    sortDirection: "descending",
                    eventType:
                      eventTypeFilter !== "all"
                        ? Number(eventTypeFilter)
                        : undefined,
                  },
                })
              : elysia.servarr.radarr.history.get({
                  query: {
                    page,
                    pageSize,
                    sortKey: "date",
                    sortDirection: "descending",
                    eventType:
                      eventTypeFilter !== "all"
                        ? Number(eventTypeFilter)
                        : undefined,
                  },
                }),
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
        toast.error("Failed to load activity history", {
          description: err.message || "Network error",
        })
      } finally {
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [provider, eventTypeFilter, page, pageSize]
  )

  useEffect(() => {
    const key = `${provider}-${eventTypeFilter}-${page}`
    if (lastLoadedKeyRef.current === key) return
    lastLoadedKeyRef.current = key
    fetchHistory()
  }, [provider, eventTypeFilter, page, fetchHistory])

  const filteredRecords = records.filter((rec) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const title = (
      rec.sourceTitle ||
      rec.series?.title ||
      rec.movie?.title ||
      ""
    ).toLowerCase()
    const indexer = (rec.data?.indexer || "").toLowerCase()
    return title.includes(term) || indexer.includes(term)
  })

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex max-w-lg flex-1 items-center gap-3">
          <div className="relative flex-1">
            <IconSearch className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by release title or indexer..."
              className="h-9 rounded-xl border-border/60 bg-background/50 pl-10 text-xs"
            />
          </div>

          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value)
              setPage(1)
            }}
            className="h-9 rounded-xl border border-border/60 bg-background px-3 text-xs text-foreground focus:ring-1 focus:ring-rose-500 focus:outline-none"
          >
            <option value="all">All Events</option>
            <option value="1">Grabbed</option>
            <option value="3">Imported</option>
            <option value="4">Deleted</option>
            <option value="5">Renamed</option>
          </select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchHistory(true)}
          disabled={isLoading}
          className="gap-2 self-start sm:self-auto"
        >
          <IconRefresh className={cn("size-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Spinner className="size-6 text-primary" />
          <span className="text-sm font-medium">Loading history events...</span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/50 bg-card/20 py-20 text-center text-muted-foreground">
          <IconHistory className="size-10 opacity-40" />
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">
              No History Events
            </h3>
            <p className="mt-1 max-w-sm text-xs">
              No recent grabs, imports, or file modifications found for the
              selected filter.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card text-card-foreground shadow-xs ring-1 ring-foreground/5 dark:ring-foreground/10">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/40 font-semibold text-muted-foreground">
                  <th className="w-28 p-3.5">Event</th>
                  <th className="p-3.5">Media Title</th>
                  <th className="p-3.5">Release / File Name</th>
                  <th className="p-3.5">Quality / Indexer</th>
                  <th className="p-3.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredRecords.map((item) => {
                  const mediaTitle =
                    item.series?.title ||
                    item.movie?.title ||
                    item.seriesTitle ||
                    item.movieTitle ||
                    "Media"
                  const epNumber =
                    item.episode?.seasonNumber !== undefined &&
                    item.episode?.episodeNumber !== undefined
                      ? `S${String(item.episode.seasonNumber).padStart(2, "0")}E${String(
                          item.episode.episodeNumber
                        ).padStart(2, "0")}`
                      : null
                  const releaseName =
                    item.sourceTitle || item.data?.releaseTitle || "—"
                  const qualityName =
                    item.quality?.quality?.name || item.quality?.name || "—"
                  const indexer =
                    item.data?.indexer || item.data?.downloadClient || null

                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="p-3.5">
                        {getEventTypeBadge(item.eventType)}
                      </td>

                      <td className="p-3.5 font-medium text-foreground">
                        <div>
                          <span className="font-heading font-semibold">
                            {mediaTitle}
                          </span>
                          {epNumber && (
                            <span className="ml-2 font-mono font-bold text-primary">
                              {epNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="max-w-md truncate p-3.5 font-mono text-muted-foreground">
                        <span className="block truncate" title={releaseName}>
                          {releaseName}
                        </span>
                      </td>

                      <td className="p-3.5 text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="secondary"
                            className="py-0 font-mono text-[10px]"
                          >
                            {qualityName}
                          </Badge>
                          {indexer && (
                            <span className="max-w-[120px] truncate text-[11px] text-muted-foreground">
                              ({indexer})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap text-muted-foreground">
                        <span
                          title={
                            item.date
                              ? new Date(item.date).toLocaleString()
                              : ""
                          }
                        >
                          {formatRelativeTime(item.date)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
