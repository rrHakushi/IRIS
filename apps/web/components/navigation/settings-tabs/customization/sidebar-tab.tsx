"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { useUser } from "@/context/user-context"
import { useIrisSidebar } from "../../sidebar-provider"
import type { SettingsTabProps } from "../types"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconCheck,
  IconRotate2,
  IconRefresh,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconLayoutNavbar,
  IconLayoutBottombar,
  IconAdjustmentsHorizontal,
  IconApps,
} from "@tabler/icons-react"
import { toast } from "sonner"
import {
  getSidebarCustomization,
  getAppSidebarCustomization,
  type SidebarPosition,
} from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"
import type {
  AppSidebarCustomization,
  CustomSidebarGroup,
  CustomSidebarItem,
} from "@/types/sidebar-config"
import { useAllAppSidebarConfigs } from "@/config/sidebars"
import {
  filterSidebarConfig,
  applySidebarCustomization,
  getSectionKey,
} from "@/lib/navigation"
import { SidebarCanvasEditor } from "./sidebar/sidebar-canvas-editor"
import { SidebarCustomGroupDialog } from "./sidebar/sidebar-custom-group-dialog"
import { SidebarCustomLinkDialog } from "./sidebar/sidebar-custom-link-dialog"

const POSITION_STORAGE_KEY = "iris-sidebar-position"
const SIDEBAR_CUSTOMIZATION_STORAGE_KEY = "iris-sidebar-customization"

interface PositionOption {
  id: SidebarPosition
  labelKey: "left" | "right" | "top" | "bottom"
  icon: React.ComponentType<{ className?: string }>
}

const POSITION_OPTIONS: PositionOption[] = [
  {
    id: "left",
    labelKey: "left",
    icon: IconLayoutSidebar,
  },
  {
    id: "right",
    labelKey: "right",
    icon: IconLayoutSidebarRight,
  },
  {
    id: "top",
    labelKey: "top",
    icon: IconLayoutNavbar,
  },
  {
    id: "bottom",
    labelKey: "bottom",
    icon: IconLayoutBottombar,
  },
]

