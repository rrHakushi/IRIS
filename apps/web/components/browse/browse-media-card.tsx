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
    queuedForFetch?: boolean
    type?: "TRACK" | "ALBUM"
    artist?: string | null
    album?: string | null
    duration?: number | null
    audioPreviewUrl?: string | null
    explicitLyrics?: boolean | null
  }
  category: BrowseCategory
  onVisit?: (item: VisitedMediaItem) => void
  onRemove?: (id: number | string, type?: "TRACK" | "ALBUM") => void
  showRemoveButton?: boolean
  className?: string
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return ""
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
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

  const isSquare =
    category === "music" || item.type === "TRACK" || item.type === "ALBUM"

  const isAlbum = item.type?.toUpperCase() === "ALBUM"
  const musicSubpath = isAlbum ? "albums" : "tracks"
  const queuedParam = item.queuedForFetch ? "?queuedFetch=true" : ""
  const href =
    category === "music"
      ? `/IRIS-list/music/${musicSubpath}/${item.id}${queuedParam}`
      : item.queuedForFetch
        ? `/IRIS-list/${category}/${item.id}?queuedFetch=true`
        : `/IRIS-list/${category}/${item.id}`

  const handleClick = () => {
    onVisit?.({
      id: item.id,
      title: item.title,
      coverImage: item.coverImage,
      format: item.format,
      year: item.year,
      queuedForFetch: item.queuedForFetch,
      type: item.type,
      artist: item.artist,
      album: item.album,
      audioPreviewUrl: item.audioPreviewUrl,
      explicitLyrics: item.explicitLyrics,
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
        <div
          className={cn(
            "relative w-full overflow-hidden bg-muted",
            isSquare ? "aspect-square" : "aspect-[2/3]"
          )}
        >
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
            {item.explicitLyrics && (
              <Badge
                variant="outline"
                className="border-transparent bg-foreground/80 px-1 py-0 text-[9px] font-bold text-background backdrop-blur-xs"
                title="Explicit Lyrics"
              >
                E
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
            {item.duration && (
              <Badge
                variant="outline"
                className="border-transparent bg-foreground/75 px-1.5 py-0 text-[10px] font-semibold text-background backdrop-blur-xs"
              >
                {formatDuration(item.duration)}
              </Badge>
            )}
          </div>

          {/* Queued For Fetch Badge */}
          {item.queuedForFetch && (
            <div
              className="absolute inset-x-1.5 bottom-1.5 z-10 flex"
              title={t("fetchingFullDataTooltip")}
            >
              <Badge
                variant="outline"
                className="w-full justify-center border-amber-500/40 bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-medium text-amber-950 shadow-xs backdrop-blur-md dark:border-amber-400/30 dark:bg-amber-500/25 dark:text-amber-200"
              >
                <span className="truncate">{t("fetchingFullData")}</span>
              </Badge>
            </div>
          )}
        </div>

        {/* Card Metadata */}
        <div className="flex flex-1 flex-col p-2.5">
          <h3
            title={item.title}
            className="line-clamp-2 text-xs leading-tight font-medium text-foreground"
          >
            {item.title}
          </h3>
          {item.artist && (
            <p
              title={
                !isAlbum && item.album
                  ? `${item.artist} • ${item.album}`
                  : item.artist
              }
              className="mt-1 line-clamp-1 text-[11px] text-muted-foreground"
            >
              <span>{item.artist}</span>
              {!isAlbum && item.album && (
                <span className="opacity-75"> • {item.album}</span>
              )}
            </p>
          )}
        </div>
      </Link>

      {/* Remove Button for Visited Grid */}
      {showRemoveButton && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onPress={() => {
            onRemove(item.id, item.type)
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
