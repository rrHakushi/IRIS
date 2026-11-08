"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { IconSearchOff, IconMusic, IconDisc } from "@tabler/icons-react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { BorealisCard, BorealisCardGroup, type BorealisEntityType } from "@Runa/borealis"
import type { BrowseCategory, VisitedMediaItem } from "@/lib/browse-history"

export interface SearchResultItem {
  id: number | string
  title: string
  titlePrimary?: string | null
  titleNative?: string | null
  titleSecondary?: string | null
  coverImage?: string | null
  bannerImage?: string | null
  format?: string | null
  status?: string | null
  year?: number | string | null
  seasonYear?: number | null
  averageScore?: number | null
  episodeCount?: number | null
  chapterCount?: number | null
  volumeCount?: number | null
  genres?: any[]
  studios?: any[]
  queuedForFetch?: boolean
  type?: "TRACK" | "ALBUM"
  artist?: string | null
  album?: string | null
  duration?: number | null
  audioPreviewUrl?: string | null
  explicitLyrics?: boolean | null
  description?: string | null
  gender?: string | null
  age?: string | number | null
  raw?: any
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
        <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4 w-full">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-2xl border border-frost bg-frost p-2 shadow-xs backdrop-blur-md"
            >
              <Skeleton
                className={cn(
                  "w-full rounded-xl",
                  isMusic ? "aspect-square" : "aspect-[2/3]"
                )}
              />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-full rounded-md" />
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

  const renderItemCard = (item: SearchResultItem) => {
    const isAlbum = item.type?.toUpperCase() === "ALBUM"
    const musicSubpath = isAlbum ? "albums" : "tracks"
    const queuedParam = item.queuedForFetch ? "?queuedFetch=true" : ""
    const href =
      category === "music"
        ? `/borealis/music/${musicSubpath}/${item.id}${queuedParam}`
        : item.queuedForFetch
          ? `/borealis/${category}/${item.id}?queuedFetch=true`
          : `/borealis/${category}/${item.id}`

    const handleVisitClick = () => {
      onVisit({
        id: item.id,
        title: item.title,
        titlePrimary: item.titlePrimary ?? item.title,
        titleNative: item.titleNative ?? null,
        titleSecondary: item.titleSecondary ?? null,
        coverImage: item.coverImage ?? null,
        bannerImage: item.bannerImage ?? null,
        description: item.description ?? null,
        format: item.format ?? null,
        status: item.status ?? null,
        year: item.year ?? null,
        seasonYear:
          item.seasonYear ??
          (typeof item.year === "number" ? item.year : null),
        averageScore: item.averageScore ?? null,
        chapterCount: item.chapterCount ?? null,
        episodeCount: item.episodeCount ?? null,
        volumeCount: item.volumeCount ?? null,
        genres: item.genres ?? [],
        studios: item.studios ?? [],
        queuedForFetch: Boolean(item.queuedForFetch),
        type: item.type,
        artist: item.artist ?? null,
        album: item.album ?? null,
        duration: item.duration ?? null,
        audioPreviewUrl: item.audioPreviewUrl ?? null,
        explicitLyrics: item.explicitLyrics ?? null,
        gender: item.gender ?? null,
        age: item.age ?? null,
        visitedAt: Date.now(),
        raw: item.raw ?? item,
      })
    }

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
      <div key={item.id} onClick={handleVisitClick} className="w-full">
        <BorealisCard
          type={category as BorealisEntityType}
          href={href}
          data={cardData}
          showSubtitle={false}
          showExtras={false}
          className="w-full"
        />
      </div>
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
              <IconSearchOff
                className="size-7 stroke-[1.5]"
                aria-hidden="true"
              />
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
          <BorealisCardGroup grid variant="none" gap="md" className="w-full">
            {trackResults.map((item) => renderItemCard(item))}
          </BorealisCardGroup>
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
              <IconSearchOff
                className="size-7 stroke-[1.5]"
                aria-hidden="true"
              />
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
          <BorealisCardGroup grid variant="none" gap="md" className="w-full">
            {albumResults.map((item) => renderItemCard(item))}
          </BorealisCardGroup>
        </section>
      )
    }

    // Default "all": Separate into Tracks and Albums sections
    return (
      <section
        aria-label="Music Search Results"
        className={cn("flex flex-col gap-6", className)}
      >
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
            <BorealisCardGroup grid variant="none" gap="md" className="w-full">
              {trackResults.map((item) => renderItemCard(item))}
            </BorealisCardGroup>
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
            <BorealisCardGroup grid variant="none" gap="md" className="w-full">
              {albumResults.map((item) => renderItemCard(item))}
            </BorealisCardGroup>
          </div>
        )}
      </section>
    )
  }

  // Generic non-music search results
  return (
    <section aria-label="Search Results" className={className}>
      <BorealisCardGroup grid variant="none" gap="md" className="w-full">
        {results.map((item) => renderItemCard(item))}
      </BorealisCardGroup>
    </section>
  )
}
