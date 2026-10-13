import { useMemo } from "react"
import type { Session } from "next-auth"
import type { SidebarConfig } from "@/types/sidebar-config"
import { useListSidebarConfig, getListSidebarConfig } from "./listSidebarConfig"
import { usePassSidebarConfig, getPassSidebarConfig } from "./passSidebarConfig"

export interface AppSidebarRegistryEntry {
  appId: string
  appName: string
  config: SidebarConfig
}

/**
 * Hook returning sidebar navigation configurations for all registered apps.
 * Encapsulates the proper localized translation namespaces for each app.
 */
export function useAllAppSidebarConfigs(
  session: Session | null
): AppSidebarRegistryEntry[] {
  const listConfig = useListSidebarConfig(session)
  const passConfig = usePassSidebarConfig(session)

  return useMemo(
    () => [
      {
        appId: "borealis",
        appName: "Borealis",
        config: listConfig,
      },
      {
        appId: "akaromi",
        appName: "Akaromi",
        config: passConfig,
      },
    ],
    [listConfig, passConfig]
  )
}

/**
 * Non-hook helper returning sidebar navigation configurations.
 */
export function getAllAppSidebarConfigs(
  session: Session | null,
  tList: (key: string) => string,
  connectedServarr?: string[]
): AppSidebarRegistryEntry[] {
  return [
    {
      appId: "borealis",
      appName: "Borealis",
      config: getListSidebarConfig(session, tList, connectedServarr),
    },
    {
      appId: "akaromi",
      appName: "Akaromi",
      config: getPassSidebarConfig(session),
    },
  ]
}

export * from "./listSidebarConfig"
export * from "./passSidebarConfig"
export * from "./accountUserSidebarConfig"
