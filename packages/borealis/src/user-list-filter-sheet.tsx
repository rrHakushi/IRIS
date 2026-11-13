"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  IconFilter,
  IconX,
  IconRotate,
  IconCheck,
  IconChevronDown,
  IconBookmark,
  IconListDetails,
  IconLink,
  IconBook,
  IconRotateClockwise,
  IconStar,
  IconFlag,
  IconCalendar,
  IconLock,
  IconFileText,
  IconDeviceTv,
  IconActivity,
  IconTag,
  IconBuilding,
  IconCalendarEvent,
  IconSun,
  IconWorld,
  IconListNumbers,
  IconFlame,
  IconSearch,
  IconHash,
  IconUsers,
  IconCertificate,
} from "@tabler/icons-react"
import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from "@workspace/ui/components/sheet"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

export interface UserListFilterState {
  // Library filters
  statuses: string[]
  progressMin: number | null
  progressMax: number | null
  secondaryProgressMin: number | null
  secondaryProgressMax: number | null
  rewatchMin: number | null
  rewatchMax: number | null
  ratingMin: number | null
  ratingMax: number | null
  priorities: string[]
  startedAfter: string | null
  startedBefore: string | null
  completedAfter: string | null
  completedBefore: string | null
  privacy: "all" | "public" | "private"
  notes: "all" | "withNotes" | "withoutNotes"
  connections: string[]
  excludeConnections?: string[]

  // Series filters
  formats: string[]
  mediaStatuses: string[]
  genres: string[]
  companies: string[]
  seriesProgressMin: number | null
  seriesProgressMax: number | null
  seriesSecondaryProgressMin: number | null
  seriesSecondaryProgressMax: number | null
  seriesScoreMin?: number | null
  seriesScoreMax?: number | null
  adult: "all" | "sfw" | "nsfw"
  years: number[]
  seasons: string[]
  countries: string[]
  staff?: string[]
  licensed?: "all" | "yes" | "no"
}

export const DEFAULT_USER_LIST_FILTER_STATE: UserListFilterState = {
  statuses: [],
  progressMin: null,
  progressMax: null,
  secondaryProgressMin: null,
  secondaryProgressMax: null,
  rewatchMin: null,
  rewatchMax: null,
  ratingMin: null,
  ratingMax: null,
  priorities: [],
  startedAfter: null,
  startedBefore: null,
  completedAfter: null,
  completedBefore: null,
  privacy: "all",
  notes: "all",
  connections: [],
  excludeConnections: [],

  formats: [],
  mediaStatuses: [],
  genres: [],
  companies: [],
  seriesProgressMin: null,
  seriesProgressMax: null,
  seriesSecondaryProgressMin: null,
  seriesSecondaryProgressMax: null,
  seriesScoreMin: null,
  seriesScoreMax: null,
  adult: "all",
  years: [],
  seasons: [],
  countries: [],
  staff: [],
  licensed: "all",
}

export interface UserListFilterFacets {
  statuses?: Array<{ value: string; count: number }>
  formats?: Array<{ value: string; count: number }>
  mediaStatuses?: Array<{ value: string; count: number }>
  genres?: Array<{ value: string; count: number }>
  years?: Array<{ value: number; count: number }>
  priorities?: Array<{ value: string; count: number }>
  connections?: Array<{ value: string; count: number }>
  companies?: Array<{ value: string; count: number }>
  seasons?: Array<{ value: string; count: number }>
  countries?: Array<{ value: string; count: number }>
  privacyCounts?: { public: number; private: number }
  notesCounts?: { withNotes?: number; withoutNotes?: number; hasNotes?: number; noNotes?: number }
  adultCounts?: { sfw: number; nsfw: number }
}

export interface UserListFilterSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  filters: UserListFilterState
  onFiltersChange: (filters: UserListFilterState) => void
  facets: UserListFilterFacets
  mediaType: string
  trigger?: React.ReactNode
}

export function countActiveFilters(filters: UserListFilterState): number {
  let count = 0
  if (filters.statuses.length > 0) count += filters.statuses.length
  if (filters.progressMin !== null || filters.progressMax !== null) count++
  if (
    filters.secondaryProgressMin !== null ||
    filters.secondaryProgressMax !== null
  )
    count++
  if (filters.rewatchMin !== null || filters.rewatchMax !== null) count++
  if (filters.ratingMin !== null || filters.ratingMax !== null) count++
  if (filters.priorities.length > 0) count += filters.priorities.length
  if (filters.startedAfter || filters.startedBefore) count++
  if (filters.completedAfter || filters.completedBefore) count++
  if (filters.privacy !== "all") count++
  if (filters.notes !== "all") count++
  if (filters.connections.length > 0) count += filters.connections.length
  if (filters.excludeConnections && filters.excludeConnections.length > 0) {
    count += filters.excludeConnections.length
  }

  if (filters.formats.length > 0) count += filters.formats.length
  if (filters.mediaStatuses.length > 0) count += filters.mediaStatuses.length
  if (filters.genres.length > 0) count += filters.genres.length
  if (filters.companies.length > 0) count += filters.companies.length
  if (
    filters.seriesProgressMin !== null ||
    filters.seriesProgressMax !== null
  )
    count++
  if (
    filters.seriesSecondaryProgressMin !== null ||
    filters.seriesSecondaryProgressMax !== null
  )
    count++
  if (
    filters.seriesScoreMin !== null &&
    filters.seriesScoreMin !== undefined
  )
    count++
  if (
    filters.seriesScoreMax !== null &&
    filters.seriesScoreMax !== undefined
  )
    count++
  if (filters.licensed && filters.licensed !== "all") count++
  if (filters.staff && filters.staff.length > 0) count += filters.staff.length
  if (filters.adult !== "all") count++
  if (filters.years.length > 0) count += filters.years.length
  if (filters.seasons.length > 0) count += filters.seasons.length
  if (filters.countries.length > 0) count += filters.countries.length

  return count
}

