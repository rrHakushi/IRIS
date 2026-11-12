"use client"

import React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  IconChartBar,
  IconDeviceTv,
  IconDisc,
  IconFileText,
  IconGitBranch,
  IconLayoutGrid,
  IconPhoto,
  IconPlayerPlay,
  IconSparkles,
  IconUserCheck,
  IconUserHeart,
  IconUsers,
  IconUsersGroup,
  type TablerIcon,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import type { MediaTabItem, MediaTabKey } from "./media-types"

const TAB_ICONS: Record<MediaTabKey, TablerIcon> = {
  overview: IconLayoutGrid,
  relations: IconGitBranch,
  characters: IconUserHeart,
  staff: IconUserCheck,
  episodes: IconDeviceTv,
  tracks: IconDisc,
  lyrics: IconFileText,
  images: IconPhoto,
  trailers: IconPlayerPlay,
  stats: IconChartBar,
  friends: IconUsersGroup,
  people: IconUsers,
  recommendations: IconSparkles,
}

interface MediaTabNavProps {
  tabs: MediaTabItem[]
  activeTab: MediaTabKey
  onSelectTab: (tab: MediaTabKey) => void
  embedded?: boolean
  className?: string
}

export function MediaTabNav({
  tabs,
  activeTab,
  onSelectTab,
  embedded = false,
  className,
}: MediaTabNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleTabClick = (key: MediaTabKey) => {
    onSelectTab(key)

    const params = new URLSearchParams(searchParams.toString())
    if (key === "overview") {
      params.delete("tab")
    } else {
      params.set("tab", key)
    }

    const query = params.toString()
    const newUrl = query ? `${pathname}?${query}` : pathname
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", newUrl)
    }
  }

  const navContent = (
    <nav
      suppressHydrationWarning
      className={cn(
        "no-scrollbar flex items-center gap-1 overflow-x-auto py-1",
        className
      )}
      aria-label="Media Sections"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        const TabIcon = TAB_ICONS[tab.key]
        return (
          <button
            key={tab.key}
            type="button"
            suppressHydrationWarning
            onClick={() => handleTabClick(tab.key)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold whitespace-nowrap transition-all duration-150 outline-none select-none backdrop-blur-md",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "border-border bg-background text-foreground shadow-xs dark:border-zinc-700/80 dark:bg-zinc-800/90 dark:text-zinc-100"
                : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            {TabIcon && <TabIcon className="size-3.5 shrink-0" aria-hidden="true" />}
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )

  if (embedded) {
    return navContent
  }

  return (
    <div className="sticky top-0 z-30 w-full border-t border-b border-border/40 bg-background/95 backdrop-blur-md">
      <div className="w-full px-4 sm:px-6 lg:px-8">{navContent}</div>
    </div>
  )
}
