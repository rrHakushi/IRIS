"use client"

import React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { IconPalette, IconLayoutNavbar, IconCheck } from "@tabler/icons-react"
import { COLOR_PRESETS } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"

export interface VisualThemeCardProps {
  accentColor?: string | null
  onAccentColorChange: (color: string | null) => void
  bannerHeight?: "compact" | "normal" | "expansive"
  onBannerHeightChange: (height: "compact" | "normal" | "expansive") => void
  disabled?: boolean
}

const BANNER_HEIGHT_OPTIONS = [
  { id: "compact", name: "Compact", description: "Minimal slim banner (160px)" },
  { id: "normal", name: "Standard", description: "Balanced default view (240px)" },
  { id: "expansive", name: "Expansive", description: "Immersive hero style (340px)" },
] as const

export function VisualThemeCard({
  accentColor,
  onAccentColorChange,
  bannerHeight = "normal",
  onBannerHeightChange,
  disabled = false,
}: VisualThemeCardProps): React.JSX.Element {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <IconPalette className="size-4 text-primary" />
          Profile Visual Theme & Layout
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Banner Height Options */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            Hero Banner Height
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {BANNER_HEIGHT_OPTIONS.map((opt) => {
              const isSelected = bannerHeight === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBannerHeightChange(opt.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-start transition-all disabled:opacity-50",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-2xs"
                      : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-bold",
                        isSelected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {opt.name}
                    </span>
                    {isSelected && <IconCheck className="size-3.5 text-primary" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {opt.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Accent Color Preset Swatches */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Profile Accent Tint
            </label>
            {accentColor && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAccentColorChange(null)}
                className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground"
              >
                Reset to Default
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Default Option */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAccentColorChange(null)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110",
                !accentColor
                  ? "border-primary ring-2 ring-primary/40 scale-105"
                  : "border-border/70 bg-primary/20"
              )}
              title="System Default Rose Accent"
            >
              {!accentColor && <IconCheck className="size-3.5 text-primary" />}
            </button>

            {/* Color swatches */}
            {COLOR_PRESETS.map((preset) => {
              const isSelected = accentColor === preset.value
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAccentColorChange(preset.value)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110",
                    isSelected
                      ? "border-white ring-2 ring-white/60 scale-110"
                      : "border-black/20"
                  )}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                >
                  {isSelected && <IconCheck className="size-3.5 text-black drop-shadow" />}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
