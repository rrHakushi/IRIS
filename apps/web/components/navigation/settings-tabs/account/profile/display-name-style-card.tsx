"use client"

import React from "react"
import { useTranslations } from "next-intl"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldLabel, FieldGroup } from "@workspace/ui/components/field"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopover,
  SelectList,
  SelectItem,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import {
  FONT_PRESETS,
  TEXT_EFFECT_PRESETS,
  COLOR_PRESETS,
  GRADIENT_PRESETS,
  PRISM_PRESETS,
  type DisplayNameStyle,
  type DisplayNameEffectType,
  getDisplayNameStyleCss,
} from "@IRIS/shared"
import {
  IconTypography,
  IconSparkles,
  IconColorSwatch,
  IconCheck,
} from "@tabler/icons-react"
import { GradientSpectrumEditor } from "./gradient-spectrum-editor"

function renderEffectPreview(effectId: string, label: string) {
  switch (effectId) {
    case "solid":
      return (
        <span className="text-xs font-bold tracking-wide text-foreground">
          {label}
        </span>
      )
    case "gradient":
      return (
        <span
          className="inline-block text-xs font-black tracking-wide"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #2dd4bf 0%, #fde68a 50%, #fda4af 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          {label}
        </span>
      )
    case "neon":
      return (
        <span
          className="text-xs font-extrabold text-white"
          style={{
            textShadow:
              "0 0 4px #d946ef, 0 0 10px #d946ef, 0 0 18px #d946ef",
          }}
        >
          {label}
        </span>
      )
    case "toon":
      return (
        <span
          className="text-xs font-black tracking-wider text-pink-400"
          style={{
            textShadow:
              "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 0px #000",
          }}
        >
          {label}
        </span>
      )
    case "pop":
      return (
        <span
          className="text-xs font-black text-emerald-400"
          style={{
            textShadow:
              "1px 1px 0px #059669, 2px 2px 0px #059669, 3px 3px 0px rgba(0,0,0,0.5)",
          }}
        >
          {label}
        </span>
      )
    case "gummy":
      return (
        <span
          className="inline-block text-xs font-black"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #ffffff 0%, #f472b6 45%, #ec4899 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            filter: "drop-shadow(0 2px 4px rgba(244,114,182,0.6))",
          }}
        >
          {label}
        </span>
      )
    case "prism":
      return (
        <span
          className="inline-block text-xs font-black"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #a855f7 0%, #3b82f6 25%, #10b981 50%, #f59e0b 75%, #ef4444 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.3))",
          }}
        >
          {label}
        </span>
      )
    case "glitch":
      return (
        <span
          className="text-xs font-black tracking-wider text-white"
          style={{
            textShadow:
              "-1.5px 0 0 #06b6d4, 1.5px 0 0 #ef4444, 0 0 6px rgba(6,182,212,0.6)",
          }}
        >
          {label}
        </span>
      )
    case "chrome":
      return (
        <span
          className="inline-block text-xs font-black"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #f8fafc 0%, #cbd5e1 35%, #475569 50%, #94a3b8 70%, #f1f5f9 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.7))",
          }}
        >
          {label}
        </span>
      )
    case "flame":
      return (
        <span
          className="inline-block text-xs font-black"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #fef08a 0%, #f97316 45%, #dc2626 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            filter: "drop-shadow(0 0 6px #f97316)",
          }}
        >
          {label}
        </span>
      )
    case "celestial":
      return (
        <span
          className="inline-block text-xs font-black"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #38bdf8 0%, #a855f7 50%, #ec4899 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            filter: "drop-shadow(0 0 6px rgba(168,85,247,0.7))",
          }}
        >
          {label}
        </span>
      )
    default:
      return (
        <span
          className="text-xs font-bold"
          style={getDisplayNameStyleCss({ effect: effectId as any })}
        >
          {label}
        </span>
      )
  }
}

export interface DisplayNameStyleCardProps {
  displayName: string
  onDisplayNameChange: (val: string) => void
  pronouns?: string
  onPronounsChange?: (val: string) => void
  statusText?: string
  onStatusTextChange?: (val: string) => void
  style: DisplayNameStyle
  onStyleChange: (style: DisplayNameStyle) => void
  username: string
  disabled?: boolean
}

