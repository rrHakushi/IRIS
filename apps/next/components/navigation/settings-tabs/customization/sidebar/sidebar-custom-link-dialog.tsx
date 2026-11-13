"use client"

import React, { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { IconCheck, IconLink, IconPin } from "@tabler/icons-react"
import type { CustomSidebarItem } from "@/types/sidebar-config"
import {
  DOCK_GROUP_ICON_OPTIONS,
  renderDockGroupIcon,
} from "@/config/dock-group-icons"

export interface SidebarCustomLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLink?: CustomSidebarItem | null
  onSaveLink: (link: CustomSidebarItem, targetSectionKey?: string) => void
  existingSections: Array<{ key: string; label: string }>
}

export function SidebarCustomLinkDialog({
  open,
  onOpenChange,
  initialLink,
  onSaveLink,
  existingSections,
}: SidebarCustomLinkDialogProps): React.JSX.Element {
  const t = useTranslations("navigation.sidebarSettings")

  const [label, setLabel] = useState("")
  const [href, setHref] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("pin")
  const [targetSectionKey, setTargetSectionKey] = useState("")

  useEffect(() => {
    if (open) {
      if (initialLink) {
        setLabel(initialLink.label)
        setHref(initialLink.href)
        setSelectedIcon(initialLink.icon || "pin")
      } else {
        setLabel("")
        setHref("")
        setSelectedIcon("pin")
      }
      setTargetSectionKey(existingSections[0]?.key || "")
    }
  }, [open, initialLink, existingSections])

  const handleSave = () => {
    if (!label.trim() || !href.trim()) return

    const link: CustomSidebarItem = {
      id:
        initialLink?.id ||
        `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim(),
      href: href.trim(),
      icon: selectedIcon,
      isExternal: href.startsWith("http://") || href.startsWith("https://"),
    }

    onSaveLink(link, targetSectionKey)
    onOpenChange(false)
  }

  const isSaveDisabled = !label.trim() || !href.trim()

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-h-[90vh] sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <IconLink className="size-5 text-primary" />
          <span>{initialLink ? t("editCustomLink") : t("addCustomLink")}</span>
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {t("linkLabel")}
          </label>
          <Input
            value={label}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLabel(e.target.value)
            }
            placeholder={t("linkLabelPlaceholder")}
            maxLength={32}
            className="bg-background text-sm"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {t("linkUrl")}
          </label>
          <Input
            value={href}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setHref(e.target.value)
            }
            placeholder={t("linkUrlPlaceholder")}
            className="bg-background text-sm"
          />
        </div>

        {existingSections.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("targetSection")}
            </label>
            <select
              value={targetSectionKey}
              onChange={(e) => setTargetSectionKey(e.target.value)}
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-hidden focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {existingSections.map((sec) => (
                <option key={sec.key} value={sec.key}>
                  {sec.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {t("groupIcon")}
          </label>
          <div className="flex flex-wrap items-center gap-1.5 py-1">
            {DOCK_GROUP_ICON_OPTIONS.map((opt) => {
              const IconComp = opt.icon
              const isSelected = selectedIcon === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedIcon(opt.id)}
                  className={cn(
                    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-all duration-150 select-none",
                    isSelected
                      ? "border-primary bg-primary/20 text-primary shadow-xs"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                  title={opt.label}
                  aria-label={opt.label}
                >
                  <IconComp className="size-4.5" />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onPress={() => onOpenChange(false)}
          className="rounded-xl"
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onPress={handleSave}
          isDisabled={isSaveDisabled}
          className="gap-1.5 rounded-xl font-bold"
        >
          <IconCheck className="size-3.5" />
          <span>{initialLink ? t("updateLink") : t("saveLink")}</span>
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
