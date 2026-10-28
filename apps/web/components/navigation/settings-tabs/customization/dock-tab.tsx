"use client"

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
} from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useSession } from "@/context/session-context"
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
  IconApps,
} from "@tabler/icons-react"
import { toast } from "sonner"
import {
  getDockCustomization,
  DEFAULT_DOCK_POSITIONS,
  type CustomDockGroup,
  type AppDockCustomization,
} from "@IRIS/shared"
import type {
  DockPositions,
  SidebarItem,
  SidebarItemChild,
  SidebarConfig,
} from "@/types/sidebar-config"
import { filterSidebarConfig } from "@/lib/navigation"
import { useAllAppSidebarConfigs } from "@/config/sidebars"
import { getCarinaUserSidebarConfig } from "@/config/sidebars/carinaUserSidebarConfig"
import { renderDockGroupIcon } from "@/config/dock-group-icons"
import { SidebarNavigationContext } from "../../sidebar-provider"
import { IrisBottomDock } from "../../iris-bottom-dock"
import { DockShortcutsGrid } from "./dock/dock-shortcuts-grid"
import { DockCustomGroupDialog } from "./dock/dock-custom-group-dialog"
import { cn } from "@workspace/ui/lib/utils"

const DOCK_STORAGE_KEY = "iris-phone-dock-items-default"
const DOCK_GROUPS_STORAGE_KEY = "iris-phone-dock-custom-groups"

/**
 * Extracts the default 4 mobile dock slot items from an app's sidebar config (#$Phone section).
 */
