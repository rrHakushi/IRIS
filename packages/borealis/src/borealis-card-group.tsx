"use client"

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
  type CarouselApi,
} from "@workspace/ui/components/carousel"

export type BorealisCardGroupOrientation = "horizontal" | "vertical"
export type BorealisCardGroupVariant = "none" | "card" | "ghost"
export type BorealisCardGroupTitlePosition = "start" | "end"
export type BorealisCardGroupControlsPlacement = "header" | "floating" | "none"

export interface BorealisCardGroupProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  /** Title for the group */
  title?: React.ReactNode
  /** Optional secondary subtitle or description */
  subtitle?: React.ReactNode
  /** Placement of the title: 'start' (controls on end) or 'end' (controls on start) */
  titlePosition?: BorealisCardGroupTitlePosition
  /** Layout orientation: 'horizontal' (default) or 'vertical' */
  orientation?: BorealisCardGroupOrientation
  /** Maximum number of rows in carousel mode (e.g. rowCount={1} or rowCount={5}). */
  rowCount?: number
  /** Fixed number of columns in grid mode (e.g. columnCount={5} creates a 5-column grid with N rows and no scroll). */
  columnCount?: number
  /** Whether to render items in a static CSS grid instead of an Embla carousel (everything visible, no horizontal scroll). */
  grid?: boolean
  /** Layout mode: 'carousel' (default) or 'grid' */
  layout?: "carousel" | "grid"
  /** Background container variant: 'none' (transparent) or 'card' (styled IRIS card frame) */
  variant?: BorealisCardGroupVariant
  /** Spacing between cards: 'sm' (gap-2), 'md' (gap-4, default), 'lg' (gap-6) or custom class */
  gap?: "sm" | "md" | "lg" | string
  /** Where scroll controls are rendered: 'header' (default if title exists), 'floating', or 'none' */
  controlsPlacement?: BorealisCardGroupControlsPlacement
  /** Whether mouse wheel scrolling advances slides when hovered/focused (default true) */
  enableWheelScroll?: boolean
  /** Whether drag-to-scroll glides with momentum until velocity hits 0 (default true) */
  dragFree?: boolean
  /** Embla carousel options override */
  opts?: Record<string, any>
  /** Custom class for header */
  headerClassName?: string
  /** Custom class for content / viewport */
  contentClassName?: string
  /** Custom class for controls */
  controlsClassName?: string
  /** Children elements (BorealisCard components) */
  children?: React.ReactNode
}

// -----------------------------------------------------------------------------
// Internal Controls Component (Header or Floating)
// -----------------------------------------------------------------------------
interface ControlsProps {
  orientation: BorealisCardGroupOrientation
  className?: string
  isFloating?: boolean
}

