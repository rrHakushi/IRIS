"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { IconHistory, IconMusic, IconDisc } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { BrowseMediaCard } from "./browse-media-card"
import type { BrowseCategory, VisitedMediaItem } from "@/lib/browse-history"

interface BrowseVisitedGridProps {
  items: VisitedMediaItem[]
  category: BrowseCategory
  categoryLabel: string
  onVisit: (item: VisitedMediaItem) => void
  onRemove: (id: number | string, type?: "TRACK" | "ALBUM") => void
  musicType?: "all" | "tracks" | "albums"
  className?: string
}

export function BrowseVisitedGrid({
  items,
  category,
  categoryLabel,
  onVisit,
  onRemove,
  musicType = "all",
  className,
}: BrowseVisitedGridProps) {
  const t = useTranslations("browse")

  if (items.length === 0) {
    return null
  }

  // Music-specific separated view
  if (category === "music") {
    const visitedTracks = items.filter((item) => item.type !== "ALBUM")
    const visitedAlbums = items.filter((item) => item.type === "ALBUM")

    if (musicType === "tracks") {
      if (visitedTracks.length === 0) return null
      return (
        <section aria-label={t("recentlyVisitedTracks")} className={className}>
          <div className="flex items-center justify-between pt-2 pb-3">
            <div className="flex items-center gap-2">
              <IconMusic className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("recentlyVisitedTracks")}
              </h2>
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-semibold"
              >
                {visitedTracks.length}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
            {visitedTracks.map((item) => (
              <BrowseMediaCard
                key={`visited-track-${item.id}-${item.visitedAt}`}
                item={item}
                category={category}
                onVisit={onVisit}
                onRemove={onRemove}
                showRemoveButton={true}
              />
            ))}
          </div>
        </section>
      )
    }

    if (musicType === "albums") {
      if (visitedAlbums.length === 0) return null
      return (
        <section aria-label={t("recentlyVisitedAlbums")} className={className}>
          <div className="flex items-center justify-between pt-2 pb-3">
            <div className="flex items-center gap-2">
              <IconDisc className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("recentlyVisitedAlbums")}
              </h2>
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-semibold"
              >
                {visitedAlbums.length}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
            {visitedAlbums.map((item) => (
              <BrowseMediaCard
                key={`visited-album-${item.id}-${item.visitedAt}`}
                item={item}
                category={category}
                onVisit={onVisit}
                onRemove={onRemove}
                showRemoveButton={true}
              />
            ))}
          </div>
        </section>
      )
    }

    // Default "all": show Tracks and Albums sections
    return (
      <section
        aria-label={t("recentlyVisited", { category: categoryLabel })}
        className={cn("flex flex-col gap-6", className)}
      >
        {visitedTracks.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pt-1">
              <IconMusic className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("recentlyVisitedTracks")}
              </h2>
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-semibold"
              >
                {visitedTracks.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
              {visitedTracks.map((item) => (
                <BrowseMediaCard
                  key={`visited-track-${item.id}-${item.visitedAt}`}
                  item={item}
                  category={category}
                  onVisit={onVisit}
                  onRemove={onRemove}
                  showRemoveButton={true}
                />
              ))}
            </div>
          </div>
        )}

        {visitedAlbums.length > 0 && (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-2">
              <IconDisc className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("recentlyVisitedAlbums")}
              </h2>
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-semibold"
              >
                {visitedAlbums.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
              {visitedAlbums.map((item) => (
                <BrowseMediaCard
                  key={`visited-album-${item.id}-${item.visitedAt}`}
                  item={item}
                  category={category}
                  onVisit={onVisit}
                  onRemove={onRemove}
                  showRemoveButton={true}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    )
  }

  // Non-music categories
  const title = t("recentlyVisited", { category: categoryLabel })

  return (
    <section aria-label={title} className={className}>
      <div className="flex items-center justify-between pt-2 pb-3">
        <div className="flex items-center gap-2">
          <IconHistory className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
        {items.map((item) => (
          <BrowseMediaCard
            key={`${item.id}-${item.visitedAt}`}
            item={item}
            category={category}
            onVisit={onVisit}
            onRemove={onRemove}
            showRemoveButton={true}
          />
        ))}
      </div>
    </section>
  )
}
