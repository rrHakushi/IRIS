"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Field, FieldLabel, FieldDescription, FieldGroup } from "@workspace/ui/components/field";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";
import {
  FONT_PRESETS,
  TEXT_EFFECT_PRESETS,
  COLOR_PRESETS,
  GRADIENT_PRESETS,
  PRISM_PRESETS,
  type DisplayNameStyle,
  type DisplayNameEffectType,
} from "@IRIS/shared";
import {
  IconTypography,
  IconSparkles,
  IconColorSwatch,
  IconCheck,
} from "@tabler/icons-react";

export interface DisplayNameStyleCardProps {
  displayName: string;
  onDisplayNameChange: (val: string) => void;
  pronouns?: string;
  onPronounsChange?: (val: string) => void;
  statusText?: string;
  onStatusTextChange?: (val: string) => void;
  style: DisplayNameStyle;
  onStyleChange: (style: DisplayNameStyle) => void;
  username: string;
  disabled?: boolean;
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
  const currentFont = style.font || "default";
  const currentEffect: DisplayNameEffectType =
    (style.effect as DisplayNameEffectType) || "solid";
  const currentColor = style.color || "#ffffff";
  const currentColor2 = style.color2 || "#8b5cf6";
  const currentPrismColors: [string, string, string, string, string] =
    Array.isArray(style.colors) && style.colors.length >= 5
      ? [
          style.colors[0] ?? "#a855f7",
          style.colors[1] ?? "#3b82f6",
          style.colors[2] ?? "#10b981",
          style.colors[3] ?? "#f59e0b",
          style.colors[4] ?? "#ef4444",
        ]
      : ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  const handlePrismColorChange = (index: number, val: string) => {
    const updated = [...currentPrismColors] as [string, string, string, string, string];
    updated[index] = val;
    onStyleChange({ ...style, colors: updated });
  };

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <IconTypography className="size-4 text-primary" />
          Display Name & Styling
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Name, Pronouns & Status Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          {/* Display Name */}
          <div className="sm:col-span-8">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="display-name" className="text-xs font-semibold">
                  Display Name
                </FieldLabel>
                <Input
                  id="display-name"
                  type="text"
                  value={displayName}
                  disabled={disabled}
                  onChange={(e) => onDisplayNameChange(e.target.value)}
                  placeholder={username || "Your custom name"}
                  maxLength={32}
                  className="rounded-xl text-xs bg-background/50 h-9"
                />
              </Field>
            </FieldGroup>
          </div>

          {/* Pronouns */}
          <div className="sm:col-span-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="pronouns" className="text-xs font-semibold">
                  Pronouns
                </FieldLabel>
                <Input
                  id="pronouns"
                  type="text"
                  value={pronouns}
                  disabled={disabled}
                  onChange={(e) => onPronounsChange?.(e.target.value)}
                  placeholder="Pronouns"
                  maxLength={24}
                  className="rounded-xl text-xs bg-background/50 h-9"
                />
              </Field>
            </FieldGroup>
          </div>

