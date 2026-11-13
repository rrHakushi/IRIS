import { useMemo } from "react"
import type { Session } from "@/context/session-context"
import type { SidebarConfig } from "@/types/sidebar-config"
import {
  useBorealisSidebarConfig,
  getBorealisSidebarConfig,
} from "./borealisSidebarConfig"
import {
  useAkaromiSidebarConfig,
  getAkaromiSidebarConfig,
} from "./akaromiSidebarConfig"
import {
  useKiroshiSidebarConfig,
  getKiroshiSidebarConfig,
} from "./kiroshiSidebarConfig"
import {
  useCarinaSidebarConfig,
  getCarinaSidebarConfig,
} from "./carinaSidebarConfig"

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
  const borealisConfig = useBorealisSidebarConfig(session)
  const akaromiConfig = useAkaromiSidebarConfig(session)
  const kiroshiConfig = useKiroshiSidebarConfig(session)
  const carinaConfig = useCarinaSidebarConfig(session)

  return useMemo(
    () => [
      {
        appId: "borealis",
        appName: "Borealis",
        config: borealisConfig,
      },
      {
        appId: "akaromi",
        appName: "Akaromi",
        config: akaromiConfig,
      },
      {
        appId: "kiroshi",
        appName: "Kiroshi",
        config: kiroshiConfig,
      },
      {
        appId: "carina",
        appName: "Carina",
        config: carinaConfig,
      },
    ],
    [borealisConfig, akaromiConfig, kiroshiConfig, carinaConfig]
  )
}

/**
 * Non-hook helper returning sidebar navigation configurations.
 */
export function getAllAppSidebarConfigs(
  session: Session | null,
  tList?: (key: string) => string,
  connectedServarr?: string[]
): AppSidebarRegistryEntry[] {
  return [
    {
      appId: "borealis",
      appName: "Borealis",
      config: getBorealisSidebarConfig(
        session,
        tList ?? ((k: string) => k),
        connectedServarr
      ),
    },
    {
      appId: "akaromi",
      appName: "Akaromi",
      config: getAkaromiSidebarConfig(session),
    },
    {
      appId: "kiroshi",
      appName: "Kiroshi",
      config: getKiroshiSidebarConfig(session),
    },
    {
      appId: "carina",
      appName: "Carina",
      config: getCarinaSidebarConfig(session),
    },
  ]
}

export * from "./borealisSidebarConfig"
export * from "./akaromiSidebarConfig"
export * from "./kiroshiSidebarConfig"
export * from "./carinaSidebarConfig"
export * from "./carinaUserSidebarConfig"
