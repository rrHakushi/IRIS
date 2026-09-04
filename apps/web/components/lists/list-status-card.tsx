"use client"

import React from "react"
import {
  IconSearch,
  IconX,
  IconSortAscending,
  IconSortDescending,
  IconChevronDown,
} from "@tabler/icons-react"
import {
  DialogTrigger,
  Popover,
  Dialog,
} from "react-aria-components"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  type StatusKey,
  type SortByOption,
  type SortOrderOption,
  type ListFilterFacets,
  type MediaListType,
  MEDIA_CATEGORIES,
} from "./types"
import { MultiSelectFilterPopover } from "./multi-select-filter-popover"

export interface ListStatusCardProps {
  mediaType: MediaListType
  activeStatus: StatusKey
  onStatusChange: (status: StatusKey) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  facets: ListFilterFacets
  selectedFormats: string[]
  onFormatsChange: (formats: string[]) => void
  selectedMediaStatuses: string[]
  onMediaStatusesChange: (statuses: string[]) => void
  selectedGenres: string[]
  onGenresChange: (genres: string[]) => void
  selectedYears: string[]
  onYearsChange: (years: string[]) => void
  sortBy: SortByOption
  onSortByChange: (sort: SortByOption) => void
  sortOrder: SortOrderOption
  onSortOrderChange: (order: SortOrderOption) => void
  totalCount: number
  className?: string
}

const SORT_OPTIONS: Array<{ value: SortByOption; label: string }> = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "score", label: "Score" },
  { value: "title", label: "Title" },
  { value: "progress", label: "Progress" },
  { value: "addedAt", label: "Date Added" },
]

