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
import { cn } from "@workspace/ui/lib/utils"
import {
  FONT_PRESETS,
  TEXT_EFFECT_PRESETS,
  COLOR_PRESETS,
  GRADIENT_PRESETS,
  PRISM_PRESETS,
  type DisplayNameStyle,
  type DisplayNameEffectType,
} from "@IRIS/shared"
import {
  IconTypography,
  IconSparkles,
  IconColorSwatch,
  IconCheck,
} from "@tabler/icons-react"

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
  const currentFont = style.font || "default"
  const currentEffect: DisplayNameEffectType =
    (style.effect as DisplayNameEffectType) || "solid"
  const currentColor = style.color || "#ffffff"
  const currentColor2 = style.color2 || "#8b5cf6"
  const currentPrismColors: [string, string, string, string, string] =
    Array.isArray(style.colors) && style.colors.length >= 5
      ? [
          style.colors[0] ?? "#a855f7",
          style.colors[1] ?? "#3b82f6",
          style.colors[2] ?? "#10b981",
          style.colors[3] ?? "#f59e0b",
          style.colors[4] ?? "#ef4444",
        ]
      : ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"]

  const handlePrismColorChange = (index: number, val: string) => {
    const updated = [...currentPrismColors] as [
      string,
      string,
      string,
      string,
      string,
    ]
    updated[index] = val
    onStyleChange({ ...style, colors: updated })
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

        {/* Font Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <IconTypography className="size-3.5 text-primary" />
            <span>{t("font")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {FONT_PRESETS.map((preset) => {
              const isSelected = currentFont === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onStyleChange({ ...style, font: preset.id })}
                  className={cn(
                    "group flex cursor-pointer flex-col items-start rounded-xl border p-2.5 text-start transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-2xs"
                      : "border-border/60 bg-background/40 hover:border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className="truncate text-xs font-semibold"
                      style={{ fontFamily: preset.family }}
                    >
                      {preset.name.split(" ")[0]}
                    </span>
                    {isSelected && (
                      <IconCheck className="size-3.5 shrink-0 text-primary" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Text Effects Grid (Matching Runa Realm Style) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <IconSparkles className="size-3.5 text-primary" />
            <span>{t("effect")}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {TEXT_EFFECT_PRESETS.map((effect) => {
              const isSelected = currentEffect === effect.id

              return (
                <button
                  key={effect.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onStyleChange({ ...style, effect: effect.id })}
                  className={cn(
                    "relative flex h-16 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border p-3 text-center transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40"
                      : "border-border/60 bg-background/40 hover:border-border hover:bg-muted/40"
                  )}
                >
                  {/* Effect Text Representation */}
                  {effect.id === "solid" && (
                    <span className="text-xs font-bold tracking-wide text-white">
                      {t("effects.solid")}
                    </span>
                  )}
                  {effect.id === "gradient" && (
                    <span className="bg-linear-to-r from-teal-300 via-amber-200 to-rose-300 bg-clip-text text-xs font-extrabold text-transparent">
                      {t("effects.gradient")}
                    </span>
                  )}
                  {effect.id === "neon" && (
                    <span className="text-xs font-extrabold text-white drop-shadow-[0_0_8px_#d946ef] drop-shadow-[0_0_18px_#d946ef]">
                      {t("effects.neon")}
                    </span>
                  )}
                  {effect.id === "toon" && (
                    <span
                      className="text-xs font-black tracking-wider text-pink-400"
                      style={{
                        textShadow:
                          "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 0px #000",
                      }}
                    >
                      {t("effects.toon")}
                    </span>
                  )}
                  {effect.id === "pop" && (
                    <span
                      className="text-xs font-black text-emerald-400"
                      style={{
                        textShadow:
                          "1px 1px 0px #059669, 2px 2px 0px #059669, 3px 3px 0px rgba(0,0,0,0.5)",
                      }}
                    >
                      {t("effects.pop")}
                    </span>
                  )}
                  {effect.id === "gummy" && (
                    <span
                      className="bg-linear-to-b from-white via-pink-300 to-pink-500 bg-clip-text text-xs font-black text-transparent"
                      style={{
                        filter: "drop-shadow(0 2px 4px rgba(244,114,182,0.6))",
                      }}
                    >
                      {t("effects.gummy")}
                    </span>
                  )}
                  {effect.id === "prism" && (
                    <span className="bg-linear-to-r from-purple-400 via-amber-400 via-emerald-400 via-sky-400 to-rose-400 bg-clip-text text-xs font-black text-transparent">
                      {t("effects.prism")}
                    </span>
                  )}

                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary/20">
                      <IconCheck className="size-3.5 text-primary" />
                    </div>
                  )}
                </button>
              )
            })}
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

          {/* 2. GRADIENT CONTROLS (2-Stop Linear Gradient) */}
          {currentEffect === "gradient" && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <IconColorSwatch className="size-3.5 text-primary" />
                <span>{t("gradientColorsTitle")}</span>
              </div>

              {/* Gradient Presets */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {GRADIENT_PRESETS.map((gp) => {
                  const isSelected =
                    currentColor.toLowerCase() === gp.color1.toLowerCase() &&
                    currentColor2.toLowerCase() === gp.color2.toLowerCase()
                  return (
                    <button
                      key={gp.id}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onStyleChange({
                          ...style,
                          color: gp.color1,
                          color2: gp.color2,
                        })
                      }
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-start transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border/60 bg-background/40 hover:border-border"
                      )}
                    >
                      <div
                        className="size-4 shrink-0 rounded-full shadow-xs"
                        style={{
                          background: `linear-gradient(135deg, ${gp.color1}, ${gp.color2})`,
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

              {/* Color 1 & Color 2 Custom Inputs */}
              <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/30 p-3">
                  <span className="text-xs font-medium">
                    {t("color1Start")}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={disabled}
                      value={
                        currentColor.startsWith("#") ? currentColor : "#818cf8"
                      }
                      onChange={(e) =>
                        onStyleChange({ ...style, color: e.target.value })
                      }
                      className="size-6 cursor-pointer rounded-md border border-border bg-transparent"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {currentColor}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/30 p-3">
                  <span className="text-xs font-medium">{t("color2End")}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={disabled}
                      value={
                        currentColor2.startsWith("#")
                          ? currentColor2
                          : "#c084fc"
                      }
                      onChange={(e) =>
                        onStyleChange({ ...style, color2: e.target.value })
                      }
                      className="size-6 cursor-pointer rounded-md border border-border bg-transparent"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {currentColor2}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. PRISM COLOR PICKER (Prism Effect: 5 Colors) */}
          {currentEffect === "prism" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <IconColorSwatch className="size-3.5 text-primary" />
                  <span>{t("prismSpectrumTitle")}</span>
                </div>
              </div>

              {/* Prism Presets */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PRISM_PRESETS.map((pp) => {
                  const isSelected = currentPrismColors.every(
                    (c, i) => c === pp.colors[i]
                  )
                  return (
                    <button
                      key={pp.id}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onStyleChange({
                          ...style,
                          colors: pp.colors,
                        })
                      }
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-start transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border/60 bg-background/40 hover:border-border"
                      )}
                    >
                      <div
                        className="h-3 w-12 shrink-0 rounded-full shadow-xs"
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

              {/* 5 Individual Color Pickers */}
              <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-5">
                {currentPrismColors.map((colorVal, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-background/30 p-2 text-center"
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {t("stopNumber", { number: idx + 1 })}
                    </span>
                    <input
                      type="color"
                      disabled={disabled}
                      value={colorVal.startsWith("#") ? colorVal : "#ffffff"}
                      onChange={(e) =>
                        handlePrismColorChange(idx, e.target.value)
                      }
                      className="size-7 cursor-pointer rounded-md border border-border bg-transparent"
                    />
                    <span className="w-full truncate font-mono text-[9px] text-muted-foreground">
                      {colorVal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