          {/* Status Text */}
          <div className="sm:col-span-12">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="status-text" className="text-xs font-semibold">
                  Status
                </FieldLabel>
                <Input
                  id="status-text"
                  type="text"
                  value={statusText}
                  disabled={disabled}
                  onChange={(e) => onStatusTextChange?.(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={128}
                  className="rounded-xl text-xs bg-background/50 h-9"
                />
              </Field>
            </FieldGroup>
          </div>
        </div>

        {/* Font Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <IconTypography className="size-3.5 text-primary" />
            <span>Font</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {FONT_PRESETS.map((preset) => {
              const isSelected = currentFont === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onStyleChange({ ...style, font: preset.id })}
                  className={cn(
                    "flex flex-col items-start p-2.5 rounded-xl border text-start transition-all cursor-pointer group",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-2xs"
                      : "border-border/60 bg-background/40 hover:border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className="text-xs font-semibold truncate"
                      style={{ fontFamily: preset.family }}
                    >
                      {preset.name.split(" ")[0]}
                    </span>
                    {isSelected && (
                      <IconCheck className="size-3.5 text-primary shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Text Effects Grid (Matching Runa Realm Style) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <IconSparkles className="size-3.5 text-primary" />
            <span>Effect</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {TEXT_EFFECT_PRESETS.map((effect) => {
              const isSelected = currentEffect === effect.id;

              return (
                <button
                  key={effect.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onStyleChange({ ...style, effect: effect.id })}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer h-16 relative overflow-hidden",
                    isSelected
                      ? "border-primary ring-2 ring-primary/40 bg-primary/10 shadow-md"
                      : "border-border/60 bg-background/40 hover:border-border hover:bg-muted/40"
                  )}
                >
                  {/* Effect Text Representation */}
                  {effect.id === "solid" && (
                    <span className="text-xs font-bold text-white tracking-wide">
                      Solid
                    </span>
                  )}
                  {effect.id === "gradient" && (
                    <span className="text-xs font-extrabold bg-linear-to-r from-teal-300 via-amber-200 to-rose-300 bg-clip-text text-transparent">
                      Gradient
                    </span>
                  )}
                  {effect.id === "neon" && (
                    <span className="text-xs font-extrabold text-white drop-shadow-[0_0_8px_#d946ef] drop-shadow-[0_0_18px_#d946ef]">
                      Neon
                    </span>
                  )}
                  {effect.id === "toon" && (
                    <span
                      className="text-xs font-black text-pink-400 tracking-wider"
                      style={{
                        textShadow:
                          "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 0px #000",
                      }}
                    >
                      Toon
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
                      Pop
                    </span>
                  )}
                  {effect.id === "gummy" && (
                    <span
                      className="text-xs font-black bg-linear-to-b from-white via-pink-300 to-pink-500 bg-clip-text text-transparent"
                      style={{ filter: "drop-shadow(0 2px 4px rgba(244,114,182,0.6))" }}
                    >
                      Gummy
                    </span>
                  )}
                  {effect.id === "prism" && (
                    <span className="text-xs font-black bg-linear-to-r from-purple-400 via-sky-400 via-emerald-400 via-amber-400 to-rose-400 bg-clip-text text-transparent">
                      Prism
                    </span>
                  )}

                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5">
                      <IconCheck className="size-3.5 text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Color Controls based on Effect */}
        <div className="space-y-4 pt-1 border-t border-border/40">
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
                  <span>Choose Color {currentEffect === "pop" ? "(Face)" : ""}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    disabled={disabled}
                    value={currentColor.startsWith("#") ? currentColor : "#ffffff"}
                    onChange={(e) => onStyleChange({ ...style, color: e.target.value })}
                    className="size-6 rounded-md border border-border cursor-pointer bg-transparent"
                    title="Custom color"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {currentColor}
                  </span>
                </div>
              </div>

              {/* Color Preset Palette */}
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((col) => {
                  const isSelected = currentColor.toLowerCase() === col.value.toLowerCase();
                  return (
                    <button
                      key={col.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onStyleChange({ ...style, color: col.value })}
                      title={col.name}
                      className={cn(
                        "size-7 rounded-full flex items-center justify-center transition-all cursor-pointer border shadow-2xs",
                        isSelected
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 border-white"
                          : "border-border/60 hover:scale-105"
                      )}
                      style={{ backgroundColor: col.value }}
                    >
                      {isSelected && (
                        <IconCheck className="size-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Additional Pop Shadow Color */}
              {currentEffect === "pop" && (
                <div className="pt-2 border-t border-border/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      3D Shadow Color
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        disabled={disabled}
                        value={currentColor2.startsWith("#") ? currentColor2 : "#8b5cf6"}
                        onChange={(e) =>
                          onStyleChange({ ...style, color2: e.target.value })
                        }
                        className="size-6 rounded-md border border-border cursor-pointer bg-transparent"
                      />
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {currentColor2}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. DUAL GRADIENT PICKER (Gradient Effect: 2 Colors) */}
          {currentEffect === "gradient" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <IconColorSwatch className="size-3.5 text-primary" />
                  <span>Gradient Colors (2-Stop Blend)</span>
                </div>
              </div>

              {/* Gradient Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GRADIENT_PRESETS.map((gp) => {
                  const isSelected =
                    currentColor.toLowerCase() === gp.color1.toLowerCase() &&
                    currentColor2.toLowerCase() === gp.color2.toLowerCase();
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
                        "flex items-center gap-2 p-2 rounded-xl border text-start transition-all cursor-pointer",
                        isSelected
                          ? "border-primary ring-1 ring-primary/40 bg-primary/10"
                          : "border-border/60 bg-background/40 hover:border-border"
                      )}
                    >
                      <div
                        className="size-4 rounded-full shrink-0 shadow-xs"
                        style={{
                          background: `linear-gradient(135deg, ${gp.color1}, ${gp.color2})`,
                        }}
                      />
                      <span className="text-xs font-medium truncate flex-1">
                        {gp.name}
                      </span>
                      {isSelected && (
                        <IconCheck className="size-3 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Color 1 & Color 2 Custom Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl border border-border/50 bg-background/30 flex items-center justify-between">
                  <span className="text-xs font-medium">Color 1 (Start)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={disabled}
                      value={currentColor.startsWith("#") ? currentColor : "#818cf8"}
                      onChange={(e) =>
                        onStyleChange({ ...style, color: e.target.value })
                      }
                      className="size-6 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {currentColor}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border/50 bg-background/30 flex items-center justify-between">
                  <span className="text-xs font-medium">Color 2 (End)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      disabled={disabled}
                      value={currentColor2.startsWith("#") ? currentColor2 : "#c084fc"}
                      onChange={(e) =>
                        onStyleChange({ ...style, color2: e.target.value })
                      }
                      className="size-6 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground">
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
                  <span>Prism Spectrum Colors (5 Stops)</span>
                </div>
              </div>

              {/* Prism Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PRISM_PRESETS.map((pp) => {
                  const isSelected =
                    currentPrismColors.every((c, i) => c === pp.colors[i]);
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
                        "flex items-center gap-2 p-2 rounded-xl border text-start transition-all cursor-pointer",
                        isSelected
                          ? "border-primary ring-1 ring-primary/40 bg-primary/10"
                          : "border-border/60 bg-background/40 hover:border-border"
                      )}
                    >
                      <div
                        className="h-3 w-12 rounded-full shrink-0 shadow-xs"
                        style={{
                          background: `linear-gradient(90deg, ${pp.colors.join(", ")})`,
                        }}
                      />
                      <span className="text-xs font-medium truncate flex-1">
                        {pp.name}
                      </span>
                      {isSelected && (
                        <IconCheck className="size-3 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 5 Individual Color Pickers */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                {currentPrismColors.map((colorVal, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl border border-border/50 bg-background/30 flex flex-col items-center gap-1.5 text-center"
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Stop {idx + 1}
                    </span>
                    <input
                      type="color"
                      disabled={disabled}
                      value={colorVal.startsWith("#") ? colorVal : "#ffffff"}
                      onChange={(e) => handlePrismColorChange(idx, e.target.value)}
                      className="size-7 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <span className="text-[9px] font-mono text-muted-foreground truncate w-full">
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
  );
}
