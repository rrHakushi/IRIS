"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconFilePencil,
  IconArrowRight,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"

export interface ServarrRenameDialogProps {
  isOpen: boolean
  onClose: () => void
  provider: "SONARR" | "RADARR"
  mediaId: number
  mediaTitle: string
  seasonNumber?: number
  onRenamed?: () => void
}

export function ServarrRenameDialog({
  isOpen,
  onClose,
  provider,
  mediaId,
  mediaTitle,
  seasonNumber,
  onRenamed,
}: ServarrRenameDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!isOpen || !mediaId) return

    let isMounted = true
    setIsLoading(true)

    const fetchPreview = async () => {
      try {
        let res: any
        if (provider === "SONARR") {
          res = await elysia.servarr.sonarr.rename.get({
            query: {
              seriesId: mediaId,
              seasonNumber:
                seasonNumber !== undefined ? seasonNumber : undefined,
            },
          })
        } else {
          res = await elysia.servarr.radarr.rename.get({
            query: {
              movieId: mediaId,
            },
          })
        }

        if (isMounted) {
          if (res?.data?.success && Array.isArray(res.data.records)) {
            setFiles(res.data.records)
            const allIds = new Set<number>(
              res.data.records
                .map(
                  (f: any) =>
                    f.fileId || f.movieFileId || f.episodeFileId || f.id
                )
                .filter(Boolean)
            )
            setSelectedFileIds(allIds)
          } else {
            setFiles([])
            setSelectedFileIds(new Set())
          }
        }
      } catch (err: any) {
        if (isMounted) {
          toast.error("Failed to fetch rename preview", {
            description: err.message || "Unknown error occurred",
          })
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchPreview()

    return () => {
      isMounted = false
    }
  }, [isOpen, provider, mediaId, seasonNumber])

  const handleToggleFile = (fileId: number) => {
    const next = new Set(selectedFileIds)
    if (next.has(fileId)) {
      next.delete(fileId)
    } else {
      next.add(fileId)
    }
    setSelectedFileIds(next)
  }

  const handleToggleAll = () => {
    if (selectedFileIds.size === files.length) {
      setSelectedFileIds(new Set())
    } else {
      const allIds = new Set<number>(
        files
          .map((f) => f.fileId || f.movieFileId || f.episodeFileId || f.id)
          .filter(Boolean)
      )
      setSelectedFileIds(allIds)
    }
  }

  const handleExecuteRename = async () => {
    if (selectedFileIds.size === 0) return

    setIsRenaming(true)
    try {
      const fileIdArray = Array.from(selectedFileIds)
      let res: any
      if (provider === "SONARR") {
        res = await elysia.servarr.sonarr.rename.post({
          seriesId: mediaId,
          files: fileIdArray,
        })
      } else {
        res = await elysia.servarr.radarr.rename.post({
          movieId: mediaId,
          files: fileIdArray,
        })
      }

      if (res?.data?.success) {
        toast.success(`Renaming started for ${fileIdArray.length} files`)
        onRenamed?.()
        onClose()
      } else {
        toast.error("Rename failed", {
          description: res?.data?.message || "Unknown error",
        })
      }
    } catch (err: any) {
      toast.error("Rename request failed", {
        description: err.message || "Network error",
      })
    } finally {
      setIsRenaming(false)
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
          <div className="flex items-center gap-3 pe-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
              <IconFilePencil className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Rename Files — {mediaTitle}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                Preview and apply standard naming conventions to your media
                files on disk.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Spinner className="size-6 text-rose-500" />
            <span className="text-sm font-medium">
              Analyzing file names and patterns...
            </span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/40 bg-muted/20 py-16 text-muted-foreground">
            <IconCheck className="size-8 text-emerald-500" />
            <div className="text-center">
              <p className="font-semibold text-foreground">
                All files are properly named
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                No files need renaming based on your current naming
                configuration.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  isSelected={
                    selectedFileIds.size === files.length && files.length > 0
                  }
                  onChange={handleToggleAll}
                />
                <span className="text-xs font-semibold text-muted-foreground">
                  Select All ({selectedFileIds.size}/{files.length} selected)
                </span>
              </div>
            </div>

            <div className="max-h-[460px] divide-y divide-border/30 overflow-y-auto rounded-xl border border-border/40 bg-card/40">
              {files.map((file, idx) => {
                const fId =
                  file.fileId ||
                  file.movieFileId ||
                  file.episodeFileId ||
                  file.id ||
                  idx
                const isSelected = selectedFileIds.has(fId)
                const existingPath =
                  file.existingPath || file.path || file.sourcePath || ""
                const newPath = file.newPath || file.targetPath || ""
                const existingName =
                  existingPath.split(/[\/\\]/).pop() || existingPath
                const newName = newPath.split(/[\/\\]/).pop() || newPath

                return (
                  <div
                    key={fId}
                    onClick={() => handleToggleFile(fId)}
                    className="flex cursor-pointer items-start gap-3 p-3.5 transition-colors hover:bg-muted/30"
                  >
                    <div
                      className="pt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        isSelected={isSelected}
                        onChange={() => handleToggleFile(fId)}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5 font-mono text-xs">
                      <div className="flex items-center gap-2 truncate text-muted-foreground line-through opacity-75">
                        <span className="truncate">{existingName}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate font-medium text-rose-500 dark:text-rose-400">
                        <IconArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{newName}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="flex items-center justify-between border-t border-border/40 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={selectedFileIds.size === 0 || isRenaming || isLoading}
            onClick={handleExecuteRename}
            className="gap-2 bg-rose-600 text-white hover:bg-rose-700"
          >
            {isRenaming ? (
              <Spinner className="size-4" />
            ) : (
              <IconFilePencil className="size-4" />
            )}
            Rename {selectedFileIds.size} File
            {selectedFileIds.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
