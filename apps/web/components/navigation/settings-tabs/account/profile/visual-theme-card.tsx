"use client"

import React, { useState, useEffect } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { IconPalette, IconCheck, IconColorPicker, IconRotate2 } from "@tabler/icons-react"
import { COLOR_PRESETS } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"

export interface VisualThemeCardProps {
  accentColor?: string | null
  onAccentColorChange: (color: string | null) => void
  disabled?: boolean
}

export function VisualThemeCard({
  accentColor,
  onAccentColorChange,
  disabled = false,
}: VisualThemeCardProps): React.JSX.Element {
  const [customHex, setCustomHex] = useState(accentColor || "")

  useEffect(() => {
    setCustomHex(accentColor || "")
  }, [accentColor])

  const handleHexInput = (val: string) => {
    setCustomHex(val)
    const cleaned = val.trim()
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      onAccentColorChange(cleaned)
    }
  }

  const handleNativeColorPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setCustomHex(val)
    onAccentColorChange(val)
  }

  const isPresetSelected = (hex: string) =>
    accentColor?.toLowerCase() === hex.toLowerCase()

  const isCustomColor =
    Boolean(accentColor) &&
    !COLOR_PRESETS.some(
      (p) => p.value.toLowerCase() === accentColor?.toLowerCase()
    )

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <IconPalette className="size-4 text-primary" />
            Profile Accent Color & Theme
          </CardTitle>
          {accentColor && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAccentColorChange(null)}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <IconRotate2 className="size-3" />
              Reset to Default
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Curated Presets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Curated Accent Tints
            </label>
            <span className="text-[11px] text-muted-foreground">
              {COLOR_PRESETS.length} presets
            </span>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {/* System Default Swatch */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAccentColorChange(null)}
              className={cn(
                "group relative flex aspect-square size-8 items-center justify-center rounded-xl border transition-all hover:scale-105 disabled:opacity-50",
                !accentColor
                  ? "border-primary bg-primary/20 ring-2 ring-primary/40 shadow-xs"
                  : "border-border/60 bg-muted/40 hover:border-border"
              )}
              title="System Default Accent"
            >
              {!accentColor ? (
                <IconCheck className="size-3.5 text-primary" />
              ) : (
                <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground">
                  Def
                </span>
              )}
            </button>

            {/* Color swatches */}
            {COLOR_PRESETS.map((preset) => {
              const selected = isPresetSelected(preset.value)
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAccentColorChange(preset.value)}
                  className={cn(
                    "relative flex aspect-square size-8 items-center justify-center rounded-xl border transition-all hover:scale-105 disabled:opacity-50",
                    selected
                      ? "border-white ring-2 ring-primary/50 shadow-md scale-105"
                      : "border-border/40 hover:border-foreground/30"
                  )}
                  style={{ backgroundColor: preset.value }}
                  title={`${preset.name} (${preset.value})`}
                >
                  {selected && (
                    <IconCheck className="size-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Custom Hex / Color Picker */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <IconColorPicker className="size-3.5 text-primary" />
              Custom Accent Color
            </label>
            {isCustomColor && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                Custom active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <input
                type="color"
                disabled={disabled}
                value={accentColor?.startsWith("#") ? accentColor : "#f43f5e"}
                onChange={handleNativeColorPick}
                className="size-8 cursor-pointer rounded-lg border border-border/60 bg-transparent p-0.5 transition-all hover:scale-105 disabled:opacity-50"
                title="Open color palette picker"
              />
            </div>

            <div className="relative flex-1">
              <Input
                type="text"
                disabled={disabled}
                placeholder="#RRGGBB (e.g. #8b5cf6)"
                value={customHex}
                onChange={(e) => handleHexInput(e.target.value)}
                maxLength={7}
                className="h-8 font-mono text-xs uppercase"
              />
            </div>

            {customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex.trim()) && (
              <div
                className="size-8 rounded-lg border border-border/60 shadow-2xs"
                style={{ backgroundColor: customHex.trim() }}
                title="Current custom color preview"
              />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Type any 6-digit hex code or use the color swatch to pick an arbitrary accent color.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
