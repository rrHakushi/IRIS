"use client"

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
} from "react"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { useUser } from "@/context/user-context"
import type { SettingsTabProps } from "../types"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconCheck,
  IconRotate2,
  IconRefresh,
  IconDeviceMobile,
  IconSparkles,
} from "@tabler/icons-react"
import { toast } from "sonner"
import {
  getDockCustomization,
  DEFAULT_DOCK_POSITIONS,
  type CustomDockGroup,
} from "@IRIS/shared"
import type {
  DockPositions,
  SidebarItem,
} from "@/types/sidebar-config"
import { filterSidebarConfig } from "@/lib/navigation"
import { useListSidebarConfig } from "@/config/sidebars/listSidebarConfig"
import { useAllAppSidebarConfigs } from "@/config/sidebars"
import { renderDockGroupIcon } from "@/config/dock-group-icons"
import { SidebarNavigationContext } from "../../sidebar-provider"
import { IrisBottomDock } from "../../iris-bottom-dock"
import { DockShortcutsGrid } from "./dock/dock-shortcuts-grid"
import { DockCustomGroupDialog } from "./dock/dock-custom-group-dialog"

const DOCK_STORAGE_KEY = "iris-phone-dock-items-default"
const DOCK_GROUPS_STORAGE_KEY = "iris-phone-dock-custom-groups"

