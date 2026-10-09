import React, { useMemo } from "react"
import type { SidebarConfig } from "@/types/sidebar-config"
import {
  IconSearch,
  IconHistory,
  IconSparkles,
  IconWorld,
  IconPhoto,
  IconNews,
} from "@tabler/icons-react"
import { Session } from "next-auth"

export function getSearchSidebarConfig(
  session: Session | null,
  t?: (key: string) => string
): SidebarConfig {
  const tr = (key: string, fallback: string) => {
    if (!t) return fallback
    try {
      const res = t(key)
      return res && !res.includes(".") ? res : fallback
    } catch {
      return fallback
    }
  }

  return [
    // ----------------------------------------------------
    // Mobile-Only Bottom Dock (#$Phone)
    // ----------------------------------------------------
    {
      section: "#$Phone",
      dataKey: "mobile-dock",
      items: [
        {
          label: tr("search", "Search"),
          dataKey: "phone-search",
          href: "/IRIS-search",
          icon: <IconSearch className="size-5" />,
          position: 1,
        },
        {
          label: tr("history", "History"),
          dataKey: "phone-history",
          href: "/IRIS-search?view=history",
          icon: <IconHistory className="size-5" />,
          position: 2,
        },
      ],
    },

    // ----------------------------------------------------
    // Discover Section
    // ----------------------------------------------------
    {
      section: tr("explore", "Search"),
      dataKey: "search-section",
      items: [
        {
          label: tr("webSearch", "Web Search"),
          dataKey: "search-web",
          href: "/IRIS-search",
          icon: <IconSearch className="size-4" />,
          position: 1,
        },
        {
          label: tr("history", "Search History"),
          dataKey: "search-history",
          href: "/IRIS-search?view=history",
          icon: <IconHistory className="size-4" />,
          position: 2,
        },
      ],
    },

    // ----------------------------------------------------
    // Quick Categories Section
    // ----------------------------------------------------
    {
      section: tr("categories", "Categories"),
      dataKey: "categories-section",
      items: [
        {
          label: tr("general", "General"),
          dataKey: "cat-general",
          href: "/IRIS-search?category=general",
          icon: <IconWorld className="size-4" />,
          position: 1,
        },
        {
          label: tr("images", "Images"),
          dataKey: "cat-images",
          href: "/IRIS-search?category=images",
          icon: <IconPhoto className="size-4" />,
          position: 2,
        },
        {
          label: tr("news", "News"),
          dataKey: "cat-news",
          href: "/IRIS-search?category=news",
          icon: <IconNews className="size-4" />,
          position: 3,
        },
      ],
    },
  ]
}

export function useSearchSidebarConfig(session: Session | null): SidebarConfig {
  return useMemo(() => getSearchSidebarConfig(session), [session])
}