export function ListStatusCard({
  mediaType,
  activeStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  facets,
  selectedFormats,
  onFormatsChange,
  selectedMediaStatuses,
  onMediaStatusesChange,
  selectedGenres,
  onGenresChange,
  selectedYears,
  onYearsChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  totalCount,
  className,
}: ListStatusCardProps): React.JSX.Element {
  const currentCategory = MEDIA_CATEGORIES.find((c) => c.key === mediaType)
  const activeVerb = currentCategory?.activeVerb || "Watching"

  // Compute status badge counts from facets
  const statusCounts = React.useMemo(() => {
    const allTotal =
      facets.statuses.length > 0
        ? facets.statuses.reduce((sum, s) => sum + s.count, 0)
        : totalCount

    const map: Record<string, number> = {
      ALL: allTotal,
      WATCHING: 0,
      ON_HOLD: 0,
      COMPLETED: 0,
      DROPPED: 0,
      PLANNING: 0,
    }

    facets.statuses.forEach((item) => {
      const upper = item.value.toUpperCase()
      if (upper === "WATCHING" || upper === "READING" || upper === "PLAYING") {
        map.WATCHING = (map.WATCHING || 0) + item.count
      } else if (upper === "ON_HOLD") {
        map.ON_HOLD = item.count
      } else if (upper === "COMPLETED") {
        map.COMPLETED = item.count
      } else if (upper === "DROPPED") {
        map.DROPPED = item.count
      } else if (upper === "PLANNING") {
        map.PLANNING = item.count
      }
    })

    return map
  }, [facets.statuses, totalCount])

  const statusOptions: Array<{
    key: StatusKey
    label: string
    count: number
  }> = [
    { key: "ALL", label: "ALL", count: statusCounts.ALL ?? 0 },
    {
      key: "WATCHING",
      label: activeVerb.toUpperCase(),
      count: statusCounts.WATCHING ?? 0,
    },
    { key: "ON_HOLD", label: "ON HOLD", count: statusCounts.ON_HOLD ?? 0 },
    { key: "COMPLETED", label: "COMPLETED", count: statusCounts.COMPLETED ?? 0 },
    { key: "DROPPED", label: "DROPPED", count: statusCounts.DROPPED ?? 0 },
    { key: "PLANNING", label: "PLANNING", count: statusCounts.PLANNING ?? 0 },
  ]

  const formatOptions = React.useMemo(() => {
    if (facets.formats && facets.formats.length > 0) {
      return facets.formats.map((f) => ({
        value: f.value,
        label: f.value.replace(/_/g, " "),
        count: f.count,
      }))
    }
    const fallbackMap: Record<MediaListType, string[]> = {
      anime: ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "TV_SHORT", "MUSIC"],
      manga: ["MANGA", "NOVEL", "ONE_SHOT", "MANHWA", "MANHUA"],
      movie: ["MOVIE", "SPECIAL"],
      tv: ["SERIES", "MINISERIES", "SPECIAL"],
      game: ["GAME", "DLC", "REMAKE", "REMASTER"],
      book: ["BOOK", "HARDCOVER", "PAPERBACK", "EBOOK", "AUDIOBOOK"],
    }
    return (fallbackMap[mediaType] || []).map((fmt) => ({
      value: fmt,
      label: fmt.replace(/_/g, " "),
    }))
  }, [facets.formats, mediaType])

  const mediaStatusOptions = React.useMemo(() => {
    if (facets.mediaStatuses && facets.mediaStatuses.length > 0) {
      return facets.mediaStatuses.map((s) => ({
        value: s.value,
        label: s.value.replace(/_/g, " "),
        count: s.count,
      }))
    }
    return [
      { value: "FINISHED", label: "Finished" },
      { value: "RELEASING", label: "Releasing" },
      { value: "NOT_YET_RELEASED", label: "Upcoming" },
      { value: "CANCELLED", label: "Cancelled" },
    ]
  }, [facets.mediaStatuses])

  const genreOptions = React.useMemo(() => {
    if (facets.genres && facets.genres.length > 0) {
      return facets.genres.map((g) => ({
        value: g.value,
        label: g.value,
        count: g.count,
      }))
    }
    const defaultGenres = [
      "Action",
      "Adventure",
      "Comedy",
      "Drama",
      "Fantasy",
      "Horror",
      "Mystery",
      "Psychological",
      "Romance",
      "Sci-Fi",
      "Slice of Life",
      "Supernatural",
      "Thriller",
    ]
    return defaultGenres.map((g) => ({ value: g, label: g }))
  }, [facets.genres])

  const yearOptions = React.useMemo(() => {
    if (facets.years && facets.years.length > 0) {
      return facets.years.map((y) => ({
        value: String(y.value),
        label: String(y.value),
        count: y.count,
      }))
    }
    const currentYear = new Date().getFullYear()
    const fallbackYears: Array<{ value: string; label: string }> = []
    for (let y = currentYear + 1; y >= currentYear - 15; y--) {
      fallbackYears.push({ value: String(y), label: String(y) })
    }
    return fallbackYears
  }, [facets.years])

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Last Updated"

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur-xl transition-all",
        className
      )}
    >
      {/* ================================================================== */}
      {/* 1. TOP ROW: Status Options Tabs                                     */}
      {/* ================================================================== */}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto p-2 sm:gap-2 sm:p-2.5">
        {statusOptions.map((st) => {
          const isActive = activeStatus === st.key

          return (
            <button
              key={st.key}
              type="button"
              onClick={() => onStatusChange(st.key)}
              className={cn(
                "group inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer select-none",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span>{st.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none transition-colors",
                  isActive
                    ? "bg-black/20 text-primary-foreground dark:bg-black/30"
                    : "bg-muted text-muted-foreground group-hover:bg-muted/90 group-hover:text-foreground"
                )}
              >
                {st.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Subtle Divider */}
      <div className="border-t border-border/40" />

      {/* ================================================================== */}
      {/* 2. BOTTOM ROW: Search Bar & Multi-Select Filter Controls           */}
      {/* ================================================================== */}
      <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <IconSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${mediaType}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-full rounded-2xl border border-border/50 bg-background/50 ps-9 pe-8 text-xs text-foreground placeholder:text-muted-foreground transition-all focus:border-ring focus:bg-background focus:outline-hidden focus:ring-3 focus:ring-ring/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <IconX className="size-3.5" />
            </button>
          )}
        </div>

        {/* Right: Multi-select dropdowns & Sort controls */}
        <div className="no-scrollbar flex flex-wrap items-center gap-2 overflow-x-auto pt-1 lg:pt-0">
          {/* Formats Dropdown */}
          <MultiSelectFilterPopover
            label="Formats"
            allLabel="All Formats"
            options={formatOptions}
            selected={selectedFormats}
            onChange={onFormatsChange}
          />

          {/* Statuses Dropdown */}
          <MultiSelectFilterPopover
            label="Statuses"
            allLabel="All Statuses"
            options={mediaStatusOptions}
            selected={selectedMediaStatuses}
            onChange={onMediaStatusesChange}
          />

          {/* Genres Dropdown */}
          <MultiSelectFilterPopover
            label="Genres"
            allLabel="All Genres"
            options={genreOptions}
            selected={selectedGenres}
            onChange={onGenresChange}
          />

          {/* Years Dropdown */}
          <MultiSelectFilterPopover
            label="Years"
            allLabel="All Years"
            options={yearOptions}
            selected={selectedYears}
            onChange={onYearsChange}
          />

          {/* SORT Divider & Label */}
          <div className="hidden sm:flex items-center gap-1.5 ps-1">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground/80 uppercase">
              SORT
            </span>
          </div>

          {/* Sort Dropdown Trigger with RAC Button */}
          <DialogTrigger>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-2xl border border-border/60 bg-card/60 px-3 text-xs font-medium text-foreground hover:bg-muted hover:text-foreground select-none"
            >
              <span>{currentSortLabel}</span>
              <IconChevronDown className="size-3.5 opacity-60 shrink-0" />
            </Button>

            <Popover
              placement="bottom end"
              offset={6}
              className="z-50 w-48 overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-1 text-popover-foreground shadow-2xl backdrop-blur-2xl outline-hidden duration-100 data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95"
            >
              <Dialog className="flex flex-col gap-0.5 outline-hidden">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = opt.value === sortBy
                  return (
                    <Button
                      key={opt.value}
                      variant="ghost"
                      size="sm"
                      onPress={() => onSortByChange(opt.value)}
                      className={cn(
                        "flex h-auto w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-start select-none",
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15"
                          : "text-foreground hover:bg-muted/60"
                      )}
                    >
                      <span>{opt.label}</span>
                      {isSelected && (
                        <span className="size-1.5 rounded-full bg-primary" />
                      )}
                    </Button>
                  )
                })}
              </Dialog>
            </Popover>
          </DialogTrigger>

          {/* Sort Order Direction Toggle */}
          <Button
            variant="outline"
            size="icon-sm"
            onPress={() =>
              onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")
            }
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
    </div>
  )
}
