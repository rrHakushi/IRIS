"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { IconSearchOff, IconMusic, IconDisc } from "@tabler/icons-react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { BrowseMediaCard } from "./browse-media-card"
import type { BrowseCategory, VisitedMediaItem } from "@/lib/browse-history"

export interface SearchResultItem {
  id: number | string
  title: string
  coverImage?: string | null
  format?: string | null
  year?: number | string | null
  queuedForFetch?: boolean
  type?: "TRACK" | "ALBUM"
  artist?: string | null
  album?: string | null
  duration?: number | null
  audioPreviewUrl?: string | null
  explicitLyrics?: boolean | null
}

interface BrowseSearchResultsProps {
  results: SearchResultItem[]
  query: string
  category: BrowseCategory
  categoryLabel: string
  isLoading: boolean
  onVisit: (item: VisitedMediaItem) => void
  musicType?: "all" | "tracks" | "albums"
  className?: string
}

export function BrowseSearchResults({
  results,
  query,
  category,
  categoryLabel,
  isLoading,
  onVisit,
  musicType = "all",
  className,
}: BrowseSearchResultsProps) {
  const t = useTranslations("browse")
  const isMusic = category === "music"

  if (isLoading) {
    return (
      <section aria-label="Search Results Loading" className={className}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-2xl border border-border/40 p-2"
            >
              <Skeleton
                className={cn(
                  "w-full rounded-xl",
                  isMusic ? "aspect-square" : "aspect-[2/3]"
                )}
              />
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

  // Music-specific separated view
  if (isMusic) {
    const trackResults = results.filter((r) => r.type !== "ALBUM")
    const albumResults = results.filter((r) => r.type === "ALBUM")

    if (musicType === "tracks") {
      if (trackResults.length === 0) {
        return (
          <section
            aria-label="No Tracks Found"
            className="my-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 p-12 text-center text-muted-foreground"
          >
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <IconSearchOff className="size-7 stroke-[1.5]" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("noTracksFound", { query })}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {t("noResultsDesc")}
            </p>
          </section>
        )
      }

      return (
        <section aria-label="Track Search Results" className={className}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
            {trackResults.map((item) => (
              <BrowseMediaCard
                key={`track-${item.id}`}
                item={item}
                category={category}
                onVisit={onVisit}
              />
            ))}
          </div>
        </section>
      )
    }

    if (musicType === "albums") {
      if (albumResults.length === 0) {
        return (
          <section
            aria-label="No Albums Found"
            className="my-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 p-12 text-center text-muted-foreground"
          >
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <IconSearchOff className="size-7 stroke-[1.5]" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("noAlbumsFound", { query })}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {t("noResultsDesc")}
            </p>
          </section>
        )
      }

      return (
        <section aria-label="Album Search Results" className={className}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
            {albumResults.map((item) => (
              <BrowseMediaCard
                key={`album-${item.id}`}
                item={item}
                category={category}
                onVisit={onVisit}
              />
            ))}
          </div>
        </section>
      )
    }

    // Default "all": Separate into Tracks and Albums sections
    return (
      <section aria-label="Music Search Results" className={cn("flex flex-col gap-6", className)}>
        {/* Tracks Section */}
        {trackResults.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <IconMusic className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("tracks")}
              </h2>
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-semibold"
              >
                {trackResults.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
              {trackResults.map((item) => (
                <BrowseMediaCard
                  key={`track-${item.id}`}
                  item={item}
                  category={category}
                  onVisit={onVisit}
                />
              ))}
            </div>
          </div>
        )}

        {/* Albums Section */}
        {albumResults.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <IconDisc className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {t("albums")}
              </h2>
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] font-semibold"
              >
                {albumResults.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:gap-4">
              {albumResults.map((item) => (
                <BrowseMediaCard
                  key={`album-${item.id}`}
                  item={item}
                  category={category}
                  onVisit={onVisit}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    )
  }

  // Generic non-music search results
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
