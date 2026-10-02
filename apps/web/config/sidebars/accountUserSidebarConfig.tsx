import React, { useMemo } from "react"
import type { SidebarConfig } from "@/types/sidebar-config"
import {
  IconLayoutDashboard,
  IconPlayerPlay,
  IconList,
  IconHeart,
  IconChartBar,
  IconUsers,
} from "@tabler/icons-react"

export interface AccountUserSidebarOptions {
  username: string
  activeTab?: string
  onSelectTab?: (tabId: string) => void
  t?: (key: string) => string
}

export const ACCOUNT_USER_TABS = [
  { id: "overview", defaultName: "Overview", icon: IconLayoutDashboard },
  { id: "activity", defaultName: "Activity", icon: IconPlayerPlay },
  { id: "lists", defaultName: "Lists", icon: IconList },
  { id: "favorites", defaultName: "Favorites", icon: IconHeart },
  { id: "friends", defaultName: "Friends", icon: IconUsers },
  { id: "stats", defaultName: "Stats", icon: IconChartBar },
] as const

export function getAccountUserSidebarConfig({
  username,
  activeTab = "overview",
  onSelectTab,
  t,
}: AccountUserSidebarOptions): SidebarConfig {
  const tr = (key: string, fallback: string): string => {
    if (!t) return fallback
    try {
      const res = t(key)
      return res && !res.includes(".") ? res : fallback
    } catch {
      return fallback
    }
  }

  const userBaseHref = `/IRIS-account/users/${username}`

  return [
    // ----------------------------------------------------
    // Mobile Bottom Dock (#$Phone)
    // ----------------------------------------------------
    {
      section: "#$Phone",
      dataKey: "mobile-dock",
      items: ACCOUNT_USER_TABS.slice(0, 4).map((tab, idx) => {
        const Icon = tab.icon
        const isSelected = activeTab === tab.id
        return {
          label: tr(tab.id, tab.defaultName),
          dataKey: `phone-${tab.id}`,
          href: `${userBaseHref}?tab=${tab.id}`,
          icon: <Icon className="size-5" />,
          isActive: isSelected,
          onClick: () => onSelectTab?.(tab.id),
          position: idx + 1,
        }
      }),
    },

    // ----------------------------------------------------
    // Main User Profile Navigation
    // Empty section heading so top/bottom horizontal mode renders directly as segmented pills
    // ----------------------------------------------------
    {
      section: "",
      dataKey: "account-user-tabs",
      items: ACCOUNT_USER_TABS.map((tab, idx) => {
        const Icon = tab.icon
        const isSelected = activeTab === tab.id
        return {
          label: tr(tab.id, tab.defaultName),
          dataKey: tab.id,
          href: `${userBaseHref}?tab=${tab.id}`,
          icon: <Icon className="size-4 shrink-0" />,
          isActive: isSelected,
          onClick: () => onSelectTab?.(tab.id),
          position: idx + 1,
        }
      }),
    },
  ]
}

export function useAccountUserSidebarConfig(
  options: AccountUserSidebarOptions
): SidebarConfig {
  const onSelectTabRef = React.useRef(options.onSelectTab)
  onSelectTabRef.current = options.onSelectTab

  const tRef = React.useRef(options.t)
  tRef.current = options.t

  const stableOnSelectTab = React.useCallback((tabId: string) => {
    onSelectTabRef.current?.(tabId)
  }, [])

  return useMemo(
    () =>
      getAccountUserSidebarConfig({
        username: options.username,
        activeTab: options.activeTab,
        onSelectTab: stableOnSelectTab,
        t: tRef.current,
      }),
    [options.username, options.activeTab, stableOnSelectTab]
  )
}