interface FilterAccordionRowProps {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  activeCount?: number
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function FilterAccordionRow({
  id: _id,
  label,
  icon: Icon,
  activeCount = 0,
  isOpen,
  onToggle,
  children,
}: FilterAccordionRowProps): React.JSX.Element {
  return (
    <div className="border-b border-zinc-800/60 last:border-b-0 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between px-5 py-2.5 text-start transition-colors cursor-pointer select-none",
          isOpen
            ? "bg-zinc-900/50 text-white"
            : "text-zinc-300 hover:bg-zinc-800/40 hover:text-white"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="size-4 shrink-0 text-zinc-400" />
          <span className="text-xs font-semibold tracking-wide truncate text-zinc-200">
            {label}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeCount > 0 && (
            <Badge
              variant="default"
              className="h-4.5 rounded-full px-1.5 font-mono text-[10px]"
            >
              {activeCount}
            </Badge>
          )}
          <IconChevronDown
            className={cn(
              "size-3.5 text-zinc-400 transition-transform duration-200",
              isOpen && "rotate-180 text-white"
            )}
          />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-zinc-800/40 bg-zinc-950/60 px-5 pt-3 pb-4 animate-in fade-in-50 duration-150">
          {children}
        </div>
      )}
    </div>
  )
}

export function UserListFilterSheet({
  isOpen,
  onOpenChange,
  filters,
  onFiltersChange,
  facets,
  mediaType,
  trigger,
}: UserListFilterSheetProps): React.JSX.Element {
  // Local draft filters with 300ms debounce to parent
  const [localFilters, setLocalFilters] = useState<UserListFilterState>(filters)

  // Track which dropdown accordion rows are expanded
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({})

  // Search states for genres & companies
  const [genreSearch, setGenreSearch] = useState("")
  const [companySearch, setCompanySearch] = useState("")
  const [staffInput, setStaffInput] = useState("")

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  // 300ms debounce propagate to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange(localFilters)
    }, 300)
    return () => clearTimeout(timer)
  }, [localFilters, onFiltersChange])

  const activeCount = useMemo(() => countActiveFilters(localFilters), [localFilters])

  const toggleDropdown = (id: string) => {
    setOpenDropdowns((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleReset = () => {
    setLocalFilters(DEFAULT_USER_LIST_FILTER_STATE)
    onFiltersChange(DEFAULT_USER_LIST_FILTER_STATE)
  }

  const toggleArrayFilter = (
    key: keyof Pick<
      UserListFilterState,
      | "statuses"
      | "priorities"
      | "connections"
      | "formats"
      | "mediaStatuses"
      | "genres"
      | "companies"
      | "seasons"
      | "countries"
    >,
    val: string
  ) => {
    setLocalFilters((prev) => {
      const current = prev[key] as string[]
      const exists = current.includes(val)
      const next = exists ? current.filter((x) => x !== val) : [...current, val]
      return { ...prev, [key]: next }
    })
  }

  const toggleYearFilter = (yr: number) => {
    setLocalFilters((prev) => {
      const exists = prev.years.includes(yr)
      const next = exists ? prev.years.filter((y) => y !== yr) : [...prev.years, yr]
      return { ...prev, years: next }
    })
  }

  // Media unit labels
  const progressLabel =
    mediaType === "manga" || mediaType === "book"
      ? "Chapters"
      : mediaType === "game"
        ? "Hours"
        : mediaType === "music"
          ? "Plays"
          : "Episodes"

  const secondaryLabel =
    mediaType === "manga" || mediaType === "book"
      ? "Volumes"
      : mediaType === "tv"
        ? "Seasons"
        : null

  const rewatchLabel =
    mediaType === "manga" || mediaType === "book"
      ? "Rereads"
      : mediaType === "game"
        ? "Replays"
        : mediaType === "music"
          ? "Relistens"
          : "Rewatches"

  const companyLabel =
    mediaType === "anime"
      ? "Studios"
      : mediaType === "tv"
        ? "Networks / Studios"
        : mediaType === "game"
          ? "Developers / Publishers"
          : mediaType === "music"
            ? "Record Labels"
            : mediaType === "movie"
              ? "Studios"
              : "Publisher"

  const yearLabel =
    mediaType === "anime" || mediaType === "tv"
      ? "Aired / Year"
      : mediaType === "manga" || mediaType === "book"
        ? "Published / Year"
        : mediaType === "game" || mediaType === "movie" || mediaType === "music"
          ? "Released / Year"
          : "Year"

  const seriesProgressLabel =
    mediaType === "manga" || mediaType === "book"
      ? "Chapters & Volumes"
      : mediaType === "anime" || mediaType === "tv"
        ? "Episodes & Seasons"
        : mediaType === "game"
          ? "Hours / Length"
          : mediaType === "music"
            ? "Tracks / Length"
            : mediaType === "movie"
              ? "Duration"
              : "Total Length"

  const seriesPrimaryUnit =
    mediaType === "manga" || mediaType === "book"
      ? "Chapters"
      : mediaType === "game"
        ? "Hours"
        : mediaType === "music"
          ? "Tracks"
          : mediaType === "movie"
            ? "Minutes"
            : "Episodes"

  const seriesSecondaryUnit =
    mediaType === "manga" || mediaType === "book"
      ? "Volumes"
      : mediaType === "anime" || mediaType === "tv"
        ? "Seasons"
        : null

  // Filtered genres based on search
  const filteredGenres = useMemo(() => {
    if (!facets.genres) return []
    if (!genreSearch.trim()) return facets.genres
    const q = genreSearch.toLowerCase()
    return facets.genres.filter((g) => g.value.toLowerCase().includes(q))
  }, [facets.genres, genreSearch])

  // Filtered companies based on search
  const filteredCompanies = useMemo(() => {
    if (!facets.companies) return []
    if (!companySearch.trim()) return facets.companies
    const q = companySearch.toLowerCase()
    return facets.companies.filter((c) => c.value.toLowerCase().includes(q))
  }, [facets.companies, companySearch])

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      side="right"
      showCloseButton={false}
      className="w-full sm:max-w-md border-s border-frost bg-background/95 p-0 text-foreground shadow-2xl backdrop-blur-2xl flex flex-col"
    >
      {trigger && <SheetTrigger>{trigger}</SheetTrigger>}

      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-frost/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <IconFilter className="size-4.5 text-primary" />
          <SheetTitle className="font-heading text-base font-bold text-foreground">
            Filter List
          </SheetTitle>
          <SheetDescription className="sr-only">
            Filter entries in this media list
          </SheetDescription>
          {activeCount > 0 && (
            <Badge
              variant="default"
              className="h-5 rounded-full px-2 font-mono text-[11px]"
            >
              {activeCount}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onPress={handleReset}
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <IconRotate className="size-3.5" />
              <span>Reset</span>
            </Button>
          )}
          <SheetClose
            variant="ghost"
            size="icon-sm"
            className="size-7 rounded-lg border border-zinc-700/60 bg-zinc-900/80 text-zinc-200 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <IconX className="size-4 text-white stroke-[2.5]" style={{ color: "#ffffff", stroke: "#ffffff" }} />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>
      </div>

      {/* Scrollable Filters Accordion List */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] divide-y-0">
        {/* ================================================================ */}
        {/* SECTION 1: LIBRARY                                               */}
        {/* ================================================================ */}
        <div className="px-5 pt-4 pb-1.5 bg-zinc-950/60 border-b border-frost/20">
          <span className="font-mono text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            Library
          </span>
        </div>

        {/* 1. Status Dropdown */}
        <FilterAccordionRow
          id="status"
          label="Status"
          icon={IconBookmark}
          activeCount={localFilters.statuses.length}
          isOpen={Boolean(openDropdowns.status)}
          onToggle={() => toggleDropdown("status")}
        >
          <div className="flex flex-wrap gap-1.5">
            {(
              facets.statuses || [
                { value: "IN_PROGRESS", count: 0 },
                { value: "COMPLETED", count: 0 },
                { value: "ON_HOLD", count: 0 },
                { value: "DROPPED", count: 0 },
                { value: "PLANNED", count: 0 },
                { value: "MAYBE", count: 0 },
              ]
            ).map((st) => {
              const isSelected = localFilters.statuses.includes(st.value)
              return (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => toggleArrayFilter("statuses", st.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold transition-all cursor-pointer select-none",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-frost bg-frost/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60"
                  )}
                >
                  <span>
                    {st.value.charAt(0) +
                      st.value.slice(1).toLowerCase().replace(/_/g, " ")}
                  </span>
                  {st.count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                        isSelected
                          ? "bg-black/25 text-white"
                          : "bg-zinc-800/80 text-zinc-400"
                      )}
                    >
                      {st.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </FilterAccordionRow>

        {/* 2. Connections Dropdown */}
        <FilterAccordionRow
          id="connections"
          label="Connections"
          icon={IconLink}
          activeCount={
            (localFilters.connections?.length || 0) +
            (localFilters.excludeConnections?.length || 0)
          }
          isOpen={Boolean(openDropdowns.connections)}
          onToggle={() => toggleDropdown("connections")}
        >
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const defaultProviders = [
                  "AniList",
                  "MyAnimeList",
                  "SIMKL",
                  "Bangumi",
                  "Hikka",
                  "MangaUpdates",
                  "TMDB",
                  "TVDB",
                  "IGDB",
                  "OpenLibrary",
                  "MusicBrainz",
                ]
                const facetMap = new Map<string, { value: string; count: number }>()
                for (const p of defaultProviders) {
                  facetMap.set(p.toLowerCase(), { value: p, count: 0 })
                }
                for (const c of facets.connections ?? []) {
                  const existing = facetMap.get(c.value.toLowerCase())
                  facetMap.set(c.value.toLowerCase(), {
                    value: existing?.value ?? c.value,
                    count: c.count,
                  })
                }
                return Array.from(facetMap.values())
              })().map((conn) => {
                const isIncluded = localFilters.connections.includes(conn.value)
                const isExcluded = (localFilters.excludeConnections ?? []).includes(conn.value)
                const handleCycle = () => {
                  setLocalFilters((prev) => {
                    const inc = prev.connections ?? []
                    const exc = prev.excludeConnections ?? []
                    if (!isIncluded && !isExcluded) {
                      return { ...prev, connections: [...inc, conn.value] }
                    }
                    if (isIncluded) {
                      return {
                        ...prev,
                        connections: inc.filter((v) => v !== conn.value),
                        excludeConnections: [...exc, conn.value],
                      }
                    }
                    return {
                      ...prev,
                      excludeConnections: exc.filter((v) => v !== conn.value),
                    }
                  })
                }
                return (
                  <button
                    key={conn.value}
                    type="button"
                    onClick={handleCycle}
                    title={
                      isIncluded
                        ? `Has ${conn.value} (click to switch to Doesn't have)`
                        : isExcluded
                          ? `Doesn't have ${conn.value} (click to clear)`
                          : `Click to filter by Has ${conn.value}`
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold transition-all cursor-pointer select-none",
                      isIncluded
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : isExcluded
                          ? "border-destructive/60 bg-destructive/15 text-destructive shadow-xs"
                          : "border-border/60 bg-muted/40 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {isIncluded && <IconCheck className="size-3 shrink-0" />}
                    {isExcluded && <IconX className="size-3 shrink-0" />}
                    <span>{conn.value}</span>
                    {conn.count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                          isIncluded
                            ? "bg-black/25 text-primary-foreground"
                            : isExcluded
                              ? "bg-destructive/20 text-destructive"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {conn.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
        </FilterAccordionRow>

        {/* 3. Progress Dropdown */}
        <FilterAccordionRow
          id="progress"
          label="Progress"
          icon={IconBook}
          activeCount={
            (localFilters.progressMin !== null ||
              localFilters.progressMax !== null ||
              localFilters.secondaryProgressMin !== null ||
              localFilters.secondaryProgressMax !== null)
              ? 1
              : 0
          }
          isOpen={Boolean(openDropdowns.progress)}
          onToggle={() => toggleDropdown("progress")}
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                {progressLabel}
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={localFilters.progressMin ?? ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      progressMin: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
                />
                <span className="text-muted-foreground text-xs font-mono">—</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Max"
                  value={localFilters.progressMax ?? ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      progressMax: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
                />
              </div>
            </div>

            {secondaryLabel && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  {secondaryLabel}
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Min"
                    value={localFilters.secondaryProgressMin ?? ""}
                    onChange={(e) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        secondaryProgressMin:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
                  />
                  <span className="text-muted-foreground text-xs font-mono">—</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Max"
                    value={localFilters.secondaryProgressMax ?? ""}
                    onChange={(e) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        secondaryProgressMax:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </FilterAccordionRow>

        {/* 4. Rereads / Rewatches Dropdown */}
        <FilterAccordionRow
          id="rewatch"
          label={rewatchLabel}
          icon={IconRotateClockwise}
          activeCount={
            localFilters.rewatchMin !== null || localFilters.rewatchMax !== null ? 1 : 0
          }
          isOpen={Boolean(openDropdowns.rewatch)}
          onToggle={() => toggleDropdown("rewatch")}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              placeholder="Min"
              value={localFilters.rewatchMin ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  rewatchMin: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
            />
            <span className="text-muted-foreground text-xs font-mono">—</span>
            <Input
              type="number"
              min={0}
              placeholder="Max"
              value={localFilters.rewatchMax ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  rewatchMax: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
            />
          </div>
        </FilterAccordionRow>

        {/* 5. My Rating Dropdown */}
        <FilterAccordionRow
          id="rating"
          label="My Rating"
          icon={IconStar}
          activeCount={
            localFilters.ratingMin !== null || localFilters.ratingMax !== null ? 1 : 0
          }
          isOpen={Boolean(openDropdowns.rating)}
          onToggle={() => toggleDropdown("rating")}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={10}
              step={0.5}
              placeholder="Min"
              value={localFilters.ratingMin ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  ratingMin: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
            />
            <span className="text-muted-foreground text-xs font-mono">—</span>
            <Input
              type="number"
              min={0}
              max={10}
              step={0.5}
              placeholder="Max"
              value={localFilters.ratingMax ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  ratingMax: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
            />
          </div>
        </FilterAccordionRow>

        {/* 6. Priority Dropdown */}
        <FilterAccordionRow
          id="priority"
          label="Priority"
          icon={IconFlag}
          activeCount={localFilters.priorities.length}
          isOpen={Boolean(openDropdowns.priority)}
          onToggle={() => toggleDropdown("priority")}
        >
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { key: "LOW", label: "Low", color: "border-zinc-700 text-zinc-300 bg-zinc-800" },
              { key: "MEDIUM", label: "Med", color: "border-amber-500/60 text-amber-300 bg-amber-500/20" },
              { key: "HIGH", label: "High", color: "border-rose-500/60 text-rose-300 bg-rose-500/20" },
              { key: "ULTRA", label: "Ultra", color: "border-purple-500/60 text-purple-300 bg-purple-500/20" },
            ].map((p) => {
              const isSelected = localFilters.priorities.includes(p.key)
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => toggleArrayFilter("priorities", p.key)}
                  className={cn(
                    "flex items-center justify-center rounded-xl border py-1.5 text-xs font-bold transition-all cursor-pointer select-none",
                    isSelected
                      ? cn("shadow-xs", p.color)
                      : "border-frost bg-frost/50 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </FilterAccordionRow>

        {/* 7. Privacy Dropdown */}
        <FilterAccordionRow
          id="privacy"
          label="Privacy"
          icon={IconLock}
          activeCount={localFilters.privacy !== "all" ? 1 : 0}
          isOpen={Boolean(openDropdowns.privacy)}
          onToggle={() => toggleDropdown("privacy")}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setLocalFilters((prev) => ({
                  ...prev,
                  privacy: prev.privacy === "public" ? "all" : "public",
                }))
              }
              className={cn(
                "rounded-xl border py-2 text-xs font-semibold transition-all select-none cursor-pointer",
                localFilters.privacy === "public"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-frost bg-frost/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              Public Only
            </button>
            <button
              type="button"
              onClick={() =>
                setLocalFilters((prev) => ({
                  ...prev,
                  privacy: prev.privacy === "private" ? "all" : "private",
                }))
              }
              className={cn(
                "rounded-xl border py-2 text-xs font-semibold transition-all select-none cursor-pointer",
                localFilters.privacy === "private"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-frost bg-frost/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              Private Only
            </button>
          </div>
        </FilterAccordionRow>

        {/* 8. Notes Dropdown */}
        <FilterAccordionRow
          id="notes"
          label="Notes"
          icon={IconFileText}
          activeCount={localFilters.notes !== "all" ? 1 : 0}
          isOpen={Boolean(openDropdowns.notes)}
          onToggle={() => toggleDropdown("notes")}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setLocalFilters((prev) => ({
                  ...prev,
                  notes: prev.notes === "withNotes" ? "all" : "withNotes",
                }))
              }
              className={cn(
                "rounded-xl border py-2 text-xs font-semibold transition-all select-none cursor-pointer",
                localFilters.notes === "withNotes"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-frost bg-frost/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              Has Notes
            </button>
            <button
              type="button"
              onClick={() =>
                setLocalFilters((prev) => ({
                  ...prev,
                  notes: prev.notes === "withoutNotes" ? "all" : "withoutNotes",
                }))
              }
              className={cn(
                "rounded-xl border py-2 text-xs font-semibold transition-all select-none cursor-pointer",
                localFilters.notes === "withoutNotes"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-frost bg-frost/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              No Notes
            </button>
          </div>
        </FilterAccordionRow>

        {/* 9. Dates Dropdown */}
        <FilterAccordionRow
          id="dates"
          label="Dates"
          icon={IconCalendar}
          activeCount={
            (localFilters.startedAfter || localFilters.startedBefore ? 1 : 0) +
            (localFilters.completedAfter || localFilters.completedBefore ? 1 : 0)
          }
          isOpen={Boolean(openDropdowns.dates)}
          onToggle={() => toggleDropdown("dates")}
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Started
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={localFilters.startedAfter ?? ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      startedAfter: e.target.value || null,
                    }))
                  }
                  className="h-8 rounded-xl border-frost bg-frost/60 text-xs text-zinc-200"
                />
                <span className="text-muted-foreground text-xs font-mono">—</span>
                <Input
                  type="date"
                  value={localFilters.startedBefore ?? ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      startedBefore: e.target.value || null,
                    }))
                  }
                  className="h-8 rounded-xl border-frost bg-frost/60 text-xs text-zinc-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Completed
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={localFilters.completedAfter ?? ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      completedAfter: e.target.value || null,
                    }))
                  }
                  className="h-8 rounded-xl border-frost bg-frost/60 text-xs text-zinc-200"
                />
                <span className="text-muted-foreground text-xs font-mono">—</span>
                <Input
                  type="date"
                  value={localFilters.completedBefore ?? ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      completedBefore: e.target.value || null,
                    }))
                  }
                  className="h-8 rounded-xl border-frost bg-frost/60 text-xs text-zinc-200"
                />
              </div>
            </div>
          </div>
        </FilterAccordionRow>

        {/* ================================================================ */}
        {/* SECTION 2: SERIES                                                */}
        {/* ================================================================ */}
        <div className="px-5 pt-5 pb-1.5 bg-zinc-950/60 border-t border-b border-frost/20">
          <span className="font-mono text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            Series
          </span>
        </div>

        {/* 1. Format Dropdown */}
        {facets.formats && facets.formats.length > 0 && (
          <FilterAccordionRow
            id="format"
            label="Format"
            icon={IconDeviceTv}
            activeCount={localFilters.formats.length}
            isOpen={Boolean(openDropdowns.format)}
            onToggle={() => toggleDropdown("format")}
          >
            <div className="flex flex-wrap gap-1.5">
              {facets.formats.map((fmt) => {
                const isSelected = localFilters.formats.includes(fmt.value)
                return (
                  <button
                    key={fmt.value}
                    type="button"
                    onClick={() => toggleArrayFilter("formats", fmt.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-frost bg-frost/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60"
                    )}
                  >
                    <span>{fmt.value.replace(/_/g, " ")}</span>
                    {fmt.count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                          isSelected
                            ? "bg-black/25 text-white"
                            : "bg-zinc-800/80 text-zinc-400"
                        )}
                      >
                        {fmt.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </FilterAccordionRow>
        )}

        {/* 2. Status (Release Status) Dropdown */}
        {facets.mediaStatuses && facets.mediaStatuses.length > 0 && (
          <FilterAccordionRow
            id="mediaStatus"
            label="Status"
            icon={IconActivity}
            activeCount={localFilters.mediaStatuses.length}
            isOpen={Boolean(openDropdowns.mediaStatus)}
            onToggle={() => toggleDropdown("mediaStatus")}
          >
            <div className="flex flex-wrap gap-1.5">
              {facets.mediaStatuses.map((ms) => {
                const isSelected = localFilters.mediaStatuses.includes(ms.value)
                return (
                  <button
                    key={ms.value}
                    type="button"
                    onClick={() => toggleArrayFilter("mediaStatuses", ms.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-frost bg-frost/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60"
                    )}
                  >
                    <span>
                      {ms.value.charAt(0) +
                        ms.value.slice(1).toLowerCase().replace(/_/g, " ")}
                    </span>
                    {ms.count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                          isSelected
                            ? "bg-black/25 text-white"
                            : "bg-zinc-800/80 text-zinc-400"
                        )}
                      >
                        {ms.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </FilterAccordionRow>
        )}

        {/* 3. Genres & Tags Dropdown */}
        {facets.genres && facets.genres.length > 0 && (
          <FilterAccordionRow
            id="genres"
            label="Genres & Tags"
            icon={IconTag}
            activeCount={localFilters.genres.length}
            isOpen={Boolean(openDropdowns.genres)}
            onToggle={() => toggleDropdown("genres")}
          >
            <div className="space-y-2.5">
              {facets.genres.length > 8 && (
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute start-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search genres..."
                    value={genreSearch}
                    onChange={(e) => setGenreSearch(e.target.value)}
                    className="h-7.5 rounded-xl border-frost bg-frost/60 ps-8 text-xs"
                  />
                  {genreSearch && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onPress={() => setGenreSearch("")}
                      className="absolute end-2 top-1/2 -translate-y-1/2 size-4.5 rounded-full text-zinc-400 hover:text-white"
                    >
                      <IconX className="size-3" />
                    </Button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto [scrollbar-width:thin]">
                {filteredGenres.map((g) => {
                  const isSelected = localFilters.genres.includes(g.value)
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleArrayFilter("genres", g.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer select-none",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-frost bg-frost/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60"
                      )}
                    >
                      <span>{g.value}</span>
                      {g.count > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                            isSelected
                              ? "bg-black/25 text-white"
                              : "bg-zinc-800/80 text-zinc-400"
                          )}
                        >
                          {g.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </FilterAccordionRow>
        )}

        {/* 4. Publisher / Studio Dropdown */}
        {facets.companies && facets.companies.length > 0 && (
          <FilterAccordionRow
            id="company"
            label={companyLabel}
            icon={IconBuilding}
            activeCount={localFilters.companies.length}
            isOpen={Boolean(openDropdowns.company)}
            onToggle={() => toggleDropdown("company")}
          >
            <div className="space-y-2.5">
              {facets.companies.length > 8 && (
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute start-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={`Search ${companyLabel.toLowerCase()}...`}
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="h-7.5 rounded-xl border-frost bg-frost/60 ps-8 text-xs"
                  />
                  {companySearch && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onPress={() => setCompanySearch("")}
                      className="absolute end-2 top-1/2 -translate-y-1/2 size-4.5 rounded-full text-zinc-400 hover:text-white"
                    >
                      <IconX className="size-3" />
                    </Button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto [scrollbar-width:thin]">
                {filteredCompanies.map((c) => {
                  const isSelected = localFilters.companies.includes(c.value)
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => toggleArrayFilter("companies", c.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer select-none",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-frost bg-frost/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60"
                      )}
                    >
                      <span>{c.value}</span>
                      {c.count > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                            isSelected
                              ? "bg-black/25 text-white"
                              : "bg-zinc-800/80 text-zinc-400"
                          )}
                        >
                          {c.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </FilterAccordionRow>
        )}

        {/* 5. Published / Year Dropdown */}
        {facets.years && facets.years.length > 0 && (
          <FilterAccordionRow
            id="year"
            label={yearLabel}
            icon={IconCalendarEvent}
            activeCount={localFilters.years.length}
            isOpen={Boolean(openDropdowns.year)}
            onToggle={() => toggleDropdown("year")}
          >
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto [scrollbar-width:thin]">
              {facets.years.map((yr) => {
                const isSelected = localFilters.years.includes(yr.value)
                return (
                  <button
                    key={yr.value}
                    type="button"
                    onClick={() => toggleYearFilter(yr.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-2.5 py-1 font-mono text-xs font-semibold transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-frost bg-frost/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60"
                    )}
                  >
                    <span>{yr.value}</span>
                    {yr.count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px]",
                          isSelected
                            ? "bg-black/25 text-white"
                            : "bg-zinc-800/80 text-zinc-400"
                        )}
                      >
                        {yr.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </FilterAccordionRow>
        )}

        {/* 6. Staff Dropdown */}
        <FilterAccordionRow
          id="staff"
          label="Staff"
          icon={IconUsers}
          activeCount={localFilters.staff?.length || 0}
          isOpen={Boolean(openDropdowns.staff)}
          onToggle={() => toggleDropdown("staff")}
        >
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Search or filter by staff..."
              value={staffInput}
              onChange={(e) => setStaffInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && staffInput.trim()) {
                  e.preventDefault()
                  const val = staffInput.trim()
                  if (!localFilters.staff?.includes(val)) {
                    setLocalFilters((prev) => ({
                      ...prev,
                      staff: [...(prev.staff || []), val],
                    }))
                  }
                  setStaffInput("")
                }
              }}
              className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
            />
            {localFilters.staff && localFilters.staff.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {localFilters.staff.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setLocalFilters((prev) => ({
                          ...prev,
                          staff: prev.staff?.filter((s) => s !== name),
                        }))
                      }
                      className="text-primary hover:text-white"
                    >
                      <IconX className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </FilterAccordionRow>

        {/* 7. Licensed? Dropdown */}
        <FilterAccordionRow
          id="licensed"
          label="Licensed?"
          icon={IconCertificate}
          activeCount={localFilters.licensed && localFilters.licensed !== "all" ? 1 : 0}
          isOpen={Boolean(openDropdowns.licensed)}
          onToggle={() => toggleDropdown("licensed")}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setLocalFilters((prev) => ({
                  ...prev,
                  licensed: prev.licensed === "yes" ? "all" : "yes",
                }))
              }
              className={cn(
                "rounded-xl border py-2 text-xs font-semibold transition-all select-none cursor-pointer",
                localFilters.licensed === "yes"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-frost bg-frost/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              Licensed
            </button>
            <button
              type="button"
              onClick={() =>
                setLocalFilters((prev) => ({
                  ...prev,
                  licensed: prev.licensed === "no" ? "all" : "no",
                }))
              }
              className={cn(
                "rounded-xl border py-2 text-xs font-semibold transition-all select-none cursor-pointer",
                localFilters.licensed === "no"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-frost bg-frost/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              Unlicensed
            </button>
          </div>
        </FilterAccordionRow>

        {/* 8. Rating (Series Average Rating) Dropdown */}
        <FilterAccordionRow
          id="seriesRating"
          label="Rating"
          icon={IconStar}
          activeCount={
            (localFilters.seriesScoreMin !== null && localFilters.seriesScoreMin !== undefined) ||
            (localFilters.seriesScoreMax !== null && localFilters.seriesScoreMax !== undefined)
              ? 1
              : 0
          }
          isOpen={Boolean(openDropdowns.seriesRating)}
          onToggle={() => toggleDropdown("seriesRating")}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={10}
              step={0.5}
              placeholder="Min"
              value={localFilters.seriesScoreMin ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  seriesScoreMin:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
            />
            <span className="text-muted-foreground text-xs font-mono">—</span>
            <Input
              type="number"
              min={0}
              max={10}
              step={0.5}
              placeholder="Max"
              value={localFilters.seriesScoreMax ?? ""}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  seriesScoreMax:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
            />
          </div>
        </FilterAccordionRow>

        {/* 6. Season Dropdown (Anime / TV) */}
        {facets.seasons && facets.seasons.length > 0 && (
          <FilterAccordionRow
            id="season"
            label="Season"
            icon={IconSun}
            activeCount={localFilters.seasons.length}
            isOpen={Boolean(openDropdowns.season)}
            onToggle={() => toggleDropdown("season")}
          >
            <div className="grid grid-cols-4 gap-1.5">
              {facets.seasons.map((s) => {
                const isSelected = localFilters.seasons.includes(s.value)
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleArrayFilter("seasons", s.value)}
                    className={cn(
                      "flex items-center justify-center rounded-xl border py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-frost bg-frost/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60"
                    )}
                  >
                    <span>{s.value.toLowerCase()}</span>
                  </button>
                )
              })}
            </div>
          </FilterAccordionRow>
        )}

        {/* 7. Country of Origin Dropdown */}
        {facets.countries && facets.countries.length > 0 && (
          <FilterAccordionRow
            id="country"
            label="Origin / Country"
            icon={IconWorld}
            activeCount={localFilters.countries.length}
            isOpen={Boolean(openDropdowns.country)}
            onToggle={() => toggleDropdown("country")}
          >
            <div className="flex flex-wrap gap-1.5">
              {facets.countries.map((c) => {
                const isSelected = localFilters.countries.includes(c.value)
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleArrayFilter("countries", c.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-frost bg-frost/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60"
                    )}
                  >
                    <span>{c.value}</span>
                    {c.count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                          isSelected
                            ? "bg-black/25 text-white"
                            : "bg-zinc-800/80 text-zinc-400"
                        )}
                      >
                        {c.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </FilterAccordionRow>
        )}

        {/* 8. Total Units / Length Dropdown */}
        <FilterAccordionRow
          id="seriesProgress"
          label={seriesProgressLabel}
          icon={IconListNumbers}
          activeCount={
            (localFilters.seriesProgressMin !== null ||
            localFilters.seriesProgressMax !== null
              ? 1
              : 0) +
            (localFilters.seriesSecondaryProgressMin !== null ||
            localFilters.seriesSecondaryProgressMax !== null
              ? 1
              : 0)
          }
          isOpen={Boolean(openDropdowns.seriesProgress)}
          onToggle={() => toggleDropdown("seriesProgress")}
        >
          <div className="space-y-3">
            {/* Primary Series Unit */}
            <div className="space-y-1.5">
              {seriesSecondaryUnit && (
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  {seriesPrimaryUnit}
                </span>
              )}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={localFilters.seriesProgressMin ?? ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      seriesProgressMin:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
                />
                <span className="text-muted-foreground text-xs font-mono">—</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Max"
                  value={localFilters.seriesProgressMax ?? ""}
                  onChange={(e) =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      seriesProgressMax:
                        e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
                />
              </div>
            </div>

            {/* Secondary Series Unit (e.g. Volumes for Manga/Books, Seasons for TV/Anime) */}
            {seriesSecondaryUnit && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  {seriesSecondaryUnit}
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Min"
                    value={localFilters.seriesSecondaryProgressMin ?? ""}
                    onChange={(e) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        seriesSecondaryProgressMin:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
                  />
                  <span className="text-muted-foreground text-xs font-mono">—</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Max"
                    value={localFilters.seriesSecondaryProgressMax ?? ""}
                    onChange={(e) =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        seriesSecondaryProgressMax:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className="h-8 rounded-xl border-frost bg-frost/60 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </FilterAccordionRow>

        {/* 11. Content Rating Dropdown */}
        <FilterAccordionRow
          id="adult"
          label="Content Rating"
          icon={IconFlame}
          activeCount={localFilters.adult !== "all" ? 1 : 0}
          isOpen={Boolean(openDropdowns.adult)}
          onToggle={() => toggleDropdown("adult")}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setLocalFilters((prev) => ({
                  ...prev,
                  adult: prev.adult === "sfw" ? "all" : "sfw",
                }))
              }
              className={cn(
                "rounded-xl border py-2 text-xs font-semibold transition-all select-none cursor-pointer",
                localFilters.adult === "sfw"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-frost bg-frost/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              SFW Only
            </button>
            <button
              type="button"
              onClick={() =>
                setLocalFilters((prev) => ({
                  ...prev,
                  adult: prev.adult === "nsfw" ? "all" : "nsfw",
                }))
              }
              className={cn(
                "rounded-xl border py-2 text-xs font-semibold transition-all select-none cursor-pointer",
                localFilters.adult === "nsfw"
                  ? "border-rose-500 bg-rose-500/20 text-rose-300 shadow-xs"
                  : "border-frost bg-frost/50 text-zinc-400 hover:text-zinc-200"
              )}
            >
              NSFW (18+)
            </button>
          </div>
        </FilterAccordionRow>
      </div>
    </Sheet>
  )
}
