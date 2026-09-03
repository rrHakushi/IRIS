"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { IconSearchOff } from "@tabler/icons-react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { BrowseMediaCard } from "./browse-media-card"
import type { BrowseCategory, VisitedMediaItem } from "@/lib/browse-history"

export interface SearchResultItem {
  id: number | string
  title: string
  coverImage?: string | null
  format?: string | null
  year?: number | string | null
}

interface BrowseSearchResultsProps {
  results: SearchResultItem[]
  query: string
  category: BrowseCategory
  categoryLabel: string
  isLoading: boolean
  onVisit: (item: VisitedMediaItem) => void
  className?: string
}

export function BrowseSearchResults({
  results,
  query,
  category,
  categoryLabel,
  isLoading,
  onVisit,
  className,
}: BrowseSearchResultsProps) {
  const t = useTranslations("browse")

  if (isLoading) {
    return (
      <section aria-label="Search Results Loading" className={className}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-2xl border border-border/40 p-2"
            >
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (results.length === 0) {
    return (
      <section
        aria-label="No Results Found"
        className="my-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 p-12 text-center text-muted-foreground"
      >
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          <IconSearchOff className="size-7 stroke-[1.5]" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {t("noResultsTitle", {
            category: categoryLabel.toLowerCase(),
            query,
          })}
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {t("noResultsDesc")}
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Search Results" className={className}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
        {results.map((item) => (
          <BrowseMediaCard
            key={item.id}
            item={item}
            category={category}
            onVisit={onVisit}
          />
        ))}
      </div>
    </section>
  )
}
