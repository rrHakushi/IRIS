"use client"

import React from "react"
import {
  IconSearch,
  IconX,
  IconSortAscending,
  IconSortDescending,
  IconChevronDown,
  IconLoader2,
  IconFilter,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Badge } from "@workspace/ui/components/badge"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  type UserListFilterState,
  DEFAULT_USER_LIST_FILTER_STATE,
  countActiveFilters,
} from "./user-list-filter-sheet"

export type ListViewTab = "list" | "comments" | "stats" | "activity"
export type SortByOption =
  | "updatedAt"
  | "score"
  | "title"
  | "progress"
  | "addedAt"
  | "createdAt"
  | "priority"
export type SortOrderOption = "asc" | "desc"

export interface UserListToolbarProps {
  mediaType: string
  activeTab: ListViewTab
  onTabChange: (tab: ListViewTab) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  isSearching?: boolean
  sortBy: SortByOption
  onSortByChange: (sort: SortByOption) => void
  sortOrder: SortOrderOption
  onSortOrderChange: (order: SortOrderOption) => void
  filters: UserListFilterState
  onFiltersChange: (filters: UserListFilterState) => void
  onOpenFilterSheet: () => void
  action?: React.ReactNode
  className?: string
}

const SORT_OPTIONS: Array<{ value: SortByOption; label: string }> = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "score", label: "Score" },
  { value: "title", label: "Title" },
  { value: "progress", label: "Progress" },
  { value: "priority", label: "Priority" },
  { value: "addedAt", label: "Date Added" },
]

