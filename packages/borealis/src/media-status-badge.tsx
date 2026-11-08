"use client"

import React from "react"
import {
  IconBan,
  IconBroadcast,
  IconCalendarTime,
  IconCircleCheck,
  IconCircleDot,
  IconPlayerPause,
  type TablerIcon,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  getMediaStatusText,
  normalizeMediaStatus,
  type MediaStatus,
} from "./media-status-text"
import {
  getMediaStatusColor,
  getMediaStatusDotBg,
} from "./status"

export interface MediaStatusBadgeProps {
  status?: MediaStatus | string | null
  showDot?: boolean
  showIcon?: boolean
  size?: "sm" | "md"
  className?: string
  t?: (key: string) => string
}

function getMediaStatusIcon(canonical: MediaStatus): TablerIcon {
  switch (canonical) {
    case "RELEASED":
      return IconCircleCheck
    case "RELEASING":
      return IconBroadcast
    case "UPCOMING":
      return IconCalendarTime
    case "CANCELLED":
      return IconBan
    case "HIATUS":
      return IconPlayerPause
    case "UNKNOWN":
    default:
      return IconCircleDot
  }
}

/**
 * MediaStatusBadge renders a frosted glass badge representing media release status
 * (Released, Releasing, Upcoming, Cancelled, Hiatus, Unknown).
 *
 * Uses:
 * - Tabler icons exclusively
 * - `bg-frost border-frost border backdrop-blur-md`
 * - Releasing color is white (`text-white`)
 * - i18n support via optional `t` prop (`borealis.components.media.status`)
 */
export function MediaStatusBadge({
  status,
  showDot = false,
  showIcon = true,
  size = "sm",
  className,
  t,
}: MediaStatusBadgeProps) {
  if (!status) return null

  const canonical = normalizeMediaStatus(status)
  const label = getMediaStatusText(status, t)
  const color = getMediaStatusColor(canonical)
  const dotBg = getMediaStatusDotBg(canonical)
  const Icon = getMediaStatusIcon(canonical)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-frost bg-frost font-mono font-bold uppercase backdrop-blur-md shadow-xs select-none transition-colors",
        color,
        size === "sm" && "px-1.5 py-0.5 text-[10px]",
        size === "md" && "px-2 py-1 text-xs",
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            dotBg,
            canonical === "RELEASING" && "animate-pulse"
          )}
          aria-hidden="true"
        />
      )}

      {showIcon && <Icon className="size-3 shrink-0" aria-hidden="true" />}

      <span className="tracking-wide">{label}</span>
    </span>
  )
}

