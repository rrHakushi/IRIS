"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Spinner } from "@workspace/ui/components/spinner"
import { IconCloudDownload } from "@tabler/icons-react"
import { useTranslations } from "next-intl"

export interface ImportMediaTypeOption {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface ImportMediaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerKey: string
  providerName: string
  providerIconUrl?: string
  availableMediaTypes: ImportMediaTypeOption[]
  onStartImport: (selectedTypes: string[]) => Promise<void>
}

export function ImportMediaDialog({
  open,
  onOpenChange,
  providerName,
  providerIconUrl,
  availableMediaTypes,
  onStartImport,
}: ImportMediaDialogProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.lists.import")
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize selected types whenever modal opens or available types change
  useEffect(() => {
    if (open) {
      setSelectedTypes(availableMediaTypes.map((m) => m.id))
      setIsSubmitting(false)
    }
  }, [open, availableMediaTypes])

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleStart = async () => {
    if (selectedTypes.length === 0 || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onStartImport(selectedTypes)
      onOpenChange(false)
    } catch {
      // Error handled by parent toast
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      aria-label={t("selectTypesTitle")}
    >
      <div className="flex flex-col gap-5">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {providerIconUrl && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/40 p-2">
                <img
                  src={providerIconUrl}
                  alt={providerName}
                  className="h-6 w-6 object-contain"
                  loading="lazy"
                />
              </div>
            )}
            <div>
              <DialogTitle>{t("selectTypesTitle")}</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                {t("selectTypesDesc", { provider: providerName })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 py-1">
          {availableMediaTypes.map((option) => {
            const Icon = option.icon
            const isChecked = selectedTypes.includes(option.id)

            return (
              <div
                key={option.id}
                onClick={() => toggleType(option.id)}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
                  isChecked
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-border/60 bg-card hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isChecked
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
                <Checkbox
                  isSelected={isChecked}
                  onChange={() => toggleType(option.id)}
                  aria-label={option.label}
                />
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleStart}
            disabled={selectedTypes.length === 0 || isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Spinner className="h-3.5 w-3.5" />
                <span>{t("importing")}</span>
              </>
            ) : (
              <>
                <IconCloudDownload className="h-4 w-4" />
                <span>{t("startImportBtn")}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