export function DisplayNameStyleCard({
  displayName,
  onDisplayNameChange,
  pronouns = "",
  onPronounsChange,
  statusText = "",
  onStatusTextChange,
  style,
  onStyleChange,
  username,
  disabled = false,
}: DisplayNameStyleCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile")
  const getEffectLabel = React.useCallback(
    (id: string): string => {
      switch (id) {
        case "solid":
          return t("effects.solid")
        case "gradient":
          return t("effects.gradient")
        case "neon":
          return t("effects.neon")
        case "toon":
          return t("effects.toon")
        case "pop":
          return t("effects.pop")
        case "gummy":
          return t("effects.gummy")
        case "prism":
          return t("effects.prism")
        case "glitch":
          return t("effects.glitch")
        case "chrome":
          return t("effects.chrome")
        case "flame":
          return t("effects.flame")
        case "celestial":
          return t("effects.celestial")
        default:
          return id
      }
    },
    [t]
  )

  const currentFont = style.font || "default"
  const currentEffect: DisplayNameEffectType =
    (style.effect as DisplayNameEffectType) || "solid"
  const currentColor = style.color || "#ffffff"
  const currentColor2 = style.color2 || "#8b5cf6"

  // 2-8 color stops for gradient
  const currentGradientColors: string[] =
    Array.isArray(style.colors) && style.colors.length >= 2
      ? style.colors.slice(0, 8)
      : [currentColor || "#818cf8", currentColor2 || "#c084fc"]

  const computeDefaultPositions = (count: number): number[] => {
    if (count <= 1) return [0]
    return Array.from({ length: count }, (_, i) =>
      Math.round((i / (count - 1)) * 100)
    )
  }

  const currentGradientPositions: number[] =
    Array.isArray(style.positions) &&
    style.positions.length === currentGradientColors.length
      ? style.positions.map((p, i) =>
          typeof p === "number" && !isNaN(p)
            ? Math.max(0, Math.min(100, Math.round(p)))
            : Math.round((i / (currentGradientColors.length - 1)) * 100)
        )
      : computeDefaultPositions(currentGradientColors.length)

  // 2-8 color stops for prism
  const currentPrismColors: string[] =
    Array.isArray(style.colors) && style.colors.length >= 2
      ? style.colors.slice(0, 8)
      : ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"]

  const currentPrismPositions: number[] =
    Array.isArray(style.positions) &&
    style.positions.length === currentPrismColors.length
      ? style.positions.map((p, i) =>
          typeof p === "number" && !isNaN(p)
            ? Math.max(0, Math.min(100, Math.round(p)))
            : Math.round((i / (currentPrismColors.length - 1)) * 100)
        )
      : computeDefaultPositions(currentPrismColors.length)

  const handleGradientStopChange = (index: number, val: string) => {
    const updated = [...currentGradientColors]
    updated[index] = val
    onStyleChange({
      ...style,
      color: updated[0] ?? currentColor,
      color2: updated[updated.length - 1] ?? currentColor2,
      colors: updated,
      positions: currentGradientPositions,
    })
  }

  const handleGradientPositionChange = (index: number, val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)))
    const updated = [...currentGradientPositions]
    updated[index] = clamped
    onStyleChange({
      ...style,
      color: currentGradientColors[0] ?? currentColor,
      color2:
        currentGradientColors[currentGradientColors.length - 1] ??
        currentColor2,
      colors: currentGradientColors,
      positions: updated,
    })
  }

  const handleResetGradientPositions = () => {
    const evenly = computeDefaultPositions(currentGradientColors.length)
    onStyleChange({
      ...style,
      color: currentGradientColors[0] ?? currentColor,
      color2:
        currentGradientColors[currentGradientColors.length - 1] ??
        currentColor2,
      colors: currentGradientColors,
      positions: evenly,
    })
  }

  const handleAddGradientStop = () => {
    if (currentGradientColors.length >= 8) return
    const palette = [
      "#ec4899",
      "#f59e0b",
      "#10b981",
      "#06b6d4",
      "#3b82f6",
      "#8b5cf6",
      "#f43f5e",
      "#fde047",
    ]
    const nextColor =
      palette.find((c) => !currentGradientColors.includes(c)) ||
      currentGradientColors[currentGradientColors.length - 1] ||
      "#ec4899"
    const updatedColors = [...currentGradientColors, nextColor]
    const updatedPositions = computeDefaultPositions(updatedColors.length)
    onStyleChange({
      ...style,
      color: updatedColors[0],
      color2: updatedColors[updatedColors.length - 1],
      colors: updatedColors,
      positions: updatedPositions,
    })
  }

  const handleRemoveGradientStop = (index: number) => {
    if (currentGradientColors.length <= 2) return
    const updatedColors = currentGradientColors.filter((_, i) => i !== index)
    const updatedPositions = currentGradientPositions.filter(
      (_, i) => i !== index
    )
    onStyleChange({
      ...style,
      color: updatedColors[0],
      color2: updatedColors[updatedColors.length - 1],
      colors: updatedColors,
      positions: updatedPositions,
    })
  }

  const handlePrismColorChange = (index: number, val: string) => {
    const updated = [...currentPrismColors]
    updated[index] = val
    onStyleChange({
      ...style,
      colors: updated,
      positions: currentPrismPositions,
    })
  }

  const handlePrismPositionChange = (index: number, val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)))
    const updated = [...currentPrismPositions]
    updated[index] = clamped
    onStyleChange({
      ...style,
      colors: currentPrismColors,
      positions: updated,
    })
  }

  const handleResetPrismPositions = () => {
    const evenly = computeDefaultPositions(currentPrismColors.length)
    onStyleChange({
      ...style,
      colors: currentPrismColors,
      positions: evenly,
    })
  }

  const handleAddPrismStop = () => {
    if (currentPrismColors.length >= 8) return
    const palette = [
      "#f43f5e",
      "#fb923c",
      "#facc15",
      "#4ade80",
      "#22d3ee",
      "#818cf8",
      "#c084fc",
      "#e879f9",
    ]
    const nextColor =
      palette.find((c) => !currentPrismColors.includes(c)) || "#f43f5e"
    const updatedColors = [...currentPrismColors, nextColor]
    const updatedPositions = computeDefaultPositions(updatedColors.length)
    onStyleChange({
      ...style,
      colors: updatedColors,
      positions: updatedPositions,
    })
  }

  const handleRemovePrismStop = (index: number) => {
    if (currentPrismColors.length <= 2) return
    const updatedColors = currentPrismColors.filter((_, i) => i !== index)
    const updatedPositions = currentPrismPositions.filter((_, i) => i !== index)
    onStyleChange({
      ...style,
      colors: updatedColors,
      positions: updatedPositions,
    })
  }

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <IconTypography className="size-4 text-primary" />
          {t("displayNameAndStyling")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Name, Pronouns & Status Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          {/* Display Name */}
          <div className="sm:col-span-8">
            <FieldGroup>
              <Field>
                <FieldLabel
                  htmlFor="display-name"
                  className="text-xs font-semibold"
                >
                  {t("displayName")}
                </FieldLabel>
                <Input
                  id="display-name"
                  type="text"
                  value={displayName}
                  disabled={disabled}
                  onChange={(e) => onDisplayNameChange(e.target.value)}
                  placeholder={username || t("yourCustomNamePlaceholder")}
                  maxLength={32}
                  className="h-9 rounded-xl bg-background/50 text-xs"
                />
              </Field>
            </FieldGroup>
          </div>

          {/* Pronouns */}
          <div className="sm:col-span-4">
            <FieldGroup>
              <Field>
                <FieldLabel
                  htmlFor="pronouns"
                  className="text-xs font-semibold"
                >
                  {t("pronouns")}
                </FieldLabel>
                <Input
                  id="pronouns"
                  type="text"
                  value={pronouns}
                  disabled={disabled}
                  onChange={(e) => onPronounsChange?.(e.target.value)}
                  placeholder={t("pronounsPlaceholder")}
                  maxLength={24}
                  className="h-9 rounded-xl bg-background/50 text-xs"
                />
              </Field>
            </FieldGroup>
          </div>

          {/* Status Text */}
          <div className="sm:col-span-12">
            <FieldGroup>
              <Field>
                <FieldLabel
                  htmlFor="status-text"
                  className="text-xs font-semibold"
                >
                  {t("status")}
                </FieldLabel>
                <Input
                  id="status-text"
                  type="text"
                  value={statusText}
                  disabled={disabled}
                  onChange={(e) => onStatusTextChange?.(e.target.value)}
                  placeholder={t("statusPlaceholder")}
                  maxLength={128}
                  className="h-9 rounded-xl bg-background/50 text-xs"
                />
              </Field>
            </FieldGroup>
          </div>
        </div>

        {/* Font & Effect Selectors (Dropdowns) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Font Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <IconTypography className="size-3.5 text-primary" />
              <span>{t("font")}</span>
            </div>
            <Select
              selectedKey={currentFont}
              onSelectionChange={(key) =>
                key && onStyleChange({ ...style, font: key as string })
              }
              aria-label={t("font")}
              isDisabled={disabled}
              className="w-full"
            >
              <SelectTrigger
                size="default"
                className="h-10 w-full rounded-xl border border-border/60 bg-background/50 px-3 text-xs font-medium cursor-pointer"
              >
                <SelectValue>
                  {() => {
                    const fontPreset =
                      FONT_PRESETS.find((p) => p.id === currentFont) ||
                      FONT_PRESETS[0]
                    return (
                      <span
                        className="truncate font-semibold text-xs"
                        style={{ fontFamily: fontPreset?.family }}
                      >
                        {fontPreset?.name}
                      </span>
                    )
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectPopover className="w-(--trigger-width) max-h-64 rounded-xl border border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur-xl">
                <SelectList className="flex flex-col gap-0.5 p-0">
                  {FONT_PRESETS.map((preset) => (
                    <SelectItem
                      key={preset.id}
                      id={preset.id}
                      textValue={preset.name}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium"
                    >
                      <span
                        className="truncate"
                        style={{ fontFamily: preset.family }}
                      >
                        {preset.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectPopover>
            </Select>
          </div>

          {/* Text Effect Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <IconSparkles className="size-3.5 text-primary" />
              <span>{t("effect")}</span>
            </div>
            <Select
              selectedKey={currentEffect}
              onSelectionChange={(key) =>
                key &&
                onStyleChange({ ...style, effect: key as DisplayNameEffectType })
              }
              aria-label={t("effect")}
              isDisabled={disabled}
              className="w-full"
            >
              <SelectTrigger
                size="default"
                className="h-10 w-full rounded-xl border border-border/60 bg-background/50 px-3 text-xs font-medium cursor-pointer"
              >
                <SelectValue>
                  {() => {
                    const label = getEffectLabel(currentEffect)
                    return renderEffectPreview(currentEffect, label)
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectPopover className="w-(--trigger-width) max-h-72 rounded-xl border border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur-xl">
                <SelectList className="flex flex-col gap-0.5 p-0">
                  {TEXT_EFFECT_PRESETS.map((eff) => {
                    const label = getEffectLabel(eff.id)
                    return (
                      <SelectItem
                        key={eff.id}
                        id={eff.id}
                        textValue={label}
                        className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium"
                      >
                        {renderEffectPreview(eff.id, label)}
                      </SelectItem>
                    )
                  })}
                </SelectList>
              </SelectPopover>
            </Select>
          </div>
        </div>

        {/* Dynamic Color Controls based on Effect */}
        <div className="space-y-4 border-t border-border/40 pt-1">
          {/* 1. SINGLE COLOR PICKER (Solid, Neon, Toon, Gummy, Pop Color 1) */}
          {(currentEffect === "solid" ||
            currentEffect === "neon" ||
            currentEffect === "toon" ||
            currentEffect === "gummy" ||
            currentEffect === "pop") && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <IconColorSwatch className="size-3.5 text-primary" />
                  <span>
                    {currentEffect === "pop"
                      ? t("chooseColorFace")
                      : t("chooseColor")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    disabled={disabled}
                    value={
                      currentColor.startsWith("#") ? currentColor : "#ffffff"
                    }
                    onChange={(e) =>
                      onStyleChange({ ...style, color: e.target.value })
                    }
                    className="size-6 cursor-pointer rounded-md border border-border bg-transparent"
                    title={t("customColorTitle")}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {currentColor}
                  </span>
                </div>
              </div>

              {/* Color Preset Palette */}
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((col) => {
                  const isSelected =
                    currentColor.toLowerCase() === col.value.toLowerCase()
                  return (
                    <button
                      key={col.id}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onStyleChange({ ...style, color: col.value })
                      }
                      title={col.name}
                      className={cn(
                        "flex size-7 cursor-pointer items-center justify-center rounded-full border shadow-2xs transition-all",
                        isSelected
                          ? "scale-110 border-white ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "border-border/60 hover:scale-105"
                      )}
                      style={{ backgroundColor: col.value }}
                    >
                      {isSelected && (
                        <IconCheck className="size-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Additional Pop Shadow Color */}
              {currentEffect === "pop" && (
                <div className="space-y-2 border-t border-border/30 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {t("shadow3dColor")}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        disabled={disabled}
                        value={
                          currentColor2.startsWith("#")
                            ? currentColor2
                            : "#8b5cf6"
                        }
                        onChange={(e) =>
                          onStyleChange({ ...style, color2: e.target.value })
                        }
                        className="size-6 cursor-pointer rounded-md border border-border bg-transparent"
                        title={t("customColorTitle")}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {currentColor2}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. GRADIENT CONTROLS (2-8 Stops Multi-Stop Blend with Draggable Spectrum) */}
          {currentEffect === "gradient" && (
            <div className="space-y-4">
              <GradientSpectrumEditor
                title={t("gradientColorsTitle", {
                  count: currentGradientColors.length,
                })}
                colors={currentGradientColors}
                positions={currentGradientPositions}
                onColorsChange={(updatedColors) =>
                  onStyleChange({
                    ...style,
                    color: updatedColors[0] ?? currentColor,
                    color2:
                      updatedColors[updatedColors.length - 1] ?? currentColor2,
                    colors: updatedColors,
                    positions: currentGradientPositions,
                  })
                }
                onPositionsChange={(updatedPositions) =>
                  onStyleChange({
                    ...style,
                    color: currentGradientColors[0] ?? currentColor,
                    color2:
                      currentGradientColors[currentGradientColors.length - 1] ??
                      currentColor2,
                    colors: currentGradientColors,
                    positions: updatedPositions,
                  })
                }
                onResetPositions={handleResetGradientPositions}
                onAddStop={handleAddGradientStop}
                onRemoveStop={handleRemoveGradientStop}
                disabled={disabled}
                minStops={2}
                maxStops={8}
              />

              {/* Gradient Presets Grid */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Presets ({GRADIENT_PRESETS.length})
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {GRADIENT_PRESETS.map((gp) => {
                    const gpColors = gp.colors || [gp.color1, gp.color2]
                    const isSelected =
                      currentGradientColors.length === gpColors.length &&
                      currentGradientColors.every(
                        (c, i) =>
                          c.toLowerCase() === gpColors[i]?.toLowerCase()
                      )
                    return (
                      <button
                        key={gp.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const presetPositions =
                            gp.positions ||
                            computeDefaultPositions(gpColors.length)
                          onStyleChange({
                            ...style,
                            color: gpColors[0],
                            color2: gpColors[gpColors.length - 1],
                            colors: [...gpColors],
                            positions: presetPositions,
                          })
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-start transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-2xs"
                            : "border-border/60 bg-background/40 hover:border-border hover:bg-muted/30"
                        )}
                      >
                        <div
                          className="size-4 shrink-0 rounded-full shadow-xs ring-1 ring-border/50"
                          style={{
                            background: `linear-gradient(135deg, ${gpColors.join(", ")})`,
                          }}
                        />
                        <span className="flex-1 truncate text-xs font-medium">
                          {gp.name}
                        </span>
                        {isSelected && (
                          <IconCheck className="size-3 shrink-0 text-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. PRISM COLOR PICKER (2-8 Stops Multi-Stop Rainbow Spectrum with Draggable Spectrum) */}
          {currentEffect === "prism" && (
            <div className="space-y-4">
              <GradientSpectrumEditor
                title={t("prismSpectrumTitle", {
                  count: currentPrismColors.length,
                })}
                colors={currentPrismColors}
                positions={currentPrismPositions}
                onColorsChange={(updatedColors) =>
                  onStyleChange({
                    ...style,
                    colors: updatedColors,
                    positions: currentPrismPositions,
                  })
                }
                onPositionsChange={(updatedPositions) =>
                  onStyleChange({
                    ...style,
                    colors: currentPrismColors,
                    positions: updatedPositions,
                  })
                }
                onResetPositions={handleResetPrismPositions}
                onAddStop={handleAddPrismStop}
                onRemoveStop={handleRemovePrismStop}
                disabled={disabled}
                minStops={2}
                maxStops={8}
              />

              {/* Prism Presets Grid */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Presets ({PRISM_PRESETS.length})
                </span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {PRISM_PRESETS.map((pp) => {
                    const isSelected =
                      currentPrismColors.length === pp.colors.length &&
                      currentPrismColors.every(
                        (c, i) =>
                          c.toLowerCase() === pp.colors[i]?.toLowerCase()
                      )
                    return (
                      <button
                        key={pp.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const presetPositions =
                            pp.positions ||
                            computeDefaultPositions(pp.colors.length)
                          onStyleChange({
                            ...style,
                            colors: [...pp.colors],
                            positions: presetPositions,
                          })
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-start transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-2xs"
                            : "border-border/60 bg-background/40 hover:border-border hover:bg-muted/30"
                        )}
                      >
                        <div
                          className="h-3 w-8 shrink-0 rounded-full shadow-xs ring-1 ring-border/50"
                          style={{
                            background: `linear-gradient(90deg, ${pp.colors.join(", ")})`,
                          }}
                        />
                        <span className="flex-1 truncate text-xs font-medium">
                          {pp.name}
                        </span>
                        {isSelected && (
                          <IconCheck className="size-3 shrink-0 text-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
