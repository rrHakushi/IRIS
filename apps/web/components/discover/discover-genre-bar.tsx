"use client"

import React from "react"
import Link from "next/link"
import { IconX, IconArrowUpRight } from "@tabler/icons-react"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { DiscoverCategory, DiscoverGenre } from "./discover-types"

interface DiscoverGenreBarProps {
  category: DiscoverCategory
  genres: DiscoverGenre[]
  selectedGenre?: string
  onSelectGenre: (genre?: string) => void
}

export function DiscoverGenreBar({
  category,
  genres,
  selectedGenre,
  onSelectGenre,
}: DiscoverGenreBarProps) {
  if (genres.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      {selectedGenre ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onSelectGenre(undefined)}
            className="h-6 gap-1 rounded-2xl px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <IconX className="size-3" />
            <span>Clear filter</span>
          </Button>

          <Link
            href={`/IRIS-list/browse?category=${category}&genre=${encodeURIComponent(selectedGenre)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "xs" }),
              "flex h-6 items-center gap-1 rounded-2xl border-primary/30 px-2 text-xs text-primary hover:bg-primary/10"
            )}
          >
            <span>View in Browse</span>
            <IconArrowUpRight className="size-3 rtl:rotate-90" />
          </Link>
        </div>
      ) : null}

      {/* Genre Pills */}
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-1">
        <Button
          type="button"
          variant={!selectedGenre ? "default" : "secondary"}
          size="sm"
          onClick={() => onSelectGenre(undefined)}
          className={cn(
            "h-7 shrink-0 rounded-2xl px-3 text-xs font-medium transition-colors",
            !selectedGenre
              ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              : "bg-secondary text-secondary-foreground hover:bg-muted"
          )}
        >
          All Genres
        </Button>

        {genres.map((genre) => {
          const isSelected =
            selectedGenre?.toLowerCase() === genre.name.toLowerCase()
          return (
            <Button
              key={genre.id || genre.name}
              type="button"
              variant={isSelected ? "default" : "secondary"}
              size="sm"
              onClick={() => onSelectGenre(isSelected ? undefined : genre.name)}
              className={cn(
                "h-7 shrink-0 rounded-2xl px-3 text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              )}
            >
              {genre.name}
              {genre.count ? (
                <span
                  className={cn(
                    "ms-1 text-[10px] opacity-70",
                    isSelected
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  ({genre.count})
                </span>
              ) : null}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