export function UserListToolbar({
  mediaType,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  isSearching = false,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  filters,
  onFiltersChange,
  onOpenFilterSheet,
  action,
  className,
}: UserListToolbarProps): React.JSX.Element {
  const activeFilterCount = countActiveFilters(filters)

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Last Updated"

  const handleClearSingleFilter = (remover: (prev: UserListFilterState) => UserListFilterState) => {
    onFiltersChange(remover(filters))
  }

  const handleClearAllFilters = () => {
    onFiltersChange(DEFAULT_USER_LIST_FILTER_STATE)
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl border border-frost bg-frost/70 p-2.5 text-zinc-100 shadow-xl backdrop-blur-2xl transition-all",
        className
      )}
    >
      {/* 1. Main Controls Row */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
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
            className="h-8.5 w-full rounded-2xl border border-frost bg-zinc-900/60 ps-9 pe-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary backdrop-blur-md"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon-xs"
              onPress={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute end-2 top-1/2 z-10 size-5.5 -translate-y-1/2 rounded-full text-zinc-400 hover:text-white"
            >
              <IconX className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Right: View Switcher, Sort Controls, Filters Button, Action */}
        <div className="no-scrollbar flex flex-wrap items-center gap-2 overflow-x-auto">
          {action}

          {/* View Switcher: List | Comments | Stats | Activity */}
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => onTabChange(String(key) as ListViewTab)}
            className="shrink-0 gap-0"
          >
            <TabsList
              aria-label="View Switcher"
              className="h-8 gap-0.5 rounded-full border border-frost bg-frost/80 p-0.5 backdrop-blur-md"
            >
              <TabsTrigger
                id="list"
                className="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all text-zinc-400 hover:text-zinc-100 data-selected:bg-zinc-800/90 data-selected:text-white data-selected:shadow-xs"
              >
                List
              </TabsTrigger>
              <TabsTrigger
                id="comments"
                className="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all text-zinc-400 hover:text-zinc-100 data-selected:bg-zinc-800/90 data-selected:text-white data-selected:shadow-xs"
              >
                Comments
              </TabsTrigger>
              <TabsTrigger
                id="stats"
                className="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all text-zinc-400 hover:text-zinc-100 data-selected:bg-zinc-800/90 data-selected:text-white data-selected:shadow-xs"
              >
                Stats
              </TabsTrigger>
              <TabsTrigger
                id="activity"
                className="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all text-zinc-400 hover:text-zinc-100 data-selected:bg-zinc-800/90 data-selected:text-white data-selected:shadow-xs"
              >
                Activity
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Sort Dropdown */}
          <DropdownMenuTrigger>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-2xl border-frost bg-frost/80 px-3 text-xs text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white backdrop-blur-md"
            >
              <span className="text-[11px] text-zinc-400 uppercase font-mono">Sort:</span>
              <span>{currentSortLabel}</span>
              <IconChevronDown className="size-3.5 shrink-0 opacity-60" />
            </Button>

            <DropdownMenu
              placement="bottom end"
              className="w-44 rounded-2xl border border-frost bg-frost/95 p-1 text-zinc-100 shadow-2xl backdrop-blur-2xl z-50 animate-none!"
            >
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onAction={() => onSortByChange(opt.value)}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs select-none cursor-pointer",
                    opt.value === sortBy
                      ? "bg-zinc-800/90 font-semibold text-white"
                      : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                  )}
                >
                  <span>{opt.label}</span>
                  {opt.value === sortBy && (
                    <span className="size-1.5 rounded-full bg-white" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenu>
          </DropdownMenuTrigger>

          {/* Sort Asc/Desc Button */}
          <Button
            variant="outline"
            size="icon-sm"
            onPress={() =>
              onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")
            }
            aria-label={
              sortOrder === "asc" ? "Sort Ascending" : "Sort Descending"
            }
            className="size-8 rounded-2xl border border-frost bg-frost/80 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white backdrop-blur-md"
          >
            {sortOrder === "asc" ? (
              <IconSortAscending className="size-4" />
            ) : (
              <IconSortDescending className="size-4" />
            )}
          </Button>

          {/* "Filters" Sheet Trigger Button */}
          <Button
            variant={activeFilterCount > 0 ? "default" : "outline"}
            size="sm"
            onPress={onOpenFilterSheet}
            className={cn(
              "h-8 gap-1.5 rounded-2xl px-3.5 text-xs font-semibold backdrop-blur-md transition-all shadow-xs",
              activeFilterCount > 0
                ? "bg-primary text-primary-foreground shadow-primary/25"
                : "border-frost bg-frost/80 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <IconFilter className="size-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-black/25 px-1.5 py-0.2 font-mono text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Active Filter Chips Row (renders only when filters are active) */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-frost/40 pt-2 text-xs">
          <span className="font-mono text-[11px] text-muted-foreground uppercase ps-0.5">
            Active:
          </span>

          {/* Status chips */}
          {filters.statuses.map((st) => (
            <Badge
              key={st}
              variant="secondary"
              className="gap-1 rounded-xl border border-frost bg-frost/80 ps-2 pe-1 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md"
            >
              <span>{st.toLowerCase().replace(/_/g, " ")}</span>
              <button
                type="button"
                onClick={() =>
                  handleClearSingleFilter((p) => ({
                    ...p,
                    statuses: p.statuses.filter((x) => x !== st),
                  }))
                }
                className="rounded-full hover:bg-white/10 p-0.5 text-zinc-400 hover:text-white"
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          ))}

          {/* Priority chips */}
          {filters.priorities.map((pr) => (
            <Badge
              key={pr}
              variant="secondary"
              className="gap-1 rounded-xl border border-frost bg-frost/80 ps-2 pe-1 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md"
            >
              <span>Priority: {pr}</span>
              <button
                type="button"
                onClick={() =>
                  handleClearSingleFilter((p) => ({
                    ...p,
                    priorities: p.priorities.filter((x) => x !== pr),
                  }))
                }
                className="rounded-full hover:bg-white/10 p-0.5 text-zinc-400 hover:text-white"
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          ))}

          {/* Privacy chip */}
          {filters.privacy !== "all" && (
            <Badge
              variant="secondary"
              className="gap-1 rounded-xl border border-frost bg-frost/80 ps-2 pe-1 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md"
            >
              <span>{filters.privacy}</span>
              <button
                type="button"
                onClick={() =>
                  handleClearSingleFilter((p) => ({ ...p, privacy: "all" }))
                }
                className="rounded-full hover:bg-white/10 p-0.5 text-zinc-400 hover:text-white"
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          )}

          {/* Notes chip */}
          {filters.notes !== "all" && (
            <Badge
              variant="secondary"
              className="gap-1 rounded-xl border border-frost bg-frost/80 ps-2 pe-1 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md"
            >
              <span>{filters.notes === "withNotes" ? "Has notes" : "No notes"}</span>
              <button
                type="button"
                onClick={() =>
                  handleClearSingleFilter((p) => ({ ...p, notes: "all" }))
                }
                className="rounded-full hover:bg-white/10 p-0.5 text-zinc-400 hover:text-white"
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          )}

          {/* Adult chip */}
          {filters.adult !== "all" && (
            <Badge
              variant="secondary"
              className="gap-1 rounded-xl border border-frost bg-frost/80 ps-2 pe-1 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md"
            >
              <span>{filters.adult.toUpperCase()}</span>
              <button
                type="button"
                onClick={() =>
                  handleClearSingleFilter((p) => ({ ...p, adult: "all" }))
                }
                className="rounded-full hover:bg-white/10 p-0.5 text-zinc-400 hover:text-white"
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          )}

          {/* Formats chips */}
          {filters.formats.map((fmt) => (
            <Badge
              key={fmt}
              variant="secondary"
              className="gap-1 rounded-xl border border-frost bg-frost/80 ps-2 pe-1 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md"
            >
              <span>{fmt}</span>
              <button
                type="button"
                onClick={() =>
                  handleClearSingleFilter((p) => ({
                    ...p,
                    formats: p.formats.filter((x) => x !== fmt),
                  }))
                }
                className="rounded-full hover:bg-white/10 p-0.5 text-zinc-400 hover:text-white"
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          ))}

          {/* Genres chips */}
          {filters.genres.map((g) => (
            <Badge
              key={g}
              variant="secondary"
              className="gap-1 rounded-xl border border-frost bg-frost/80 ps-2 pe-1 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md"
            >
              <span>{g}</span>
              <button
                type="button"
                onClick={() =>
                  handleClearSingleFilter((p) => ({
                    ...p,
                    genres: p.genres.filter((x) => x !== g),
                  }))
                }
                className="rounded-full hover:bg-white/10 p-0.5 text-zinc-400 hover:text-white"
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          ))}

          {/* Progress range chip */}
          {(filters.progressMin !== null || filters.progressMax !== null) && (
            <Badge
              variant="secondary"
              className="gap-1 rounded-xl border border-frost bg-frost/80 ps-2 pe-1 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md"
            >
              <span>
                Prog: {filters.progressMin ?? 0} - {filters.progressMax ?? "∞"}
              </span>
              <button
                type="button"
                onClick={() =>
                  handleClearSingleFilter((p) => ({
                    ...p,
                    progressMin: null,
                    progressMax: null,
                  }))
                }
                className="rounded-full hover:bg-white/10 p-0.5 text-zinc-400 hover:text-white"
              >
                <IconX className="size-3" />
              </button>
            </Badge>
          )}

          {/* Clear all link */}
          <Button
            variant="ghost"
            size="sm"
            onPress={handleClearAllFilters}
            className="h-6 px-1.5 text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}

