"use client"

import React, { useState, useEffect, useMemo } from "react"
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
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Badge } from "@workspace/ui/components/badge"
import { IconSearch, IconFolder, IconCheck } from "@tabler/icons-react"
import type { CustomDockGroup } from "@IRIS/shared"
import type { SidebarItem, SidebarItemChild } from "@/types/sidebar-config"
import type { AppSidebarRegistryEntry } from "@/config/sidebars"
import {
  DOCK_GROUP_ICON_OPTIONS,
  renderDockGroupIcon,
} from "@/config/dock-group-icons"

export interface DockCustomGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialGroup?: CustomDockGroup | null
  onSaveGroup: (group: CustomDockGroup) => void
  allAppConfigs: AppSidebarRegistryEntry[]
}

interface SelectableShortcut {
  key: string
  label: string
  icon?: React.ReactNode
  appName: string
  sectionName?: string
}

export function DockCustomGroupDialog({
  open,
  onOpenChange,
  initialGroup,
  onSaveGroup,
  allAppConfigs,
}: DockCustomGroupDialogProps): React.JSX.Element {
  const t = useTranslations("navigation.dockSettings")

  const [label, setLabel] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("folder")
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Reset or populate state whenever dialog opens or initialGroup changes
  useEffect(() => {
    if (open) {
      if (initialGroup) {
        setLabel(initialGroup.label)
        setSelectedIcon(initialGroup.icon || "folder")
        setSelectedKeys([...initialGroup.itemKeys])
      } else {
        setLabel("")
        setSelectedIcon("folder")
        setSelectedKeys([])
      }
      setSearchQuery("")
    }
  }, [open, initialGroup])

  // Extract all distinct shortcuts across all registered apps
  const availableShortcuts = useMemo((): SelectableShortcut[] => {
    const list: SelectableShortcut[] = []
    const seen = new Set<string>()

    allAppConfigs.forEach((app) => {
      app.config.forEach((section) => {
        const secLower = section.section?.toLowerCase() || ""
        if (secLower.startsWith("#$")) return // Skip phone dock container sections

        section.items.forEach((item: SidebarItem) => {
          if ((item.position ?? 0) < 0) return // Skip negative footer widgets

          const mainKey =
            item.href ||
            item.dataKey ||
            (item.component ? `label:${item.label}` : undefined)

          if (mainKey && !seen.has(mainKey)) {
            seen.add(mainKey)
            list.push({
              key: mainKey,
              label: item.label,
              icon: item.icon,
              appName: app.appName,
              sectionName: section.section,
            })
          }

          if (item.children) {
            item.children.forEach((child: SidebarItemChild) => {
              const childKey =
                child.href ||
                (child as any).dataKey ||
                (child.component ? `label:${child.label}` : undefined)

              if (childKey && !seen.has(childKey)) {
                seen.add(childKey)
                list.push({
                  key: childKey,
                  label: child.label,
                  icon: child.icon || item.icon,
                  appName: app.appName,
                  sectionName: item.label || section.section,
                })
              }
            })
          }
        })
      })
    })

    return list
  }, [allAppConfigs])

  // Filtered shortcuts based on user search query
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return availableShortcuts
    const q = searchQuery.toLowerCase().trim()
    return availableShortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.appName.toLowerCase().includes(q) ||
        (s.sectionName && s.sectionName.toLowerCase().includes(q))
    )
  }, [availableShortcuts, searchQuery])

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleSave = () => {
    if (!label.trim() || selectedKeys.length === 0) return

    const group: CustomDockGroup = {
      id:
        initialGroup?.id ||
        `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim(),
      icon: selectedIcon,
      itemKeys: selectedKeys,
    }

    onSaveGroup(group)
    onOpenChange(false)
  }

  const isSaveDisabled = !label.trim() || selectedKeys.length === 0

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-h-[90vh] sm:max-w-lg"
    >
      <DialogHeader>
        <DialogTitle>
          {initialGroup ? t("editGroup") : t("createGroup")}
        </DialogTitle>
      </DialogHeader>

      <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto pr-1">
        {/* Group Name & Icon Picker Section */}
        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("groupName")}
            </label>
            <Input
              value={label}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLabel(e.target.value)
              }
              placeholder={t("groupNamePlaceholder")}
              maxLength={24}
              className="bg-background text-sm"
              autoFocus
            />
          </div>

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

        {/* Shortcut Selection Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <label className="text-xs font-semibold text-foreground">
              {t("selectShortcuts")}
            </label>
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-medium",
                selectedKeys.length > 0
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              {t("itemsCount", { count: selectedKeys.length })}
            </Badge>
          </div>

          {/* Search shortcuts input */}
          <div className="relative">
            <IconSearch className="text-muted-foreground absolute start-3 top-1/2 size-3.5 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              placeholder={t("searchShortcutsPlaceholder")}
              className="ps-8 bg-muted/40 text-xs"
            />
          </div>

          {/* List of selectable shortcuts across apps */}
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-border/60 bg-card/40 p-2">
            {filteredShortcuts.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {t("noShortcutsFound")}
              </div>
            ) : (
              filteredShortcuts.map((shortcut) => {
                const isSelected = selectedKeys.includes(shortcut.key)
                return (
                  <div
                    key={shortcut.key}
                    onClick={() => toggleKey(shortcut.key)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors select-none",
                      isSelected
                        ? "bg-primary/15 font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <Checkbox
                        isSelected={isSelected}
                        onChange={() => toggleKey(shortcut.key)}
                      />
                      {shortcut.icon && (
                        <span className="shrink-0 text-foreground/80 [&>svg]:size-4">
                          {shortcut.icon}
                        </span>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {shortcut.label}
                        </span>
                        {shortcut.sectionName && (
                          <span className="truncate text-[10px] text-muted-foreground">
                            {shortcut.appName} • {shortcut.sectionName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          onPress={() => onOpenChange(false)}
          className="cursor-pointer rounded-xl text-xs"
        >
          {t("cancel")}
        </Button>
        <Button
          variant="default"
          size="sm"
          isDisabled={isSaveDisabled}
          onPress={handleSave}
          className="cursor-pointer gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-xs"
        >
          <IconCheck data-icon="inline-start" className="size-3.5" />
          <span>{initialGroup ? t("saveGroup") : t("createGroup")}</span>
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
