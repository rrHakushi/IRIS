"use client"

import React from "react"
import Link from "next/link"
import {
  IconSearch,
  IconX,
  IconSortAscending,
  IconSortDescending,
  IconChevronDown,
  IconLoader2,
  IconDeviceTv,
  IconBook2,
  IconMovie,
  IconDeviceGamepad,
  IconBook,
  IconMusic,
  IconUserHeart,
  IconUserCheck,
  IconBuildingSkyscraper,
} from "@tabler/icons-react"
import { DialogTrigger, Popover, Dialog } from "react-aria-components"
import { cn } from "@workspace/ui/lib/utils"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { MultiSelectFilterPopover } from "@/components/lists/multi-select-filter-popover"
import {
  type DiscoverCategory,
  type DiscoverSortByOption,
  type DiscoverSortOrderOption,
  type DiscoverFilterFacets,
  DISCOVER_MEDIA_METAS,
} from "./discover-types"

export interface DiscoverStatusCardProps {
  category: DiscoverCategory
  searchQuery: string
  onSearchChange: (q: string) => void
  isSearching?: boolean
  facets: DiscoverFilterFacets
  selectedStatuses: string[]
  onStatusesChange: (statuses: string[]) => void
  selectedFormats: string[]
  onFormatsChange: (formats: string[]) => void
  selectedGenres: string[]
  onGenresChange: (genres: string[]) => void
  selectedYears: string[]
  onYearsChange: (years: string[]) => void
  selectedSeasons?: string[]
  onSeasonsChange?: (seasons: string[]) => void
  selectedArtists?: string[]
  onArtistsChange?: (artists: string[]) => void
  sortBy: DiscoverSortByOption
  onSortByChange: (sort: DiscoverSortByOption) => void
  sortOrder: DiscoverSortOrderOption
  onSortOrderChange: (order: DiscoverSortOrderOption) => void
  className?: string
}

const CATEGORY_ICON_MAP: Record<DiscoverCategory, React.ReactNode> = {
  anime: <IconDeviceTv className="size-4 shrink-0" />,
  manga: <IconBook2 className="size-4 shrink-0" />,
  movies: <IconMovie className="size-4 shrink-0" />,
  tv: <IconDeviceTv className="size-4 shrink-0" />,
  games: <IconDeviceGamepad className="size-4 shrink-0" />,
  books: <IconBook className="size-4 shrink-0" />,
  music: <IconMusic className="size-4 shrink-0" />,
  characters: <IconUserHeart className="size-4 shrink-0" />,
  staff: <IconUserCheck className="size-4 shrink-0" />,
  studios: <IconBuildingSkyscraper className="size-4 shrink-0" />,
}

const SORT_OPTIONS: Array<{ value: DiscoverSortByOption; label: string }> = [
  { value: "popularity", label: "Popularity" },
  { value: "score", label: "Top Rated" },
  { value: "favorites", label: "Favorites" },
  { value: "title", label: "Title" },
  { value: "releaseDate", label: "Release Date" },
  { value: "updatedAt", label: "Recently Updated" },
]

