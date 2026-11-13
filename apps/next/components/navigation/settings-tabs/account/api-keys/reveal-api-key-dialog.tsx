"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconKey,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { ApiKeyItem } from "./types"

export interface RevealApiKeyDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  rawKey: string | null
  apiKey: ApiKeyItem | null
  isRegenerated?: boolean
}

export function RevealApiKeyDialog({
  isOpen,
  onOpenChange,
  rawKey,
  apiKey,
  isRegenerated = false,
}: RevealApiKeyDialogProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.apiKeys")
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!rawKey) return
    try {
      await navigator.clipboard.writeText(rawKey)
      setCopied(true)
      toast.success(t("copiedSuccess"))
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error(t("failedCopy"))
    }
  }

  const formattedExpiration = apiKey?.expiresAt
    ? new Date(apiKey.expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : t("never")

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} className="sm:max-w-lg">
      <DialogHeader>
        <div className="flex items-center gap-2.5 text-primary">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <IconKey className="size-4.5" />
          </div>
          <DialogTitle>
            {isRegenerated ? t("regeneratedTitle") : t("createdTitle")}
          </DialogTitle>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-1">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-300">
          <IconAlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-amber-200">
              {t("saveImmediately")}
            </p>
            <p className="leading-relaxed text-amber-300/90">
              {t("saveWarningDesc")}
            </p>
          </div>
        </div>

        {/* API Key Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-0.5 text-xs text-muted-foreground">
            <span className="font-medium">
              {t("keyLabel", { name: apiKey?.name ?? "" })}
            </span>
            <Badge variant="outline" className="h-5 px-2 text-[10px]">
              {t("expiresLabel", { date: formattedExpiration })}
            </Badge>
          </div>
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              value={rawKey || ""}
              className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 pr-20 font-mono text-xs tracking-tight text-foreground select-all focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <Button
              type="button"
              variant={copied ? "default" : "secondary"}
              size="sm"
              onClick={handleCopy}
              className="absolute right-1.5 h-7 gap-1.5 rounded-lg px-2.5 text-xs"
            >
              {copied ? (
                <>
                  <IconCheck className="size-3.5 text-emerald-400" />
                  <span>{t("copied")}</span>
                </>
              ) : (
                <>
                  <IconCopy className="size-3.5" />
                  <span>{t("copy")}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="default"
          onClick={() => onOpenChange(false)}
          className="w-full rounded-xl sm:w-auto"
        >
          {t("savedConfirmButton")}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
