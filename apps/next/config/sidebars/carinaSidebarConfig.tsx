import { useMemo } from "react"
import type { SidebarConfig } from "@/types/sidebar-config"
import type { Session } from "@/context/session-context"

/**
 * Carina (Account management) sidebar navigation configuration.
 * Special case: empty for now.
 */
export function getCarinaSidebarConfig(
  _session?: Session | null,
  _t?: (key: string) => string
): SidebarConfig {
  return []
}

export function useCarinaSidebarConfig(
  session?: Session | null
): SidebarConfig {
  return useMemo(() => getCarinaSidebarConfig(session), [session])
}

export const carinaSidebarConfig: SidebarConfig = []