export function SidebarSettingsTab({
  setFooterContent,
}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.sidebarSettings")
  const { data: session } = useSession()
  const { user, updateSidebar } = useUser()
  const pathname = usePathname() || "/"
  const {
    sidebarConfig: currentActiveConfig,
    position: currentActivePosition,
    setPosition: setGlobalPosition,
  } = useIrisSidebar()

  // Multi-app navigation configurations registry
  const baseAppConfigs = useAllAppSidebarConfigs(session)

  // Resolve currently active app with priority: pathname match -> active config match -> default 'iris-list'
  const defaultActiveAppId = useMemo(() => {
    if (pathname.startsWith("/iris-pass")) return "iris-pass"
    if (currentActiveConfig && currentActiveConfig.length > 0) {
      const match = baseAppConfigs.find((app) =>
        app.config.some((sec) =>
          currentActiveConfig.some((s) => s.section === sec.section)
        )
      )
      if (match) return match.appId
    }
    return "iris-list"
  }, [pathname, currentActiveConfig, baseAppConfigs])

  const [activeAppId, setActiveAppId] = useState<string>(defaultActiveAppId)

  // Use currently active runtime config as default for the active app
  const allAppConfigs = useMemo(() => {
    if (!currentActiveConfig || currentActiveConfig.length === 0) {
      return baseAppConfigs
    }
    return baseAppConfigs.map((app) => {
      if (app.appId === defaultActiveAppId) {
        return {
          ...app,
          config: currentActiveConfig,
        }
      }
      return app
    })
  }, [baseAppConfigs, currentActiveConfig, defaultActiveAppId])

  // Resolve initial position with priority: user customization -> localStorage -> context position -> default 'left'
  const initialResolvedPosition = useMemo((): SidebarPosition => {
    if (user?.customization) {
      const userPos = getSidebarCustomization(user.customization).position
      if (userPos && ["left", "right", "top", "bottom"].includes(userPos)) {
        return userPos
      }
    }
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(
          POSITION_STORAGE_KEY
        ) as SidebarPosition | null
        if (stored && ["left", "right", "top", "bottom"].includes(stored)) {
          return stored
        }
      } catch {
        // ignore
      }
    }
    return currentActivePosition || "left"
  }, [user?.customization, currentActivePosition])

  const [tempPosition, setTempPosition] =
    useState<SidebarPosition>(initialResolvedPosition)
  const [savedPosition, setSavedPosition] =
    useState<SidebarPosition>(initialResolvedPosition)

  // Per-app customization state map: appId -> AppSidebarCustomization
  const initialAppCustomizations = useMemo((): Record<
    string,
    AppSidebarCustomization
  > => {
    const map: Record<string, AppSidebarCustomization> = {}

    if (user?.customization) {
      const sidebarCust = getSidebarCustomization(user.customization)
      if (sidebarCust.apps && typeof sidebarCust.apps === "object") {
        Object.entries(sidebarCust.apps).forEach(([appId, appCust]) => {
          map[appId] = appCust
        })
      }
    } else if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(SIDEBAR_CUSTOMIZATION_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed && typeof parsed === "object") {
            Object.assign(map, parsed)
          }
        }
      } catch {
        // ignore
      }
    }

    return map
  }, [user?.customization])

  const [tempAppCustomizations, setTempAppCustomizations] =
    useState<Record<string, AppSidebarCustomization>>(initialAppCustomizations)
  const [savedAppCustomizations, setSavedAppCustomizations] =
    useState<Record<string, AppSidebarCustomization>>(initialAppCustomizations)

  const [isSaving, setIsSaving] = useState(false)

  // Dialogs state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] =
    useState<CustomSidebarGroup | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<CustomSidebarItem | null>(null)

  // Sync when user data arrives or changes
  useEffect(() => {
    if (user?.customization) {
      const sidebarCust = getSidebarCustomization(user.customization)
      if (
        sidebarCust.position &&
        ["left", "right", "top", "bottom"].includes(sidebarCust.position)
      ) {
        setTempPosition(sidebarCust.position)
        setSavedPosition(sidebarCust.position)
      }
      if (sidebarCust.apps && typeof sidebarCust.apps === "object") {
        setTempAppCustomizations(sidebarCust.apps)
        setSavedAppCustomizations(sidebarCust.apps)
      }
    }
  }, [user?.customization])

  const isDirty = useMemo(() => {
    const posDirty = tempPosition !== savedPosition
    const custDirty =
      JSON.stringify(tempAppCustomizations) !==
      JSON.stringify(savedAppCustomizations)
    return posDirty || custDirty
  }, [
    tempPosition,
    savedPosition,
    tempAppCustomizations,
    savedAppCustomizations,
  ])

  // Current active app raw base configuration
  const activeAppEntry = useMemo(
    () =>
      allAppConfigs.find((a) => a.appId === activeAppId) || allAppConfigs[0],
    [allAppConfigs, activeAppId]
  )

  const userPermissions = user?.permissions
  const filteredBaseConfig = useMemo(() => {
    // If editing the currently active app and active config is available, use currently active config as default
    if (
      activeAppId === defaultActiveAppId &&
      currentActiveConfig &&
      currentActiveConfig.length > 0
    ) {
      return currentActiveConfig
    }
    if (!activeAppEntry) return []
    return filterSidebarConfig(activeAppEntry.config, userPermissions)
  }, [activeAppId, defaultActiveAppId, currentActiveConfig, activeAppEntry, userPermissions])

  // Current active app customization object
  const currentAppCustomization: AppSidebarCustomization = useMemo(() => {
    return (
      tempAppCustomizations[activeAppId] || {
        sectionOrder: [],
        hiddenSections: [],
        itemOrder: {},
        hiddenItems: [],
        itemOverrides: {},
        childrenOrder: {},
        hiddenChildren: [],
        customGroups: [],
        customLinks: [],
      }
    )
  }, [tempAppCustomizations, activeAppId])

  // Preview config with customizations applied (excluding hidden items from sidebar canvas, preserving empty sections)
  const previewConfig = useMemo(() => {
    return applySidebarCustomization(
      filteredBaseConfig,
      currentAppCustomization,
      allAppConfigs,
      { includeHidden: false, preserveEmptySections: true }
    )
  }, [filteredBaseConfig, currentAppCustomization, allAppConfigs])

  // Existing sections for target section pickers
  const existingSections = useMemo(() => {
    return previewConfig
      .filter((s) => !s.section?.startsWith("#$"))
      .map((s) => ({
        key: getSectionKey(s),
        label: s.section || t("unnamedSection"),
      }))
  }, [previewConfig, t])

  // Handlers for customization updates
  const handleUpdateAppCustomization = useCallback(
    (updated: AppSidebarCustomization) => {
      setTempAppCustomizations((prev) => ({
        ...prev,
        [activeAppId]: updated,
      }))
    },
    [activeAppId]
  )

  const handleResetAppLayout = useCallback(() => {
    setTempAppCustomizations((prev) => {
      const copy = { ...prev }
      delete copy[activeAppId]
      return copy
    })
    toast.info(t("resetSectionSuccess"))
  }, [activeAppId, t])

  const handleSelectPosition = useCallback((newPos: SidebarPosition) => {
    setTempPosition(newPos)
  }, [])

  const handleResetToDefault = useCallback(() => {
    setTempPosition("left")
    toast.info(t("resetSuccess"))
  }, [t])

  const handleResetAll = useCallback(() => {
    setTempPosition(savedPosition)
    setTempAppCustomizations(savedAppCustomizations)
  }, [savedPosition, savedAppCustomizations])

  // Dialog actions
  const handleSaveGroup = useCallback(
    (group: CustomSidebarGroup) => {
      const current = currentAppCustomization
      const groups = current.customGroups || []
      const existingIdx = groups.findIndex((g) => g.id === group.id)

      let updatedGroups: CustomSidebarGroup[]
      if (existingIdx >= 0) {
        updatedGroups = [...groups]
        updatedGroups[existingIdx] = group
      } else {
        updatedGroups = [...groups, group]
      }

      let updatedSectionOrder = current.sectionOrder || []
      const updatedItemOrder = { ...(current.itemOrder || {}) }

      if (group.type === "section") {
        const secKey = `group-sec:${group.id}`
        if (!updatedSectionOrder.includes(secKey)) {
          updatedSectionOrder = [...updatedSectionOrder, secKey]
        }
        if (!updatedItemOrder[secKey]) {
          updatedItemOrder[secKey] = [...(group.itemKeys || [])]
        }
      }

      handleUpdateAppCustomization({
        ...current,
        customGroups: updatedGroups,
        sectionOrder: updatedSectionOrder,
        itemOrder: updatedItemOrder,
      })
    },
    [currentAppCustomization, handleUpdateAppCustomization]
  )

  const handleSaveLink = useCallback(
    (link: CustomSidebarItem, targetSectionKey?: string) => {
      const current = currentAppCustomization
      const links = current.customLinks || []
      const existingIdx = links.findIndex((l) => l.id === link.id)

      let updatedLinks: CustomSidebarItem[]
      if (existingIdx >= 0) {
        updatedLinks = [...links]
        updatedLinks[existingIdx] = link
      } else {
        updatedLinks = [...links, link]
      }

      handleUpdateAppCustomization({
        ...current,
        customLinks: updatedLinks,
      })
    },
    [currentAppCustomization, handleUpdateAppCustomization]
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      // 1. Save to local storage for instant zero-latency access
      try {
        localStorage.setItem(POSITION_STORAGE_KEY, tempPosition)
        localStorage.setItem(
          SIDEBAR_CUSTOMIZATION_STORAGE_KEY,
          JSON.stringify(tempAppCustomizations)
        )
      } catch {
        // ignore
      }

      // 2. Dispatch cross-component events
      setGlobalPosition(tempPosition)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("iris-sidebar-position-changed", {
            detail: tempPosition,
          })
        )
        window.dispatchEvent(
          new CustomEvent("iris-sidebar-customization-changed", {
            detail: tempAppCustomizations,
          })
        )
      }

      // 3. Persist to server / cloud user profile
      await updateSidebar({
        position: tempPosition,
        apps: tempAppCustomizations,
      })

      setSavedPosition(tempPosition)
      setSavedAppCustomizations(tempAppCustomizations)
      toast.success(t("updateSuccess"))
    } catch (err) {
      console.error("Failed to save sidebar customizations:", err)
      toast.error(t("updateFailed"))
    } finally {
      setIsSaving(false)
    }
  }, [
    tempPosition,
    tempAppCustomizations,
    setGlobalPosition,
    updateSidebar,
    t,
  ])

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
            onPress={handleResetAll}
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
  }, [isDirty, isSaving, handleResetAll, handleSave, setFooterContent, t])

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      {/* 1. Position Selector Grid */}
      <Card className="border border-border/70 bg-card/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <IconAdjustmentsHorizontal
                className="size-4.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <CardTitle className="text-sm font-semibold whitespace-nowrap">
                {t("position")}
              </CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onPress={handleResetToDefault}
              className="cursor-pointer gap-1 rounded-xl text-[11px] text-muted-foreground hover:text-foreground"
            >
              <IconRefresh data-icon="inline-start" className="size-3" />
              <span>{t("resetToDefault")}</span>
            </Button>
          </div>
          <CardDescription className="text-xs">
            {t("positionDescription")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POSITION_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isSelected = tempPosition === opt.id

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectPosition(opt.id)}
                  className={cn(
                    "group relative flex cursor-pointer flex-col items-start gap-3 rounded-2xl border p-4 text-start transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                      : "border-border/70 bg-muted/20 hover:border-border hover:bg-muted/40"
                  )}
                >
                  {/* Visual Layout Mockup Diagram */}
                  <div className="flex h-20 w-full items-center justify-center rounded-xl border border-border/60 bg-background/80 p-2 shadow-inner">
                    <div className="relative flex h-full w-full overflow-hidden rounded-lg border border-border/70 bg-muted/40">
                      {opt.id === "left" && (
                        <div className="flex size-full flex-row">
                          <div className="h-full w-1/4 rounded-s-md border-e border-primary/40 bg-primary/30" />
                          <div className="flex flex-1 flex-col gap-1 p-1">
                            <div className="h-2 w-3/4 rounded-xs bg-muted-foreground/20" />
                            <div className="h-2 w-1/2 rounded-xs bg-muted-foreground/15" />
                          </div>
                        </div>
                      )}

                      {opt.id === "right" && (
                        <div className="flex size-full flex-row">
                          <div className="flex flex-1 flex-col gap-1 p-1">
                            <div className="h-2 w-3/4 rounded-xs bg-muted-foreground/20" />
                            <div className="h-2 w-1/2 rounded-xs bg-muted-foreground/15" />
                          </div>
                          <div className="h-full w-1/4 rounded-e-md border-s border-primary/40 bg-primary/30" />
                        </div>
                      )}

                      {opt.id === "top" && (
                        <div className="flex size-full flex-col">
                          <div className="h-1/3 w-full rounded-t-md border-b border-primary/40 bg-primary/30 flex items-center px-1 gap-1">
                            <div className="size-1.5 rounded-full bg-primary" />
                            <div className="h-1.5 w-1/3 rounded-xs bg-primary/50" />
                          </div>
                          <div className="flex flex-1 flex-col gap-1 p-1">
                            <div className="h-2 w-3/4 rounded-xs bg-muted-foreground/20" />
                            <div className="h-2 w-1/2 rounded-xs bg-muted-foreground/15" />
                          </div>
                        </div>
                      )}

                      {opt.id === "bottom" && (
                        <div className="flex size-full flex-col">
                          <div className="flex flex-1 flex-col gap-1 p-1">
                            <div className="h-2 w-3/4 rounded-xs bg-muted-foreground/20" />
                            <div className="h-2 w-1/2 rounded-xs bg-muted-foreground/15" />
                          </div>
                          <div className="h-1/3 w-full rounded-b-md border-t border-primary/40 bg-primary/30 flex items-center px-1 gap-1">
                            <div className="size-1.5 rounded-full bg-primary" />
                            <div className="h-1.5 w-1/3 rounded-xs bg-primary/50" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Header & Title */}
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex size-7 items-center justify-center rounded-lg transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground group-hover:text-foreground"
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {t(opt.labelKey)}
                      </span>
                    </div>

                    {isSelected && (
                      <Badge className="size-5 shrink-0 rounded-full bg-primary p-0 text-primary-foreground flex items-center justify-center">
                        <IconCheck className="size-3 stroke-[3]" />
                      </Badge>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2. Desktop Sidebar Layout & Available Inventory */}
      <Card className="border border-border/70 bg-card/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <IconLayoutSidebar className="size-4.5 text-primary" />
              <CardTitle className="text-sm font-semibold">
                {t("sidebarLayout")}
              </CardTitle>
            </div>

            {/* App Selector Tabs */}
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
        </CardHeader>

        <CardContent>
          <SidebarCanvasEditor
            appId={activeAppId}
            appName={activeAppEntry?.appName || "IRIS"}
            position={tempPosition}
            configuredSections={previewConfig}
            customization={currentAppCustomization}
            allAppConfigs={allAppConfigs}
            onChangeCustomization={handleUpdateAppCustomization}
            onOpenCreateGroup={() => {
              setEditingGroup(null)
              setGroupDialogOpen(true)
            }}
            onOpenEditGroup={(group) => {
              setEditingGroup(group)
              setGroupDialogOpen(true)
            }}
            onOpenCreateLink={() => {
              setEditingLink(null)
              setLinkDialogOpen(true)
            }}
            onResetLayout={handleResetAppLayout}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      <SidebarCustomGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        initialGroup={editingGroup}
        onSaveGroup={handleSaveGroup}
        allAppConfigs={allAppConfigs}
        existingSections={existingSections}
      />

      <SidebarCustomLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        initialLink={editingLink}
        onSaveLink={handleSaveLink}
        existingSections={existingSections}
      />
    </div>
  )
}

export default SidebarSettingsTab
