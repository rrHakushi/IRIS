"use client"

import React from "react"
import { MediaStatusBadge } from "./media-status-badge"
import { MediaListStatusBadge } from "./media-list-status-badge"
import { normalizeListStatus } from "./media-list-status-text"

export interface StatusBadgeProps {
  status?: string | null
  mediaType?: string | null
  showDot?: boolean
  showIcon?: boolean
  size?: "sm" | "md"
  className?: string
  t?: (key: string) => string
}

/**
 * Unified StatusBadge that automatically determines whether the status
 * is a user ListStatus (Watching/Reading/Paused/etc.) or a MediaStatus (Released/Releasing/etc.)
 * and delegates to the appropriate specialized badge component.
 */
export function StatusBadge({
  status,
  mediaType,
  showDot,
  showIcon,
  size,
  className,
  t,
}: StatusBadgeProps) {
  if (!status) return null

  const isList = normalizeListStatus(status) !== null

  if (isList) {
    return (
      <MediaListStatusBadge
        status={status}
        mediaType={mediaType}
        showDot={showDot}
        showIcon={showIcon}
        size={size}
        className={className}
        t={t}
      />
    )
  }

  return (
    <MediaStatusBadge
      status={status}
      showDot={showDot}
      showIcon={showIcon}
      size={size}
      className={className}
      t={t}
    />
  )
}

export { MediaStatusBadge } from "./media-status-badge"
export { MediaListStatusBadge } from "./media-list-status-badge"
