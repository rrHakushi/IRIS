"use client"

import React, { useState, useMemo } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Switch } from "@workspace/ui/components/switch"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconX,
  IconCheck,
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconDeviceGamepad2,
  IconHeadphones,
  IconPlaylist,
  IconCloudDownload,
  IconFilter,
} from "@tabler/icons-react"

export interface ImportItemPayload {
  mediaType:
    | "anime"
    | "manga"
    | "tv"
    | "movie"
    | "game"
    | "book"
    | "music"
    | "custom_lists"
  title: string
  externalIds: {
    anilistId?: number | null
    malId?: number | null
    tvDBId?: number | null
    simklId?: number | null
    tmdbId?: number | null
    imdbId?: string | null
    googleBookId?: string | null
    isbn13?: string | null
    deezerId?: string | null
    igdbId?: number | null
    steamAppId?: number | null
    [key: string]: unknown
  }
  status: string
  progress?: number
  progressVolumes?: number | null
  progressPages?: number | null
  progressChapters?: number | null
  score?: number | null
  notes?: string | null
  rewatched?: number
  reread?: number
  replayed?: number
  playCount?: number
  startedAt?: string | null
  completedAt?: string | null
  connections?: unknown
  customListName?: string
  customNotes?: string | null
  order?: number
}

interface ImportItemSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceName: string
  items: ImportItemPayload[]
  onConfirmImport: (
    selectedItems: ImportItemPayload[],
    skipExisting: boolean
  ) => Promise<void>
  isSubmitting?: boolean
}

const TYPE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  anime: IconDeviceTv,
  manga: IconBook,
  tv: IconDeviceTv,
  movie: IconMovie,
  game: IconDeviceGamepad2,
  book: IconBook,
  music: IconHeadphones,
  custom_lists: IconPlaylist,
}

const TYPE_LABELS: Record<string, string> = {
  anime: "Anime",
  manga: "Manga",
  tv: "TV",
  movie: "Movie",
  game: "Game",
  book: "Book",
  music: "Music",
  custom_lists: "Custom List",
}

