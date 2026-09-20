"use client"

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  IconBuildingSkyscraper,
  IconWorld,
  IconShare,
  IconCheck,
  IconStar,
  IconPhotoOff,
  IconCalendar,
  IconMovie,
  IconSearch,
  IconX,
  IconLoader2,
  IconChevronDown,
  IconSortAscending,
  IconSortDescending,
  IconLayersLinked,
} from "@tabler/icons-react"
import { DialogTrigger, Popover, Dialog } from "react-aria-components"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"
import type { StudioDetails, StudioCreationItem } from "@IRIS/elysia"
import { elysia } from "@/lib/elysia"
import { FavoriteButton } from "../favorite-button"
import { getMediaDetailHref } from "@/lib/media-routes"
import { useUser } from "@/context/user-context"
import { getMediaPreferences } from "@IRIS/shared"

interface StudioDetailViewProps {
  studio: StudioDetails
}

type SortByOption = "releaseDate" | "popularity" | "score" | "favorites" | "title"
type SortOrderOption = "asc" | "desc"
type MediaTypeFilter = "ALL" | "ANIME" | "MOVIE" | "TV" | "GAME" | "BOOK"

const SORT_OPTIONS: Array<{ value: SortByOption; label: string }> = [
  { value: "releaseDate", label: "Release Date" },
  { value: "popularity", label: "Popularity" },
  { value: "score", label: "Top Rated" },
  { value: "favorites", label: "Favorites" },
  { value: "title", label: "Title" },
]

const MEDIA_TYPE_FILTERS: Array<{ value: MediaTypeFilter; label: string }> = [
  { value: "ALL", label: "All Works" },
  { value: "ANIME", label: "Anime" },
  { value: "MOVIE", label: "Movies" },
  { value: "TV", label: "TV Shows" },
  { value: "GAME", label: "Games" },
  { value: "BOOK", label: "Books" },
]

