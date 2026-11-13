"use client"

import React, { useRef, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconClipboardText,
  IconFile,
  IconFolderPlus,
  IconLink,
  IconLock,
  IconLogin2,
  IconPencil,
  IconPlus,
  IconShieldLock,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useTesseract } from "@/context/tesseract-context"
import {
  formatBytes,
  groupDirectoryInputFiles,
} from "@/lib/tesseract/device-info"
import { DeviceTypeIcon } from "./device-icon"

export function SharedByYouPanel() {
  const t = useTranslations("tesseract")
  const {
    isAuthenticated,
    alias,
    setAlias,
    deviceInfo,
    sharedByYou,
    requireShelfApproval,
    setRequireShelfApproval,
    autoAcceptOwnDevices,
    setAutoAcceptOwnDevices,
    addFilesToShelf,
    addFoldersToShelf,
    addTextToShelf,
    removeLocalItem,
    clearLocalShelf,
    handleDataTransferDropOrPaste,
  } = useTesseract()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showTextComposer, setShowTextComposer] = useState(false)
  const [textTitle, setTextTitle] = useState("")
  const [textBody, setTextBody] = useState("")
  const [editingAlias, setEditingAlias] = useState(false)
  const [draftAlias, setDraftAlias] = useState(alias)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer) {
      await handleDataTransferDropOrPaste(e.dataTransfer, "drop")
    }
  }

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textBody.trim()) return
    addTextToShelf(textBody, textTitle)
    setTextTitle("")
    setTextBody("")
    setShowTextComposer(false)
  }

  const folderInputAttrs = {
    webkitdirectory: "",
    directory: "",
  } as React.InputHTMLAttributes<HTMLInputElement>

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/70 bg-card/50 p-4 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            {t("sharedByYou.title")}
          </h2>
          <Badge variant="secondary" className="text-xs">
            {sharedByYou.length}
          </Badge>
          {isAuthenticated && requireShelfApproval && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-600 dark:text-amber-400"
            >
              <IconShieldLock className="size-3" />
              <span>{t("sharedByYou.approvalActive")}</span>
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {editingAlias ? (
            <form
              className="inline-flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                if (draftAlias.trim()) setAlias(draftAlias)
                setEditingAlias(false)
              }}
            >
              <Input
                value={draftAlias}
                onChange={(e) => setDraftAlias(e.target.value)}
                maxLength={48}
                autoFocus
                className="h-6 w-36 rounded-lg px-2 text-xs"
                aria-label={t("header.editAlias")}
              />
              <Button
                type="submit"
                size="icon-xs"
                variant="ghost"
                aria-label={t("common.save")}
              >
                <IconCheck className="size-3.5 text-lime-500" />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => setEditingAlias(false)}
                aria-label={t("common.cancel")}
              >
                <IconX className="size-3.5" />
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftAlias(alias)
                setEditingAlias(true)
              }}
              className="inline-flex h-6 items-center gap-1 rounded-xl border border-border/60 bg-background/70 px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <DeviceTypeIcon
                deviceType={deviceInfo.deviceType}
                className="size-3 text-lime-500"
              />
              <span className="max-w-32 truncate">{alias}</span>
              <IconPencil className="size-3 text-muted-foreground" />
            </button>
          )}

          <PopoverTrigger>
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              aria-label={t("header.preferences")}
            >
              <IconAdjustmentsHorizontal className="size-3.5" />
            </Button>
            <Popover className="w-80">
              <PopoverHeader>
                <PopoverTitle>{t("preferences.title")}</PopoverTitle>
                <PopoverDescription>
                  {t("preferences.subtitle")}
                </PopoverDescription>
              </PopoverHeader>

              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-foreground">
                      {t("preferences.autoAcceptOwnTitle")}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t("preferences.autoAcceptOwnDesc")}
                    </p>
                  </div>
                  <Switch
                    size="sm"
                    isDisabled={!isAuthenticated}
                    isSelected={isAuthenticated && autoAcceptOwnDevices}
                    onChange={setAutoAcceptOwnDevices}
                    aria-label={t("preferences.autoAcceptOwnTitle")}
                  />
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                      <IconShieldLock className="size-3.5 text-lime-500" />
                      <span>{t("preferences.requireApprovalTitle")}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t("preferences.requireApprovalDesc")}
                    </p>
                  </div>
                  <Switch
                    size="sm"
                    isDisabled={!isAuthenticated}
                    isSelected={isAuthenticated && requireShelfApproval}
                    onChange={setRequireShelfApproval}
                    aria-label={t("preferences.requireApprovalTitle")}
                  />
                </div>

                {!isAuthenticated && (
                  <Link
                    href="/carina/auth/login"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-lime-500/15 px-2.5 py-2 text-xs font-medium text-lime-600 transition-colors hover:bg-lime-500/25 dark:text-lime-400"
                  >
                    <IconLogin2 className="size-3.5" />
                    <span>{t("header.guestSignIn")}</span>
                  </Link>
                )}
              </div>
            </Popover>
          </PopoverTrigger>

          {sharedByYou.length > 0 && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={clearLocalShelf}
              className="text-muted-foreground hover:text-destructive"
            >
              <IconTrash data-icon="inline-start" className="size-3.5" />
              <span>{t("sharedByYou.clearAll")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all",
          isDragging
            ? "border-lime-500 bg-lime-500/10 ring-4 ring-lime-500/15"
            : "border-border/80 bg-muted/25 hover:border-border"
        )}
      >
        <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-lime-500/15 text-lime-500">
          <IconUpload className="size-5" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {t("sharedByYou.dropTitle")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isAuthenticated
            ? t("sharedByYou.dropSubtitleAuth")
            : t("sharedByYou.dropSubtitleGuest")}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="bg-lime-500 text-zinc-950 hover:bg-lime-400"
          >
            <IconPlus data-icon="inline-start" className="size-4" />
            <span>{t("sharedByYou.addFiles")}</span>
          </Button>

          {isAuthenticated ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
            >
              <IconFolderPlus data-icon="inline-start" className="size-4" />
              <span>{t("sharedByYou.addFolder")}</span>
            </Button>
          ) : (
            <Link
              href="/carina/auth/login"
              className="inline-flex h-7 items-center gap-1.5 rounded-2xl border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-500/50 hover:text-foreground"
            >
              <IconLock className="size-3.5" />
              <span>{t("sharedByYou.folderAccountLocked")}</span>
            </Link>
          )}

          <Button
            type="button"
            size="sm"
            variant={showTextComposer ? "secondary" : "outline"}
            onClick={() => setShowTextComposer((v) => !v)}
          >
            <IconClipboardText data-icon="inline-start" className="size-4" />
            <span>{t("sharedByYou.addText")}</span>
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : []
            if (list.length > 0) addFilesToShelf(list)
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
              const grouped = groupDirectoryInputFiles(e.target.files)
              addFoldersToShelf(grouped)
            }
            e.target.value = ""
          }}
        />
      </div>

      {/* Text / URL composer */}
      {showTextComposer && (
        <form
          onSubmit={handleSubmitText}
          className="mt-3 flex flex-col gap-2 rounded-2xl border border-border/80 bg-background/70 p-3"
        >
          <Input
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            placeholder={t("sharedByYou.textTitlePlaceholder")}
            className="h-8 text-xs"
          />
          <Textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder={t("sharedByYou.textBodyPlaceholder")}
            rows={3}
            className="resize-none text-xs"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setShowTextComposer(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              size="xs"
              disabled={!textBody.trim()}
              className="bg-lime-500 text-zinc-950 hover:bg-lime-400"
            >
              {t("sharedByYou.publishText")}
            </Button>
          </div>
        </form>
      )}

      {/* Shared items list */}
      {sharedByYou.length > 0 && (
        <ScrollArea className="mt-3 flex-1 pe-1">
          <ul className="flex flex-col gap-2">
            {sharedByYou.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-2.5 text-start transition-colors hover:border-border"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    {item.kind === "file" ? (
                      <IconFile className="size-4" />
                    ) : item.kind === "folder" ? (
                      <IconFolderPlus className="size-4 text-lime-500" />
                    ) : item.isUrl ? (
                      <IconLink className="size-4 text-lime-500" />
                    ) : (
                      <IconClipboardText className="size-4 text-lime-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {item.kind === "file" && (
                      <>
                        <p className="truncate text-xs font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatBytes(item.size)}
                        </p>
                      </>
                    )}

                    {item.kind === "folder" && (
                      <>
                        <p className="truncate text-xs font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t("common.folderSummary", {
                            count: item.fileCount,
                            size: formatBytes(item.totalSize),
                          })}
                        </p>
                      </>
                    )}

                    {item.kind === "text" && (
                      <>
                        <p className="truncate text-xs font-medium text-foreground">
                          {item.title ||
                            (item.isUrl
                              ? t("sharedByYou.sharedLink")
                              : t("sharedByYou.sharedSnippet"))}
                        </p>
                        <p className="line-clamp-2 break-all text-[11px] text-muted-foreground">
                          {item.content}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => removeLocalItem(item.id)}
                  aria-label={t("sharedByYou.removeItem")}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <IconTrash className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </section>
  )
}