function BorealisCardGroupControlsInner({
  orientation,
  className,
  isFloating = false,
}: ControlsProps) {
  const { scrollPrev, scrollNext, canScrollPrev, canScrollNext } = useCarousel()

  // Only visible when content is overflowing the screen
  const isOverflowing = canScrollPrev || canScrollNext
  if (!isOverflowing) {
    return null
  }

  const isHorizontal = orientation === "horizontal"
  const PrevIcon = isHorizontal ? IconChevronLeft : IconChevronUp
  const NextIcon = isHorizontal ? IconChevronRight : IconChevronDown

  if (isFloating) {
    return (
      <>
        {/* Floating Prev Button */}
        {canScrollPrev && (
          <button
            type="button"
            onClick={scrollPrev}
            aria-label="Scroll previous"
            className={cn(
              "absolute z-30 inline-flex size-9 items-center justify-center rounded-xl border border-frost bg-frost text-zinc-100 shadow-xl backdrop-blur-md transition-all hover:bg-zinc-800 hover:text-white cursor-pointer select-none",
              isHorizontal
                ? "start-2 top-1/2 -translate-y-1/2"
                : "top-2 start-1/2 -translate-x-1/2",
              className
            )}
          >
            <PrevIcon className="size-5 shrink-0 rtl:rotate-180" aria-hidden="true" />
          </button>
        )}

        {/* Floating Next Button */}
        {canScrollNext && (
          <button
            type="button"
            onClick={scrollNext}
            aria-label="Scroll next"
            className={cn(
              "absolute z-30 inline-flex size-9 items-center justify-center rounded-xl border border-frost bg-frost text-zinc-100 shadow-xl backdrop-blur-md transition-all hover:bg-zinc-800 hover:text-white cursor-pointer select-none",
              isHorizontal
                ? "end-2 top-1/2 -translate-y-1/2"
                : "bottom-2 start-1/2 -translate-x-1/2",
              className
            )}
          >
            <NextIcon className="size-5 shrink-0 rtl:rotate-180" aria-hidden="true" />
          </button>
        )}
      </>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 shrink-0 select-none",
        className
      )}
    >
      <button
        type="button"
        disabled={!canScrollPrev}
        onClick={scrollPrev}
        aria-label="Scroll previous"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-xl border border-frost bg-frost text-zinc-200 backdrop-blur-md transition-all",
          "hover:border-zinc-600 hover:bg-zinc-800 hover:text-white",
          "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-frost disabled:hover:bg-frost disabled:hover:text-zinc-200",
          "cursor-pointer"
        )}
      >
        <PrevIcon className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
      </button>

      <button
        type="button"
        disabled={!canScrollNext}
        onClick={scrollNext}
        aria-label="Scroll next"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-xl border border-frost bg-frost text-zinc-200 backdrop-blur-md transition-all",
          "hover:border-zinc-600 hover:bg-zinc-800 hover:text-white",
          "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-frost disabled:hover:bg-frost disabled:hover:text-zinc-200",
          "cursor-pointer"
        )}
      >
        <NextIcon className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
      </button>
    </div>
  )
}

// -----------------------------------------------------------------------------
// BorealisCardGroup Compound Header
// -----------------------------------------------------------------------------
interface HeaderProps {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  titlePosition: BorealisCardGroupTitlePosition
  orientation: BorealisCardGroupOrientation
  showControls: boolean
  className?: string
  controlsClassName?: string
}

function BorealisCardGroupHeader({
  title,
  subtitle,
  titlePosition,
  orientation,
  showControls,
  className,
  controlsClassName,
}: HeaderProps) {
  if (!title && !subtitle && !showControls) {
    return null
  }

  const titleNode = (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5",
        titlePosition === "end" ? "text-end items-end" : "text-start items-start"
      )}
    >
      {typeof title === "string" ? (
        <h3 className="truncate font-sans text-base sm:text-lg font-bold tracking-tight text-foreground">
          {title}
        </h3>
      ) : (
        title
      )}

      {subtitle && (
        typeof subtitle === "string" ? (
          <p className="line-clamp-1 font-mono text-xs text-muted-foreground">
            {subtitle}
          </p>
        ) : (
          subtitle
        )
      )}
    </div>
  )

  const controlsNode = showControls ? (
    <BorealisCardGroupControlsInner
      orientation={orientation}
      className={controlsClassName}
    />
  ) : null

  return (
    <div
      className={cn(
        "mb-3.5 flex items-center justify-between gap-4 px-0.5",
        titlePosition === "end" && "flex-row-reverse",
        className
      )}
    >
      {titleNode}
      {controlsNode}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Mouse Wheel Listener Component (Always prevents page scroll when scrollable)
// -----------------------------------------------------------------------------
function BorealisCardGroupWheelListener({
  enabled,
  orientation,
}: {
  enabled: boolean
  orientation: BorealisCardGroupOrientation
}) {
  const { api } = useCarousel()
  const lastWheelTimeRef = useRef(0)

  useEffect(() => {
    if (!enabled || !api) return

    const rootNode = api.rootNode()
    if (!rootNode) return

    const handleWheel = (e: WheelEvent) => {
      const isHorizontal = orientation === "horizontal"
      const delta = isHorizontal
        ? Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.deltaY
        : e.deltaY

      if (Math.abs(delta) < 5) return

      const canScrollDirection =
        delta > 0 ? api.canScrollNext() : api.canScrollPrev()

      // Prevent page from scrolling whenever the carousel has room to scroll!
      if (canScrollDirection) {
        e.preventDefault()

        const now = Date.now()
        if (now - lastWheelTimeRef.current >= 35) {
          lastWheelTimeRef.current = now
          if (delta > 0) {
            api.scrollNext()
          } else {
            api.scrollPrev()
          }
        }
      }
    }

    rootNode.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      rootNode.removeEventListener("wheel", handleWheel)
    }
  }, [api, enabled, orientation])

  return null
}