export function StudioDetailView({ studio }: StudioDetailViewProps): React.JSX.Element {
  const { user } = useUser()
  const mediaTitlePreference = getMediaPreferences(user?.customization).title || "primary"

  // Data & Pagination state
  const [creations, setCreations] = useState<StudioCreationItem[]>(studio.creations || [])
  const [nextCursor, setNextCursor] = useState<number | null>(studio.pagination?.nextCursor ?? null)
  const [hasMore, setHasMore] = useState<boolean>(Boolean(studio.pagination?.hasMore))
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isFetchingRef = useRef(false)

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMediaType, setSelectedMediaType] = useState<MediaTypeFilter>("ALL")
  const [sortBy, setSortBy] = useState<SortByOption>("releaseDate")
  const [sortOrder, setSortOrder] = useState<SortOrderOption>("desc")
  const [copied, setCopied] = useState(false)

  // Background backdrop banner from top creation with banner/cover
  const backdropImage = useMemo(() => {
    const topItem = creations.find((c) => c.bannerImage || c.coverImage)
    return topItem?.bannerImage || topItem?.coverImage || null
  }, [creations])

  // Year Range calculation
  const yearRange = useMemo(() => {
    const years = creations
      .map((c) => c.releaseYear)
      .filter((y): y is number => typeof y === "number" && y > 1900)
    if (years.length === 0) return null
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)
    return minYear === maxYear ? String(minYear) : `${minYear} - ${maxYear}`
  }, [creations])

  // Share action
  const handleShare = useCallback(() => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      toast.success("Studio link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  // Infinite Scroll fetch function
  const loadMoreCreations = useCallback(async () => {
    if (!hasMore || !nextCursor || isFetchingRef.current || isLoadingMore) return

    isFetchingRef.current = true
    setIsLoadingMore(true)

    try {
      const { data, error } = await elysia.media.studios({ id: studio.id }).creations.get({
        query: {
          cursor: nextCursor,
          limit: 36,
          mediaType: selectedMediaType !== "ALL" ? selectedMediaType : undefined,
          sortBy,
          order: sortOrder,
        },
      })

      if (!error && data && data.success) {
        setCreations((prev) => {
          const existingIds = new Set(prev.map((p) => p.id))
          const fresh = data.items.filter((item) => !existingIds.has(item.id))
          return [...prev, ...fresh]
        })
        setNextCursor(data.pagination?.nextCursor ?? null)
        setHasMore(Boolean(data.pagination?.hasMore))
      } else {
        setHasMore(false)
      }
    } catch (err) {
      console.error("[StudioDetailView] Failed to load more creations:", err)
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
      isFetchingRef.current = false
    }
  }, [studio.id, nextCursor, hasMore, isLoadingMore, selectedMediaType, sortBy, sortOrder])

  // Reset creations when changing sort/filter options
  useEffect(() => {
    let isCancelled = false

    const reloadFiltered = async () => {
      try {
        const { data, error } = await elysia.media.studios({ id: studio.id }).creations.get({
          query: {
            limit: 36,
            mediaType: selectedMediaType !== "ALL" ? selectedMediaType : undefined,
            sortBy,
            order: sortOrder,
          },
        })

        if (!isCancelled && !error && data && data.success) {
          setCreations(data.items)
          setNextCursor(data.pagination?.nextCursor ?? null)
          setHasMore(Boolean(data.pagination?.hasMore))
        }
      } catch (err) {
        console.error("[StudioDetailView] Reload error:", err)
      }
    }

    reloadFiltered()
    return () => {
      isCancelled = true
    }
  }, [studio.id, selectedMediaType, sortBy, sortOrder])

  // Sentinel IntersectionObserver for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          loadMoreCreations()
        }
      },
      { rootMargin: "600px 0px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMoreCreations, hasMore, isLoadingMore])

  // Filtered & Search-matched Creations
  const filteredCreations = useMemo(() => {
    let list = creations
    if (selectedMediaType !== "ALL") {
      list = list.filter((c) => c.mediaType.toUpperCase() === selectedMediaType)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((c) => {
        const p = c.titlePrimary?.toLowerCase() || ""
        const s = c.titleSecondary?.toLowerCase() || ""
        const n = c.titleNative?.toLowerCase() || ""
        return p.includes(q) || s.includes(q) || n.includes(q)
      })
    }
    return list
  }, [creations, selectedMediaType, searchQuery])

  // Group creations by year (descending or ascending based on sort order)
  const creationsGroupedByYear = useMemo(() => {
    const groups = new Map<string, StudioCreationItem[]>()

    for (const item of filteredCreations) {
      const yearKey = item.releaseYear ? String(item.releaseYear) : "TBA / Unknown"
      if (!groups.has(yearKey)) {
        groups.set(yearKey, [])
      }
      groups.get(yearKey)!.push(item)
    }

    // Sort group keys
    const sortedEntries = Array.from(groups.entries()).sort(([yearA], [yearB]) => {
      if (yearA === "TBA / Unknown") return 1
      if (yearB === "TBA / Unknown") return -1
      const numA = parseInt(yearA, 10)
      const numB = parseInt(yearB, 10)
      return sortOrder === "asc" ? numA - numB : numB - numA
    })

    return sortedEntries
  }, [filteredCreations, sortOrder])

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Release Date"

  return (
    <div className="flex w-full flex-col gap-8 pb-16">
      {/* 1. STUDIO HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/90 shadow-sm backdrop-blur-xl">
        {/* Backdrop visual banner */}
        {backdropImage && (
          <div className="absolute inset-0 z-0 overflow-hidden opacity-20 filter blur-xl">
            <Image
              src={backdropImage}
              alt={studio.name}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
          </div>
        )}

        <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Studio Icon & Info */}
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-muted/80 text-primary shadow-inner sm:size-20">
                <IconBuildingSkyscraper className="size-8 sm:size-10 stroke-[1.5]" />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                    {studio.name}
                  </h1>
                  <Badge
                    variant="secondary"
                    className="rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 border-primary/20"
                  >
                    {studio.isAnimationStudio ? "Animation Studio" : "Production Studio"}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:text-sm">
                  <span className="flex items-center gap-1.5">
                    <IconMovie className="size-4 opacity-70 text-primary" />
                    <strong className="font-semibold text-foreground">
                      {studio.creationsCount}
                    </strong>{" "}
                    Creations
                  </span>

                  {yearRange && (
                    <>
                      <span className="text-border">•</span>
                      <span className="flex items-center gap-1.5">
                        <IconCalendar className="size-4 opacity-70 text-primary" />
                        <span>{yearRange}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: Favorite, Website, Share */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
              <FavoriteButton
                targetId={studio.id}
                type="STUDIO"
                showLabel
                variant="outline"
                size="sm"
                className="h-9 rounded-2xl px-4 text-xs font-semibold"
              />

              {studio.siteUrl && (
                <a
                  href={studio.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-9 gap-1.5 rounded-2xl border-border/70 px-4 text-xs font-semibold text-foreground hover:bg-muted"
                  )}
                >
                  <IconWorld className="size-4 opacity-70" />
                  <span>Website</span>
                </a>
              )}

              <Button
                variant="outline"
                size="sm"
                onPress={handleShare}
                className="h-9 gap-1.5 rounded-2xl border-border/70 px-4 text-xs font-semibold text-foreground hover:bg-muted"
              >
                {copied ? (
                  <IconCheck className="size-4 text-emerald-500" />
                ) : (
                  <IconShare className="size-4 opacity-70" />
                )}
                <span>{copied ? "Copied" : "Share"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER & SORTING CONTROLS TOOLBAR */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Media Type Pills */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          {MEDIA_TYPE_FILTERS.map((f) => {
            const isSelected = selectedMediaType === f.value
            return (
              <Button
                key={f.value}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                onPress={() => setSelectedMediaType(f.value)}
                className={cn(
                  "h-7 shrink-0 rounded-full px-3 text-xs font-semibold uppercase tracking-wider transition-all select-none",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {f.label}
              </Button>
            )
          })}
        </div>

        {/* Right: Search + Sort Dropdown + Direction Toggle */}
        <div className="flex flex-wrap items-center gap-2 pt-1 lg:pt-0">
          {/* Live Search input */}
          <div className="relative w-full max-w-xs sm:w-56">
            <IconSearch className="pointer-events-none absolute start-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search creations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-2xl border border-border/50 bg-background/50 ps-8 pe-7 text-xs placeholder:text-muted-foreground focus-visible:bg-background"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon-xs"
                onPress={() => setSearchQuery("")}
                aria-label="Clear creations search"
                className="absolute end-1.5 top-1/2 z-10 size-5 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-3" />
              </Button>
            )}
          </div>

          <Separator orientation="vertical" className="hidden h-5 bg-border/40 sm:block" />

          {/* Sort Menu */}
          <DialogTrigger>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-2xl border border-border/60 bg-card/60 px-3 text-xs font-medium text-foreground select-none hover:bg-muted hover:text-foreground"
            >
              <span>{currentSortLabel}</span>
              <IconChevronDown className="size-3.5 shrink-0 opacity-60" />
            </Button>

            <Popover
              placement="bottom end"
              offset={6}
              className="z-50 w-44 overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-1 text-popover-foreground shadow-2xl outline-hidden backdrop-blur-2xl duration-100 data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95"
            >
              <Dialog className="flex flex-col gap-0.5 outline-hidden">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = opt.value === sortBy
                  return (
                    <Button
                      key={opt.value}
                      variant="ghost"
                      size="sm"
                      onPress={() => setSortBy(opt.value)}
                      className={cn(
                        "flex h-auto w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-start text-xs select-none",
                        isSelected
                          ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15"
                          : "text-foreground hover:bg-muted/60"
                      )}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <span className="size-1.5 rounded-full bg-primary" />}
                    </Button>
                  )
                })}
              </Dialog>
            </Popover>
          </DialogTrigger>

          {/* Sort Direction Toggle */}
          <Button
            variant="outline"
            size="icon-sm"
            onPress={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            aria-label={sortOrder === "asc" ? "Sort Ascending" : "Sort Descending"}
            className="size-8 rounded-2xl border border-border/60 bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {sortOrder === "asc" ? (
              <IconSortAscending className="size-4" />
            ) : (
              <IconSortDescending className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 3. YEAR-BY-YEAR GROUPED CREATIONS TIMELINE */}
      {creationsGroupedByYear.length > 0 ? (
        <div className="flex flex-col gap-10">
          {creationsGroupedByYear.map(([year, items]) => (
            <div key={year} className="flex flex-col gap-4">
              {/* Year Section Header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary shadow-sm shadow-primary/50" />
                  <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                    {year}
                  </h2>
                </div>
                <Badge
                  variant="secondary"
                  className="rounded-full border-none bg-muted px-2.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground"
                >
                  {items.length} {items.length === 1 ? "release" : "releases"}
                </Badge>
                <div className="h-px flex-1 bg-border/40" />
              </div>

              {/* Creations Media Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {items.map((item) => (
                  <StudioCreationCard
                    key={`${item.mediaType}-${item.mediaId}`}
                    item={item}
                    mediaTitlePreference={mediaTitlePreference}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Bottom Loading Sentinel & Indicator */}
          <div ref={sentinelRef} className="flex min-h-12 w-full items-center justify-center py-6">
            {isLoadingMore ? (
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <IconLoader2 className="size-4 animate-spin text-primary" />
                <span>Loading more creations...</span>
              </div>
            ) : hasMore ? (
              <Button
                variant="outline"
                size="sm"
                onPress={loadMoreCreations}
                className="h-8 rounded-full border-border/60 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Load More
              </Button>
            ) : creations.length > 0 ? (
              <p className="text-xs font-medium text-muted-foreground/60">
                You've reached the end of all {creations.length} productions
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-8 text-center backdrop-blur-sm">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
            <IconLayersLinked className="size-7 stroke-[1.5]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">No creations found</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {searchQuery
              ? `No creations matched "${searchQuery}". Try clearing search or switching filter.`
              : "No creations recorded for this studio under the selected filter."}
          </p>
          {(searchQuery || selectedMediaType !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                setSearchQuery("")
                setSelectedMediaType("ALL")
              }}
              className="mt-4 rounded-full text-xs font-semibold"
            >
              Reset Filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Individual Creation Card for Studio timeline
 */
interface StudioCreationCardProps {
  item: StudioCreationItem
  mediaTitlePreference?: "primary" | "secondary" | "native"
}

function StudioCreationCard({
  item,
  mediaTitlePreference = "primary",
}: StudioCreationCardProps): React.JSX.Element {
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

  const href = getMediaDetailHref(item.mediaType, item.mediaId, {
    format: item.format,
  })

  const scoreFormatted =
    item.averageScore !== null && item.averageScore !== undefined
      ? (item.averageScore > 10 ? item.averageScore / 10 : item.averageScore).toFixed(1)
      : null

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 select-none"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted/40">
        {item.coverImage && !imgError ? (
          <Image
            src={item.coverImage}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 16vw, 12vw"
            onError={() => setImgError(true)}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground/60">
            <IconPhotoOff className="size-6" />
            <span className="text-[10px] font-medium">No Image</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Top Badges: Format & Score */}
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

        {/* Main studio indicator pill if isMain is true */}
        {item.isMain && (
          <div className="absolute bottom-1.5 start-1.5 opacity-90 transition-opacity">
            <span className="rounded-md bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground backdrop-blur-md">
              Main
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

        {item.genres && item.genres.length > 0 ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            {item.genres.slice(0, 2).join(", ")}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
