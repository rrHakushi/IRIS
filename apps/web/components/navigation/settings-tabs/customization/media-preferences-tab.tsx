"use client"

import React, { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useUser } from "@/context/user-context"
import type { SettingsTabProps } from "../types"
import { type MediaTitleLanguage, getMediaPreferences } from "@IRIS/shared"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import { IconCheck, IconRotate2, IconLanguage } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

export function MediaPreferencesSettingsTab({
  setFooterContent,
}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.customization.media")
  const { user, updateUser } = useUser()

  const currentPref =
    getMediaPreferences(user?.customization).title || "primary"
  const [selectedTitle, setSelectedTitle] =
    useState<MediaTitleLanguage>(currentPref)
  const [savedTitle, setSavedTitle] = useState<MediaTitleLanguage>(currentPref)
  const [isSaving, setIsSaving] = useState(false)

  // Synchronize when user data loads
  useEffect(() => {
    if (user?.customization) {
      const pref = getMediaPreferences(user.customization).title || "primary"
      setSelectedTitle(pref)
      setSavedTitle(pref)
    }
  }, [user?.customization])

  const isDirty = selectedTitle !== savedTitle

  const handleReset = () => {
    setSelectedTitle(savedTitle)
  }

  const handleSave = async () => {
    if (!isDirty || isSaving) return
    setIsSaving(true)

    try {
      const existingCustomization = user?.customization || {}
      const existingPreferences =
        (existingCustomization as any).preferences || {}
      const existingMedia = existingPreferences.media || {}

      const updatedCustomization = {
        ...existingCustomization,
        preferences: {
          ...existingPreferences,
          media: {
            ...existingMedia,
            title: selectedTitle,
          },
        },
      }

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customization: updatedCustomization,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to update media preferences")
      }

      const updatedUserData = await res.json()
      updateUser(updatedUserData)
      setSavedTitle(selectedTitle)
      toast.success(t("updateSuccess"))
    } catch (error) {
      console.error("Failed to save media preferences:", error)
      toast.error(t("updateFailed"))
    } finally {
      setIsSaving(false)
    }
  }

  // Inject Save/Reset bar into modal footer
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
  }, [isDirty, isSaving, selectedTitle, savedTitle, setFooterContent, t])

  const titleOptions: {
    value: MediaTitleLanguage
    label: string
    exampleAnime: string
  }[] = [
    {
      value: "primary",
      label: t("primaryTitle"),
      exampleAnime: "Attack on Titan",
    },
    {
      value: "secondary",
      label: t("secondaryTitle"),
      exampleAnime: "Shingeki no Kyojin",
    },
    {
      value: "native",
      label: t("nativeTitle"),
      exampleAnime: "進撃の巨人",
    },
  ]

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("title")}</h3>
      </div>

      {/* Title Language Selection Card */}
      <Card className="border border-border/70 bg-card/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <IconLanguage
              className="size-4.5 text-primary"
              aria-hidden="true"
            />
            <CardTitle className="text-sm font-semibold">
              {t("titleDisplayLanguage")}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {titleOptions.map((opt) => {
              const isSelected = selectedTitle === opt.value

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedTitle(opt.value)}
                  className={cn(
                    "group relative flex flex-col items-start justify-between rounded-2xl border p-3.5 text-start transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs shadow-primary/15"
                      : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {opt.label}
                    </span>
                    <div
                      className={cn(
                        "flex size-4.5 items-center justify-center rounded-full border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/80 bg-background"
                      )}
                    >
                      {isSelected && (
                        <IconCheck className="size-3" aria-hidden="true" />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 w-full rounded-xl border border-border/40 bg-background/50 p-2">
                    <span className="block text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                      {t("preview")}
                    </span>
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {opt.exampleAnime}
                    </span>
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
