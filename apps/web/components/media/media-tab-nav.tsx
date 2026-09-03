"use client"

import React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import type { MediaTabItem, MediaTabKey } from "./media-types"

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
  const router = useRouter()
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
    router.replace(newUrl, { scroll: false })
  }

  const navContent = (
    <nav
      className={cn(
        "no-scrollbar flex items-center gap-1 overflow-x-auto py-1",
        className
      )}
      aria-label="Media Sections"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabClick(tab.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors outline-none select-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && tab.count > 0 && (
              <span
                className={cn(
                  "py-0.2 rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{navContent}</div>
    </div>
  )
}
