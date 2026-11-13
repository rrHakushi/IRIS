"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import {
  IconCheck,
  IconClipboardText,
  IconFile,
  IconFolder,
  IconFolderDown,
  IconSend,
  IconX,
} from "@tabler/icons-react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useTesseract } from "@/context/tesseract-context"
import { formatBytes } from "@/lib/tesseract/device-info"
import { supportsDirectoryPicker } from "@/lib/tesseract/download-writer"

export function IncomingTransferDialog() {
  const t = useTranslations("tesseract")
  const { pendingDirectOffers, respondToDirectOffer } = useTesseract()
  const [dirPickerSupported] = useState(() => supportsDirectoryPicker())

  const currentOffer = pendingDirectOffers[0] ?? null
  const hasMultipleOrFolders = Boolean(
    currentOffer &&
      (currentOffer.items.some((i) => i.kind === "folder") ||
        currentOffer.items.filter((i) => i.kind !== "text").length > 1)
  )

  return (
    <Dialog
      isOpen={Boolean(currentOffer)}
      isDismissable={false}
      showCloseButton={false}
      onOpenChange={(open) => {
        if (!open && currentOffer) {
          void respondToDirectOffer(currentOffer.offerId, false)
        }
      }}
    >
      {currentOffer && (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconSend className="size-4 text-lime-500" />
              <span>{t("incomingOffer.title")}</span>
            </DialogTitle>
            <DialogDescription>
              {t("incomingOffer.subtitle", {
                peer: currentOffer.fromAlias,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2">
              {currentOffer.fromUser && (
                <Avatar className="size-6">
                  {currentOffer.fromUser.avatarUrl ? (
                    <AvatarImage
                      src={currentOffer.fromUser.avatarUrl}
                      alt={currentOffer.fromUser.displayName}
                    />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {currentOffer.fromUser.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="text-xs">
                <p className="font-medium text-foreground">
                  {currentOffer.fromAlias}
                </p>
                {currentOffer.fromUser && (
                  <p className="text-[11px] text-muted-foreground">
                    @{currentOffer.fromUser.username}
                  </p>
                )}
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {currentOffer.totalBytes > 0
                ? formatBytes(currentOffer.totalBytes)
                : t("incomingOffer.textOnlyBadge")}
            </Badge>
          </div>

          <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-xl border border-border/60 bg-background/60 p-2">
            {currentOffer.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {item.kind === "folder" ? (
                    <IconFolder className="size-4 shrink-0 text-lime-500" />
                  ) : item.kind === "text" ? (
                    <IconClipboardText className="size-4 shrink-0 text-lime-500" />
                  ) : (
                    <IconFile className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium">{item.name}</span>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {item.kind === "folder"
                    ? t("common.folderSummary", {
                        count: item.fileCount ?? 0,
                        size: formatBytes(item.size),
                      })
                    : formatBytes(item.size)}
                </span>
              </li>
            ))}
          </ul>

          <DialogFooter className="flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void respondToDirectOffer(currentOffer.offerId, false)
              }
            >
              <IconX data-icon="inline-start" className="size-4" />
              <span>{t("incomingOffer.decline")}</span>
            </Button>

            {dirPickerSupported && hasMultipleOrFolders && (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void respondToDirectOffer(
                    currentOffer.offerId,
                    true,
                    "directory"
                  )
                }
              >
                <IconFolderDown data-icon="inline-start" className="size-4" />
                <span>{t("sharedByOthers.saveToFolder")}</span>
              </Button>
            )}

            <Button
              type="button"
              onClick={() =>
                void respondToDirectOffer(currentOffer.offerId, true, "auto")
              }
              className="bg-lime-500 text-zinc-950 hover:bg-lime-400"
            >
              <IconCheck data-icon="inline-start" className="size-4" />
              <span>{t("incomingOffer.accept")}</span>
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}

