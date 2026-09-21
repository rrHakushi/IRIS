"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import {
  IconSearch,
  IconFolder,
  IconTrash,
  IconRefresh,
  IconArrowsSort,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconDeviceTv,
  IconMovie,
  IconListCheck,
  IconFilter,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { dedupGet, invalidateDedup } from "@/lib/request-dedup"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"
import { ServarrInteractiveSearchDialog } from "./servarr-interactive-search-dialog"
import { ServarrFileManagerDialog } from "./servarr-file-manager-dialog"

export interface ServarrSeriesManageViewProps {
  provider: "SONARR" | "RADARR"
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

export function ServarrSeriesManageView({
  provider,
}: ServarrSeriesManageViewProps) {
  const { data: session, status: authStatus } = useSession()
  const pageTitle = provider === "RADARR" ? "Radarr" : "Sonarr"
  const itemNoun = provider === "RADARR" ? "movie" : "series"

  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<
    "all" | "monitored" | "unmonitored" | "downloaded" | "missing"
  >("all")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Modal states for File Manager and Interactive Search
  const [activeSearchItem, setActiveSearchItem] = useState<{
    id: number
    title: string
  } | null>(null)
  const [activeFileItem, setActiveFileItem] = useState<{
    id: number
    title: string
  } | null>(null)

  // Bulk action states
  const [isBulkOperating, setIsBulkOperating] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteFilesOnDisk, setDeleteFilesOnDisk] = useState(false)
  const [addImportListExclusion, setAddImportListExclusion] = useState(false)

  const inFlightRef = React.useRef(false)
  const lastLoadedKeyRef = React.useRef<string | null>(null)