// -----------------------------------------------------------------------------
// Helper: Map gap prop to Tailwind class
// -----------------------------------------------------------------------------
function resolveGapClass(gap: BorealisCardGroupProps["gap"]): string {
  if (gap === "sm") return "gap-2"
  if (gap === "lg") return "gap-6"
  if (typeof gap === "string" && gap.startsWith("gap-")) return gap
  return "gap-4" // default md
}

// -----------------------------------------------------------------------------
// Helper: Chunk children for multi-row or multi-column layouts
// -----------------------------------------------------------------------------
function chunkChildren(
  children: React.ReactNode,
  chunkSize: number
): React.ReactNode[][] {
  const arr = React.Children.toArray(children)
  if (chunkSize <= 1) {
    return arr.map((item) => [item])
  }

  const chunks: React.ReactNode[][] = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize))
  }
  return chunks
}

// -----------------------------------------------------------------------------
// Main Component: BorealisCardGroup
// -----------------------------------------------------------------------------
export function BorealisCardGroup({
  title,
  subtitle,
  titlePosition = "start",
  orientation = "horizontal",
  rowCount,
  columnCount,
  grid,
  layout,
  variant = "none",
  gap = "md",
  controlsPlacement,
  enableWheelScroll = true,
  dragFree = true,
  opts,
  className,
  headerClassName,
  contentClassName,
  controlsClassName,
  children,
  ...props
}: BorealisCardGroupProps) {
  const isHorizontal = orientation === "horizontal"
  const gapClass = resolveGapClass(gap)

  // When grid is true, layout === "grid", or columnCount is explicitly provided,
  // BorealisCardGroup renders as a CSS Grid with rows flowing down naturally (everything visible, NO scroll).
  const isGrid = Boolean(columnCount) || grid === true || layout === "grid"

  const childArray = useMemo(() => React.Children.toArray(children), [children])

  // If both rowCount and columnCount are specified:
  // Cap at rowCount * columnCount and omit any extra items.
  const effectiveChildren = useMemo(() => {
    if (rowCount && columnCount) {
      const maxItems = rowCount * columnCount
      return childArray.slice(0, maxItems)
    }
    return childArray
  }, [childArray, rowCount, columnCount])

  // ---------------------------------------------------------------------------
  // 1. Grid Mode: responsive or columnCount grid, all items visible, no scroll
  // ---------------------------------------------------------------------------
  if (isGrid) {
    const gridContent = (
      <div className="relative w-full">
        {/* Header with Title (no scroll controls needed for static grid) */}
        <BorealisCardGroupHeader
          title={title}
          subtitle={subtitle}
          titlePosition={titlePosition}
          orientation={orientation}
          showControls={false}
          className={headerClassName}
          controlsClassName={controlsClassName}
        />

        {/* Responsive or fixed columnCount CSS Grid, all items visible, no scroll */}
        <div
          style={{
            display: "grid",
            ...(columnCount
              ? { gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }
              : contentClassName?.includes("grid-cols")
                ? undefined
                : { gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))" }),
          }}
          className={cn(
            "w-full",
            gapClass,
            contentClassName,
            "[&>*]:w-full [&>*]:max-w-none [&_.bcard]:w-full [&_.bcard]:max-w-none"
          )}
        >
          {effectiveChildren.map((child, idx) => (
            <div key={idx} className="w-full min-w-0">
              {child}
            </div>
          ))}
        </div>
      </div>
    )

    if (variant === "card") {
      return (
        <section
          className={cn(
            "w-full rounded-2xl border border-border/60 bg-card p-4 sm:p-5 text-card-foreground shadow-xs transition-colors",
            className
          )}
          {...props}
        >
          {gridContent}
        </section>
      )
    }

    return (
      <section className={cn("w-full", className)} {...props}>
        {gridContent}
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // 2. Carousel Mode: horizontal / vertical scrolling with rowCount rows
  // ---------------------------------------------------------------------------
  // Floating frosted arrows are the default controls for the group
  const effectiveControlsPlacement: BorealisCardGroupControlsPlacement =
    controlsPlacement ?? "floating"

  const [api, setApi] = useState<CarouselApi>()
  const [visibleSlideIndices, setVisibleSlideIndices] = useState<number[] | null>(null)
  const [itemDimensions, setItemDimensions] = useState<{ width: number; height: number } | null>(null)

  // Each slide chunk has rowCount items stacked vertically
  const chunkSize = Math.max(1, rowCount ?? 1)

  const slides = useMemo(() => {
    return chunkChildren(effectiveChildren, chunkSize)
  }, [effectiveChildren, chunkSize])

  // Track window resize to re-measure card dimensions dynamically
  useEffect(() => {
    const handleResize = () => setItemDimensions(null)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Windowing: Only render visible slides + 2 buffer cards on each side
  useEffect(() => {
    if (!api) return

    let rafId: number | null = null

    const updateVisibleSlides = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const inView = api.slidesInView()
        if (!inView || inView.length === 0) return

        const min = Math.min(...inView)
        const max = Math.max(...inView)

        // Buffer of 2 on each side: visible cards + 2
        const buffer = 2
        const start = Math.max(0, min - buffer)
        const end = Math.min(slides.length - 1, max + buffer)

        setVisibleSlideIndices((prev) => {
          if (
            prev &&
            prev.length === end - start + 1 &&
            prev[0] === start &&
            prev[prev.length - 1] === end
          ) {
            return prev
          }
          const range: number[] = []
          for (let i = start; i <= end; i++) {
            range.push(i)
          }
          return range
        })
      })
    }

    updateVisibleSlides()

    api.on("slidesInView", updateVisibleSlides)
    api.on("scroll", updateVisibleSlides)
    api.on("reInit", updateVisibleSlides)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      api.off("slidesInView", updateVisibleSlides)
      api.off("scroll", updateVisibleSlides)
      api.off("reInit", updateVisibleSlides)
    }
  }, [api, slides.length])

  const isSlideRendered = (slideIdx: number): boolean => {
    // Before Embla mounts, render the initial 8 slides (initial visible + 2 buffer)
    if (visibleSlideIndices === null) {
      return slideIdx <= 8
    }
    return visibleSlideIndices.includes(slideIdx)
  }

  const carouselOpts = useMemo(
    () => ({
      align: "start" as const,
      containScroll: "trimSnaps" as const,
      dragFree,
      axis: isHorizontal ? ("x" as const) : ("y" as const),
      ...opts,
    }),
    [dragFree, isHorizontal, opts]
  )

  const carouselContent = (
    <Carousel
      orientation={orientation}
      opts={carouselOpts}
      setApi={setApi}
      className="relative w-full"
    >
      <BorealisCardGroupWheelListener
        enabled={enableWheelScroll}
        orientation={orientation}
      />

      {/* Header with Title and Controls (mirrored positions) */}
      <BorealisCardGroupHeader
        title={title}
        subtitle={subtitle}
        titlePosition={titlePosition}
        orientation={orientation}
        showControls={effectiveControlsPlacement === "header"}
        className={headerClassName}
        controlsClassName={controlsClassName}
      />

      {/* Viewport & Items */}
      <div className="relative w-full">
        <CarouselContent
          className={cn(
            isHorizontal ? "-ms-4" : "-mt-4",
            contentClassName
          )}
        >
          {slides.map((slideChunk, slideIdx) => {
            const isVisible = isSlideRendered(slideIdx)

            return (
              <CarouselItem
                key={slideIdx}
                className={cn(
                  "basis-auto shrink-0 grow-0",
                  isHorizontal ? "ps-4" : "pt-4"
                )}
              >
                {chunkSize > 1 ? (
                  <div
                    className={cn(
                      "flex",
                      isHorizontal ? "flex-col" : "flex-row",
                      gapClass
                    )}
                  >
                    {slideChunk.map((child, itemIdx) => {
                      if (!isVisible) {
                        const fallbackSize =
                          React.isValidElement(child) &&
                          (child.props as any)?.size === "sm"
                            ? "w-32 aspect-[2/3]"
                            : React.isValidElement(child) &&
                                (child.props as any)?.size === "lg"
                              ? "w-48 aspect-[2/3]"
                              : "w-40 aspect-[2/3]"

                        return (
                          <div
                            key={itemIdx}
                            className={cn(
                              "shrink-0 rounded-2xl border border-transparent bg-muted/5 pointer-events-none select-none",
                              !itemDimensions && fallbackSize
                            )}
                            style={
                              itemDimensions
                                ? {
                                    width: `${itemDimensions.width}px`,
                                    height: `${itemDimensions.height}px`,
                                  }
                                : undefined
                            }
                            aria-hidden="true"
                          />
                        )
                      }

                      return (
                        <div
                          key={itemIdx}
                          ref={
                            !itemDimensions && slideIdx === 0 && itemIdx === 0
                              ? (el) => {
                                  if (el) {
                                    const rect = el.getBoundingClientRect()
                                    if (rect.width > 0 && rect.height > 0) {
                                      setItemDimensions({
                                        width: Math.round(rect.width),
                                        height: Math.round(rect.height),
                                      })
                                    }
                                  }
                                }
                              : undefined
                          }
                          className="shrink-0"
                        >
                          {child}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <>
                    {!isVisible ? (
                      (() => {
                        const child = slideChunk[0]
                        const fallbackSize =
                          React.isValidElement(child) &&
                          (child.props as any)?.size === "sm"
                            ? "w-32 aspect-[2/3]"
                            : React.isValidElement(child) &&
                                (child.props as any)?.size === "lg"
                              ? "w-48 aspect-[2/3]"
                              : "w-40 aspect-[2/3]"

                        return (
                          <div
                            className={cn(
                              "shrink-0 rounded-2xl border border-transparent bg-muted/5 pointer-events-none select-none",
                              !itemDimensions && fallbackSize
                            )}
                            style={
                              itemDimensions
                                ? {
                                    width: `${itemDimensions.width}px`,
                                    height: `${itemDimensions.height}px`,
                                  }
                                : undefined
                            }
                            aria-hidden="true"
                          />
                        )
                      })()
                    ) : (
                      <div
                        ref={
                          !itemDimensions && slideIdx === 0
                            ? (el) => {
                                if (el) {
                                  const rect = el.getBoundingClientRect()
                                  if (rect.width > 0 && rect.height > 0) {
                                    setItemDimensions({
                                      width: Math.round(rect.width),
                                      height: Math.round(rect.height),
                                    })
                                  }
                                }
                              }
                            : undefined
                        }
                        className="shrink-0"
                      >
                        {slideChunk[0]}
                      </div>
                    )}
                  </>
                )}
              </CarouselItem>
            )
          })}
        </CarouselContent>

        {/* Floating Controls (overlay arrows when controlsPlacement is floating) */}
        {effectiveControlsPlacement === "floating" && (
          <BorealisCardGroupControlsInner
            orientation={orientation}
            isFloating
            className={controlsClassName}
          />
        )}
      </div>
    </Carousel>
  )

  if (variant === "card") {
    return (
      <section
        className={cn(
          "w-full rounded-2xl border border-border/60 bg-card p-4 sm:p-5 text-card-foreground shadow-xs transition-colors",
          className
        )}
        {...props}
      >
        {carouselContent}
      </section>
    )
  }

  return (
    <section className={cn("w-full", className)} {...props}>
      {carouselContent}
    </section>
  )
}

// Compound API Attachments
BorealisCardGroup.Controls = BorealisCardGroupControlsInner
