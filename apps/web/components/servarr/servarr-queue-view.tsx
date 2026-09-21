"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  IconCloudDownload,
  IconRefresh,
  IconTrash,
  IconFileImport,
  IconAlertTriangle,
  IconCheck,
  IconPlayerPause,
  IconSettings,
  IconLink,
  IconClock,
  IconBrandSpeedtest,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { dedupGet, invalidateDedup } from "@/lib/request-dedup"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { ServarrManualImportDialog } from "./servarr-manual-import-dialog"

export interface ServarrQueueViewProps {
  provider: "SONARR" | "RADARR" | "ALL"
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatTimeLeft(timeleft?: string): string {
  if (!timeleft) return "—"
  // Handles formats like "00:15:30" or ISO durations
  if (timeleft.startsWith("00:00:00")) return "Finished"
  return timeleft
}

export function ServarrQueueView({ provider }: ServarrQueueViewProps) {
  const { data: session, status: authStatus } = useSession()
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filter, setFilter] = useState<
    "all" | "downloading" | "queued" | "failed"
  >("all")
  const [autoRefresh, setAutoRefresh] = useState<number>(5) // 5s interval default
  const [isManualImportOpen, setIsManualImportOpen] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const inFlightRef = React.useRef(false)
  const lastLoadedKeyRef = React.useRef<string | null>(null)

  const loadQueue = useCallback(
    async (silent = false, force = false) => {
      if (authStatus === "loading") return
      if (!silent && inFlightRef.current) return
      inFlightRef.current = true
      if (!silent) setIsLoading(true)
      else setIsRefreshing(true)

      try {
        const records = await dedupGet(
          `servarr:${provider}:queue`,
          async () => {
            const list: any[] = []
            if (provider === "RADARR" || provider === "ALL") {
              const res = await elysia.servarr.radarr.queue.get({
                fetch: { credentials: "include" },
              })
              if (res?.data?.success && Array.isArray(res.data.records)) {
                list.push(
                  ...res.data.records.map((r: any) => ({
                    ...r,
                    _provider: "RADARR",
                  }))
                )
              }
            }

            if (provider === "SONARR" || provider === "ALL") {
              const res = await elysia.servarr.sonarr.queue.get({
                fetch: { credentials: "include" },
              })
              if (res?.data?.success && Array.isArray(res.data.records)) {
                list.push(
                  ...res.data.records.map((r: any) => ({
                    ...r,
                    _provider: "SONARR",
                  }))
                )
              }
            }
            return list
          },
          { force, ttlMs: silent ? 0 : 2500 }
        )

        setItems(records)
      } catch {
        // Silently fail on background refresh
      } finally {
        if (!silent) setIsLoading(false)
        setIsRefreshing(false)
        inFlightRef.current = false
      }
    },
    [provider, authStatus]
  )

