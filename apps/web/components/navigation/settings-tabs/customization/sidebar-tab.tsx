"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useUser } from "@/context/user-context"
import { useIrisSidebar } from "../../sidebar-provider"
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
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconLayoutNavbar,
  IconLayoutBottombar,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { getSidebarCustomization, type SidebarPosition } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"

const POSITION_STORAGE_KEY = "iris-sidebar-position"

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
  const { user, updateSidebar } = useUser()
  const { position: currentActivePosition, setPosition: setGlobalPosition } =
    useIrisSidebar()

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
        const stored = localStorage.getItem(POSITION_STORAGE_KEY) as SidebarPosition | null
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
  const [isSaving, setIsSaving] = useState(false)

  // Synchronize when remote user profile loads
  useEffect(() => {
    if (user?.customization) {
      const remotePos = getSidebarCustomization(user.customization).position
      if (remotePos && ["left", "right", "top", "bottom"].includes(remotePos)) {
        setTempPosition(remotePos)
        setSavedPosition(remotePos)
      }
    }
  }, [user?.customization])

  const isDirty = tempPosition !== savedPosition

  const handleSelectPosition = useCallback((newPos: SidebarPosition) => {
    setTempPosition(newPos)
  }, [])

  const handleResetToDefault = useCallback(() => {
    setTempPosition("left")
    toast.info(t("resetSuccess"))
  }, [t])

  const handleReset = useCallback(() => {
    setTempPosition(savedPosition)
  }, [savedPosition])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      // 1. Save to local storage for instant zero-latency access
      try {
        localStorage.setItem(POSITION_STORAGE_KEY, tempPosition)
      } catch {
        // ignore
      }

      // 2. Update global context position & dispatch cross-component event
      setGlobalPosition(tempPosition)

      // 3. Persist to server/cloud user customization
      await updateSidebar({ position: tempPosition })

      setSavedPosition(tempPosition)
      toast.success(t("updateSuccess"))
    } catch (err) {
      console.error("Failed to save sidebar position:", err)
      toast.error(t("updateFailed"))
    } finally {
      setIsSaving(false)
    }
  }, [tempPosition, setGlobalPosition, updateSidebar, t])

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
                    {/* Mini Browser / Window Shell */}
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
    </div>
  )
}

export default SidebarSettingsTab