export function DiscoverStatusCard({
  category,
  searchQuery,
  onSearchChange,
  isSearching = false,
  facets,
  selectedStatuses,
  onStatusesChange,
  selectedFormats,
  onFormatsChange,
  selectedGenres,
  onGenresChange,
  selectedYears,
  onYearsChange,
  selectedSeasons,
  onSeasonsChange,
  selectedArtists,
  onArtistsChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  className,
}: DiscoverStatusCardProps): React.JSX.Element {
  const isStatusSupported =
    category !== "music" &&
    category !== "books" &&
    category !== "characters" &&
    category !== "staff" &&
    category !== "studios"

  const statusOptions = React.useMemo(() => {
    if (!isStatusSupported) return []
    if (facets.statuses && facets.statuses.length > 0) {
      return facets.statuses.map((s) => ({
        value: s.value,
        label: s.value.replace(/_/g, " "),
        count: s.count,
      }))
    }
    return [
      { value: "RELEASING", label: "Releasing" },
      { value: "FINISHED", label: "Finished" },
      { value: "NOT_YET_RELEASED", label: "Upcoming" },
      { value: "CANCELLED", label: "Cancelled" },
    ]
  }, [facets.statuses, isStatusSupported])

  const formatOptions = React.useMemo(() => {
    if (facets.formats && facets.formats.length > 0) {
      return facets.formats.map((f) => ({
        value: f.value,
        label: f.value.replace(/_/g, " "),
        count: f.count,
      }))
    }
    if (category === "characters") {
      return [
        { value: "Female", label: "Female" },
        { value: "Male", label: "Male" },
        { value: "Non-binary", label: "Non-binary" },
        { value: "Other", label: "Other" },
      ]
    }
    if (category === "staff") {
      return [
        { value: "Female", label: "Female" },
        { value: "Male", label: "Male" },
      ]
    }
    if (category === "studios") {
      return [
        { value: "ANIMATION_STUDIO", label: "Animation Studio" },
        { value: "STUDIO", label: "Studio" },
      ]
    }

    const fallbackMap: Record<string, string[]> = {
      anime: ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "TV_SHORT", "MUSIC"],
      manga: ["MANGA", "NOVEL", "ONE_SHOT", "MANHWA", "MANHUA"],
      movies: ["MOVIE", "SPECIAL"],
      tv: ["SERIES", "MINISERIES", "SPECIAL"],
      games: ["GAME", "DLC", "REMAKE", "REMASTER"],
      books: ["BOOK", "HARDCOVER", "PAPERBACK", "EBOOK", "AUDIOBOOK"],
      music: ["ALBUM", "TRACK"],
    }
    return (fallbackMap[category] || []).map((fmt) => ({
      value: fmt,
      label: fmt.replace(/_/g, " "),
    }))
  }, [facets.formats, category])

  const genreOptions = React.useMemo(() => {
    if (facets.genres && facets.genres.length > 0) {
      return facets.genres.map((g) => ({
        value: g.value,
        label: g.value,
        count: g.count,
      }))
    }
    if (category === "characters") {
      return [
        { value: "Anime", label: "Anime" },
        { value: "Manga", label: "Manga" },
      ]
    }
    return []
  }, [facets.genres, category])

  const yearOptions = React.useMemo(() => {
    if (category === "studios") return []
    if (facets.years && facets.years.length > 0) {
      return facets.years.map((y) => ({
        value: String(y.value),
        label: String(y.value),
        count: y.count,
      }))
    }
    const currentYear = new Date().getFullYear()
    const fallbackYears: Array<{ value: string; label: string }> = []
    for (let y = currentYear; y >= currentYear - 30; y--) {
      fallbackYears.push({ value: String(y), label: String(y) })
    }
    return fallbackYears
  }, [facets.years, category])

  const seasonOptions = React.useMemo(() => {
    if (category !== "anime") return []
    const seasonsList = [
      { value: "WINTER", label: "Winter" },
      { value: "SPRING", label: "Spring" },
      { value: "SUMMER", label: "Summer" },
      { value: "FALL", label: "Fall" },
    ]
    if (facets.seasons && facets.seasons.length > 0) {
      return seasonsList.map((s) => {
        const found = facets.seasons?.find(
          (f) => f.value.toUpperCase() === s.value
        )
        return {
          ...s,
          count: found?.count,
        }
      })
    }
    return seasonsList
  }, [facets.seasons, category])

  const artistOptions = React.useMemo(() => {
    if (facets.artists && facets.artists.length > 0) {
      return facets.artists.map((a) => ({
        value: a.value,
        label: a.value,
        count: a.count,
      }))
    }
    return []
  }, [facets.artists])

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Popularity"

  const formatsLabel =
    category === "characters" || category === "staff"
      ? "Gender"
      : category === "studios"
        ? "Type"
        : "Formats"

  const genresLabel =
    category === "characters"
      ? "Media"
      : category === "staff"
        ? "Occupations"
        : "Genres"

  const yearsLabel =
    category === "characters" || category === "staff"
      ? "Birth Year"
      : "Years"

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur-xl transition-all",
        className
      )}
    >
      {/* 1. TOP ROW: Media & Entity Type Selection Pills */}
      <div className="no-scrollbar flex w-full items-center overflow-x-auto p-2 sm:p-2.5">
        <div className="mx-auto flex shrink-0 items-center justify-center gap-1 sm:gap-1.5">
          {DISCOVER_MEDIA_METAS.map((item) => {
            const isActive = item.key === category

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  buttonVariants({
                    variant: isActive ? "default" : "ghost",
                    size: "sm",
                  }),
                  "h-7 shrink-0 gap-2 rounded-full px-3.5 text-xs font-semibold tracking-wider uppercase transition-all duration-200 select-none",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {CATEGORY_ICON_MAP[item.key]}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <Separator className="bg-border/40" />

      {/* 2. BOTTOM ROW: Search Bar & Multi-Select Filter Controls */}
      <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Search input */}
        <div className="relative max-w-md flex-1">
          {isSearching ? (
            <IconLoader2 className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <IconSearch className="pointer-events-none absolute start-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            type="text"
            placeholder={`Search ${category}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-full rounded-2xl border border-border/50 bg-background/50 ps-9 pe-8 text-xs text-foreground transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/20"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon-xs"
              onPress={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute end-2 top-1/2 z-10 size-6 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
            >
              <IconX className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Right: Multi-select dropdowns & Sort controls */}
        <div className="no-scrollbar flex flex-wrap items-center gap-2 overflow-x-auto pt-1 lg:pt-0">
          {/* Statuses Dropdown */}
          {statusOptions.length > 0 && (
            <MultiSelectFilterPopover
              label="Statuses"
              allLabel="All Statuses"
              options={statusOptions}
              selected={selectedStatuses}
              onChange={onStatusesChange}
            />
          )}

          {/* Formats Dropdown */}
          {formatOptions.length > 0 && (
            <MultiSelectFilterPopover
              label={formatsLabel}
              allLabel={`All ${formatsLabel}`}
              options={formatOptions}
              selected={selectedFormats}
              onChange={onFormatsChange}
            />
          )}

          {/* Genres Dropdown */}
          {genreOptions.length > 0 && (
            <MultiSelectFilterPopover
              label={genresLabel}
              allLabel={`All ${genresLabel}`}
              options={genreOptions}
              selected={selectedGenres}
              onChange={onGenresChange}
            />
          )}

          {/* Seasons Dropdown (for anime) */}
          {category === "anime" && onSeasonsChange && (
            <MultiSelectFilterPopover
              label="Seasons"
              allLabel="All Seasons"
              options={seasonOptions}
              selected={selectedSeasons || []}
              onChange={onSeasonsChange}
            />
          )}

          {/* Years Dropdown */}
          {yearOptions.length > 0 && (
            <MultiSelectFilterPopover
              label={yearsLabel}
              allLabel={`All ${yearsLabel}`}
              options={yearOptions}
              selected={selectedYears}
              onChange={onYearsChange}
            />
          )}

          {/* Artists Dropdown (for music or whenever artists exist) */}
          {(category === "music" || artistOptions.length > 0) &&
            onArtistsChange && (
              <MultiSelectFilterPopover
                label="Artists"
                allLabel="All Artists"
                options={artistOptions}
                selected={selectedArtists || []}
                onChange={onArtistsChange}
              />
            )}

          {/* SORT Divider & Label */}
          <div className="hidden items-center gap-1.5 ps-1 sm:flex">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground/80 uppercase">
              SORT
            </span>
          </div>

          {/* Sort Dropdown Trigger */}
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
              className="z-50 w-48 overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-1 text-popover-foreground shadow-2xl outline-hidden backdrop-blur-2xl duration-100 data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95"
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
                        "flex h-auto w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-start text-xs select-none",
                        isSelected
                          ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15"
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
            aria-label={
              sortOrder === "asc" ? "Sort Ascending" : "Sort Descending"
            }
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
