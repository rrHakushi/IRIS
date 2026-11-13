"use client"

import React, { memo } from "react"
import {
  IconWorld,
  IconPhoto,
  IconPlayerPlay,
  IconNews,
  IconMap,
  IconMusic,
  IconCode,
  IconAtom,
  IconFolder,
  IconUsers,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import type { SearchCategoryItem } from "./types"

export const CATEGORIES: SearchCategoryItem[] = [
  { id: "general", label: "General", icon: IconWorld },
  { id: "images", label: "Images", icon: IconPhoto },
  { id: "videos", label: "Videos", icon: IconPlayerPlay },
  { id: "news", label: "News", icon: IconNews },
  { id: "map", label: "Map", icon: IconMap },
  { id: "music", label: "Music", icon: IconMusic },
  { id: "it", label: "IT", icon: IconCode },
  { id: "science", label: "Science", icon: IconAtom },
  { id: "files", label: "Files", icon: IconFolder },
  { id: "social_media", label: "Social", icon: IconUsers },
]

export interface KiroshiCategoryTabsProps {
  activeCategory: string
  onSelectCategory: (categoryId: string) => void
  className?: string
}

export const KiroshiCategoryTabs = memo(function KiroshiCategoryTabs({
  activeCategory,
  onSelectCategory,
  className,
}: KiroshiCategoryTabsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Search categories"
      className={cn(
        "flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-border/30 pt-0.5 sm:pt-1 -mx-3 px-3 sm:mx-0 sm:px-0",
        className
      )}
    >
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon
        const isActive = activeCategory === cat.id
        return (
          <button
            key={cat.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors shrink-0",
              isActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5 sm:size-4 shrink-0" />
            <span>{cat.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full transition-all" />
            )}
          </button>
        )
      })}
    </div>
  )
})
