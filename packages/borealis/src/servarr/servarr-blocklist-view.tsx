"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconRefresh,
  IconShieldLock,
  IconTrash,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { dedupGet, invalidateDedup } from "@/lib/request-dedup"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

export interface ServarrBlocklistViewProps {
  provider: "SONARR" | "RADARR"
}

export function ServarrBlocklistView({ provider }: ServarrBlocklistViewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [records, setRecords] = useState<any[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const inFlightRef = React.useRef(false)
  const lastLoadedKeyRef = React.useRef<string | null>(null)

  const fetchBlocklist = React.useCallback(
    async (force = false) => {
      if (!force && inFlightRef.current) return
      inFlightRef.current = true
      setIsLoading(true)
      try {
        const cacheKey = `servarr:${provider}:blocklist:${page}:${pageSize}`
        const res = await dedupGet(
          cacheKey,
          () =>
            provider === "SONARR"
              ? elysia.servarr.sonarr.blocklist.get({
                  query: {
                    page,
                    pageSize,
                    sortKey: "date",
                    sortDirection: "descending",
                  },
                })
              : elysia.servarr.radarr.blocklist.get({
                  query: {
                    page,
                    pageSize,
                    sortKey: "date",
                    sortDirection: "descending",
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
        toast.error("Failed to load blocklist", {
          description: err.message || "Network error",
        })
      } finally {
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [provider, page, pageSize]
  )

  useEffect(() => {
    const key = `${provider}-${page}`
    if (lastLoadedKeyRef.current === key) return
    lastLoadedKeyRef.current = key
    setSelectedIds(new Set())
    fetchBlocklist()
  }, [provider, page, fetchBlocklist])

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

  const handleUnblock = async (ids: number[]) => {
    if (ids.length === 0) return

    setIsDeleting(true)
    try {
      let res: any
      if (provider === "SONARR") {
        res = await elysia.servarr.sonarr.blocklist.delete({ ids })
      } else {
        res = await elysia.servarr.radarr.blocklist.delete({ ids })
      }

      if (res?.data?.success) {
        toast.success(
          `Removed ${ids.length} release${ids.length > 1 ? "s" : ""} from blocklist`
        )
        setSelectedIds(new Set())
        invalidateDedup(`servarr:${provider}:blocklist`)
        fetchBlocklist(true)
      } else {
        toast.error("Failed to remove from blocklist", {
          description: res?.data?.message || "Unknown error",
        })
      }
    } catch (err: any) {
      toast.error("Unblock request failed", {
        description: err.message || "Network error",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredRecords = records.filter((rec) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const sourceTitle = (rec.sourceTitle || "").toLowerCase()
    const indexer = (rec.indexer || "").toLowerCase()
    return sourceTitle.includes(term) || indexer.includes(term)
  })

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <IconSearch className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter blacklisted releases..."
            className="h-9 rounded-xl border-border/60 bg-background/50 pl-10 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {selectedIds.size > 0 && (
            <Button
              variant="default"
              size="sm"
              disabled={isDeleting}
              onClick={() => handleUnblock(Array.from(selectedIds))}
              className="gap-2 bg-rose-600 text-white shadow-sm hover:bg-rose-700"
            >
              {isDeleting ? (
                <Spinner className="size-4" />
              ) : (
                <IconTrash className="size-4" />
              )}
              Unblock Selected ({selectedIds.size})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBlocklist(true)}
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

      {/* Main Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Spinner className="size-6 text-primary" />
          <span className="text-sm font-medium">Checking blocklist...</span>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/50 bg-card/20 py-20 text-center text-muted-foreground">
          <IconCheck className="size-10 text-emerald-500" />
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">
              Blocklist is Empty
            </h3>
            <p className="mt-1 max-w-sm text-xs">
              No blacklisted or permanently failed releases in your{" "}
              {provider === "SONARR" ? "Sonarr" : "Radarr"} instance.
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
                  <th className="p-3.5">Release Title</th>
                  <th className="p-3.5">Indexer / Client</th>
                  <th className="p-3.5">Quality</th>
                  <th className="p-3.5">Date Blocked</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredRecords.map((item) => {
                  const isSelected = selectedIds.has(item.id)
                  const releaseName = item.sourceTitle || "Unknown Release"
                  const indexer = item.indexer || item.downloadClient || "—"
                  const qualityName =
                    item.quality?.quality?.name || item.quality?.name || "—"
                  const dateStr = item.date
                    ? new Date(item.date).toLocaleDateString()
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

                      <td className="max-w-md p-3.5 font-medium text-foreground">
                        <div className="space-y-0.5">
                          <span
                            className="block truncate font-mono text-xs font-semibold text-foreground"
                            title={releaseName}
                          >
                            {releaseName}
                          </span>
                          {item.message && (
                            <p className="truncate text-[11px] text-destructive">
                              {item.message}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-muted-foreground">{indexer}</td>

                      <td className="p-3.5 font-mono text-muted-foreground">
                        <Badge variant="secondary" className="py-0 text-[10px]">
                          {qualityName}
                        </Badge>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-muted-foreground">
                        {dateStr}
                      </td>

                      <td
                        className="p-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Remove from Blocklist"
                          onClick={() => handleUnblock([item.id])}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                        >
                          <IconTrash className="size-3.5" />
                        </Button>
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
