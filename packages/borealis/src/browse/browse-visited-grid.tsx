"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { IconHistory, IconMusic, IconDisc, IconX } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { BorealisCard, BorealisCardGroup, type BorealisEntityType } from "@NamelessLiberty/borealis"
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

  const renderVisitedCard = (item: VisitedMediaItem) => {
    const isAlbum = item.type?.toUpperCase() === "ALBUM"
    const musicSubpath = isAlbum ? "albums" : "tracks"
    const queuedParam = item.queuedForFetch ? "?queuedFetch=true" : ""
    const href =
      category === "music"
        ? `/borealis/music/${musicSubpath}/${item.id}${queuedParam}`
        : item.queuedForFetch
          ? `/borealis/${category}/${item.id}?queuedFetch=true`
          : `/borealis/${category}/${item.id}`

    const rawData = item.raw ?? item
    const cardData = {
      ...rawData,
      id: item.id,
      titlePrimary: item.titlePrimary ?? rawData.titlePrimary ?? item.title,
      titleSecondary: item.titleSecondary ?? rawData.titleSecondary,
      titleNative: item.titleNative ?? rawData.titleNative,
      coverImage: item.coverImage ?? rawData.coverImage,
      bannerImage: item.bannerImage ?? rawData.bannerImage,
      description: item.description ?? rawData.description,
      gender: item.gender ?? rawData.gender,
      age: item.age ?? rawData.age,
      format: item.format ?? rawData.format,
      seasonYear:
        item.seasonYear ??
        item.year ??
        rawData.seasonYear ??
        rawData.startDateYear,
      averageScore: item.averageScore ?? rawData.averageScore,
      chapterCount: item.chapterCount ?? rawData.chapterCount,
      episodeCount: item.episodeCount ?? rawData.episodeCount,
      volumeCount: item.volumeCount ?? rawData.volumeCount,
      status: item.status ?? rawData.status,
      genres: item.genres ?? rawData.genres ?? [],
      studios: item.studios ?? rawData.studios ?? [],
      queuedForFetch: item.queuedForFetch ?? rawData.queuedForFetch,
      subtext: item.artist
        ? !isAlbum && item.album
          ? `${item.artist} • ${item.album}`
          : item.artist
        : rawData.subtext,
    }

    return (
      <div
        key={`${item.id}-${item.visitedAt}`}
        className="group relative flex flex-col w-full"
        onClick={() => onVisit(item)}
      >
        <BorealisCard
          type={category as BorealisEntityType}
          href={href}
          data={cardData}
          showSubtitle={false}
          showExtras={false}
          className="w-full"
        />
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onPress={() => onRemove(item.id, item.type)}
            aria-label={t("removeFromVisited", { title: item.title })}
            className="hover:text-destructive-foreground absolute end-2 top-2 z-30 size-6 cursor-pointer rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-xs transition-opacity duration-150 group-hover:opacity-100 hover:bg-destructive focus-visible:opacity-100"
          >
            <IconX className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    )
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

          <BorealisCardGroup grid variant="none" gap="md" className="w-full">
            {visitedTracks.map((item) => renderVisitedCard(item))}
          </BorealisCardGroup>
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

          <BorealisCardGroup grid variant="none" gap="md" className="w-full">
            {visitedAlbums.map((item) => renderVisitedCard(item))}
          </BorealisCardGroup>
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
            <BorealisCardGroup grid variant="none" gap="md" className="w-full">
              {visitedTracks.map((item) => renderVisitedCard(item))}
            </BorealisCardGroup>
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
            <BorealisCardGroup grid variant="none" gap="md" className="w-full">
              {visitedAlbums.map((item) => renderVisitedCard(item))}
            </BorealisCardGroup>
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

      <BorealisCardGroup grid variant="none" gap="md" className="w-full">
        {items.map((item) => renderVisitedCard(item))}
      </BorealisCardGroup>
    </section>
  )
}
