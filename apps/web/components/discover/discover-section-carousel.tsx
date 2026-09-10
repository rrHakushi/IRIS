"use client"

import React, { useRef } from "react"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { DiscoverMediaCard } from "./discover-media-card"
import type { DiscoverCategory, DiscoverSection } from "./discover-types"

interface DiscoverSectionCarouselProps {
  section: DiscoverSection
  category: DiscoverCategory
}

export function DiscoverSectionCarousel({
  section,
  category,
}: DiscoverSectionCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return
    const scrollAmount = 600
    const currentScroll = scrollContainerRef.current.scrollLeft
    const targetScroll =
      direction === "left"
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount

    scrollContainerRef.current.scrollTo({
      left: targetScroll,
      behavior: "smooth",
    })
  }

  if (section.items.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-3">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg md:text-xl">
          {section.title}
        </h2>

        {/* Scroll Controls */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleScroll("left")}
            aria-label="Scroll left"
            className="size-7 rounded-2xl border border-border/40 hover:bg-muted"
          >
            <IconChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleScroll("right")}
            aria-label="Scroll right"
            className="size-7 rounded-2xl border border-border/40 hover:bg-muted"
          >
            <IconChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollContainerRef}
        className="no-scrollbar flex items-stretch gap-3 overflow-x-auto scroll-smooth px-0.5 py-1"
      >
        {section.items.map((item) => (
          <div
            key={item.id}
            className="flex w-[140px] shrink-0 flex-col sm:w-[160px] md:w-[180px]"
          >
            <DiscoverMediaCard
              item={item}
              category={category}
              className="h-full"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