export function DockSettingsTab({
  setFooterContent,
}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.dockSettings")
  const { data: session } = useSession()
  const { user, updateDock } = useUser()

  // Multi-app navigation configurations registry
  const allAppConfigs = useAllAppSidebarConfigs(session)

  // Current active sidebar navigation configuration resolution
  const sidebarContext = useContext(SidebarNavigationContext)
  const listConfig = useListSidebarConfig(session)
  const baseConfig =
    sidebarContext?.sidebarConfig && sidebarContext.sidebarConfig.length > 0
      ? sidebarContext.sidebarConfig
      : listConfig

  const userPermissions = user?.permissions
  const currentConfig = useMemo(
    () => filterSidebarConfig(baseConfig, userPermissions),
    [baseConfig, userPermissions]
  )

  // Default mobile dock positions from #$Phone section
  const defaultPositions: DockPositions = useMemo(() => {
    const defs: DockPositions = { ...DEFAULT_DOCK_POSITIONS }
    const phoneSection = currentConfig.find((s) => {
      const sec = s.section?.toLowerCase() || ""
      const dk = s.dataKey?.toLowerCase() || ""
      return (
        sec.startsWith("#$") ||
        sec === "phone" ||
        sec === "#$phone" ||
        dk.startsWith("#$") ||
        dk === "phone" ||
        dk === "mobile-dock"
      )
    })

    if (phoneSection) {
      phoneSection.items.forEach((item) => {
        if (item.position && [1, 2, 3, 4].includes(item.position)) {
          const itemKey =
            item.href ||
            item.dataKey ||
            (item.component ? `label:${item.label}` : null)
          if (itemKey) {
            defs[item.position.toString()] = itemKey
          }
        }
      })
    }
    return defs
  }, [currentConfig])

  const [focusedSlot, setFocusedSlot] = useState<string | null>("1")
  const [tempPositions, setTempPositions] = useState<DockPositions>(() => {
    // 1. From user customization
    if (user?.customization) {
      const userPos = getDockCustomization(user.customization).positions
      if (userPos && Object.values(userPos).some(Boolean)) {
        return { ...DEFAULT_DOCK_POSITIONS, ...userPos }
      }
    }
    // 2. From localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(DOCK_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed && typeof parsed === "object") {
            return { ...DEFAULT_DOCK_POSITIONS, ...parsed }
          }
        }
      } catch {
        // ignore
      }
    }
    return defaultPositions
  })

  const [savedPositions, setSavedPositions] =
    useState<DockPositions>(tempPositions)

  // Custom Groups State
  const [customGroups, setCustomGroups] = useState<CustomDockGroup[]>(() => {
    if (user?.customization) {
      const groups = getDockCustomization(user.customization).customGroups
      if (Array.isArray(groups)) return groups
    }
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(DOCK_GROUPS_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) return parsed
        }
      } catch {
        // ignore
      }
    }
    return []
  })

  const [savedCustomGroups, setSavedCustomGroups] =
    useState<CustomDockGroup[]>(customGroups)

  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomDockGroup | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Synchronize when user data loads or changes
  useEffect(() => {
    let initialPos: DockPositions = defaultPositions
    let initialGroups: CustomDockGroup[] = []

    if (user?.customization) {
      const dockCust = getDockCustomization(user.customization)
      if (dockCust.positions && Object.values(dockCust.positions).some(Boolean)) {
        initialPos = { ...DEFAULT_DOCK_POSITIONS, ...dockCust.positions }
      }
      if (Array.isArray(dockCust.customGroups)) {
        initialGroups = dockCust.customGroups
      }
    } else if (typeof window !== "undefined") {
      try {
        const storedPos = localStorage.getItem(DOCK_STORAGE_KEY)
        if (storedPos) {
          const parsed = JSON.parse(storedPos)
          if (parsed && typeof parsed === "object") {
            initialPos = { ...DEFAULT_DOCK_POSITIONS, ...parsed }
          }
        }
        const storedGroups = localStorage.getItem(DOCK_GROUPS_STORAGE_KEY)
        if (storedGroups) {
          const parsed = JSON.parse(storedGroups)
          if (Array.isArray(parsed)) {
            initialGroups = parsed
          }
        }
      } catch {
        // ignore
      }
    }

    setTempPositions(initialPos)
    setSavedPositions(initialPos)
    setCustomGroups(initialGroups)
    setSavedCustomGroups(initialGroups)
  }, [user?.customization, defaultPositions])

  const isDirty = useMemo(() => {
    const posDirty =
      JSON.stringify(tempPositions) !== JSON.stringify(savedPositions)
    const groupsDirty =
      JSON.stringify(customGroups) !== JSON.stringify(savedCustomGroups)
    return posDirty || groupsDirty
  }, [tempPositions, savedPositions, customGroups, savedCustomGroups])

  // Lookup helper for preview dock items (including custom groups and cross-app items)
  const findItemByKey = useCallback(
    (key: string | null | undefined): SidebarItem | undefined => {
      if (!key) return undefined

      // Check if key references a custom dock group
      if (key.startsWith("group:")) {
        const groupId = key.slice("group:".length)
        const group = customGroups.find((g) => g.id === groupId)
        if (group) {
          const children = group.itemKeys
            .map((k) => findItemByKey(k))
            .filter(Boolean) as SidebarItem[]
          return {
            label: group.label,
            icon: renderDockGroupIcon(group.icon, "size-5"),
            dataKey: key,
            children: children.map((c) => ({
              label: c.label,
              href: c.href,
              icon: c.icon,
            })),
          }
        }
      }

      // Check current active config
      for (const section of currentConfig) {
        for (const item of section.items) {
          const itemKey =
            item.href ||
            item.dataKey ||
            (item.component ? `label:${item.label}` : undefined)
          if (itemKey === key) return item
          if (item.children) {
            for (const child of item.children) {
              const childKey =
                child.href ||
                (child as any).dataKey ||
                (child.component ? `label:${child.label}` : undefined)
              if (childKey === key) return child as SidebarItem
            }
          }
        }
      }

      // Cross-app fallback: search all registered app configs
      for (const app of allAppConfigs) {
        for (const section of app.config) {
          for (const item of section.items) {
            const itemKey =
              item.href ||
              item.dataKey ||
              (item.component ? `label:${item.label}` : undefined)
            if (itemKey === key) return item
            if (item.children) {
              for (const child of item.children) {
                const childKey =
                  child.href ||
                  (child as any).dataKey ||
                  (child.component ? `label:${child.label}` : undefined)
                if (childKey === key) return child as SidebarItem
              }
            }
          }
        }
      }

      return undefined
    },
    [currentConfig, customGroups, allAppConfigs]
  )

  // Grouped available items for the shortcuts grid (excluding mobile-only dock section)
  const groupedItems = useMemo(() => {
    const map: Record<string, SidebarItem[]> = {}
    currentConfig.forEach((sec) => {
      const secNameLower =
        sec.section?.toLowerCase().replace(/[^a-z]/g, "") || ""
      const dkLower = sec.dataKey?.toLowerCase() || ""
      if (
        secNameLower === "phone" ||
        dkLower === "mobile-dock" ||
        sec.section?.startsWith("#$")
      ) {
        return
      }

      sec.items.forEach((item) => {
        const secName = sec.section || t("general")
        const itemKey =
          item.href ||
          item.dataKey ||
          (item.component ? `label:${item.label}` : undefined)
        const hasChildren = item.children && item.children.length > 0

        if (itemKey || hasChildren) {
          if (!map[secName]) map[secName] = []
          const isAlreadyAdded = map[secName].some((i) => {
            const existingKey =
              i.href ||
              i.dataKey ||
              (i.component ? `label:${i.label}` : undefined)
            if (existingKey === itemKey && itemKey !== undefined) return true
            if (existingKey === undefined && i.label === item.label) return true
            return false
          })
          if (!isAlreadyAdded) {
            map[secName].push(item)
          }
        }
      })
    })
    return map
  }, [currentConfig, t])

  // Slot handlers
  const handleFocusSlot = useCallback((pos: string): void => {
    setFocusedSlot(pos)
  }, [])

  const handleClearSlot = useCallback((pos: string): void => {
    setTempPositions((prev) => ({
      ...prev,
      [pos]: null,
    }))
    setFocusedSlot(pos)
  }, [])

  const handleSelectItem = useCallback(
    (itemKey: string): void => {
      if (!focusedSlot) return
      const newPositions = { ...tempPositions }

      // Unassign from any other slot that currently has this item
      Object.keys(newPositions).forEach((key) => {
        if (newPositions[key] === itemKey) {
          newPositions[key] = null
        }
      })

      // Assign to currently focused slot
      newPositions[focusedSlot] = itemKey
      setTempPositions(newPositions)

      // Auto-advance to next slot (1 -> 2 -> 3 -> 4 -> 1)
      const slotOrder = ["1", "2", "3", "4"]
      const currentIndex = slotOrder.indexOf(focusedSlot)
      const nextIndex = (currentIndex + 1) % slotOrder.length
      setFocusedSlot(slotOrder[nextIndex] ?? "1")
    },
    [focusedSlot, tempPositions]
  )

  // Custom Groups Handlers
  const handleOpenCreateGroup = useCallback(() => {
    setEditingGroup(null)
    setGroupDialogOpen(true)
  }, [])

  const handleOpenEditGroup = useCallback((group: CustomDockGroup) => {
    setEditingGroup(group)
    setGroupDialogOpen(true)
  }, [])

  const handleSaveGroup = useCallback((group: CustomDockGroup) => {
    setCustomGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === group.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = group
        return updated
      }
      return [...prev, group]
    })
  }, [])

  const handleDeleteGroup = useCallback((groupId: string) => {
    const groupKey = `group:${groupId}`
    setCustomGroups((prev) => prev.filter((g) => g.id !== groupId))
    setTempPositions((prev) => {
      const next = { ...prev }
      let changed = false
      Object.keys(next).forEach((pos) => {
        if (next[pos] === groupKey) {
          next[pos] = null
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [])

  const handleReset = useCallback(() => {
    setTempPositions(savedPositions)
    setCustomGroups(savedCustomGroups)
  }, [savedPositions, savedCustomGroups])

  const handleResetToOriginal = useCallback(() => {
    setTempPositions({ ...defaultPositions })
    toast.info(t("resetToOriginalSuccess"))
  }, [defaultPositions, t])

  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving) return
    setIsSaving(true)

    try {
      // 1. Save to database via user context
      await updateDock({
        positions: tempPositions,
        customGroups,
      })

      // 2. Cache in local storage for instant render
      try {
        localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(tempPositions))
        localStorage.setItem(
          DOCK_GROUPS_STORAGE_KEY,
          JSON.stringify(customGroups)
        )
      } catch {
        // ignore
      }

      // 3. Dispatch event for live dock re-rendering
      window.dispatchEvent(new Event("iris-sidebar-changed"))

      // 4. Update saved reference
      setSavedPositions(tempPositions)
      setSavedCustomGroups(customGroups)
      toast.success(t("updateSuccess"))
    } catch (error) {
      console.error("Failed to save dock customization:", error)
      toast.error(t("updateFailed"))
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, isSaving, tempPositions, customGroups, updateDock, t])

  // Inject Save/Reset footer actions into settings modal
  useEffect(() => {
    setFooterContent?.(
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge
              variant="outline"
              className="animate-pulse border-amber-500/40 bg-amber-500/10 text-xs text-amber-400"
            >
              {t("unsavedChanges")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!isDirty || isSaving}
            onPress={handleReset}
            className="cursor-pointer rounded-xl text-xs"
          >
            <IconRotate2 data-icon="inline-start" className="size-3.5" />
            <span>{t("reset")}</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!isDirty || isSaving}
            onPress={handleSave}
            className="cursor-pointer gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-xs"
          >
            {isSaving ? (
              <>
                <Spinner className="size-3.5" />
                <span>{t("saving")}</span>
              </>
            ) : (
              <>
                <IconCheck data-icon="inline-start" className="size-3.5" />
                <span>{t("saveChanges")}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    )

    return () => {
      setFooterContent?.(null)
    }
  }, [isDirty, isSaving, handleReset, handleSave, setFooterContent, t])

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("title")}</h3>
      </div>

      {/* Interactive Mobile Dock Mockup Preview */}
      <Card className="border border-border/70 bg-card/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <IconDeviceMobile
                className="size-4.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <CardTitle className="text-sm font-semibold whitespace-nowrap">
                {t("mobileBottomDock")}
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onPress={handleResetToOriginal}
                className="cursor-pointer gap-1 rounded-xl text-[11px] text-muted-foreground hover:text-foreground"
              >
                <IconRefresh data-icon="inline-start" className="size-3" />
                <span>{t("resetToOriginal")}</span>
              </Button>
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary"
              >
                {t("slotSelected", { slot: focusedSlot || "—" })}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex justify-center rounded-2xl border border-border/60 bg-muted/40 p-4 shadow-inner">
            <IrisBottomDock
              pathname="/"
              isPreview={true}
              tempPositions={tempPositions}
              focusedSlot={focusedSlot}
              onFocusSlot={handleFocusSlot}
              onClearSlot={handleClearSlot}
              findItemByKey={findItemByKey}
              emptySlotLabel={t("empty")}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t("selectSlotPrompt")}
          </p>
        </CardContent>
      </Card>

      {/* Available Navigation Shortcuts Section */}
      <Card className="border border-border/70 bg-card/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <IconSparkles
              className="size-4.5 text-primary"
              aria-hidden="true"
            />
            <CardTitle className="text-sm font-semibold">
              {t("dockShortcuts")}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent>
          <DockShortcutsGrid
            groupedItems={groupedItems}
            tempPositions={tempPositions}
            focusedSlot={focusedSlot}
            onSelectItem={handleSelectItem}
            customGroups={customGroups}
            onCreateGroup={handleOpenCreateGroup}
            onEditGroup={handleOpenEditGroup}
            onDeleteGroup={handleDeleteGroup}
          />
        </CardContent>
      </Card>

      {/* Create / Edit Custom Group Dialog */}
      <DockCustomGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        initialGroup={editingGroup}
        onSaveGroup={handleSaveGroup}
        allAppConfigs={allAppConfigs}
      />
    </div>
  )
}

export default DockSettingsTab

