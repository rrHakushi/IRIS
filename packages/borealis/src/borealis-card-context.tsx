"use client"

import { createContext, useContext } from "react"
import type { BorealisCardConfig, BorealisNormalizedData } from "./types"
import type { ListStatus } from "./media-list-status-text"

export interface BorealisCardContextValue {
  data: BorealisNormalizedData
  config: BorealisCardConfig
  isHovered: boolean
  popoverPlacement: "left" | "right" | "top" | "bottom"
  containerRef?: React.RefObject<HTMLDivElement | null>
  popoverRef?: React.RefObject<HTMLDivElement | null>
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  localScore?: number | null
  setLocalScore?: (score: number | null) => void
  localStatus?: ListStatus
  setLocalStatus?: (status: ListStatus) => void
  localProgress?: number
  setLocalProgress?: (prog: number) => void
  isHoverCardEditing?: boolean
  setIsHoverCardEditing?: (editing: boolean) => void
}

const BorealisCardContext = createContext<BorealisCardContextValue | null>(null)

export function useBorealisCard(): BorealisCardContextValue {
  const context = useContext(BorealisCardContext)
  if (!context) {
    throw new Error(
      "useBorealisCard must be used within a <BorealisCard> or <BorealisCard.Root>"
    )
  }
  return context
}

export { BorealisCardContext }
