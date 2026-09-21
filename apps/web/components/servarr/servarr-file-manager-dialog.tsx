"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconFile,
  IconTrash,
  IconRefresh,
  IconFolder,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

export interface ServarrFileManagerDialogProps {
  isOpen: boolean
  onClose: () => void
  provider: "SONARR" | "RADARR"
  mediaId: number
  mediaTitle: string
  onFileDeleted?: () => void
  onFilesChanged?: () => void
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
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

export function ServarrFileManagerDialog({
  isOpen,
  onClose,
  provider,
  mediaId,
  mediaTitle,
  onFileDeleted,
}: ServarrFileManagerDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [episodes, setEpisodes] = useState<any[]>([])
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const fetchFiles = async () => {
    if (!mediaId) return
    setIsLoading(true)
    try {
      let res: any
      if (provider === "RADARR") {
        res = await elysia.servarr.radarr.files.get({
          query: { movieId: mediaId },
          fetch: { credentials: "include" },
        })
      } else {
        res = await elysia.servarr.sonarr.files.get({
          query: { seriesId: mediaId },
          fetch: { credentials: "include" },
        })
      }

      if (res?.data?.success) {
        setFiles(res.data.files || [])
        if (res.data.episodes) {
          setEpisodes(res.data.episodes)
        }
      } else {
        setFiles([])
      }
    } catch {
      toast.error("Failed to load media files")
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchFiles()
    } else {
      setFiles([])
      setEpisodes([])
      setConfirmDeleteId(null)
    }
  }, [isOpen, mediaId])

  const handleDeleteFile = async (fileId: number) => {
    setDeletingId(fileId)
    try {
      let res: any
      if (provider === "RADARR") {
        res = await (elysia.servarr.radarr.files.delete as any)({
          query: { fileId },
          fetch: { credentials: "include" },
        })
      } else {
        res = await (elysia.servarr.sonarr.files.delete as any)({
          query: { fileId },
          fetch: { credentials: "include" },
        })
      }

      if (res?.data?.success) {
        toast.success("File deleted from disk")
        setFiles((prev) => prev.filter((f) => f.id !== fileId))
        setConfirmDeleteId(null)
        onFileDeleted?.()
      } else {
        toast.error((res?.data as any)?.message || "Failed to delete file")
      }
    } catch {
      toast.error("Failed to execute file deletion")
    } finally {
      setDeletingId(null)
    }
  }

  // Create episode lookup map for Sonarr
  const episodeMap = React.useMemo(() => {
    const map = new Map<number, any>()
    episodes.forEach((ep) => {
      if (ep.episodeFileId) {
        map.set(ep.episodeFileId, ep)
      }
    })
    return map
  }, [episodes])

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-3xl"
    >
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DialogHeader>
          <div className="flex items-center justify-between pe-8">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <IconFolder className="size-4 text-primary" />
                <span>Media File Manager</span>
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                {mediaTitle} ({provider})
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFiles}
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

        {/* Content list */}
        <div className="max-h-[60vh] w-full overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Spinner className="size-7 text-primary" />
              <p className="mt-3 text-xs text-muted-foreground">
                Loading disk files for {mediaTitle}...
              </p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconFile className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">
                No media files found
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                No downloaded video files currently exist on disk for this item.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-2.5">
              {files.map((file) => {
                const ep = episodeMap.get(file.id)
                const qualityName =
                  file.quality?.quality?.name || file.qualityCutoffNotMet
                    ? file.quality?.quality?.name || "Standard"
                    : "Standard"
                const mediaInfo = file.mediaInfo || {}
                const isDeleting = deletingId === file.id
                const isConfirming = confirmDeleteId === file.id

                return (
                  <div
                    key={file.id}
                    className="flex w-full flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* File path or episode label */}
                        <div className="flex flex-wrap items-center gap-2">
                          <IconFile className="size-4 shrink-0 text-primary" />
                          {ep && (
                            <Badge
                              variant="secondary"
                              className="px-1.5 py-0 font-mono text-[10px] font-bold"
                            >
                              S{String(ep.seasonNumber).padStart(2, "0")}E
                              {String(ep.episodeNumber).padStart(2, "0")}
                            </Badge>
                          )}
                          <span className="max-w-md truncate font-mono text-xs font-semibold text-foreground">
                            {file.relativePath ||
                              file.path ||
                              `File #${file.id}`}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium"
                          >
                            {qualityName}
                          </Badge>
                        </div>

                        {/* Media Info specs */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                          <span>{formatBytes(file.size)}</span>
                          {mediaInfo.videoCodec && (
                            <>
                              <span>•</span>
                              <span className="font-mono">
                                {mediaInfo.videoCodec}
                              </span>
                            </>
                          )}
                          {mediaInfo.audioFormat && (
                            <>
                              <span>•</span>
                              <span>{mediaInfo.audioFormat}</span>
                            </>
                          )}
                          {mediaInfo.audioLanguages && (
                            <>
                              <span>•</span>
                              <span>{mediaInfo.audioLanguages}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>Added: {formatDate(file.dateAdded)}</span>
                        </div>
                      </div>

                      {/* Delete action */}
                      <div className="shrink-0">
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleDeleteFile(file.id)}
                              className="h-7 rounded-lg px-2 text-xs"
                            >
                              {isDeleting ? (
                                <Spinner className="size-3" />
                              ) : (
                                <span>Confirm Delete</span>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-7 rounded-lg px-2 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteId(file.id)}
                            className="h-8 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                            aria-label="Delete file from disk"
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        )}
                      </div>
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
