"use client"

import React, { useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  IconTheater,
  IconBook,
  IconMovie,
  IconDeviceTv,
  IconDeviceGamepad,
  IconBook2,
  IconMusic,
  IconUser,
  IconUsers,
  IconBuildingStore,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { type BrowseCategory, BROWSE_CATEGORIES } from "@/lib/browse-history"

const CATEGORY_ICONS: Record<
  BrowseCategory,
  React.ComponentType<{ className?: string }>
> = {
  anime: IconTheater,
  manga: IconBook,
  movies: IconMovie,
  tv: IconDeviceTv,
  games: IconDeviceGamepad,
  books: IconBook2,
  music: IconMusic,
  characters: IconUser,
  people: IconUsers,
  studios: IconBuildingStore,
}

interface BrowseCategoryNavProps {
  activeCategory: BrowseCategory
  onSelectCategory: (category: BrowseCategory) => void
  className?: string
}

export function getCategoryLabel(
  cat: BrowseCategory,
  t: (key: string) => string
): string {
  switch (cat) {
    case "anime":
      return t("categories.anime")
    case "manga":
      return t("categories.manga")
    case "movies":
      return t("categories.movies")
    case "tv":
      return t("categories.tv")
    case "games":
      return t("categories.games")
    case "books":
      return t("categories.books")
    case "music":
      return t("categories.music")
    case "characters":
      return t("categories.characters")
    case "people":
      return t("categories.people")
    case "studios":
      return t("categories.studios")
  }
}

export function BrowseCategoryNav({
  activeCategory,
  onSelectCategory,
  className,
}: BrowseCategoryNavProps) {
  const t = useTranslations("browse")
  const containerRef = useRef<HTMLDivElement>(null)
  const activeBtnRef = useRef<HTMLButtonElement>(null)

  // Scroll active category tab into view smoothly
  useEffect(() => {
    if (activeBtnRef.current && containerRef.current) {
      const container = containerRef.current
      const btn = activeBtnRef.current
      const btnLeft = btn.offsetLeft
      const btnWidth = btn.offsetWidth
      const containerWidth = container.offsetWidth

      const targetScroll = btnLeft - containerWidth / 2 + btnWidth / 2
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: "smooth",
      })
    }
  }, [activeCategory])

  return (
    <nav
      aria-label={t("title")}
      className={cn("relative flex items-center overflow-hidden", className)}
    >
      <div
        ref={containerRef}
        role="tablist"
        aria-orientation="horizontal"
        className="-mx-4 no-scrollbar flex max-w-[calc(100%+2rem)] items-center gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:max-w-full sm:px-0"
      >
        {BROWSE_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.key]
          const isActive = activeCategory === cat.key

          return (
            <Button
              key={cat.key}
              ref={isActive ? activeBtnRef : null}
              variant={isActive ? "default" : "secondary"}
              size="sm"
              aria-current={isActive ? "page" : undefined}
              id={`tab-${cat.key}`}
              onPress={() => onSelectCategory(cat.key)}
              onKeyDown={(e) => {
                const tabs = BROWSE_CATEGORIES.map((c) => c.key)
                const currentIndex = tabs.indexOf(activeCategory)
                if (e.key === "ArrowRight") {
                  e.preventDefault()
                  const nextIndex = (currentIndex + 1) % tabs.length
                  onSelectCategory(tabs[nextIndex]!)
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault()
                  const prevIndex =
                    (currentIndex - 1 + tabs.length) % tabs.length
                  onSelectCategory(tabs[prevIndex]!)
                }
              }}
              className={cn(
                "group relative flex h-auto shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-all select-none",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]"
              )}
            >
              <Icon
                className={cn(
                  "size-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
              <span>{getCategoryLabel(cat.key, t)}</span>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
