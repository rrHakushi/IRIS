"use client"

import React, { useState, useEffect } from "react"
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
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  IconDownload,
  IconFolder,
  IconSearch,
  IconFileImport,
  IconRefresh,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

export interface ServarrManualImportDialogProps {
  isOpen: boolean
  onClose: () => void
  provider: "SONARR" | "RADARR"
  mediaId?: number
  mediaTitle?: string
  defaultFolder?: string
  downloadId?: string
  onImportComplete?: () => void
  onImported?: () => void
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "—"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function ServarrManualImportDialog({
  isOpen,
  onClose,
  provider,
  defaultFolder = "",
  downloadId,
  onImportComplete,
}: ServarrManualImportDialogProps) {
  const [folderPath, setFolderPath] = useState(defaultFolder)
  const [isScanning, setIsScanning] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importFiles, setImportFiles] = useState<any[]>([])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [importMode, setImportMode] = useState<"Move" | "Copy" | "Hardlink">(
    "Move"
  )

  const handleScan = async () => {
    if (!folderPath && !downloadId) {
      toast.error("Please provide a folder path or download ID to scan")
      return
    }

    setIsScanning(true)
    try {
      let res: any
      if (provider === "RADARR") {
        res = await elysia.servarr.radarr.manualimport.get({
          query: {
            folder: folderPath || undefined,
            downloadId: downloadId || undefined,
            filterExistingFiles: true,
          },
          fetch: { credentials: "include" },
        })
      } else {
        res = await elysia.servarr.sonarr.manualimport.get({
          query: {
            folder: folderPath || undefined,
            downloadId: downloadId || undefined,
            filterExistingFiles: true,
          },
          fetch: { credentials: "include" },
        })
      }

      if (res?.data?.success && Array.isArray(res.data.items)) {
        setImportFiles(res.data.items)
        // Select all valid files by default
        const allIndices = new Set<number>()
        res.data.items.forEach((item: any, idx: number) => {
          if (!item.rejections || item.rejections.length === 0) {
            allIndices.add(idx)
          }
        })
        setSelectedIndices(allIndices)
        toast.success(`Found ${res.data.items.length} files to import`)
      } else {
        setImportFiles([])
        toast.info("No importable files found in directory")
      }
    } catch {
      toast.error("Failed to scan directory for manual import")
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setFolderPath(defaultFolder)
      if (defaultFolder || downloadId) {
        handleScan()
      }
    } else {
      setImportFiles([])
      setSelectedIndices(new Set())
    }
  }, [isOpen, defaultFolder, downloadId])

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIndices.size === importFiles.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(importFiles.map((_, i) => i)))
    }
  }

  const handleExecuteImport = async () => {
    const selectedFiles = importFiles
      .filter((_, idx) => selectedIndices.has(idx))
      .map((f) => ({
        ...f,
        importMode: importMode.toLowerCase(),
      }))

    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file to import")
      return
    }

    setIsImporting(true)
    try {
      let res: any
      if (provider === "RADARR") {
        res = await elysia.servarr.radarr.manualimport.post(
          { files: selectedFiles },
          { fetch: { credentials: "include" } }
        )
      } else {
        res = await elysia.servarr.sonarr.manualimport.post(
          { files: selectedFiles },
          { fetch: { credentials: "include" } }
        )
      }

      if (res?.data?.success) {
        toast.success(
          `Successfully initiated manual import for ${selectedFiles.length} files`
        )
        onImportComplete?.()
        onClose()
      } else {
        toast.error(
          (res?.data as any)?.message || "Failed to execute manual import"
        )
      }
    } catch {
      toast.error("Failed to submit manual import")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-4xl"
    >
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DialogHeader>
          <div className="pe-8">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <IconFileImport className="size-4 text-primary" />
              <span>Manual Media Import</span>
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
              Scan and manually map downloaded video files to your {provider}{" "}
              library.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Scan Input bar */}
        <div className="flex w-full flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <div className="relative min-w-[240px] flex-1">
            <IconFolder className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter folder path to scan on host..."
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className="h-8 w-full ps-8 font-mono text-xs"
            />
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={handleScan}
            disabled={isScanning}
            className="h-8 shrink-0 gap-1.5 rounded-xl text-xs"
          >
            {isScanning ? (
              <Spinner className="size-3.5" />
            ) : (
              <IconSearch className="size-3.5" />
            )}
            <span>Scan Folder</span>
          </Button>
        </div>

        {/* File Table / List */}
        <div className="max-h-[55vh] w-full overflow-y-auto">
          {isScanning ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner className="size-7 text-primary" />
              <p className="mt-3 text-xs text-muted-foreground">
                Scanning directory files...
              </p>
            </div>
          ) : importFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconFolder className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">
                No files loaded
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Enter a folder path above and click Scan Folder to discover
                media files.
              </p>
            </div>
          ) : (
            <div className="w-full divide-y divide-border/40">
              {importFiles.map((file, idx) => {
                const isSelected = selectedIndices.has(idx)
                const mediaTitle =
                  file.series?.title ||
                  file.movie?.title ||
                  file.name ||
                  "Unrecognized Media"
                const qualityName =
                  file.quality?.quality?.name || file.quality?.name || "Auto"

                return (
                  <div
                    key={file.path || idx}
                    onClick={() => toggleSelect(idx)}
                    className={cn(
                      "my-1 flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors",
                      isSelected
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <div
                      className="pt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        isSelected={isSelected}
                        onChange={() => toggleSelect(idx)}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="max-w-md truncate text-xs font-semibold text-foreground">
                          {mediaTitle}
                        </span>
                        {file.episodes && file.episodes.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 font-mono text-[10px]"
                          >
                            E
                            {file.episodes
                              .map((e: any) => e.episodeNumber)
                              .join(", ")}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium"
                        >
                          {qualityName}
                        </Badge>
                      </div>

                      <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        {file.path || file.name}
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-[10.5px] text-muted-foreground">
                        <span>{formatBytes(file.size)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {importFiles.length > 0 && (
          <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="h-7 px-2 text-xs"
              >
                {selectedIndices.size === importFiles.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
              <span>
                {selectedIndices.size} of {importFiles.length} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as any)}
                className="rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground outline-hidden"
              >
                <option value="Move" className="bg-popover text-foreground">
                  Move
                </option>
                <option value="Copy" className="bg-popover text-foreground">
                  Copy
                </option>
                <option value="Hardlink" className="bg-popover text-foreground">
                  Hardlink
                </option>
              </select>

              <Button
                variant="default"
                size="sm"
                disabled={selectedIndices.size === 0 || isImporting}
                onClick={handleExecuteImport}
                className="h-8 gap-1.5 rounded-xl text-xs"
              >
                {isImporting ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <IconDownload className="size-3.5" />
                )}
                <span>Import {selectedIndices.size} Files</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
