"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconCheck,
  IconDeviceMobile,
  IconLayoutNavbar,
  IconLayoutBottombar,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconPlus,
} from "@tabler/icons-react"
import type {
  DockPositions,
  SidebarItem,
  SidebarPosition,
} from "@/types/sidebar-config"
import { useIrisSidebar } from "./sidebar-provider"
import { IrisBottomDock } from "./iris-bottom-dock"

export interface IrisDockSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DOCK_STORAGE_KEY = "iris-phone-dock-items-default"

export function IrisDockSettingsModal({
  open,
  onOpenChange,
}: IrisDockSettingsModalProps): React.JSX.Element {
  const t = useTranslations("navigation.dockSettings")
  const { sidebarConfig, position, setPosition } = useIrisSidebar()

  const [selectedPosition, setSelectedPosition] =
    useState<SidebarPosition>(position)
  const [focusedSlot, setFocusedSlot] = useState<string | null>("1")
  const [tempPositions, setTempPositions] = useState<DockPositions>({
    "1": null,
    "2": null,
    "3": null,
    "4": null,
  })

  // Sync position state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedPosition(position)
    }
  }, [open, position])

  // Load existing dock shortcut slots from storage or defaults
  useEffect(() => {
    if (!open) return

    try {
      const stored = localStorage.getItem(DOCK_STORAGE_KEY)
      if (stored) {
        setTempPositions(JSON.parse(stored))
      } else {
        const phoneSection = sidebarConfig.find(
          (s) =>
            s.section?.toLowerCase().replace(/[^a-z]/g, "") === "phone" ||
            s.dataKey?.toLowerCase() === "phone"
        )
        const defaults: DockPositions = {
          "1": null,
          "2": null,
          "3": null,
          "4": null,
        }
        if (phoneSection) {
          phoneSection.items.forEach((item) => {
            if (item.position && [1, 2, 3, 4].includes(item.position)) {
              defaults[item.position.toString()] =
                item.href || item.dataKey || item.label
            }
          })
        }
        setTempPositions(defaults)
      }
    } catch {
      // ignore
    }
  }, [open, sidebarConfig])

  // Lookup helper for item metadata in preview
  const findItemByKey = useCallback(
    (key: string | null | undefined): SidebarItem | undefined => {
      if (!key) return undefined
      for (const section of sidebarConfig) {
        for (const item of section.items) {
          const itemKey = item.href || item.dataKey || item.label
          if (itemKey === key) return item
          if (item.children) {
            for (const child of item.children) {
              const childKey = child.href || child.dataKey || child.label
              if (childKey === key) return child
            }
          }
        }
      }
      return undefined
    },
    [sidebarConfig]
  )

  // Group available items from regular sections for selection grid
  const availableItems = useMemo(() => {
    const list: SidebarItem[] = []
    sidebarConfig.forEach((sec) => {
      const secName = sec.section?.toLowerCase().replace(/[^a-z]/g, "") || ""
      if (secName === "phone") return

      sec.items.forEach((item) => {
        if (item.href) {
          list.push(item)
        }
        if (item.children) {
          item.children.forEach((child) => {
            if (child.href) {
              list.push(child)
            }
          })
        }
      })
    })
    return list
  }, [sidebarConfig])

  const handleSelectItem = (itemKey: string) => {
    if (!focusedSlot) return
    const newPositions = { ...tempPositions }

    // Remove item from any other slot
    Object.keys(newPositions).forEach((slot) => {
      if (newPositions[slot] === itemKey) {
        newPositions[slot] = null
      }
    })

    // Assign to current slot
    newPositions[focusedSlot] = itemKey
    setTempPositions(newPositions)

    // Auto-advance slot 1 -> 2 -> 3 -> 4
    const slots = ["1", "2", "3", "4"]
    const currIdx = slots.indexOf(focusedSlot)
    const nextIdx = (currIdx + 1) % slots.length
    setFocusedSlot(slots[nextIdx] ?? "1")
  }

  const handleClearSlot = (pos: string) => {
    setTempPositions((prev) => ({ ...prev, [pos]: null }))
    setFocusedSlot(pos)
  }

  const handleSave = () => {
    setPosition(selectedPosition)
    try {
      localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(tempPositions))
      window.dispatchEvent(new Event("iris-sidebar-changed"))
    } catch {
      // ignore
    }
    onOpenChange(false)
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-h-[90vh] sm:max-w-xl"
    >
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pe-1">
        {/* Section 1: Sidebar Position Settings */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("sidebarOrientation")}
          </h4>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {/* Left */}
            <button
              type="button"
              onClick={() => setSelectedPosition("left")}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all",
                selectedPosition === "left"
                  ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                  : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <IconLayoutSidebar className="size-5" />
              <span>{t("leftDefault")}</span>
            </button>

            {/* Right / Mirrored */}
            <button
              type="button"
              onClick={() => setSelectedPosition("right")}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all",
                selectedPosition === "right"
                  ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                  : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <IconLayoutSidebarRight className="size-5" />
              <span>{t("rightMirrored")}</span>
            </button>

            {/* Top (Architectural placeholder) */}
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-3 text-xs font-medium opacity-50"
            >
              <IconLayoutNavbar className="size-5 text-muted-foreground" />
              <span className="flex items-center gap-1">
                {t("top")}
                <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px]">
                  {t("soon")}
                </Badge>
              </span>
            </button>

            {/* Bottom (Architectural placeholder) */}
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-3 text-xs font-medium opacity-50"
            >
              <IconLayoutBottombar className="size-5 text-muted-foreground" />
              <span className="flex items-center gap-1">
                {t("bottom")}
                <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px]">
                  {t("soon")}
                </Badge>
              </span>
            </button>
          </div>
        </div>

        {/* Section 2: Mobile Bottom Dock Customizer */}
        <div className="space-y-4 border-t border-border/60 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              <IconDeviceMobile className="size-4 text-primary" />
              <span>{t("mobileBottomDock")}</span>
            </h4>
            <span className="text-[11px] text-muted-foreground">
              {t("slotSelected", { slot: focusedSlot || "—" })}
            </span>
          </div>

          {/* Interactive Dock Mockup Preview */}
          <div className="flex justify-center rounded-2xl border border-border/60 bg-muted/40 p-3">
            <IrisBottomDock
              pathname="/"
              isPreview={true}
              tempPositions={tempPositions}
              focusedSlot={focusedSlot}
              onFocusSlot={setFocusedSlot}
              onClearSlot={handleClearSlot}
              findItemByKey={findItemByKey}
              emptySlotLabel={t("empty")}
            />
          </div>

          {/* Shortcut Picker Grid */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("clickItemToAssign", { slot: focusedSlot || "1" })}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {availableItems.map((item) => {
                const itemKey = item.href || item.dataKey || item.label
                const assignedSlot = Object.keys(tempPositions).find(
                  (slot) => tempPositions[slot] === itemKey
                )

                return (
                  <button
                    key={itemKey}
                    type="button"
                    onClick={() => handleSelectItem(itemKey)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-2.5 text-start text-xs font-medium transition-all",
                      assignedSlot
                        ? "border-primary/50 bg-primary/5 text-primary"
                        : "border-border/80 hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {assignedSlot ? (
                      <Badge
                        variant="secondary"
                        className="h-4 shrink-0 bg-primary px-1.5 text-[10px] font-bold text-primary-foreground"
                      >
                        {t("slotBadge", { slot: assignedSlot })}
                      </Badge>
                    ) : (
                      <IconPlus className="size-3.5 shrink-0 text-muted-foreground opacity-60" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
        <Button variant="outline" size="sm" onPress={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
        <Button size="sm" onPress={handleSave}>
          <IconCheck className="size-4" />
          {t("saveChanges")}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
