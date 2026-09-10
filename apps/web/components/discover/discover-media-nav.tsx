"use client"

import React from "react"
import Link from "next/link"
import {
  IconTheater,
  IconBook,
  IconMovie,
  IconDeviceTv,
  IconDeviceGamepad,
  IconBook2,
  IconMusic,
  IconSearch,
} from "@tabler/icons-react"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { type DiscoverCategory, DISCOVER_MEDIA_METAS } from "./discover-types"

interface DiscoverMediaNavProps {
  activeCategory: DiscoverCategory
}

const CATEGORY_ICON_MAP: Record<DiscoverCategory, React.ReactNode> = {
  anime: <IconTheater className="size-4 shrink-0" />,
  manga: <IconBook className="size-4 shrink-0" />,
  movies: <IconMovie className="size-4 shrink-0" />,
  tv: <IconDeviceTv className="size-4 shrink-0" />,
  games: <IconDeviceGamepad className="size-4 shrink-0" />,
  books: <IconBook2 className="size-4 shrink-0" />,
  music: <IconMusic className="size-4 shrink-0" />,
}

export function DiscoverMediaNav({ activeCategory }: DiscoverMediaNavProps) {
  return (
    <div className="flex w-full items-center justify-between gap-3 border-b border-border/50 pb-3">
      {/* Scrollable Media Tabs */}
      <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
        {DISCOVER_MEDIA_METAS.map((item) => {
          const isActive = item.key === activeCategory
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                buttonVariants({
                  variant: isActive ? "default" : "ghost",
                  size: "sm",
                }),
                "flex h-8 shrink-0 items-center gap-1.5 rounded-2xl px-3.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {CATEGORY_ICON_MAP[item.key]}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Jump to full search/browse shortcut */}
      <div className="hidden shrink-0 items-center sm:flex">
        <Link
          href={`/IRIS-list/browse?category=${activeCategory}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex h-8 items-center gap-1.5 rounded-2xl border-border/60 px-3 text-xs text-muted-foreground hover:text-foreground"
          )}
        >
          <IconSearch className="size-3.5" />
          <span>Search in Browse</span>
        </Link>
      </div>
    </div>
  )
}