  useEffect(() => {
    if (authStatus === "loading") return
    if (lastLoadedKeyRef.current === provider) return
    lastLoadedKeyRef.current = provider
    loadQueue()
  }, [authStatus, provider, loadQueue])

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefresh <= 0) return
    const interval = setInterval(() => {
      loadQueue(true)
    }, autoRefresh * 1000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadQueue])

  const handleRemoveQueueItem = async (
    item: any,
    removeFromClient = true,
    blocklist = false
  ) => {
    setRemovingId(item.id)
    try {
      let res: any
      const prov = item._provider || provider
      if (prov === "RADARR") {
        res = await (elysia.servarr.radarr.queue.delete as any)({
          query: {
            id: item.id,
            removeFromClient,
            blocklist,
          },
          fetch: { credentials: "include" },
        })
      } else {
        res = await (elysia.servarr.sonarr.queue.delete as any)({
          query: {
            id: item.id,
            removeFromClient,
            blocklist,
          },
          fetch: { credentials: "include" },
        })
      }

      if (res?.data?.success) {
        toast.success("Removed download from queue")
        setItems((prev) => prev.filter((i) => i.id !== item.id))
      } else {
        toast.error((res?.data as any)?.message || "Failed to remove item")
      }
    } catch {
      toast.error("Failed to remove item from queue")
    } finally {
      setRemovingId(null)
    }
  }

  const processedItems = React.useMemo(() => {
    let list = [...items]
    if (filter === "downloading") {
      list = list.filter((i) => i.status === "downloading")
    } else if (filter === "queued") {
      list = list.filter((i) => i.status === "queued" || i.status === "pending")
    } else if (filter === "failed") {
      list = list.filter(
        (i) =>
          i.status === "failed" ||
          i.status === "warning" ||
          (Array.isArray(i.statusMessages) && i.statusMessages.length > 0)
      )
    }
    return list
  }, [items, filter])

  return (
    <div className="flex w-full flex-1 flex-col overflow-x-hidden p-4 md:p-6">
      {/* Header Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 pb-3.5">
        {/* Left Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={() => loadQueue(true)}
            className="h-8 gap-1.5 rounded-xl text-xs font-medium"
          >
            {isRefreshing ? (
              <Spinner className="size-3.5" />
            ) : (
              <IconRefresh className="size-3.5 text-primary" />
            )}
            <span>Refresh Queue</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsManualImportOpen(true)}
            className="h-8 gap-1.5 rounded-xl text-xs font-medium"
          >
            <IconFileImport className="size-3.5 text-amber-500" />
            <span>Manual Import</span>
          </Button>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center rounded-xl border border-border/60 bg-muted/40 p-0.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "downloading", label: "Downloading" },
                { id: "queued", label: "Queued" },
                { id: "failed", label: "Warnings / Failed" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-all select-none",
                  filter === f.id
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
            <IconClock className="size-3.5 shrink-0" />
            <select
              value={autoRefresh}
              onChange={(e) => setAutoRefresh(Number(e.target.value))}
              className="cursor-pointer bg-transparent text-xs font-medium text-foreground outline-hidden"
            >
              <option value="5" className="bg-popover text-foreground">
                5s Auto
              </option>
              <option value="10" className="bg-popover text-foreground">
                10s Auto
              </option>
              <option value="30" className="bg-popover text-foreground">
                30s Auto
              </option>
              <option value="0" className="bg-popover text-foreground">
                Off
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center py-24">
          <Spinner className="size-8 text-primary" />
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Loading activity queue...
          </p>
        </div>
      ) : processedItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border/50 bg-muted/40 text-muted-foreground">
            <IconCloudDownload className="size-7" />
          </div>
          <h3 className="mt-3 font-heading text-sm font-semibold text-foreground">
            Activity queue is empty
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            There are currently no active downloads or queued items. New grabs
            from RSS Sync or searches will appear here.
          </p>
        </div>
      ) : (
        /* IRIS Native Queue Table */
        <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card text-card-foreground shadow-xs ring-1 ring-foreground/5 dark:ring-foreground/10">
          <table className="w-full border-collapse text-start text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-muted/40 font-semibold text-muted-foreground">
                <th className="p-3.5 text-start">Media / Release Title</th>
                <th className="p-3.5 text-start">Progress & Size</th>
                <th className="p-3.5 text-start">Client</th>
                <th className="p-3.5 text-start">Time Left</th>
                <th className="p-3.5 text-start">Status</th>
                <th className="p-3.5 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {processedItems.map((item) => {
                const title =
                  item.title ||
                  item.series?.title ||
                  item.movie?.title ||
                  "Unknown Item"
                const size = item.size || 0
                const sizeleft = item.sizeleft || 0
                const downloaded = Math.max(0, size - sizeleft)
                const percent =
                  size > 0
                    ? Math.min(100, Math.round((downloaded / size) * 100))
                    : 0
                const isRemoving = removingId === item.id
                const hasWarnings =
                  Array.isArray(item.statusMessages) &&
                  item.statusMessages.length > 0

                return (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="max-w-sm p-3.5 font-medium text-foreground">
                      <div className="truncate font-heading font-semibold text-foreground">
                        {title}
                      </div>
                      {item.episode && (
                        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          S{String(item.episode.seasonNumber).padStart(2, "0")}E
                          {String(item.episode.episodeNumber).padStart(2, "0")}{" "}
                          — {item.episode.title}
                        </div>
                      )}
                      {hasWarnings && (
                        <div className="mt-1 flex items-center gap-1 text-[10.5px] text-amber-500">
                          <IconAlertTriangle className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {item.statusMessages
                              .map(
                                (m: any) => m.messages?.join(", ") || m.title
                              )
                              .join("; ")}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="min-w-[180px] p-3.5">
                      <div className="mb-1 flex items-center justify-between font-mono text-[10.5px] text-muted-foreground">
                        <span>{percent}%</span>
                        <span>
                          {formatBytes(downloaded)} / {formatBytes(size)}
                        </span>
                      </div>
                      <Progress value={percent} className="h-1.5" />
                    </td>

                    <td className="p-3.5 text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {item.downloadClient || "Download Client"}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground uppercase">
                        {item.protocol || "Torrent"}
                      </div>
                    </td>

                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                      {formatTimeLeft(item.timeleft)}
                    </td>

                    <td className="p-3.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "py-0 text-[10px] font-semibold capitalize",
                          item.status === "downloading"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                            : item.status === "failed"
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : "border-primary/20 bg-primary/10 text-primary"
                        )}
                      >
                        {item.status || "Queued"}
                      </Badge>
                    </td>

                    <td className="p-3.5 text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isRemoving}
                        onClick={() => handleRemoveQueueItem(item)}
                        className="h-7 rounded-xl px-2 text-xs text-destructive hover:bg-destructive/10"
                        aria-label="Cancel and remove from queue"
                      >
                        {isRemoving ? (
                          <Spinner className="size-3" />
                        ) : (
                          <IconTrash className="size-3.5" />
                        )}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Import Dialog */}
      <ServarrManualImportDialog
        isOpen={isManualImportOpen}
        onClose={() => setIsManualImportOpen(false)}
        provider={provider === "ALL" ? "SONARR" : provider}
        onImportComplete={() => loadQueue(true)}
      />
    </div>
  )
}
