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
import {
  IconSearch,
  IconFolder,
  IconLayoutList,
  IconCheck,
  IconPlus,
  IconTrash,
  IconLink,
  IconFolders,
} from "@tabler/icons-react"
import type {
  CustomSidebarGroup,
  CustomSidebarItem,
  SidebarItem,
  SidebarItemChild,
} from "@/types/sidebar-config"
import type { AppSidebarRegistryEntry } from "@/config/sidebars"
import {
  DOCK_GROUP_ICON_OPTIONS,
  renderDockGroupIcon,
} from "@/config/dock-group-icons"

export interface SidebarCustomGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialGroup?: CustomSidebarGroup | null
  onSaveGroup: (group: CustomSidebarGroup) => void
  allAppConfigs: AppSidebarRegistryEntry[]
  existingSections: Array<{ key: string; label: string }>
}

interface SelectableShortcut {
  key: string
  label: string
  icon?: React.ReactNode
  appName: string
  sectionName?: string
}

export function SidebarCustomGroupDialog({
  open,
  onOpenChange,
  initialGroup,
  onSaveGroup,
  allAppConfigs,
  existingSections,
}: SidebarCustomGroupDialogProps): React.JSX.Element {
  const t = useTranslations("navigation.sidebarSettings")
  const tDock = useTranslations("navigation.dockSettings")

  const [label, setLabel] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("folder")
  const [groupType, setGroupType] = useState<"section" | "folder">("section")
  const [targetSectionKey, setTargetSectionKey] = useState<string>("")
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [customLinks, setCustomLinks] = useState<CustomSidebarItem[]>([])

  // Custom link sub-form state
  const [newLinkLabel, setNewLinkLabel] = useState("")
  const [newLinkUrl, setNewLinkUrl] = useState("")
  const [showAddLinkForm, setShowAddLinkForm] = useState(false)

  useEffect(() => {
    if (open) {
      if (initialGroup) {
        setLabel(initialGroup.label)
        setSelectedIcon(initialGroup.icon || "folder")
        setGroupType(initialGroup.type || "section")
        setTargetSectionKey(
          initialGroup.targetSectionKey || existingSections[0]?.key || ""
        )
        setSelectedKeys([...(initialGroup.itemKeys || [])])
        setCustomLinks(initialGroup.customLinks ? [...initialGroup.customLinks] : [])
      } else {
        setLabel("")
        setSelectedIcon("folder")
        setGroupType("section")
        setTargetSectionKey(existingSections[0]?.key || "")
        setSelectedKeys([])
        setCustomLinks([])
      }
      setSearchQuery("")
      setShowAddLinkForm(false)
      setNewLinkLabel("")
      setNewLinkUrl("")
    }
  }, [open, initialGroup, existingSections])

  // Extract all distinct shortcuts across all registered apps
  const availableShortcuts = useMemo((): SelectableShortcut[] => {
    const list: SelectableShortcut[] = []
    const seen = new Set<string>()

    allAppConfigs.forEach((app) => {
      app.config.forEach((section) => {
        const secLower = section.section?.toLowerCase() || ""
        if (secLower.startsWith("#$")) return

        section.items.forEach((item: SidebarItem) => {
          if ((item.position ?? 0) < 0) return

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

  const handleAddCustomLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return
    const newLink: CustomSidebarItem = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: newLinkLabel.trim(),
      href: newLinkUrl.trim(),
      icon: "pin",
      isExternal:
        newLinkUrl.startsWith("http://") || newLinkUrl.startsWith("https://"),
    }
    setCustomLinks((prev) => [...prev, newLink])
    setNewLinkLabel("")
    setNewLinkUrl("")
    setShowAddLinkForm(false)
  }

  const handleRemoveCustomLink = (id: string) => {
    setCustomLinks((prev) => prev.filter((l) => l.id !== id))
  }

  const handleSave = () => {
    if (!label.trim()) return
    if (groupType === "folder" && selectedKeys.length === 0 && customLinks.length === 0) return

    const group: CustomSidebarGroup = {
      id:
        initialGroup?.id ||
        `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim(),
      icon: selectedIcon,
      type: groupType,
      targetSectionKey: groupType === "folder" ? targetSectionKey : undefined,
      itemKeys: selectedKeys,
      customLinks: customLinks.length > 0 ? customLinks : undefined,
    }

    onSaveGroup(group)
    onOpenChange(false)
  }

  const isSaveDisabled =
    !label.trim() || (groupType === "folder" && selectedKeys.length === 0 && customLinks.length === 0)

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-h-[90vh] sm:max-w-xl"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {initialGroup ? (
            <span>{t("editCustomGroup")}</span>
          ) : (
            <span>{t("createCustomGroup")}</span>
          )}
        </DialogTitle>
      </DialogHeader>

      <div className="flex max-h-[66vh] flex-col gap-4 overflow-y-auto pr-1">
        {/* 1. Group Name & Presentation Type */}
        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
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
              maxLength={32}
              className="bg-background text-sm"
              autoFocus
            />
          </div>

          {/* Presentation Type: Section vs Folder */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("groupType")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGroupType("section")}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-2.5 text-start transition-all",
                  groupType === "section"
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                    : "border-border/60 bg-background hover:bg-muted/60"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <IconLayoutList className="size-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    {t("typeSection")}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {t("typeSectionDesc")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setGroupType("folder")}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-2.5 text-start transition-all",
                  groupType === "folder"
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                    : "border-border/60 bg-background hover:bg-muted/60"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <IconFolders className="size-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    {t("typeFolder")}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {t("typeFolderDesc")}
                </span>
              </button>
            </div>
          </div>

          {/* If Folder: Target Section Picker */}
          {groupType === "folder" && existingSections.length > 0 && (
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

          {/* Icon Selector */}
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

        {/* 2. Custom Direct URL Links Inside Group */}
        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {t("customLinksInGroup")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onPress={() => setShowAddLinkForm(!showAddLinkForm)}
              className="gap-1 rounded-xl text-[11px]"
            >
              <IconPlus className="size-3" />
              <span>{t("addLink")}</span>
            </Button>
          </div>

          {showAddLinkForm && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background p-2.5">
              <Input
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder={t("linkLabelPlaceholder")}
                className="h-8 text-xs"
              />
              <Input
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder={t("linkUrlPlaceholder")}
                className="h-8 text-xs"
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onPress={() => setShowAddLinkForm(false)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  onPress={handleAddCustomLink}
                  isDisabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
                >
                  {t("add")}
                </Button>
              </div>
            </div>
          )}

          {customLinks.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              {customLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-background px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <IconLink className="size-3.5 text-primary shrink-0" />
                    <span className="font-semibold truncate">{link.label}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      ({link.href})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomLink(link.id)}
                    className="cursor-pointer text-muted-foreground hover:text-destructive"
                  >
                    <IconTrash className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Search and Select App Shortcuts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {t("selectShortcuts")}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {selectedKeys.length} {t("itemsSelected")}
            </Badge>
          </div>

          <div className="relative">
            <IconSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              placeholder={t("searchShortcutsPlaceholder")}
              className="bg-background ps-9 text-xs"
            />
          </div>

          <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-2xl border border-border/60 bg-card/30 p-2">
            {filteredShortcuts.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {t("noShortcutsFound")}
              </div>
            ) : (
              filteredShortcuts.map((s) => {
                const isChecked = selectedKeys.includes(s.key)
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleKey(s.key)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-start transition-all duration-150 select-none",
                      isChecked
                        ? "border-primary/50 bg-primary/10 shadow-xs"
                        : "border-transparent bg-background/60 hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                          isChecked
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {s.icon ? (
                          <span className="size-4 shrink-0">{s.icon}</span>
                        ) : (
                          <IconFolder className="size-4" />
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {s.label}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground/80">
                            {s.appName}
                          </span>
                          {s.sectionName && (
                            <>
                              <span>•</span>
                              <span className="truncate">{s.sectionName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        isChecked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-background"
                      )}
                    >
                      {isChecked && <IconCheck className="size-3.5 stroke-[3]" />}
                    </div>
                  </button>
                )
              })
            )}
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
          <span>{initialGroup ? t("updateGroup") : t("saveGroup")}</span>
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
