"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  IconStar,
  IconPhotoOff,
  IconBuildingSkyscraper,
  IconUserHeart,
  IconUserCheck,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import type { DiscoverCategory, DiscoverItem } from "./discover-types"

export interface DiscoverMediaCardProps {
  item: DiscoverItem
  category: DiscoverCategory
  mediaTitlePreference?: "primary" | "secondary" | "native"
  priority?: boolean
  className?: string
}

function getMediaDetailHref(
  category: DiscoverCategory,
  item: DiscoverItem
): string {
  switch (category) {
    case "anime":
      return `/IRIS-list/anime/${item.id}`
    case "manga":
      return `/IRIS-list/manga/${item.id}`
    case "movies":
      return `/IRIS-list/movies/${item.id}`
    case "tv":
      return `/IRIS-list/tv/${item.id}`
    case "games":
      return `/IRIS-list/games/${item.id}`
    case "books":
      return `/IRIS-list/books/${item.id}`
    case "music":
      if (item.itemType === "ALBUM" || !item.duration) {
        return `/IRIS-list/music/album/${item.id}`
      }
      return `/IRIS-list/music/track/${item.id}`
    case "characters":
      return `/IRIS-list/characters/${item.id}`
    case "staff":
      return `/IRIS-list/people/${item.id}`
    case "studios":
      return `/IRIS-list/studios/${item.id}`
    default:
      return `/IRIS-list/anime/${item.id}`
  }
}

export function DiscoverMediaCard({
  item,
  category,
  mediaTitlePreference = "primary",
  priority = false,
  className,
}: DiscoverMediaCardProps): React.JSX.Element {
  const [imgError, setImgError] = useState(false)

  const title = (() => {
    if (mediaTitlePreference === "native" && item.titleNative) {
      return item.titleNative
    }
    if (mediaTitlePreference === "secondary" && item.titleSecondary) {
      return item.titleSecondary
    }
    return item.titlePrimary || item.titleSecondary || "Untitled"
  })()

  const href = getMediaDetailHref(category, item)
  const isMusic = category === "music"

  const scoreFormatted =
    item.averageScore !== null && item.averageScore !== undefined
      ? (item.averageScore > 10
          ? item.averageScore / 10
          : item.averageScore
        ).toFixed(1)
      : null

  const yearOrSeason = (() => {
    if (item.seasonSeason && item.releaseYear) {
      return `${item.seasonSeason.slice(0, 3)} ${item.releaseYear}`
    }
    return item.releaseYear ? String(item.releaseYear) : null
  })()

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 transition-all duration-200 select-none hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
        className
      )}
    >
      {/* Cover Image Container */}
      <div
        className={cn(
          "relative w-full overflow-hidden bg-muted/40",
          isMusic ? "aspect-square" : "aspect-[2/3]"
        )}
      >
        {item.coverImage && !imgError ? (
          <Image
            src={item.coverImage}
            alt={title}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, (max-width: 1280px) 16vw, 12vw"
            priority={priority}
            onError={() => setImgError(true)}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground/60">
            {category === "studios" ? (
              <IconBuildingSkyscraper className="size-8 stroke-[1.5] text-muted-foreground/50" />
            ) : category === "characters" ? (
              <IconUserHeart className="size-8 stroke-[1.5] text-muted-foreground/50" />
            ) : category === "staff" ? (
              <IconUserCheck className="size-8 stroke-[1.5] text-muted-foreground/50" />
            ) : (
              <IconPhotoOff className="size-6" />
            )}
            <span className="text-[10px] font-medium">
              {category === "studios"
                ? "Studio"
                : category === "characters"
                  ? "Character"
                  : category === "staff"
                    ? "Staff"
                    : "No Image"}
            </span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Top Badges: Score & Format */}
        <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between gap-1">
          {item.format ? (
            <Badge
              variant="secondary"
              className="h-5 rounded-md border-none bg-black/60 px-1.5 text-[10px] font-semibold text-white/90 backdrop-blur-md"
            >
              {item.format.replace(/_/g, " ")}
            </Badge>
          ) : (
            <span />
          )}

          {scoreFormatted ? (
            <Badge
              variant="secondary"
              className="flex h-5 items-center gap-1 rounded-md border-none bg-black/60 px-1.5 text-[10px] font-bold text-amber-300 backdrop-blur-md"
            >
              <IconStar className="size-3 fill-amber-300 text-amber-300" />
              <span>{scoreFormatted}</span>
            </Badge>
          ) : null}
        </div>

        {/* Bottom Year / Season Pill on hover overlay */}
        {yearOrSeason && (
          <div className="absolute start-1.5 bottom-1.5 opacity-90 transition-opacity">
            <span className="rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white/90 backdrop-blur-md">
              {yearOrSeason}
            </span>
          </div>
        )}
      </div>

      {/* Card Info Details */}
      <div className="flex flex-1 flex-col justify-between gap-1 p-2 sm:p-2.5">
        <h3
          title={title}
          className="line-clamp-2 text-xs font-semibold text-foreground transition-colors group-hover:text-primary sm:text-sm"
        >
          {title}
        </h3>

        {/* Artist name for music or Primary Genre */}
        {item.artistName ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            {item.artistName}
          </p>
        ) : item.genres && item.genres.length > 0 ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            {item.genres.slice(0, 2).join(", ")}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
