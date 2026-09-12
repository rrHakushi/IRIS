"use client"

import React from "react"
import {
  IconSearch,
  IconX,
  IconSortAscending,
  IconSortDescending,
  IconChevronDown,
  IconLoader2,
} from "@tabler/icons-react"
import { DialogTrigger, Popover, Dialog } from "react-aria-components"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { Tabs, TabList, Tab } from "@workspace/ui/components/tabs"
import {
  type StatusKey,
  type SortByOption,
  type SortOrderOption,
  type ListFilterFacets,
  type MediaListType,
  type ListViewTab,
  MEDIA_CATEGORIES,
} from "./types"
import { MultiSelectFilterPopover } from "./multi-select-filter-popover"

export interface ListStatusCardProps {
  mediaType: MediaListType
  activeStatus: StatusKey
  onStatusChange: (status: StatusKey) => void
  activeTab?: ListViewTab
  onTabChange?: (tab: ListViewTab) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  isSearching?: boolean
  facets: ListFilterFacets
  selectedFormats: string[]
  onFormatsChange: (formats: string[]) => void
  selectedMediaStatuses: string[]
  onMediaStatusesChange: (statuses: string[]) => void
  selectedGenres: string[]
  onGenresChange: (genres: string[]) => void
  selectedYears: string[]
  onYearsChange: (years: string[]) => void
  selectedMonths?: string[]
  onMonthsChange?: (months: string[]) => void
  selectedArtists?: string[]
  onArtistsChange?: (artists: string[]) => void
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
  activeTab = "list",
  onTabChange,
  searchQuery,
  onSearchChange,
  isSearching = false,
  facets,
  selectedFormats,
  onFormatsChange,
  selectedMediaStatuses,
  onMediaStatusesChange,
  selectedGenres,
  onGenresChange,
  selectedYears,
  onYearsChange,
  selectedMonths,
  onMonthsChange,
  selectedArtists,
  onArtistsChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  totalCount,
  className,
}: ListStatusCardProps): React.JSX.Element {
  const [internalTab, setInternalTab] = React.useState<ListViewTab>("list")
  const currentTab = onTabChange ? activeTab : internalTab
  const handleTabChange = (tab: ListViewTab) => {
    if (onTabChange) {
      onTabChange(tab)
    } else {
      setInternalTab(tab)
    }
  }

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
      if (
        upper === "WATCHING" ||
        upper === "READING" ||
        upper === "PLAYING" ||
        upper === "LISTENING"
      ) {
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
  }> = React.useMemo(() => {
    if (mediaType === "music") {
      const albumCount =
        facets.formats.find((f) => f.value.toUpperCase() === "ALBUM")?.count ??
        0
      const trackCount =
        facets.formats.find((f) => f.value.toUpperCase() === "TRACK")?.count ??
        0
      return [
        { key: "ALL", label: "ALL", count: statusCounts.ALL ?? 0 },
        { key: "ALBUMS", label: "ALBUMS", count: albumCount },
        { key: "TRACKS", label: "TRACKS", count: trackCount },
      ]
    }

    return [
      { key: "ALL", label: "ALL", count: statusCounts.ALL ?? 0 },
      {
        key: "WATCHING",
        label: activeVerb.toUpperCase(),
        count: statusCounts.WATCHING ?? 0,
      },
      { key: "ON_HOLD", label: "ON HOLD", count: statusCounts.ON_HOLD ?? 0 },
      {
        key: "COMPLETED",
        label: "COMPLETED",
        count: statusCounts.COMPLETED ?? 0,
      },
      { key: "DROPPED", label: "DROPPED", count: statusCounts.DROPPED ?? 0 },
      { key: "PLANNING", label: "PLANNING", count: statusCounts.PLANNING ?? 0 },
    ]
  }, [mediaType, statusCounts, facets.formats, activeVerb])

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
      music: ["ALBUM", "TRACK"],
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

  const monthOptions = React.useMemo(() => {
    const monthNames: Record<number, string> = {
      1: "January",
      2: "February",
      3: "March",
      4: "April",
      5: "May",
      6: "June",
      7: "July",
      8: "August",
      9: "September",
      10: "October",
      11: "November",
      12: "December",
    }

    if (facets.months && facets.months.length > 0) {
      return facets.months.map((m) => ({
        value: String(m.value),
        label: monthNames[m.value] || `Month ${m.value}`,
        count: m.count,
      }))
    }
    return Object.entries(monthNames).map(([val, label]) => ({
      value: val,
      label,
    }))
  }, [facets.months])

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
    SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Last Updated"

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur-xl transition-all",
        className
      )}
    >
      {/* ================================================================== */}
      {/* 1. TOP ROW: Status Options Tabs & View Switcher (List | Comments | Stats) */}
      {/* ================================================================== */}
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto p-2 sm:gap-2 sm:p-2.5">
        {/* Status Option Pills */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {statusOptions.map((st) => {
            const isActive = activeStatus === st.key

            return (
              <Button
                key={st.key}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onPress={() => {
                  onStatusChange(st.key)
                  if (currentTab !== "list") {
                    handleTabChange("list")
                  }
                }}
                className={cn(
                  "group h-7 shrink-0 gap-2 rounded-full px-3.5 text-xs font-semibold tracking-wider uppercase transition-all duration-200 select-none",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span>{st.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium transition-colors",
                    isActive
                      ? "bg-black/20 text-primary-foreground dark:bg-black/30"
                      : "bg-muted text-muted-foreground group-hover:bg-muted/90 group-hover:text-foreground"
                  )}
                >
                  {st.count}
                </span>
              </Button>
            )
          })}
        </div>

        {/* Vertical Divider (Orange line in reference) */}
        <Separator
          orientation="vertical"
          className="mx-1 h-5 shrink-0 self-center bg-border/60"
        />

        {/* Tab Switcher: List | Comments | Stats (Green circle in reference) */}
        <Tabs
          selectedKey={currentTab}
          onSelectionChange={(key) =>
            handleTabChange(String(key) as ListViewTab)
          }
          className="shrink-0 gap-0"
        >
          <TabList
            aria-label="View Switcher"
            className="h-7 gap-0.5 rounded-full border border-border/40 bg-muted/40 p-0.5"
          >
            <Tab
              id="list"
              className="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all hover:text-foreground data-selected:bg-background data-selected:text-foreground data-selected:shadow-xs"
            >
              List
            </Tab>
            <Tab
              id="comments"
              className="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all hover:text-foreground data-selected:bg-background data-selected:text-foreground data-selected:shadow-xs"
            >
              Comments
            </Tab>
            <Tab
              id="stats"
              className="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all hover:text-foreground data-selected:bg-background data-selected:text-foreground data-selected:shadow-xs"
            >
              Stats
            </Tab>
            <Tab
              id="activity"
              className="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all hover:text-foreground data-selected:bg-background data-selected:text-foreground data-selected:shadow-xs"
            >
              Activity
            </Tab>
          </TabList>
        </Tabs>
      </div>

      {/* When List tab is active, show the search & filters bottom row */}
      {currentTab === "list" && (
        <>
          {/* Subtle Divider */}
          <Separator className="bg-border/40" />

          {/* ================================================================== */}
          {/* 2. BOTTOM ROW: Search Bar & Multi-Select Filter Controls           */}
          {/* ================================================================== */}
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
                placeholder={`Search ${mediaType}...`}
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
              {/* Artists Dropdown (for music or whenever artist facets exist) */}
              {(mediaType === "music" || artistOptions.length > 0) &&
                onArtistsChange && (
                  <MultiSelectFilterPopover
                    label="Artists"
                    allLabel="All Artists"
                    options={artistOptions}
                    selected={selectedArtists || []}
                    onChange={onArtistsChange}
                  />
                )}

              {/* Formats Dropdown (hidden for music because top tabs handle All / Albums / Tracks) */}
              {mediaType !== "music" && (
                <MultiSelectFilterPopover
                  label="Formats"
                  allLabel="All Formats"
                  options={formatOptions}
                  selected={selectedFormats}
                  onChange={onFormatsChange}
                />
              )}

              {/* Statuses Dropdown (hidden for music) */}
              {mediaType !== "music" && (
                <MultiSelectFilterPopover
                  label="Statuses"
                  allLabel="All Statuses"
                  options={mediaStatusOptions}
                  selected={selectedMediaStatuses}
                  onChange={onMediaStatusesChange}
                />
              )}

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

              {/* Months Dropdown (for music or whenever month facets exist) */}
              {(mediaType === "music" ||
                (facets.months && facets.months.length > 0)) &&
                onMonthsChange && (
                  <MultiSelectFilterPopover
                    label="Months"
                    allLabel="All Months"
                    options={monthOptions}
                    selected={selectedMonths || []}
                    onChange={onMonthsChange}
                  />
                )}

              {/* SORT Divider & Label */}
              <div className="hidden items-center gap-1.5 ps-1 sm:flex">
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground/80 uppercase">
                  SORT
                </span>
              </div>

              {/* Sort Dropdown Trigger with RAC Button */}
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
        </>
      )}
    </div>
  )
}
