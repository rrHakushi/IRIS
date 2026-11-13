"use client"

import React, { useRef, useState, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import {
  IconColorSwatch,
  IconArrowsHorizontal,
  IconPlus,
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"

export interface GradientSpectrumEditorProps {
  title: string
  colors: string[]
  positions: number[]
  onColorsChange: (colors: string[]) => void
  onPositionsChange: (positions: number[]) => void
  onResetPositions: () => void
  onAddStop: () => void
  onRemoveStop: (index: number) => void
  disabled?: boolean
  minStops?: number
  maxStops?: number
}

export function GradientSpectrumEditor({
  title,
  colors,
  positions,
  onColorsChange,
  onPositionsChange,
  onResetPositions,
  onAddStop,
  onRemoveStop,
  disabled = false,
  minStops = 2,
  maxStops = 8,
}: GradientSpectrumEditorProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile")
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeStopIndex, setActiveStopIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Ensure activeStopIndex is within valid range when stops count changes
  useEffect(() => {
    if (activeStopIndex >= colors.length) {
      setActiveStopIndex(Math.max(0, colors.length - 1))
    }
  }, [colors.length, activeStopIndex])

  const safePositions = React.useMemo(() => {
    return colors.map((_, i) => {
      const p = positions[i]
      if (typeof p === "number" && !isNaN(p)) {
        return Math.max(0, Math.min(100, Math.round(p)))
      }
      return colors.length <= 1
        ? 0
        : Math.round((i / (colors.length - 1)) * 100)
    })
  }, [colors, positions])

  // Handle single stop position update
  const handleUpdatePosition = useCallback(
    (index: number, newPos: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(newPos)))
      const updated = [...safePositions]
      updated[index] = clamped
      onPositionsChange(updated)
    },
    [safePositions, onPositionsChange]
  )

  // Handle color change for specific stop
  const handleUpdateColor = useCallback(
    (index: number, newColor: string) => {
      const updated = [...colors]
      updated[index] = newColor
      onColorsChange(updated)
    },
    [colors, onColorsChange]
  )

  // Drag handler for Photoshop-like dot dragging along the spectrum
  const handleDotPointerDown = useCallback(
    (index: number, e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()

      setActiveStopIndex(index)
      setIsDragging(true)

      const target = e.currentTarget
      target.setPointerCapture(e.pointerId)

      const updateFromPointer = (clientX: number) => {
        if (!trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        const rawX = clientX - rect.left
        const percent = Math.round(
          Math.max(0, Math.min(100, (rawX / rect.width) * 100))
        )
        handleUpdatePosition(index, percent)
      }

      const onPointerMove = (moveEvent: PointerEvent) => {
        updateFromPointer(moveEvent.clientX)
      }

      const onPointerUp = (upEvent: PointerEvent) => {
        setIsDragging(false)
        try {
          target.releasePointerCapture(upEvent.pointerId)
        } catch {
          // ignore if already released
        }
        target.removeEventListener("pointermove", onPointerMove)
        target.removeEventListener("pointerup", onPointerUp)
        target.removeEventListener("pointercancel", onPointerUp)
      }

      target.addEventListener("pointermove", onPointerMove)
      target.addEventListener("pointerup", onPointerUp)
      target.addEventListener("pointercancel", onPointerUp)
    },
    [disabled, handleUpdatePosition]
  )

  // Click on track to select nearest stop or move active stop
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const clickPercent = Math.round(
        Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      )

      // Find closest stop to the click
      let closestIdx = 0
      let minDistance = 999
      safePositions.forEach((pos, idx) => {
        const dist = Math.abs(pos - clickPercent)
        if (dist < minDistance) {
          minDistance = dist
          closestIdx = idx
        }
      })

      setActiveStopIndex(closestIdx)
    },
    [disabled, safePositions]
  )

  const handleAddStopAndSelect = useCallback(() => {
    if (colors.length >= maxStops) return
    onAddStop()
    setActiveStopIndex(colors.length)
  }, [colors.length, maxStops, onAddStop])

  const handleRemoveActiveStop = useCallback(() => {
    if (colors.length <= minStops) return
    onRemoveStop(activeStopIndex)
    setActiveStopIndex((prev) => Math.max(0, prev - 1))
  }, [colors.length, minStops, onRemoveStop, activeStopIndex])

  const activeColor = colors[activeStopIndex] || "#ffffff"
  const activePosition = safePositions[activeStopIndex] ?? 0

  // Generate spectrum linear gradient CSS string (sorted by position for CSS accuracy)
  const gradientCssString = React.useMemo(() => {
    const stops = colors.map((col, idx) => ({
      color: col,
      pos: safePositions[idx] ?? Math.round((idx / (colors.length - 1)) * 100),
    }))
    stops.sort((a, b) => a.pos - b.pos)
    return `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${s.pos}%`).join(", ")})`
  }, [colors, safePositions])

  return (
    <div className="space-y-3.5">
      {/* Header with Title, Even Spacing, and Add Stop Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <IconColorSwatch className="size-3.5 text-primary" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span title={t("distributeEvenly")}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={onResetPositions}
              aria-label={t("distributeEvenly")}
              className="h-7 gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <IconArrowsHorizontal className="size-3" />
              <span className="hidden sm:inline">{t("distributeEvenly")}</span>
            </Button>
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            {t("stopsCount", { count: colors.length, max: maxStops })}
          </span>
          <span
            title={
              colors.length >= maxStops
                ? t("maxStopsReached")
                : t("addStop")
            }
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || colors.length >= maxStops}
              onClick={handleAddStopAndSelect}
              className="h-7 gap-1 rounded-lg px-2 text-xs font-semibold shadow-2xs cursor-pointer"
            >
              <IconPlus className="size-3" />
              <span>{t("addStop")}</span>
            </Button>
          </span>
        </div>
      </div>

      {/* Interactive Gradient Spectrum Bar with Photoshop-style Draggable Dots */}
      <div className="pt-2 pb-1 px-3">
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-8 w-full cursor-pointer rounded-xl border border-border/80 shadow-inner"
          style={{
            background: gradientCssString,
          }}
        >
          {/* Draggable Stop Dots */}
          {colors.map((col, idx) => {
            const pos = safePositions[idx] ?? 0
            const isActive = idx === activeStopIndex

            return (
              <button
                key={idx}
                type="button"
                aria-label={`Stop ${idx + 1}: ${col} at ${pos}%`}
                disabled={disabled}
                onPointerDown={(e) => handleDotPointerDown(idx, e)}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveStopIndex(idx)
                }}
                className={cn(
                  "group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-5.5 rounded-full border-2 transition-[transform,box-shadow]",
                  "touch-none select-none focus:outline-none",
                  isDragging && isActive ? "cursor-grabbing" : "cursor-grab",
                  isActive
                    ? "z-30 scale-120 border-white ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg"
                    : "z-10 border-white/90 shadow-md hover:scale-110 hover:z-20 hover:border-white"
                )}
                style={{
                  left: `${pos}%`,
                  backgroundColor: col,
                }}
              >
                {/* Visual center indicator for active stop */}
                {isActive && (
                  <span className="block size-1.5 rounded-full bg-white mx-auto shadow-xs" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Dot Control Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-2.5 shadow-2xs">
        {/* Left: Active stop indicator & Prev/Next switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className="size-4 rounded-full border border-border shadow-xs shrink-0"
              style={{ backgroundColor: activeColor }}
            />
            <span className="text-xs font-semibold text-foreground">
              {t("stopNumber", { number: activeStopIndex + 1 })}
            </span>
          </div>

          <span className="text-[10px] text-muted-foreground">
            ({activeStopIndex + 1}/{colors.length})
          </span>

          <div className="flex items-center gap-0.5 ms-1">
            <span title="Previous Stop">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || activeStopIndex === 0}
                onClick={() => setActiveStopIndex((prev) => prev - 1)}
                aria-label="Previous Stop"
                className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer disabled:opacity-30"
              >
                <IconChevronLeft className="size-3.5" />
              </Button>
            </span>
            <span title="Next Stop">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || activeStopIndex === colors.length - 1}
                onClick={() => setActiveStopIndex((prev) => prev + 1)}
                aria-label="Next Stop"
                className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer disabled:opacity-30"
              >
                <IconChevronRight className="size-3.5" />
              </Button>
            </span>
          </div>
        </div>

        {/* Right: Color Picker, Hex Input, Manual % Input & Delete */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Color Picker & Hex Input */}
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              disabled={disabled}
              value={activeColor.startsWith("#") ? activeColor : "#ffffff"}
              onChange={(e) => handleUpdateColor(activeStopIndex, e.target.value)}
              className="size-7 cursor-pointer rounded-md border border-border bg-transparent shrink-0"
              title={t("customColorTitle")}
            />
            <Input
              type="text"
              disabled={disabled}
              value={activeColor}
              onChange={(e) => handleUpdateColor(activeStopIndex, e.target.value)}
              maxLength={7}
              placeholder="#FFFFFF"
              className="h-7 w-20 rounded-lg bg-background/50 font-mono text-[11px] uppercase"
            />
          </div>

          {/* Manual Percentage Input */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              %
            </span>
            <div className="relative flex items-center">
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                disabled={disabled}
                value={activePosition}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val)) {
                    handleUpdatePosition(activeStopIndex, val)
                  }
                }}
                className="h-7 w-16 rounded-lg bg-background/50 pe-4 font-mono text-xs text-end"
              />
              <span className="pointer-events-none absolute end-1.5 text-[10px] font-semibold text-muted-foreground">
                %
              </span>
            </div>
          </div>

          {/* Delete Stop Button */}
          <span
            title={
              colors.length <= minStops
                ? t("minStopsReached")
                : t("removeStop")
            }
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || colors.length <= minStops}
              onClick={handleRemoveActiveStop}
              aria-label={
                colors.length <= minStops
                  ? t("minStopsReached")
                  : t("removeStop")
              }
              className={cn(
                "h-7 w-7 p-0 rounded-lg text-muted-foreground hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive cursor-pointer",
                colors.length <= minStops && "cursor-not-allowed opacity-30"
              )}
            >
              <IconTrash className="size-3.5" />
            </Button>
          </span>
        </div>
      </div>
    </div>
  )
}
