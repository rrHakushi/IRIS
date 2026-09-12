"use client"

import React, { useState } from "react"
import Link from "next/link"
import { IconPhotoOff, IconStar } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { DiscoverCategory, DiscoverItem } from "./discover-types"

interface DiscoverMediaCardProps {
  item: DiscoverItem
  category: DiscoverCategory
  className?: string
}

export function DiscoverMediaCard({
  item,
  category,
  className,
}: DiscoverMediaCardProps) {
  const [imageError, setImageError] = useState(false)

  const isSquare =
    category === "music" ||
    item.itemType === "TRACK" ||
    item.itemType === "ALBUM"

  const mediaHref =
    category === "music"
      ? `/IRIS-list/music/${item.itemType?.toLowerCase() === "album" ? "albums" : "tracks"}/${item.id}`
      : `/IRIS-list/${category}/${item.id}`

  return (
    <div
      className={cn(
        "relative flex h-full flex-col justify-between gap-2 rounded-2xl border border-border/40 bg-card p-2 text-start transition-colors hover:border-primary",
        className
      )}
    >
      {/* Poster Image Container - Zero hover animations */}
      <div
        className={cn(
          "relative w-full shrink-0 overflow-hidden rounded-xl bg-muted/30",
          isSquare ? "aspect-square" : "aspect-[2/3]"
        )}
      >
        <Link href={mediaHref} className="absolute inset-0 z-0">
          {item.coverImage && !imageError ? (
            <img
              src={item.coverImage}
              alt={item.titlePrimary}
              loading="lazy"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/40 p-2 text-center text-muted-foreground">
              <IconPhotoOff className="size-6 opacity-40" />
              <span className="line-clamp-2 text-[10px] leading-tight font-medium">
                {item.titlePrimary}
              </span>
            </div>
          )}
        </Link>

        {/* Top Badges */}
        <div className="pointer-events-none absolute inset-x-1.5 top-1.5 z-10 flex items-center justify-between">
          {item.averageScore !== null && item.averageScore !== undefined ? (
            <Badge
              variant="secondary"
              className="pointer-events-auto h-5 gap-0.5 rounded-2xl border border-border/40 bg-background/85 px-1.5 text-[10px] font-semibold text-foreground backdrop-blur-md"
            >
              <IconStar className="size-2.5 fill-amber-400 text-amber-400" />
              <span>{item.averageScore.toFixed(1)}</span>
            </Badge>
          ) : (
            <span />
          )}

          {item.format ? (
            <Badge
              variant="outline"
              className="pointer-events-auto h-5 rounded-2xl border-border/40 bg-background/80 px-1.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm"
            >
              {item.format}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Metadata / Titles */}
      <div className="flex flex-col justify-end gap-0.5 px-1 pb-1">
        <Link
          href={mediaHref}
          className="block h-5 truncate font-heading text-xs leading-5 font-medium text-foreground hover:text-primary sm:text-sm"
          title={item.titlePrimary}
        >
          {item.titlePrimary}
        </Link>

        <div className="flex h-4 items-center gap-1 truncate text-[11px] leading-4 text-muted-foreground">
          {item.artistName ? (
            <span className="truncate">{item.artistName}</span>
          ) : item.releaseYear ? (
            <span className="shrink-0">{item.releaseYear}</span>
          ) : null}

          {item.genres && item.genres.length > 0 ? (
            <>
              {(item.artistName || item.releaseYear) && (
                <span className="shrink-0 text-muted-foreground/40">•</span>
              )}
              <span className="truncate text-[11px] text-muted-foreground/80">
                {item.genres[0]}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
