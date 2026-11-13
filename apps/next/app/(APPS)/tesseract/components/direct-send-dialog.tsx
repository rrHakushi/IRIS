"use client"

import React, { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  IconClipboardText,
  IconFile,
  IconFolderPlus,
  IconPlus,
  IconSend,
  IconSparkles,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useTesseract } from "@/context/tesseract-context"
import {
  extractDroppedDataTransfer,
  formatBytes,
  groupDirectoryInputFiles,
  type DroppedFolderSpec,
} from "@/lib/tesseract/device-info"
import type { TesseractPeer } from "@/lib/tesseract/types"
import { DeviceTypeIcon } from "./device-icon"

export function DirectSendDialog({
  targetPeer,
  onClose,
}: {
  targetPeer: TesseractPeer | null
  onClose: () => void
}) {
  const t = useTranslations("tesseract")
  const { currentUserId, autoAcceptOwnDevices, sendDirectToPeer } =
    useTesseract()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  const [files, setFiles] = useState<File[]>([])
  const [folders, setFolders] = useState<DroppedFolderSpec[]>([])
  const [textSnippet, setTextSnippet] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const resetAndClose = () => {
    setFiles([])
    setFolders([])
    setTextSnippet("")
    setIsDragging(false)
    setSubmitting(false)
    onClose()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (!e.dataTransfer) return
    const extracted = await extractDroppedDataTransfer(e.dataTransfer)
    if (extracted.files.length > 0) {
      setFiles((prev) => [...prev, ...extracted.files])
    }
    if (extracted.folders.length > 0) {
      setFolders((prev) => [...prev, ...extracted.folders])
    }
    if (extracted.text) {
      setTextSnippet((prev) =>
        prev ? `${prev}\n${extracted.text}` : extracted.text!
      )
    }
  }

  const handleSend = async () => {
    if (!targetPeer) return
    setSubmitting(true)
    const texts = textSnippet.trim() ? [{ content: textSnippet.trim() }] : []
    const ok = await sendDirectToPeer({
      peerId: targetPeer.peerId,
      files,
      folders,
      texts,
    })
    setSubmitting(false)
    if (ok) {
      resetAndClose()
    }
  }

  const totalBytes =
    files.reduce((acc, f) => acc + f.size, 0) +
    folders.reduce(
      (acc, fld) => acc + fld.files.reduce((s, f) => s + f.file.size, 0),
      0
    )

  const hasContent =
    files.length > 0 || folders.length > 0 || textSnippet.trim().length > 0

  const isOwnAutoAcceptPeer = Boolean(
    targetPeer &&
      currentUserId &&
      targetPeer.user?.id === currentUserId &&
      autoAcceptOwnDevices
  )

  const folderInputAttrs = {
    webkitdirectory: "",
    directory: "",
  } as React.InputHTMLAttributes<HTMLInputElement>

  return (
    <Dialog
      isOpen={Boolean(targetPeer)}
      onOpenChange={(open) => {
        if (!open) resetAndClose()
      }}
      className="sm:max-w-lg"
    >
      {targetPeer && (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DeviceTypeIcon
                deviceType={targetPeer.deviceType}
                className="size-4 text-lime-500"
              />
              <span>
                {t("directSend.title", { peer: targetPeer.alias })}
              </span>
            </DialogTitle>
            <DialogDescription>
              {isOwnAutoAcceptPeer ? (
                <span className="inline-flex items-center gap-1 text-lime-600 dark:text-lime-400">
                  <IconSparkles className="size-3.5" />
                  <span>{t("directSend.ownDeviceAutoAcceptHint")}</span>
                </span>
              ) : (
                t("directSend.subtitle")
              )}
            </DialogDescription>
          </DialogHeader>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsDragging(false)
              }
            }}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-all",
              isDragging
                ? "border-lime-500 bg-lime-500/10"
                : "border-border/80 bg-muted/25"
            )}
          >
            <IconUpload className="mb-2 size-6 text-lime-500" />
            <p className="text-xs font-medium text-foreground">
              {t("directSend.dropHint")}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconPlus data-icon="inline-start" className="size-3.5" />
                <span>{t("sharedByYou.addFiles")}</span>
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => folderInputRef.current?.click()}
              >
                <IconFolderPlus data-icon="inline-start" className="size-3.5" />
                <span>{t("sharedByYou.addFolder")}</span>
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files ? Array.from(e.target.files) : []
                if (picked.length > 0) setFiles((prev) => [...prev, ...picked])
                e.target.value = ""
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...folderInputAttrs}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setFolders((prev) => [
                    ...prev,
                    ...groupDirectoryInputFiles(e.target.files!),
                  ])
                }
                e.target.value = ""
              }}
            />
          </div>

          {(files.length > 0 || folders.length > 0) && (
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-xl border border-border/60 bg-background/60 p-2">
              {folders.map((folder, idx) => (
                <div
                  key={`${folder.name}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <IconFolderPlus className="size-4 shrink-0 text-lime-500" />
                    <span className="truncate font-medium">{folder.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {folder.files.length}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() =>
                      setFolders((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label={t("sharedByYou.removeItem")}
                  >
                    <IconTrash className="size-3.5" />
                  </Button>
                </div>
              ))}

              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <IconFile className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label={t("sharedByYou.removeItem")}
                  >
                    <IconTrash className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <IconClipboardText className="size-3.5" />
              <span>{t("directSend.optionalTextLabel")}</span>
            </label>
            <Textarea
              value={textSnippet}
              onChange={(e) => setTextSnippet(e.target.value)}
              placeholder={t("sharedByYou.textBodyPlaceholder")}
              rows={2}
              className="resize-none text-xs"
            />
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {totalBytes > 0
                ? t("directSend.totalSize", { size: formatBytes(totalBytes) })
                : null}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={resetAndClose}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!hasContent || submitting}
                onClick={() => void handleSend()}
                className="bg-lime-500 text-zinc-950 hover:bg-lime-400"
              >
                <IconSend data-icon="inline-start" className="size-4" />
                <span>{t("directSend.sendButton")}</span>
              </Button>
            </div>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}

