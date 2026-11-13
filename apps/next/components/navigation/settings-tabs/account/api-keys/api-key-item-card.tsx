"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import {
  IconKey,
  IconCopy,
  IconCheck,
  IconPencil,
  IconRotate2,
  IconTrash,
  IconAlertTriangle,
  IconClock,
  IconActivity,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"
import type { ApiKeyItem } from "./types"

export interface ApiKeyItemCardProps {
  apiKey: ApiKeyItem
  onRename: (id: string, newName: string) => Promise<boolean>
  onRegenerate: (id: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  isRenaming: boolean
  isRegenerating: boolean
  isDeleting: boolean
}

export function ApiKeyItemCard({
  apiKey,
  onRename,
  onRegenerate,
  onDelete,
  isRenaming,
  isRegenerating,
  isDeleting,
}: ApiKeyItemCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.apiKeys")

  // Modal states
  const [renameOpen, setRenameOpen] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Rename form state
  const [editName, setEditName] = useState(apiKey.name)
  const [renameError, setRenameError] = useState<string | null>(null)

  // Copied prefix state
  const [copiedPrefix, setCopiedPrefix] = useState(false)

  // Expiration calculation
  const now = Date.now()
  const isExpired = apiKey.expiresAt
    ? new Date(apiKey.expiresAt).getTime() < now
    : false

  const daysRemaining = apiKey.expiresAt
    ? Math.ceil(
        (new Date(apiKey.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24)
      )
    : null

  // Format dates
  const formattedCreated = new Date(apiKey.createdAt).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  )

  const formattedLastUsed = apiKey.lastUsedAt
    ? new Date(apiKey.lastUsedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : t("neverUsed")

  const formattedExpires = apiKey.expiresAt
    ? new Date(apiKey.expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : t("neverExpires")

  // Handle prefix copy
  const handleCopyPrefix = async () => {
    try {
      await navigator.clipboard.writeText(apiKey.prefix)
      setCopiedPrefix(true)
      toast.success(t("prefixCopied"))
      setTimeout(() => setCopiedPrefix(false), 2000)
    } catch {
      toast.error(t("failedCopyPrefix"))
    }
  }

  // Submit rename
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = editName.trim()
    if (!clean) {
      setRenameError(t("nameEmptyError"))
      return
    }
    setRenameError(null)
    const success = await onRename(apiKey.id, clean)
    if (success) {
      setRenameOpen(false)
    }
  }

  // Confirm regenerate
  const handleConfirmRegenerate = async () => {
    const success = await onRegenerate(apiKey.id)
    if (success) {
      setRegenerateOpen(false)
    }
  }

  // Confirm delete
  const handleConfirmDelete = async () => {
    const success = await onDelete(apiKey.id)
    if (success) {
      setDeleteOpen(false)
    }
  }

  return (
    <>
      <div className="space-y-3.5 rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-2xs transition-all hover:bg-muted/30">
        {/* Header row: Key Icon + Name + Badges + Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-8.5 shrink-0 items-center justify-center rounded-xl border",
                isExpired
                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                  : "border-primary/20 bg-primary/10 text-primary"
              )}
            >
              <IconKey className="size-4" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="truncate text-sm font-semibold text-foreground">
                  {apiKey.name}
                </h4>

                {/* Status Badge */}
                {isExpired ? (
                  <Badge
                    variant="outline"
                    className="h-4.5 border-destructive/30 bg-destructive/10 px-2 text-[10px] font-semibold text-destructive"
                  >
                    {t("expired")}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="h-4.5 border-emerald-500/30 bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-400"
                  >
                    {t("active")}
                  </Badge>
                )}

                {/* Expiration badge */}
                {!isExpired && (
                  <Badge
                    variant="outline"
                    className="h-4.5 border-border/70 px-2 text-[10px] font-normal text-muted-foreground"
                  >
                    {daysRemaining !== null
                      ? daysRemaining <= 1
                        ? t("expiresToday")
                        : t("expiresInDays", { days: daysRemaining })
                      : t("neverExpires")}
                  </Badge>
                )}
              </div>

              {/* Key Prefix Tag with Copy */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleCopyPrefix}
                  title={t("copyPrefixTitle")}
                  className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <span>{apiKey.prefix}••••••••</span>
                  {copiedPrefix ? (
                    <IconCheck className="size-3 text-emerald-400" />
                  ) : (
                    <IconCopy className="size-3 opacity-60 group-hover:opacity-100" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("renameAria")}
              onClick={() => {
                setEditName(apiKey.name)
                setRenameError(null)
                setRenameOpen(true)
              }}
              className="size-7.5 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <IconPencil className="size-3.5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("regenerateAria")}
              onClick={() => setRegenerateOpen(true)}
              className="size-7.5 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
            >
              <IconRotate2 className="size-3.5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("revokeAria")}
              onClick={() => setDeleteOpen(true)}
              className="size-7.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <IconTrash className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Footer Meta: Created, Last used, Expiration */}
        <div className="grid grid-cols-1 gap-2 border-t border-border/40 pt-1 text-[11px] text-muted-foreground sm:grid-cols-3">
          <div className="flex items-center gap-1.5">
            <IconClock className="size-3 shrink-0 text-muted-foreground/70" />
            <span>{t("created", { date: formattedCreated })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <IconActivity className="size-3 shrink-0 text-muted-foreground/70" />
            <span>{t("lastUsed", { date: formattedLastUsed })}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:justify-end">
            <span>{t("expires", { date: formattedExpires })}</span>
          </div>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog
        isOpen={renameOpen}
        onOpenChange={(open) => {
          if (!isRenaming) setRenameOpen(open)
        }}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <IconPencil className="size-4.5" />
            <DialogTitle>{t("renameTitle")}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleRenameSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label
              htmlFor={`rename-${apiKey.id}`}
              className="text-xs font-semibold text-foreground"
            >
              {t("keyName")}
            </label>
            <Input
              id={`rename-${apiKey.id}`}
              type="text"
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value)
                if (renameError) setRenameError(null)
              }}
              maxLength={64}
              disabled={isRenaming}
              className="w-full rounded-xl text-xs"
              autoFocus
            />
            {renameError && (
              <p className="mt-1 text-xs text-destructive">{renameError}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRenameOpen(false)}
              disabled={isRenaming}
              className="rounded-xl"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={
                isRenaming ||
                !editName.trim() ||
                editName.trim() === apiKey.name
              }
              className="min-w-[100px] gap-1.5 rounded-xl"
            >
              {isRenaming ? (
                <>
                  <Spinner className="size-3.5" />
                  <span>{t("saving")}</span>
                </>
              ) : (
                <span>{t("save")}</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Regenerate Dialog */}
      <Dialog
        isOpen={regenerateOpen}
        onOpenChange={(open) => {
          if (!isRegenerating) setRegenerateOpen(open)
        }}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-400">
            <IconAlertTriangle className="size-5" />
            <DialogTitle>{t("regenerateTitle")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("regenerateConfirm", { name: apiKey.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <p className="font-semibold text-amber-200">{t("warning")}</p>
          <p className="leading-relaxed text-amber-300/90">
            {t("regenerateWarningDesc")}
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRegenerateOpen(false)}
            disabled={isRegenerating}
            className="rounded-xl"
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConfirmRegenerate}
            disabled={isRegenerating}
            className="min-w-[120px] gap-1.5 rounded-xl bg-amber-600 text-white hover:bg-amber-700"
          >
            {isRegenerating ? (
              <>
                <Spinner className="size-3.5" />
                <span>{t("regenerating")}</span>
              </>
            ) : (
              <>
                <IconRotate2 className="size-4" />
                <span>{t("regenerateKey")}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Delete / Revoke Dialog */}
      <Dialog
        isOpen={deleteOpen}
        onOpenChange={(open) => {
          if (!isDeleting) setDeleteOpen(open)
        }}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <IconTrash className="size-5" />
            <DialogTitle>{t("revokeTitle")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("revokeConfirm", { name: apiKey.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <p className="font-semibold">{t("revokePermanentDesc")}</p>
          <p className="leading-relaxed text-destructive/90">
            {t("revokeAccessDesc")}
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDeleteOpen(false)}
            disabled={isDeleting}
            className="rounded-xl"
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            className="min-w-[100px] gap-1.5 rounded-xl"
          >
            {isDeleting ? (
              <>
                <Spinner className="size-3.5" />
                <span>{t("revoking")}</span>
              </>
            ) : (
              <span>{t("revokeKey")}</span>
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
