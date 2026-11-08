"use client"

import React from "react"
import {
  IconBook2,
  IconBookmark,
  IconCircleCheck,
  IconDeviceGamepad2,
  IconHeadphones,
  IconHelpCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
  type TablerIcon,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  getMediaListStatusText,
  normalizeListStatus,
  type ListStatus,
} from "./media-list-status-text"
import {
  getMediaListStatusColor,
  getMediaListStatusDotBg,
} from "./status"

export interface MediaListStatusBadgeProps {
  status?: ListStatus | string | null
  mediaType?: string | null
  showDot?: boolean
  showIcon?: boolean
  size?: "sm" | "md"
  className?: string
  t?: (key: string) => string
}

export function getMediaListStatusIcon(
  canonical: ListStatus,
  _mediaType?: string | null
): TablerIcon {
  switch (canonical) {
    case "IN_PROGRESS":
      return IconPlayerPlay
    case "COMPLETED":
      return IconCircleCheck
    case "ON_HOLD":
      return IconPlayerPause
    case "DROPPED":
      return IconTrash
    case "PLANNED":
      return IconBookmark
    case "MAYBE":
      return IconHelpCircle
    default:
      return IconBookmark
  }
}

/**
 * MediaListStatusBadge renders a frosted glass badge representing a user's list tracking status
 * (Watching/Reading/Playing/Listening, Paused, Dropped, Finished, Planning, Considering).
 *
 * Uses:
 * - Tabler icons exclusively
 * - `bg-frost border-frost border backdrop-blur-md`
 * - i18n support via optional `t` prop (`borealis.components.media.list.status`)
 */
export function MediaListStatusBadge({
  status,
  mediaType,
  showDot = false,
  showIcon = true,
  size = "sm",
  className,
  t,
}: MediaListStatusBadgeProps) {
  if (!status) return null

  const canonical = normalizeListStatus(status)
  if (!canonical) return null

  const label = getMediaListStatusText(status, mediaType, t)
  const color = getMediaListStatusColor(canonical)
  const dotBg = getMediaListStatusDotBg(canonical)
  const Icon = getMediaListStatusIcon(canonical, mediaType)

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
          className={cn("size-1.5 rounded-full", dotBg)}
          aria-hidden="true"
        />
      )}

      {showIcon && <Icon className="size-3 shrink-0" aria-hidden="true" />}

      <span className="tracking-wide">{label}</span>
    </span>
  )
}

