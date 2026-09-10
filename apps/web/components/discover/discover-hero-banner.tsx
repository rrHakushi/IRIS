"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  IconStar,
  IconChevronLeft,
  IconChevronRight,
  IconArrowRight,
  IconSparkles,
} from "@tabler/icons-react"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { DiscoverCategory, DiscoverItem } from "./discover-types"

interface DiscoverHeroBannerProps {
  items: DiscoverItem[]
  category: DiscoverCategory
}

export function DiscoverHeroBanner({
  items,
  category,
}: DiscoverHeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const hasItems = items.length > 0
  const currentItem = hasItems ? items[currentIndex] : null

  const handleNext = useCallback(() => {
    if (!hasItems) return
    setCurrentIndex((prev) => (prev + 1) % items.length)
  }, [hasItems, items.length])

  const handlePrev = useCallback(() => {
    if (!hasItems) return
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
  }, [hasItems, items.length])

  // Auto-rotation every 7 seconds when not hovered
  useEffect(() => {
    if (!hasItems || isPaused || items.length <= 1) return

    timerRef.current = setInterval(() => {
      handleNext()
    }, 7000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [hasItems, isPaused, items.length, handleNext])

  if (!hasItems || !currentItem) {
    return null
  }

  const mediaHref =
    category === "music"
      ? `/IRIS-list/media/music/${currentItem.itemType?.toLowerCase() === "album" ? "albums" : "tracks"}/${currentItem.id}`
      : `/IRIS-list/media/${category}/${currentItem.id}`

  const backdropUrl =
    currentItem.bannerImage ||
    currentItem.coverImage ||
    "/images/placeholder-banner.png"

  return (
    <div
      className="relative w-full overflow-hidden rounded-[min(var(--radius-4xl),24px)] border border-border/40 bg-card shadow-sm"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Backdrop Artwork with Multi-stage Gradient Fade */}
      <div className="relative aspect-[21/9] max-h-[520px] min-h-[360px] w-full overflow-hidden sm:min-h-[420px]">
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt={currentItem.titlePrimary}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-muted/40" />
        )}

        {/* Ambient Dark Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20 dark:from-background dark:via-background/80 dark:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent rtl:bg-gradient-to-l" />

        {/* Content Container */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 md:p-10 lg:p-12">
          <div className="flex max-w-3xl flex-col gap-3 sm:gap-4">
            {/* Top Spotlight Indicator & Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="default"
                className="h-6 gap-1 rounded-2xl bg-primary/90 px-2.5 text-xs font-semibold text-primary-foreground"
              >
                <IconSparkles className="size-3" />
                <span>Featured Spotlight</span>
              </Badge>

              {currentItem.averageScore !== null &&
              currentItem.averageScore !== undefined ? (
                <Badge
                  variant="secondary"
                  className="h-6 gap-1 rounded-2xl border border-border/50 bg-background/80 px-2.5 text-xs font-medium text-foreground backdrop-blur-md"
                >
                  <IconStar className="size-3 fill-amber-400 text-amber-400" />
                  <span>{currentItem.averageScore.toFixed(1)}</span>
                </Badge>
              ) : null}

              {currentItem.format ? (
                <Badge
                  variant="outline"
                  className="h-6 rounded-2xl border-border/50 bg-background/60 px-2 text-xs font-medium text-muted-foreground backdrop-blur-sm"
                >
                  {currentItem.format}
                </Badge>
              ) : null}

              {currentItem.releaseYear ? (
                <span className="text-xs font-medium text-muted-foreground">
                  {currentItem.releaseYear}
                </span>
              ) : null}
            </div>

            {/* Title */}
            <h1 className="line-clamp-2 font-heading text-2xl font-semibold tracking-tight text-foreground drop-shadow-sm sm:text-4xl md:text-5xl">
              <Link href={mediaHref} className="hover:text-primary">
                {currentItem.titlePrimary}
              </Link>
            </h1>

            {/* Artist (for music) or Native Subtitle */}
            {currentItem.artistName ? (
              <p className="text-sm font-medium text-primary sm:text-base">
                by {currentItem.artistName}
              </p>
            ) : currentItem.titleSecondary ? (
              <p className="line-clamp-1 text-xs text-muted-foreground/90 sm:text-sm">
                {currentItem.titleSecondary}
              </p>
            ) : null}

            {/* Synopsis / Description */}
            {currentItem.description ? (
              <p className="line-clamp-2 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:line-clamp-3 sm:text-sm">
                {currentItem.description.replace(/<[^>]*>/g, "")}
              </p>
            ) : null}

            {/* Genre Pills */}
            {currentItem.genres.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentItem.genres.slice(0, 4).map((genre) => (
                  <span
                    key={genre}
                    className="inline-flex items-center rounded-2xl bg-secondary/80 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground backdrop-blur-sm"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={mediaHref}
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "flex h-9 items-center gap-2 rounded-2xl bg-primary px-5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 sm:text-sm"
                )}
              >
                <span>View Details</span>
                <IconArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>

        {/* Carousel Navigation Controls (Left / Right Arrows) - Always visible, zero hover opacity animation */}
        {items.length > 1 ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={handlePrev}
              aria-label="Previous slide"
              className="absolute start-3 top-1/2 size-9 -translate-y-1/2 rounded-2xl border border-border/50 bg-background/80 text-foreground backdrop-blur-md sm:start-4"
            >
              <IconChevronLeft className="size-5 rtl:rotate-180" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={handleNext}
              aria-label="Next slide"
              className="absolute end-3 top-1/2 size-9 -translate-y-1/2 rounded-2xl border border-border/50 bg-background/80 text-foreground backdrop-blur-md sm:end-4"
            >
              <IconChevronRight className="size-5 rtl:rotate-180" />
            </Button>
          </>
        ) : null}

        {/* Carousel Slide Indicators */}
        {items.length > 1 ? (
          <div className="absolute end-4 bottom-3 z-10 flex items-center gap-1.5 sm:end-8 sm:bottom-4">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={cn(
                  "h-1.5 rounded-full",
                  idx === currentIndex
                    ? "w-6 bg-primary"
                    : "w-2 bg-foreground/30 hover:bg-foreground/50"
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
