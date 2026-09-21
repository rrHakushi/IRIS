"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Spinner } from "@workspace/ui/components/spinner"
import { IconTrash, IconFolder } from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"

export interface ServarrDeleteMediaDialogProps {
  isOpen: boolean
  onClose: () => void
  provider: "SONARR" | "RADARR"
  mediaId: number
  mediaTitle: string
  path?: string
  fileCount?: number
  onDeleted?: () => void
}

export function ServarrDeleteMediaDialog({
  isOpen,
  onClose,
  provider,
  mediaId,
  mediaTitle,
  path,
  fileCount,
  onDeleted,
}: ServarrDeleteMediaDialogProps) {
  const [addImportListExclusion, setAddImportListExclusion] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isMovie = provider === "RADARR"
  const providerName = isMovie ? "Radarr" : "Sonarr"

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      let res: any
      if (isMovie) {
        res = await elysia.servarr.radarr.movies({ id: mediaId }).delete({
          query: {
            deleteFiles,
            addImportListExclusion,
          },
          fetch: { credentials: "include" },
        })
      } else {
        res = await elysia.servarr.sonarr.series({ id: mediaId }).delete({
          query: {
            deleteFiles,
            addImportListExclusion,
          },
          fetch: { credentials: "include" },
        })
      }

      if (res?.data?.success) {
        toast.success(`Deleted ${mediaTitle}`)
        onClose()
        onDeleted?.()
      } else {
        toast.error("Failed to delete", {
          description: (res?.data as any)?.message || "Unknown error",
        })
      }
    } catch (err: any) {
      toast.error("Delete failed", { description: err.message })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && !isDeleting && onClose()}
      className="sm:max-w-lg"
    >
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DialogHeader>
          <div className="pe-8">
            <DialogTitle className="text-base font-bold text-foreground">
              Delete - {mediaTitle}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Path Display */}
        {path && (
          <div className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5 font-mono text-xs text-muted-foreground">
            <IconFolder className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{path}</span>
          </div>
        )}

        {/* Delete Options */}
        <div className="my-1 w-full space-y-2.5">
          {/* Add List Exclusion */}
          <label
            htmlFor="exclusion-checkbox"
            className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/20 p-3.5 transition-colors hover:bg-muted/30"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground">
                Add List Exclusion
              </div>
              <div className="text-[11px] leading-normal text-muted-foreground">
                Prevent {isMovie ? "movie" : "series"} from being added to{" "}
                {providerName} by lists
              </div>
            </div>
            <Checkbox
              id="exclusion-checkbox"
              isSelected={addImportListExclusion}
              onChange={(selected: boolean) =>
                setAddImportListExclusion(selected)
              }
              className="mt-0.5 shrink-0"
            />
          </label>

          {/* Delete Files */}
          <label
            htmlFor="delete-files-checkbox"
            className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/20 p-3.5 transition-colors hover:bg-muted/30"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground">
                Delete {fileCount !== undefined ? `${fileCount} ` : ""}
                {isMovie ? "Movie" : "Series"} Files
              </div>
              <div className="text-[11px] leading-normal text-muted-foreground">
                Delete the {isMovie ? "movie" : "series"} files and{" "}
                {isMovie ? "movie" : "series"} folder
              </div>
            </div>
            <Checkbox
              id="delete-files-checkbox"
              isSelected={deleteFiles}
              onChange={(selected: boolean) => setDeleteFiles(selected)}
              className="mt-0.5 shrink-0"
            />
          </label>
        </div>

        {/* Action Footer */}
        <div className="flex w-full items-center justify-end gap-2 border-t border-border/30 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="h-9 rounded-xl px-4 text-xs font-medium"
          >
            Close
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-9 gap-1.5 rounded-xl bg-rose-600 px-5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            {isDeleting ? (
              <Spinner className="size-3.5" />
            ) : (
              <IconTrash className="size-3.5" />
            )}
            <span>Delete</span>
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
