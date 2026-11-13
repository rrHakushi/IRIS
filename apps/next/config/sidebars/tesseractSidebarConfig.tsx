import { useMemo } from "react"
import type { SidebarConfig } from "@/types/sidebar-config"
import type { Session } from "@/context/session-context"

/**
 * Tesseract uses a single shared local-network page without rooms or sub-routes.
 */
export function getTesseractSidebarConfig(
  _session?: Session | null,
  _t?: (key: string) => string
): SidebarConfig {
  return []
}

export function useTesseractSidebarConfig(
  session?: Session | null
): SidebarConfig {
  return useMemo(() => getTesseractSidebarConfig(session), [session])
}

export const tesseractSidebarConfig: SidebarConfig = []