export function ImportItemSelectionDialog({
  open,
  onOpenChange,
  sourceName,
  items,
  onConfirmImport,
  isSubmitting = false,
}: ImportItemSelectionDialogProps): React.JSX.Element {
  // Selected indices map: Set of indices into `items`
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(items.map((_, i) => i))
  )
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [skipExisting, setSkipExisting] = useState<boolean>(false)

  // Reset or initialize selection whenever items change
  React.useEffect(() => {
    if (open) {
      setSelectedIndices(new Set(items.map((_, i) => i)))
      setSearchQuery("")
      setActiveCategory("all")
    }
  }, [open, items])

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length }
    for (const item of items) {
      const type = item.mediaType || "anime"
      counts[type] = (counts[type] || 0) + 1
    }
    return counts
  }, [items])

  const availableCategories = useMemo(() => {
    return Object.keys(categoryCounts).filter(
      (k) => k === "all" || (categoryCounts[k] ?? 0) > 0
    )
  }, [categoryCounts])

  // Filtered items based on activeCategory and searchQuery
  const filteredIndexedItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (activeCategory !== "all" && item.mediaType !== activeCategory) {
          return false
        }
        if (q && !item.title.toLowerCase().includes(q)) {
          return false
        }
        return true
      })
  }, [items, activeCategory, searchQuery])

  // Toggle single item
  const toggleItem = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Toggle all items in current view
  const areAllFilteredSelected = useMemo(() => {
    if (filteredIndexedItems.length === 0) return false
    return filteredIndexedItems.every(({ index }) => selectedIndices.has(index))
  }, [filteredIndexedItems, selectedIndices])

  const toggleSelectAllFiltered = () => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (areAllFilteredSelected) {
        for (const { index } of filteredIndexedItems) {
          next.delete(index)
        }
      } else {
        for (const { index } of filteredIndexedItems) {
          next.add(index)
        }
      }
      return next
    })
  }

  const handleStartImport = async () => {
    if (selectedIndices.size === 0 || isSubmitting) return
    const selectedItems = items.filter((_, i) => selectedIndices.has(i))
    await onConfirmImport(selectedItems, skipExisting)
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-w-2xl sm:max-w-3xl"
      aria-label="Review & Select Items to Import"
    >
      <div className="flex max-h-[85vh] flex-col gap-4">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between pe-6">
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Review & Select Items to Import
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                Detected{" "}
                <span className="font-medium text-foreground">
                  {items.length} items
                </span>{" "}
                from {sourceName}. You can deselect any entries you do not wish
                to import.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Category Pills & Search Bar */}
        <div className="space-y-2.5">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {availableCategories.map((cat) => {
              const Icon = TYPE_ICONS[cat] || IconFilter
              const isSelected = activeCategory === cat
              const label = cat === "all" ? "All" : TYPE_LABELS[cat] || cat

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  <span
                    className={`py-0.2 rounded-md px-1.5 text-[10px] ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    {categoryCounts[cat] || 0}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search + Bulk Selection Action Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 ps-8 pe-8 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAllFiltered}
              className="h-8 shrink-0 text-xs"
            >
              {areAllFilteredSelected ? "Deselect View" : "Select View"}
            </Button>
          </div>
        </div>

        {/* Scrollable Item List */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-border/60 bg-muted/10 p-2">
          {filteredIndexedItems.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <p className="text-xs font-medium text-foreground">
                No items match your filter.
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Try adjusting your search query or category filter.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredIndexedItems.map(({ item, index }) => {
                const isChecked = selectedIndices.has(index)
                const Icon = TYPE_ICONS[item.mediaType] || IconDeviceTv

                // External ID representation badge
                const primaryId = item.externalIds.anilistId
                  ? `AL: ${item.externalIds.anilistId}`
                  : item.externalIds.malId
                    ? `MAL: ${item.externalIds.malId}`
                    : item.externalIds.tvDBId
                      ? `TVDB: ${item.externalIds.tvDBId}`
                      : item.externalIds.simklId
                        ? `Simkl: ${item.externalIds.simklId}`
                        : item.externalIds.googleBookId
                          ? `GBook`
                          : item.externalIds.igdbId
                            ? `IGDB: ${item.externalIds.igdbId}`
                            : item.externalIds.deezerId
                              ? `Deezer`
                              : null

                return (
                  <div
                    key={`${item.mediaType}-${index}`}
                    onClick={() => toggleItem(index)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition-colors ${
                      isChecked
                        ? "border-primary/40 bg-primary/5 hover:border-primary/60"
                        : "border-border/50 bg-card/60 opacity-60 hover:opacity-90"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Checkbox
                        isSelected={isChecked}
                        onChange={() => toggleItem(index)}
                        aria-label={`Select ${item.title}`}
                      />

                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0 flex-1 text-start">
                        <p className="truncate text-xs font-medium text-foreground">
                          {item.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="capitalize">
                            {item.status.toLowerCase().replace(/_/g, " ")}
                          </span>
                          {typeof item.progress === "number" && (
                            <span>• Prog: {item.progress}</span>
                          )}
                          {item.score !== null &&
                            item.score !== undefined &&
                            item.score > 0 && (
                              <span className="font-medium text-rose-500 dark:text-rose-400">
                                ★ {item.score}
                              </span>
                            )}
                          {primaryId && (
                            <Badge
                              variant="outline"
                              className="px-1 py-0 text-[9px]"
                            >
                              {primaryId}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Options & Footer */}
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Switch
              size="sm"
              isSelected={skipExisting}
              onChange={setSkipExisting}
              id="skip-existing-toggle"
            />
            <label
              htmlFor="skip-existing-toggle"
              className="cursor-pointer text-xs text-muted-foreground select-none"
            >
              Skip existing items (don't overwrite progress/score)
            </label>
          </div>

          <DialogFooter className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleStartImport}
              disabled={selectedIndices.size === 0 || isSubmitting}
              className="h-8 gap-1.5 text-xs"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <IconCloudDownload className="h-3.5 w-3.5" />
                  <span>Start Import ({selectedIndices.size} items)</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </div>
    </Dialog>
  )
}
