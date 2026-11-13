"use client"

import React, { useState, useEffect } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { IconPalette, IconColorPicker, IconRotate2 } from "@tabler/icons-react"
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

  const handleReset = () => {
    setCustomHex("")
    onAccentColorChange(null)
  }

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <IconPalette className="size-4 text-primary" />
            Profile Accent Color
          </CardTitle>
          {accentColor && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={handleReset}
              className="h-7 gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <IconRotate2 className="size-3" />
              Reset to Default
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <IconColorPicker className="size-3.5 text-primary" />
            Custom Accent Color
          </label>
          {accentColor && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Active: {accentColor.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center shrink-0">
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
              className="size-8 shrink-0 rounded-lg border border-border/60 shadow-2xs"
              style={{ backgroundColor: customHex.trim() }}
              title="Current custom color preview"
            />
          )}

          {accentColor && (
            <span title="Reset to default color">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={handleReset}
                aria-label="Reset to default color"
                className="h-8 gap-1 rounded-xl px-2.5 text-xs font-medium cursor-pointer"
              >
                <IconRotate2 className="size-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Choose any custom accent color to highlight your profile cards, tags, and badges.
        </p>
      </CardContent>
    </Card>
  )
}