function getDefaultDockPositionsForApp(appConfig: SidebarConfig): DockPositions {
  const defs: DockPositions = { ...DEFAULT_DOCK_POSITIONS }
  const phoneSection = appConfig.find((s) => {
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

  if (phoneSection && phoneSection.items.length > 0) {
    // 1. By explicit item.position (1-4)
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

    // 2. Sequential fallback if any position (1-4) is still unassigned
    phoneSection.items.slice(0, 4).forEach((item, idx) => {
      const pos = (idx + 1).toString()
      if (!defs[pos]) {
        const itemKey =
          item.href ||
          item.dataKey ||
          (item.component ? `label:${item.label}` : null)
        if (itemKey) {
          defs[pos] = itemKey
        }
      }
    })
  }

  return defs
}

export function DockSettingsTab({
  setFooterContent,
}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.dockSettings")
  const { data: session } = useSession()
  const { user, updateDock } = useUser()
  const pathname = usePathname() || "/"

  // Current active sidebar context config
  const sidebarContext = useContext(SidebarNavigationContext)
  const currentActiveConfig = sidebarContext?.sidebarConfig

  // Multi-app navigation configurations registry
  const baseAppConfigs = useAllAppSidebarConfigs(session)

  // Resolve initial active app with priority: pathname match -> active config match -> default 'borealis'
  const defaultActiveAppId = useMemo(() => {
    if (pathname.startsWith("/akaromi") || pathname.startsWith("/iris-pass"))
      return "akaromi"
    if (pathname.startsWith("/kiroshi") || pathname.startsWith("/iris-search"))
      return "kiroshi"
    if (pathname.startsWith("/carina") || pathname.startsWith("/iris-account"))
      return "carina"
    if (currentActiveConfig && currentActiveConfig.length > 0) {
      const match = baseAppConfigs.find((app) =>
        app.config.some((sec) =>
          currentActiveConfig.some((s) => s.section === sec.section)
        )
      )
      if (match) return match.appId
    }
    return "borealis"
  }, [pathname, currentActiveConfig, baseAppConfigs])

  const [activeAppId, setActiveAppId] = useState<string>(defaultActiveAppId)

  // Augmented all app configs (provides user profile tabs for Carina if empty)
  const allAppConfigs = useMemo(() => {
    return baseAppConfigs.map((app) => {
      let resolvedConfig = app.config
      if (
        app.appId === defaultActiveAppId &&
        currentActiveConfig &&
        currentActiveConfig.length > 0
      ) {
        resolvedConfig = currentActiveConfig
      } else if (app.appId === "carina" && resolvedConfig.length === 0) {
        resolvedConfig = getCarinaUserSidebarConfig({
          userId: session?.user?.id ?? undefined,
          username: session?.user?.username ?? undefined,
        })
      }
      return {
        ...app,
        config: resolvedConfig,
      }
    })
  }, [baseAppConfigs, defaultActiveAppId, currentActiveConfig, session?.user])

  // Map of default dock positions for each registered app
  const defaultPositionsMap = useMemo((): Record<string, DockPositions> => {
    const map: Record<string, DockPositions> = {}
    allAppConfigs.forEach((app) => {
      map[app.appId] = getDefaultDockPositionsForApp(app.config)
    })
    return map
  }, [allAppConfigs])

  // Helper to resolve initial customizations map across all apps
  const getInitialAppCustomizations = useCallback((): Record<
    string,
    AppDockCustomization
  > => {
    const map: Record<string, AppDockCustomization> = {}

    // 1. From user profile customization
    if (user?.customization) {
      const dockCust = getDockCustomization(user.customization)
      if (dockCust.apps && typeof dockCust.apps === "object") {
        Object.entries(dockCust.apps).forEach(([appId, appCust]) => {
          if (appCust && typeof appCust === "object") {
            const hasPos =
              appCust.positions &&
              Object.values(appCust.positions).some(Boolean)
            map[appId] = {
              positions: hasPos
                ? { ...DEFAULT_DOCK_POSITIONS, ...appCust.positions }
                : undefined,
              customGroups: Array.isArray(appCust.customGroups)
                ? appCust.customGroups
                : [],
            }
          }
        })
      }

      // Legacy top-level positions for Borealis
      if (
        dockCust.positions &&
        Object.values(dockCust.positions).some(Boolean) &&
        !map["borealis"]?.positions
      ) {
        map["borealis"] = {
          positions: { ...DEFAULT_DOCK_POSITIONS, ...dockCust.positions },
          customGroups: Array.isArray(dockCust.customGroups)
            ? dockCust.customGroups
            : map["borealis"]?.customGroups || [],
        }
      }
    }

    // 2. From localStorage for each registered app
    if (typeof window !== "undefined") {
      allAppConfigs.forEach((app) => {
        const appId = app.appId
        if (!map[appId]?.positions) {
          try {
            const stored =
              localStorage.getItem(`iris-phone-dock-items-${appId}`) ||
              (appId === "borealis"
                ? localStorage.getItem(DOCK_STORAGE_KEY)
                : null)
            if (stored) {
              const parsed = JSON.parse(stored)
              if (
                parsed &&
                typeof parsed === "object" &&
                Object.values(parsed).some(Boolean)
              ) {
                const storedGroups =
                  localStorage.getItem(
                    `iris-phone-dock-custom-groups-${appId}`
                  ) ||
                  (appId === "borealis"
                    ? localStorage.getItem(DOCK_GROUPS_STORAGE_KEY)
                    : null)
                const parsedGroups = storedGroups ? JSON.parse(storedGroups) : []
                map[appId] = {
                  positions: { ...DEFAULT_DOCK_POSITIONS, ...parsed },
                  customGroups: Array.isArray(parsedGroups) ? parsedGroups : [],
                }
              }
            }
          } catch {
            // ignore
          }
        }
      })
    }

    // 3. Fallback: prefill remaining unassigned apps with their default dock positions
    allAppConfigs.forEach((app) => {
      const appId = app.appId
      const defs = defaultPositionsMap[appId] || { ...DEFAULT_DOCK_POSITIONS }
      if (!map[appId] || !map[appId].positions) {
        map[appId] = {
          positions: { ...defs },
          customGroups: map[appId]?.customGroups || [],
        }
      }
    })

    return map
  }, [user?.customization, allAppConfigs, defaultPositionsMap])

  // Per-app customization state: Record<appId, AppDockCustomization>
  const [tempAppCustomizations, setTempAppCustomizations] =
    useState<Record<string, AppDockCustomization>>(getInitialAppCustomizations)
  const [savedAppCustomizations, setSavedAppCustomizations] =
    useState<Record<string, AppDockCustomization>>(getInitialAppCustomizations)

  // Re-sync when user customization changes
  useEffect(() => {
    const initialized = getInitialAppCustomizations()
    setTempAppCustomizations(initialized)
    setSavedAppCustomizations(initialized)
  }, [user?.customization, getInitialAppCustomizations])

  // Current active app customization values
  const activeAppEntry = useMemo(
    () =>
      allAppConfigs.find((a) => a.appId === activeAppId) || allAppConfigs[0],
    [allAppConfigs, activeAppId]
  )

  const userPermissions = user?.permissions
  const currentAppConfig = useMemo(() => {
    if (!activeAppEntry) return []
    return filterSidebarConfig(activeAppEntry.config, userPermissions)
  }, [activeAppEntry, userPermissions])

  const defaultPositionsForActiveApp = useMemo(() => {
    return (
      defaultPositionsMap[activeAppId] || { ...DEFAULT_DOCK_POSITIONS }
    )
  }, [defaultPositionsMap, activeAppId])

  const currentAppCustomization = useMemo(() => {
    const found = tempAppCustomizations[activeAppId]
    return {
      positions: found?.positions || defaultPositionsForActiveApp,
      customGroups: found?.customGroups || [],
    }
  }, [tempAppCustomizations, activeAppId, defaultPositionsForActiveApp])

  const tempPositions = currentAppCustomization.positions
  const customGroups = currentAppCustomization.customGroups

  const [focusedSlot, setFocusedSlot] = useState<string | null>("1")
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CustomDockGroup | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Dirty check across all app configurations
  const isDirty = useMemo(() => {
    return (
      JSON.stringify(tempAppCustomizations) !==
      JSON.stringify(savedAppCustomizations)
    )
  }, [tempAppCustomizations, savedAppCustomizations])

  // Lookup helper for preview dock items (including custom groups and cross-app items)
  const findItemByKey = useCallback(
    (key: string | null | undefined): SidebarItem | undefined => {
      if (!key) return undefined

      // 1. Check if key references a custom dock group
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

      const matchItem = (item: SidebarItem | SidebarItemChild): boolean => {
        const itemKey =
          item.href ||
          (item as any).dataKey ||
          (item.component ? `label:${item.label}` : undefined)
        return (
          itemKey === key ||
          (item as any).dataKey === key ||
          item.href === key ||
          item.label === key
        )
      }

      // 2. Check active app config (including #$Phone and all regular sections)
      if (currentAppConfig) {
        for (const section of currentAppConfig) {
          for (const item of section.items) {
            if (matchItem(item)) return item
            if (item.children) {
              for (const child of item.children) {
                if (matchItem(child)) return child as SidebarItem
              }
            }
          }
        }
      }

      // 3. Fallback across all registered apps
      for (const app of allAppConfigs) {
        for (const section of app.config) {
          for (const item of section.items) {
            if (matchItem(item)) return item
            if (item.children) {
              for (const child of item.children) {
                if (matchItem(child)) return child as SidebarItem
              }
            }
          }
        }
      }

      return undefined
    },
    [currentAppConfig, customGroups, allAppConfigs]
  )

  // Grouped available items for the shortcuts grid for the active app
  const groupedItems = useMemo(() => {
    const map: Record<string, SidebarItem[]> = {}
    currentAppConfig.forEach((sec) => {
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
  }, [currentAppConfig, t])

  // Slot interaction handlers
  const handleFocusSlot = useCallback((pos: string): void => {
    setFocusedSlot(pos)
  }, [])

  const handleClearSlot = useCallback(
    (pos: string): void => {
      const newPositions = {
        ...tempPositions,
        [pos]: null,
      }
      setTempAppCustomizations((prev) => ({
        ...prev,
        [activeAppId]: {
          ...(prev[activeAppId] || {}),
          positions: newPositions,
          customGroups,
        },
      }))
      setFocusedSlot(pos)
    },
    [tempPositions, activeAppId, customGroups]
  )

  const handleSelectItem = useCallback(
    (itemKey: string): void => {
      if (!focusedSlot) return
      const newPositions = { ...tempPositions }

      // Unassign from any other slot in this app that currently has this item
      Object.keys(newPositions).forEach((key) => {
        if (newPositions[key] === itemKey) {
          newPositions[key] = null
        }
      })

      // Assign to currently focused slot
      newPositions[focusedSlot] = itemKey

      // Update state for active app
      setTempAppCustomizations((prev) => ({
        ...prev,
        [activeAppId]: {
          ...(prev[activeAppId] || {}),
          positions: newPositions,
          customGroups,
        },
      }))

      // Auto-advance to next slot (1 -> 2 -> 3 -> 4 -> 1)
      const slotOrder = ["1", "2", "3", "4"]
      const currentIndex = slotOrder.indexOf(focusedSlot)
      const nextIndex = (currentIndex + 1) % slotOrder.length
      setFocusedSlot(slotOrder[nextIndex] ?? "1")
    },
    [focusedSlot, tempPositions, activeAppId, customGroups]
  )

  // Custom Groups Handlers for active app
  const handleOpenCreateGroup = useCallback(() => {
    setEditingGroup(null)
    setGroupDialogOpen(true)
  }, [])

  const handleOpenEditGroup = useCallback((group: CustomDockGroup) => {
    setEditingGroup(group)
    setGroupDialogOpen(true)
  }, [])

  const handleSaveGroup = useCallback(
    (group: CustomDockGroup) => {
      setTempAppCustomizations((prev) => {
        const appCust = prev[activeAppId] || {
          positions: defaultPositionsMap[activeAppId] || {
            ...DEFAULT_DOCK_POSITIONS,
          },
          customGroups: [],
        }
        const groups = appCust.customGroups || []
        const idx = groups.findIndex((g) => g.id === group.id)
        let updatedGroups: CustomDockGroup[]
        if (idx >= 0) {
          updatedGroups = [...groups]
          updatedGroups[idx] = group
        } else {
          updatedGroups = [...groups, group]
        }
        return {
          ...prev,
          [activeAppId]: {
            ...appCust,
            customGroups: updatedGroups,
          },
        }
      })
    },
    [activeAppId, defaultPositionsMap]
  )

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      const groupKey = `group:${groupId}`
      setTempAppCustomizations((prev) => {
        const appCust = prev[activeAppId] || {
          positions: defaultPositionsMap[activeAppId] || {
            ...DEFAULT_DOCK_POSITIONS,
          },
          customGroups: [],
        }
        const updatedGroups = (appCust.customGroups || []).filter(
          (g) => g.id !== groupId
        )
        const updatedPositions = {
          ...(appCust.positions ||
            defaultPositionsMap[activeAppId] || { ...DEFAULT_DOCK_POSITIONS }),
        }
        Object.keys(updatedPositions).forEach((pos) => {
          if (updatedPositions[pos] === groupKey) {
            updatedPositions[pos] = null
          }
        })
        return {
          ...prev,
          [activeAppId]: {
            ...appCust,
            positions: updatedPositions,
            customGroups: updatedGroups,
          },
        }
      })
    },
    [activeAppId, defaultPositionsMap]
  )

  // Reset all apps to saved state
  const handleReset = useCallback(() => {
    setTempAppCustomizations(savedAppCustomizations)
  }, [savedAppCustomizations])

  // Reset active app to its default positions
  const handleResetToOriginal = useCallback(() => {
    const defaultPos =
      defaultPositionsMap[activeAppId] || { ...DEFAULT_DOCK_POSITIONS }
    setTempAppCustomizations((prev) => ({
      ...prev,
      [activeAppId]: {
        ...(prev[activeAppId] || {}),
        positions: { ...defaultPos },
        customGroups: [],
      },
    }))
    toast.info(t("resetToOriginalSuccess"))
  }, [activeAppId, defaultPositionsMap, t])

  // Persist all customizations
  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving) return
    setIsSaving(true)

    try {
      // 1. Cache per-app in localStorage
      if (typeof window !== "undefined") {
        Object.entries(tempAppCustomizations).forEach(([appId, appCust]) => {
          if (appCust.positions) {
            localStorage.setItem(
              `iris-phone-dock-items-${appId}`,
              JSON.stringify(appCust.positions)
            )
          }
          if (appCust.customGroups) {
            localStorage.setItem(
              `iris-phone-dock-custom-groups-${appId}`,
              JSON.stringify(appCust.customGroups)
            )
          }
        })

        // Legacy storage keys for Borealis
        const borealisCust = tempAppCustomizations["borealis"]
        if (borealisCust?.positions) {
          localStorage.setItem(
            DOCK_STORAGE_KEY,
            JSON.stringify(borealisCust.positions)
          )
        }
        if (borealisCust?.customGroups) {
          localStorage.setItem(
            DOCK_GROUPS_STORAGE_KEY,
            JSON.stringify(borealisCust.customGroups)
          )
        }
      }

      // 2. Persist to server / cloud user profile
      const primaryApp =
        tempAppCustomizations["borealis"] ||
        tempAppCustomizations[activeAppId]
      await updateDock({
        positions: primaryApp?.positions,
        customGroups: primaryApp?.customGroups,
        apps: tempAppCustomizations,
      })

      // 3. Dispatch event for live dock re-rendering
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("iris-sidebar-changed"))
        window.dispatchEvent(
          new CustomEvent("iris-dock-customization-changed", {
            detail: tempAppCustomizations,
          })
        )
      }

      // 4. Update saved reference
      setSavedAppCustomizations(tempAppCustomizations)
      toast.success(t("updateSuccess"))
    } catch (error) {
      console.error("Failed to save dock customization:", error)
      toast.error(t("updateFailed"))
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, isSaving, tempAppCustomizations, activeAppId, updateDock, t])

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
            isDisabled={!isDirty || isSaving}
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
            isDisabled={!isDirty || isSaving}
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

  // Resolve preview app path
  const activeAppPath = useMemo(() => {
    if (activeAppId === "borealis") return "/borealis"
    if (activeAppId === "akaromi") return "/akaromi"
    if (activeAppId === "kiroshi") return "/kiroshi"
    return "/carina"
  }, [activeAppId])

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      {/* Interactive Mobile Dock Mockup Preview Card */}
      <Card className="border border-border/70 bg-card/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <IconDeviceMobile
                className="size-4.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <CardTitle className="text-sm font-semibold whitespace-nowrap">
                {t("mobileBottomDock")}
              </CardTitle>
            </div>

            {/* Per-App Selector Tabs */}
            {allAppConfigs.length > 1 && (
              <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-1">
                {allAppConfigs.map((app) => (
                  <button
                    key={app.appId}
                    type="button"
                    onClick={() => setActiveAppId(app.appId)}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all select-none",
                      activeAppId === app.appId
                        ? "bg-background text-foreground font-bold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <IconApps className="size-3.5" />
                    <span>{app.appName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between pt-1 gap-2">
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary"
            >
              {t("slotSelected", { slot: focusedSlot || "—" })}
            </Badge>

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
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex justify-center rounded-2xl border border-border/60 bg-muted/40 p-4 shadow-inner">
            <IrisBottomDock
              pathname={activeAppPath}
              appId={activeAppId}
              isPreview={true}
              tempPositions={tempPositions}
              focusedSlot={focusedSlot}
              onFocusSlot={handleFocusSlot}
              onClearSlot={handleClearSlot}
              findItemByKey={findItemByKey}
              emptySlotLabel={t("empty")}
              customGroups={customGroups}
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
