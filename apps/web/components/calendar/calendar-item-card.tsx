"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  IconDeviceTv,
  IconBook2,
  IconMovie,
  IconDeviceGamepad2,
  IconBook,
  IconMusic,
  IconSparkles,
  IconClock,
  IconBookmark,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import type { CalendarItem, CalendarMediaType } from "./calendar-types"
import {
  getMediaHref,
  getMediaTypeColor,
  formatReleaseTime,
} from "./calendar-utils"

export function getMediaIcon(
  mediaType: CalendarMediaType,
  className = "size-3.5"
) {
  switch (mediaType) {
    case "anime":
      return <IconSparkles className={className} />
    case "manga":
      return <IconBook2 className={className} />
    case "tv":
      return <IconDeviceTv className={className} />
    case "movie":
      return <IconMovie className={className} />
    case "game":
      return <IconDeviceGamepad2 className={className} />
    case "book":
      return <IconBook className={className} />
    case "music":
      return <IconMusic className={className} />
  }
}

interface CalendarItemCardProps {
  item: CalendarItem
  variant?: "compact" | "detailed" | "agenda"
  titlePreference?: "primary" | "secondary" | "native"
  onClick?: () => void
}

export function CalendarItemCard({
  item,
  variant = "compact",
  titlePreference = "primary",
  onClick,
}: CalendarItemCardProps) {
  const href = getMediaHref(item.mediaType, item.mediaId)
  const color = getMediaTypeColor(item.mediaType)
  const time = formatReleaseTime(item.releaseDate)

  const displayTitle =
    titlePreference === "secondary" && item.titleSecondary
      ? item.titleSecondary
      : titlePreference === "native" && item.titleNative
        ? item.titleNative
        : item.title

  const altTitle =
    displayTitle !== item.title
      ? item.title
      : item.titleSecondary && item.titleSecondary !== displayTitle
        ? item.titleSecondary
        : item.titleNative && item.titleNative !== displayTitle
          ? item.titleNative
          : null

  // Compact variant: used in Month view day cells
  if (variant === "compact") {
    return (
      <TooltipTrigger>
        <Link
          href={href}
          onClick={onClick}
          className={cn(
            "group/item relative flex items-center gap-1.5 overflow-hidden rounded-xl border border-border/40 p-1 pe-2 text-start transition-all hover:border-border hover:shadow-xs",
            color.bg
          )}
        >
          {/* Tiny Poster Thumbnail */}
          {item.coverImage ? (
            <div className="relative size-6 shrink-0 overflow-hidden rounded-lg bg-muted">
              <Image
                src={item.coverImage}
                alt={displayTitle}
                fill
                sizes="24px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-lg bg-background/60",
                color.text
              )}
            >
              {getMediaIcon(item.mediaType, "size-3")}
            </div>
          )}

          {/* Title & Detail */}
          <div className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
            <span className="truncate text-xs font-medium text-foreground">
              {displayTitle}
            </span>
            <span
              className={cn("truncate text-[10px] font-medium", color.text)}
            >
              {item.detail || item.mediaType.toUpperCase()}
            </span>
          </div>

          {/* In User List Indicator */}
          {item.inUserList && (
            <div className="shrink-0 text-primary">
              <IconBookmark className="size-3 fill-primary" />
            </div>
          )}
        </Link>

        <Tooltip className="z-50 flex max-w-xs flex-col gap-2 rounded-2xl border border-border/80 bg-popover p-3 text-start text-popover-foreground shadow-xl ring-1 ring-border/50 sm:max-w-sm">
          {/* Top metadata: Type badge, Airing time, and Detail tag */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-border/40 pb-2">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
                  color.bg,
                  color.text
                )}
              >
                {getMediaIcon(item.mediaType, "size-3")}
                {item.mediaType}
              </span>
              {time && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <IconClock className="size-3" />
                  {time}
                </span>
              )}
            </div>

            {item.detail && (
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                  color.border,
                  color.text,
                  color.bg
                )}
              >
                {item.detail}
              </span>
            )}
          </div>

          {/* Full Title (untruncated, wrapping properly) */}
          <div className="flex flex-col gap-0.5">
            <p className="text-xs leading-snug font-bold break-words text-foreground sm:text-sm">
              {displayTitle}
            </p>
            {altTitle && (
              <p className="text-[11px] break-words text-muted-foreground">
                {altTitle}
              </p>
            )}
          </div>

          {/* Episode Title or Extra Note */}
          {item.episodeTitle && (
            <p className="text-[11px] text-muted-foreground italic">
              &ldquo;{item.episodeTitle}&rdquo;
            </p>
          )}

          {/* Bottom row: Tracked status if in list */}
          {item.inUserList && (
            <div className="flex items-center gap-1 border-t border-border/30 pt-1.5 text-[11px] font-medium text-primary">
              <IconBookmark className="size-3 fill-primary" />
              <span>In your tracking list</span>
            </div>
          )}
        </Tooltip>
      </TooltipTrigger>
    )
  }

  // Detailed variant: used in Week view columns
  if (variant === "detailed") {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "group/item relative flex flex-col gap-2 rounded-2xl border border-border/50 bg-card p-2.5 transition-all hover:border-primary/40 hover:shadow-xs",
          color.border
        )}
      >
        <div className="flex gap-2.5">
          {item.coverImage ? (
            <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-xl bg-muted shadow-2xs">
              <Image
                src={item.coverImage}
                alt={displayTitle}
                fill
                sizes="44px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div
              className={cn(
                "flex h-16 w-11 shrink-0 items-center justify-center rounded-xl bg-muted",
                color.text
              )}
            >
              {getMediaIcon(item.mediaType, "size-5")}
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase",
                    color.bg,
                    color.text
                  )}
                >
                  {getMediaIcon(item.mediaType, "size-2.5")}
                  {item.mediaType}
                </span>
                {item.inUserList && (
                  <IconBookmark className="size-3.5 fill-primary text-primary" />
                )}
              </div>
              <h4 className="line-clamp-2 text-xs leading-snug font-semibold text-foreground group-hover/item:text-primary">
                {displayTitle}
              </h4>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className={cn("font-medium", color.text)}>
                {item.detail || item.format || ""}
              </span>
              {time && (
                <span className="flex items-center gap-0.5 font-mono text-[10px]">
                  <IconClock className="size-2.5" />
                  {time}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  // Agenda variant: used in List/Agenda view
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group/item flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-card p-3 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-xs"
    >
      <div className="flex min-w-0 items-center gap-3">
        {/* Poster */}
        {item.coverImage ? (
          <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-muted shadow-2xs">
            <Image
              src={item.coverImage}
              alt={displayTitle}
              fill
              sizes="48px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div
            className={cn(
              "flex h-16 w-12 shrink-0 items-center justify-center rounded-xl bg-muted",
              color.text
            )}
          >
            {getMediaIcon(item.mediaType, "size-5")}
          </div>
        )}

        {/* Title, Subtitle, Detail */}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
                color.bg,
                color.text
              )}
            >
              {getMediaIcon(item.mediaType, "size-3")}
              {item.mediaType}
            </span>
            {item.inUserList && (
              <Badge
                variant="outline"
                className="h-5 gap-1 text-[10px] text-primary"
              >
                <IconBookmark className="size-2.5 fill-primary" />
                Tracked
              </Badge>
            )}
          </div>

          <h4 className="line-clamp-2 text-sm leading-snug font-semibold break-words text-foreground group-hover/item:text-primary">
            {displayTitle}
          </h4>
          {altTitle && (
            <p className="line-clamp-1 text-xs break-words text-muted-foreground">
              {altTitle}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.detail && (
              <span className={cn("font-medium", color.text)}>
                {item.detail}
              </span>
            )}
            {item.episodeTitle && (
              <>
                <span>•</span>
                <span className="truncate italic">
                  &ldquo;{item.episodeTitle}&rdquo;
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Time Badge */}
      {time && (
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/40 bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <IconClock className="size-3.5 text-primary" />
          <span className="font-mono">{time}</span>
        </div>
      )}
    </Link>
  )
}
