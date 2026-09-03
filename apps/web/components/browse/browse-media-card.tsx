"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { IconPhotoOff, IconX } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { BrowseCategory, VisitedMediaItem } from "@/lib/browse-history"

interface BrowseMediaCardProps {
  item: {
    id: number | string
    title: string
    coverImage?: string | null
    format?: string | null
    year?: number | string | null
  }
  category: BrowseCategory
  onVisit?: (item: VisitedMediaItem) => void
  onRemove?: (id: number | string) => void
  showRemoveButton?: boolean
  className?: string
}

export function BrowseMediaCard({
  item,
  category,
  onVisit,
  onRemove,
  showRemoveButton = false,
  className,
}: BrowseMediaCardProps) {
  const t = useTranslations("browse")
  const [imageError, setImageError] = useState(false)
  const href = `/IRIS-list/media/${category}/${item.id}`

  const handleClick = () => {
    onVisit?.({
      id: item.id,
      title: item.title,
      coverImage: item.coverImage,
      format: item.format,
      year: item.year,
      visitedAt: Date.now(),
    })
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card",
        className
      )}
    >
      <Link
        href={href}
        onClick={handleClick}
        className="flex flex-1 flex-col rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {/* Cover Image Container */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
          {item.coverImage && !imageError ? (
            <img
              src={item.coverImage}
              alt={item.title}
              loading="lazy"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-muted-foreground/60">
              <IconPhotoOff className="size-8" aria-hidden="true" />
              <span className="text-center text-[10px] font-medium">
                {t("noImage")}
              </span>
            </div>
          )}

          {/* Badges Overlay */}
          <div className="absolute start-2 top-2 flex flex-wrap gap-1">
            {item.format && (
              <Badge
                variant="secondary"
                className="bg-background/85 px-1.5 py-0 text-[10px] font-semibold tracking-wider uppercase shadow-xs backdrop-blur-xs"
              >
                {item.format}
              </Badge>
            )}
            {item.year && (
              <Badge
                variant="outline"
                className="border-transparent bg-foreground/75 px-1.5 py-0 text-[10px] font-semibold text-background backdrop-blur-xs"
              >
                {item.year}
              </Badge>
            )}
          </div>
        </div>

        {/* Card Metadata */}
        <div className="flex flex-1 flex-col p-2.5">
          <h3
            title={item.title}
            className="line-clamp-2 text-xs leading-tight font-medium text-foreground"
          >
            {item.title}
          </h3>
        </div>
      </Link>

      {/* Remove Button for Visited Grid */}
      {showRemoveButton && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onPress={() => {
            onRemove(item.id)
          }}
          aria-label={t("removeFromVisited", { title: item.title })}
          className="hover:text-destructive-foreground absolute end-1.5 top-1.5 z-10 size-6 rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-xs transition-opacity duration-150 group-hover:opacity-100 hover:bg-destructive focus-visible:opacity-100"
        >
          <IconX className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
