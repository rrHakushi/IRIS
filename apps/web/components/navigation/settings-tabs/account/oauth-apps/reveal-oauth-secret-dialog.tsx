"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import {
  IconKey,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { OAuthAppItem } from "./types"

export interface RevealOAuthSecretDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  rawSecret: string | null
  app: OAuthAppItem | null
  isRegenerated?: boolean
}

export function RevealOAuthSecretDialog({
  isOpen,
  onOpenChange,
  rawSecret,
  app,
  isRegenerated = false,
}: RevealOAuthSecretDialogProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!rawSecret) return
    try {
      await navigator.clipboard.writeText(rawSecret)
      setCopied(true)
      toast.success("Client secret copied to clipboard!")
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error("Failed to copy secret.")
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} className="sm:max-w-lg">
      <DialogHeader>
        <div className="flex items-center gap-2.5 text-primary">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <IconKey className="size-4.5" />
          </div>
          <DialogTitle>
            {isRegenerated ? "Client Secret Regenerated" : "OAuth Application Created"}
          </DialogTitle>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-1">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-300">
          <IconAlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-amber-200">
              Save your Client Secret immediately
            </p>
            <p className="leading-relaxed text-amber-300/90">
              For security reasons, this client secret is never stored in plaintext and will not be displayed again. If you lose it, you will need to regenerate a new one.
            </p>
          </div>
        </div>

        {/* Client ID Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-0.5 text-xs text-muted-foreground">
            <span className="font-medium">Client ID ({app?.name})</span>
          </div>
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              value={app?.clientId ?? ""}
              className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2 pe-10 font-mono text-xs text-foreground select-all focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Secret Box */}
        {rawSecret && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5 text-xs text-muted-foreground">
              <span className="font-medium">Client Secret</span>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={rawSecret}
                className="w-full rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 pe-12 font-mono text-xs text-foreground select-all focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="absolute end-1.5 size-7 text-muted-foreground hover:text-foreground"
                aria-label="Copy client secret"
              >
                {copied ? (
                  <IconCheck className="size-4 text-emerald-500" />
                ) : (
                  <IconCopy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="mt-4 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleCopy}
          className="gap-1.5 text-xs"
        >
          {copied ? (
            <>
              <IconCheck className="size-3.5 text-emerald-500" />
              Copied
            </>
          ) : (
            <>
              <IconCopy className="size-3.5" />
              Copy Secret
            </>
          )}
        </Button>
        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-5"
        >
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