  const loadMedia = useCallback(
    async (silent = false, force = false) => {
      if (authStatus === "loading") return
      if (!silent && inFlightRef.current) return
      inFlightRef.current = true
      if (!silent) setIsLoading(true)
      try {
        const res = await dedupGet(
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

        if (res?.data?.success && Array.isArray(res.data.items)) {
          setItems(res.data.items)
        } else {
          setItems([])
        }
      } catch {
        toast.error(`Failed to load ${pageTitle} library`)
      } finally {
        if (!silent) setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [provider, pageTitle, authStatus]
  )

  useEffect(() => {
    if (authStatus === "loading") return
    if (lastLoadedKeyRef.current === provider) return
    lastLoadedKeyRef.current = provider
    loadMedia()
  }, [authStatus, provider, loadMedia])

  // Filtered Items
  const processedItems = useMemo(() => {
    let list = [...items]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (i) =>
          i.title?.toLowerCase().includes(q) ||
          i.originalTitle?.toLowerCase().includes(q) ||
          i.year?.toString().includes(q)
      )
    }

    if (filter === "monitored") {
      list = list.filter((i) => i.monitored)
    } else if (filter === "unmonitored") {
      list = list.filter((i) => !i.monitored)
    } else if (filter === "downloaded") {
      list = list.filter((i) => i.hasFile)
    } else if (filter === "missing") {
      list = list.filter((i) => !i.hasFile && i.monitored)
    }

    return list
  }, [items, searchQuery, filter])

  // Selection handlers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === processedItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(processedItems.map((i) => Number(i.id))))
    }
  }

  // Bulk Operations
  const handleBulkMonitored = async (monitored: boolean) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setIsBulkOperating(true)
    try {
      let res: any
      if (provider === "RADARR") {
        res = await elysia.servarr.radarr.manage.put(
          { movieIds: ids, monitored },
          { fetch: { credentials: "include" } }
        )
      } else {
        res = await elysia.servarr.sonarr.manage.put(
          { seriesIds: ids, monitored },
          { fetch: { credentials: "include" } }
        )
      }

      if (res?.data?.success) {
        toast.success(
          `Set ${ids.length} ${itemNoun}s to ${monitored ? "Monitored" : "Unmonitored"}`
        )
        await loadMedia(true, true)
        setSelectedIds(new Set())
      } else {
        toast.error(
          (res?.data as any)?.message || "Failed to update monitored status"
        )
      }
    } catch {
      toast.error("Bulk update failed")
    } finally {
      setIsBulkOperating(false)
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setIsBulkOperating(true)
    try {
      let res: any
      if (provider === "RADARR") {
        res = await elysia.servarr.radarr.manage.delete(
          {
            movieIds: ids,
            deleteFiles: deleteFilesOnDisk,
            addImportListExclusion,
          },
          { fetch: { credentials: "include" } }
        )
      } else {
        res = await elysia.servarr.sonarr.manage.delete(
          {
            seriesIds: ids,
            deleteFiles: deleteFilesOnDisk,
            addImportListExclusion,
          },
          { fetch: { credentials: "include" } }
        )
      }

      if (res?.data?.success) {
        toast.success(`Deleted ${ids.length} ${itemNoun}s successfully`)
        setIsDeleteDialogOpen(false)
        setSelectedIds(new Set())
        await loadMedia(true, true)
      } else {
        toast.error((res?.data as any)?.message || "Failed to delete items")
      }
    } catch {
      toast.error("Bulk delete failed")
    } finally {
      setIsBulkOperating(false)
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col overflow-x-hidden p-4 pb-24 md:p-6">
      {/* Header Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {provider === "RADARR" ? (
              <IconMovie className="size-5" />
            ) : (
              <IconDeviceTv className="size-5" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Manage {provider === "RADARR" ? "Movies" : "Series"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Mass editor, disk file management, and interactive release search.
            </p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-40 sm:w-56">
            <IconSearch className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Filter ${itemNoun}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 ps-8 text-xs"
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
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMedia(true, true)}
            className="h-8 gap-1.5 rounded-xl text-xs"
          >
            <IconRefresh className="size-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Table Area */}
      {isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center py-24">
          <Spinner className="size-8 text-primary" />
          <p className="mt-3 text-xs text-muted-foreground">
            Loading {itemNoun}s for management...
          </p>
        </div>
      ) : processedItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border/50 bg-muted/40 text-muted-foreground">
            {provider === "RADARR" ? (
              <IconMovie className="size-6" />
            ) : (
              <IconDeviceTv className="size-6" />
            )}
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            No {itemNoun}s found
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {searchQuery
              ? `No items match "${searchQuery}".`
              : `Your ${pageTitle} library currently has no media items.`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card text-card-foreground shadow-xs ring-1 ring-foreground/5 dark:ring-foreground/10">
          <table className="w-full border-collapse text-start text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-muted/40 font-semibold text-muted-foreground">
                <th className="w-8 p-3.5 text-center">
                  <Checkbox
                    isSelected={
                      selectedIds.size > 0 &&
                      selectedIds.size === processedItems.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-3.5 text-start">Title</th>
                <th className="p-3.5 text-start">Year</th>
                <th className="p-3.5 text-start">Status</th>
                <th className="p-3.5 text-start">Quality Profile</th>
                <th className="p-3.5 text-start">Added</th>
                <th className="p-3.5 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {processedItems.map((item) => {
                const isSelected = selectedIds.has(Number(item.id))

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "transition-colors",
                      isSelected
                        ? "bg-primary/5 dark:bg-primary/10"
                        : "hover:bg-muted/30"
                    )}
                  >
                    <td
                      className="p-3.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        isSelected={isSelected}
                        onChange={() => toggleSelect(Number(item.id))}
                      />
                    </td>

                    <td className="p-3.5 font-medium text-foreground">
                      <div className="flex items-center gap-2.5">
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
                        <div>
                          <div className="max-w-xs truncate font-heading font-semibold text-foreground">
                            {item.title}
                          </div>
                          {item.originalTitle &&
                            item.originalTitle !== item.title && (
                              <div className="max-w-xs truncate text-[10px] text-muted-foreground">
                                {item.originalTitle}
                              </div>
                            )}
                        </div>
                      </div>
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
                      {item.qualityProfile || "Any"}
                    </td>

                    <td className="p-3.5 text-muted-foreground">
                      {formatDate(item.added)}
                    </td>

                    <td className="p-3.5 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Interactive Release Search */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setActiveSearchItem({
                              id: Number(item.id),
                              title: item.title,
                            })
                          }
                          className="h-7 rounded-xl px-2 text-xs text-primary hover:bg-primary/10"
                          aria-label="Interactive Search (Manual Release Picker)"
                        >
                          <IconSearch className="size-3.5" />
                          <span className="ms-1 hidden sm:inline">Search</span>
                        </Button>

                        {/* Manage Files on Disk */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setActiveFileItem({
                              id: Number(item.id),
                              title: item.title,
                            })
                          }
                          className="h-7 rounded-xl px-2 text-xs text-amber-500 hover:bg-amber-500/10"
                          aria-label="Manage Disk Files"
                        >
                          <IconFolder className="size-3.5" />
                          <span className="ms-1 hidden sm:inline">Files</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-popover/95 p-2 shadow-xl backdrop-blur-md">
            <span className="ps-2 pe-1 text-xs font-bold text-foreground">
              {selectedIds.size} Selected
            </span>

            <div className="h-4 w-px bg-border/80" />

            <Button
              variant="outline"
              size="sm"
              disabled={isBulkOperating}
              onClick={() => handleBulkMonitored(true)}
              className="h-8 gap-1.5 rounded-xl text-xs"
            >
              <IconEye className="size-3.5 text-primary" />
              <span>Monitor</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={isBulkOperating}
              onClick={() => handleBulkMonitored(false)}
              className="h-8 gap-1.5 rounded-xl text-xs"
            >
              <IconEyeOff className="size-3.5 text-muted-foreground" />
              <span>Unmonitor</span>
            </Button>

            <Button
              variant="destructive"
              size="sm"
              disabled={isBulkOperating}
              onClick={() => setIsDeleteDialogOpen(true)}
              className="h-8 gap-1.5 rounded-xl text-xs"
            >
              <IconTrash className="size-3.5" />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      )}

      {/* Interactive Search Modal */}
      {activeSearchItem && (
        <ServarrInteractiveSearchDialog
          isOpen={Boolean(activeSearchItem)}
          onClose={() => setActiveSearchItem(null)}
          provider={provider}
          mediaId={activeSearchItem.id}
          mediaTitle={activeSearchItem.title}
        />
      )}

      {/* File Manager Modal */}
      {activeFileItem && (
        <ServarrFileManagerDialog
          isOpen={Boolean(activeFileItem)}
          onClose={() => setActiveFileItem(null)}
          provider={provider}
          mediaId={activeFileItem.id}
          mediaTitle={activeFileItem.title}
          onFileDeleted={() => loadMedia(true)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={(open) => !open && setIsDeleteDialogOpen(false)}
        className="p-6 sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-rose-500">
            <IconTrash className="size-5" />
            <span>
              Delete {selectedIds.size} {itemNoun}s
            </span>
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-foreground">
            Are you sure you want to remove the selected {itemNoun}s from{" "}
            {pageTitle}?
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-2.5">
          <label
            htmlFor="bulk-exclusion-checkbox"
            className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/20 p-3.5 transition-colors hover:bg-muted/30"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground">
                Add List Exclusion
              </div>
              <div className="text-[11px] leading-normal text-muted-foreground">
                Prevent selected {itemNoun}s from being re-added by lists
              </div>
            </div>
            <Checkbox
              id="bulk-exclusion-checkbox"
              isSelected={addImportListExclusion}
              onChange={(selected: boolean) =>
                setAddImportListExclusion(selected)
              }
              className="mt-0.5 shrink-0"
            />
          </label>

          <label
            htmlFor="bulk-delete-files-checkbox"
            className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/20 p-3.5 transition-colors hover:bg-muted/30"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground">
                Delete Media Files
              </div>
              <div className="text-[11px] leading-normal text-muted-foreground">
                Delete all media files and folders from disk storage
              </div>
            </div>
            <Checkbox
              id="bulk-delete-files-checkbox"
              isSelected={deleteFilesOnDisk}
              onChange={(selected: boolean) => setDeleteFilesOnDisk(selected)}
              className="mt-0.5 shrink-0"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(false)}
            className="h-8 rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isBulkOperating}
            onClick={handleBulkDelete}
            className="h-8 gap-1.5 rounded-xl text-xs"
          >
            {isBulkOperating ? (
              <Spinner className="size-3.5" />
            ) : (
              <IconTrash className="size-3.5" />
            )}
            <span>Delete {selectedIds.size} Items</span>
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
