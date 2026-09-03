"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { IconHistory } from "@tabler/icons-react"
import { BrowseMediaCard } from "./browse-media-card"
import type { BrowseCategory, VisitedMediaItem } from "@/lib/browse-history"

interface BrowseVisitedGridProps {
  items: VisitedMediaItem[]
  category: BrowseCategory
  categoryLabel: string
  onVisit: (item: VisitedMediaItem) => void
  onRemove: (id: number | string) => void
  className?: string
}

export function BrowseVisitedGrid({
  items,
  category,
  categoryLabel,
  onVisit,
  onRemove,
  className,
}: BrowseVisitedGridProps) {
  const t = useTranslations("browse")

  if (items.length === 0) {
    return null
  }

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
