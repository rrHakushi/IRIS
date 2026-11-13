"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { IconCheck, IconShieldLock, IconX } from "@tabler/icons-react"
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

export function ShelfApprovalDialog() {
  const t = useTranslations("tesseract")
  const { pendingShelfApprovals, respondToShelfApproval } = useTesseract()

  const request = pendingShelfApprovals[0] ?? null

  return (
    <Dialog
      isOpen={Boolean(request)}
      isDismissable={false}
      showCloseButton={false}
      onOpenChange={(open) => {
        if (!open && request) {
          respondToShelfApproval(request.requestId, false)
        }
      }}
    >
      {request && (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconShieldLock className="size-4 text-amber-500" />
              <span>{t("shelfApproval.title")}</span>
            </DialogTitle>
            <DialogDescription>
              {t("shelfApproval.subtitle", {
                peer: request.fromAlias,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {request.itemNames.join(", ")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("common.folderSummary", {
                  count: request.fileCount,
                  size: formatBytes(request.totalBytes),
                })}
              </p>
            </div>
            <Badge variant="outline">{formatBytes(request.totalBytes)}</Badge>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => respondToShelfApproval(request.requestId, false)}
            >
              <IconX data-icon="inline-start" className="size-4" />
              <span>{t("shelfApproval.deny")}</span>
            </Button>
            <Button
              type="button"
              onClick={() => respondToShelfApproval(request.requestId, true)}
              className="bg-lime-500 text-zinc-950 hover:bg-lime-400"
            >
              <IconCheck data-icon="inline-start" className="size-4" />
              <span>{t("shelfApproval.allow")}</span>
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}

