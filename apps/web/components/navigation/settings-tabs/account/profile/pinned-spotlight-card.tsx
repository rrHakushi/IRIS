"use client"

import React, { useState, useEffect, useRef } from "react"
import Image from "next/image"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import {
  IconSparkles,
  IconSearch,
  IconTrash,
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconDeviceGamepad,
  IconHeadphones,
  IconUser,
  IconBuildingCommunity,
  IconLoader2,
  IconChevronDown,
  IconX,
  IconCheck,
  IconExternalLink,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import type { PinnedSpotlight } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

export interface PinnedSpotlightCardProps {
  spotlight?: PinnedSpotlight | null
  onChange: (spotlight: PinnedSpotlight | null) => void
  disabled?: boolean
}

interface SpotlightCategory {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  path: string
}

const SPOTLIGHT_CATEGORIES: SpotlightCategory[] = [
  {
    id: "ANIME",
    name: "Anime",
    description: "Japanese animation series & movies",
    icon: IconDeviceTv,
    path: "anime",
  },
  {
    id: "MANGA",
    name: "Manga",
    description: "Japanese comics & serialized works",
    icon: IconBook,
    path: "manga",
  },
  {
    id: "MOVIE",
    name: "Movie",
    description: "Feature films & cinematic releases",
    icon: IconMovie,
    path: "movies",
  },
  {
    id: "TV",
    name: "TV Series",
    description: "Television drama, shows & seasons",
    icon: IconDeviceTv,
    path: "tv",
  },
  {
    id: "GAME",
    name: "Game",
    description: "Video games across PC & consoles",
    icon: IconDeviceGamepad,
    path: "games",
  },
  {
    id: "BOOK",
    name: "Book",
    description: "Novels, light novels & literature",
    icon: IconBook,
    path: "books",
  },
  {
    id: "MUSIC",
    name: "Music",
    description: "Albums, tracks, artists & OSTs",
    icon: IconHeadphones,
    path: "music",
  },
  {
    id: "CHARACTER",
    name: "Character",
    description: "Fictional characters & protagonists",
    icon: IconSparkles,
    path: "characters",
  },
  {
    id: "PERSON",
    name: "Staff & Cast",
    description: "Voice actors, directors & creators",
    icon: IconUser,
    path: "people",
  },
  {
    id: "STUDIO",
    name: "Studio",
    description: "Animation & game development studios",
    icon: IconBuildingCommunity,
    path: "studios",
  },
  {
    id: "CUSTOM",
    name: "Custom / Quote",
    description: "Personal quote, motto, or custom spotlight",
    icon: IconSparkles,
    path: "",
  },
]

export function PinnedSpotlightCard({
  spotlight,
  onChange,
  disabled = false,
}: PinnedSpotlightCardProps): React.JSX.Element {
  const isEnabled = Boolean(spotlight)
  const selectedCategory = spotlight?.mediaType || "ANIME"
  const currentCategoryConfig =
    SPOTLIGHT_CATEGORIES.find((c) => c.id === selectedCategory) ||
    SPOTLIGHT_CATEGORIES[0]!
  const CategoryIcon = currentCategoryConfig.icon

  // Modals state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  // Search state inside Search Modal
  const [modalSearchQuery, setModalSearchQuery] = useState("")
  const [modalSearchCategory, setModalSearchCategory] = useState(selectedCategory)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Open search modal with current category
  const handleOpenSearchModal = () => {
    setModalSearchCategory(selectedCategory)
    setModalSearchQuery("")
    setSearchResults([])
    setSearchModalOpen(true)
  }

  // Focus search input on modal open
  useEffect(() => {
    if (searchModalOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [searchModalOpen])

  // Live debounced search against Elysia search endpoints
  useEffect(() => {
    if (!searchModalOpen || modalSearchCategory === "CUSTOM") {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const trimmed = modalSearchQuery.trim()
    if (trimmed.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let res: any = null
        switch (modalSearchCategory) {
          case "ANIME":
            res = await elysia.search.anime.get({ query: { q: trimmed } })
            break
          case "MANGA":
            res = await elysia.search.manga.get({ query: { q: trimmed } })
            break
          case "MOVIE":
            res = await elysia.search.movies.get({ query: { q: trimmed } })
            break
          case "TV":
            res = await elysia.search.tv.get({ query: { q: trimmed } })
            break
          case "GAME":
            res = await elysia.search.games.get({ query: { q: trimmed } })
            break
          case "BOOK":
            res = await elysia.search.books.get({ query: { q: trimmed } })
            break
          case "MUSIC":
            res = await elysia.search.music.get({ query: { q: trimmed } })
            break
          case "CHARACTER":
            res = await elysia.search.characters.get({ query: { q: trimmed } })
            break
          case "PERSON":
            res = await elysia.search.people.get({ query: { q: trimmed } })
            break
          case "STUDIO":
            res = await elysia.search.studios.get({ query: { q: trimmed } })
            break
        }

        const rawItems = res?.data
        const items = Array.isArray(rawItems)
          ? rawItems
          : Array.isArray(rawItems?.data)
            ? rawItems.data
            : Array.isArray(rawItems?.items)
              ? rawItems.items
              : []

        setSearchResults(items.slice(0, 16))
      } catch (err) {
        console.error("[PinnedSpotlightCard] Search error:", err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 280)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [modalSearchQuery, modalSearchCategory, searchModalOpen])

  const handleToggle = () => {
    if (isEnabled) {
      onChange(null)
      toast.info("Spotlight removed from profile.")
    } else {
      onChange({
        title: "",
        subtitle: "",
        mediaType: "ANIME",
        customNote: "",
        imageUrl: "",
        link: "",
      })
      toast.success("Spotlight showcase enabled.")
    }
  }

  const handleFieldChange = (field: keyof PinnedSpotlight, value: any) => {
    onChange({
      ...(spotlight || {}),
      [field]: value,
    })
  }

  const handleSelectCategory = (catId: string) => {
    handleFieldChange("mediaType", catId)
    setCategoryModalOpen(false)
    toast.success(`Category set to ${SPOTLIGHT_CATEGORIES.find((c) => c.id === catId)?.name}`)
  }

  const handleSelectResult = (item: any) => {
    const catConfig = SPOTLIGHT_CATEGORIES.find((c) => c.id === modalSearchCategory)
    const title =
      item.titlePrimary ||
      item.namePrimary ||
      item.name ||
      item.title ||
      "Selected Entity"
    const subtitle =
      item.titleSecondary ||
      item.nameSecondary ||
      item.nameNative ||
      item.titleNative ||
      (item.seasonYear
        ? `${item.seasonSeason ? item.seasonSeason + " " : ""}${item.seasonYear}`
        : null) ||
      (item.releaseDateYear ? String(item.releaseDateYear) : null) ||
      (item.startDateYear ? String(item.startDateYear) : null) ||
      (item.releaseYear ? String(item.releaseYear) : null) ||
      (item.publishedYear ? String(item.publishedYear) : null) ||
      (Array.isArray(item.primaryOccupations)
        ? item.primaryOccupations.slice(0, 2).join(", ")
        : null) ||
      (Array.isArray(item.platforms) ? item.platforms.slice(0, 3).join(", ") : null) ||
      ""
    const cover = item.coverImage || item.image || item.cover || null
    const link = catConfig?.path
      ? `/IRIS-list/${catConfig.path}/${item.id}`
      : ""

    onChange({
      ...(spotlight || {}),
      title,
      subtitle: subtitle || undefined,
      mediaType: modalSearchCategory,
      mediaId: item.id,
      imageUrl: cover || undefined,
      link: link || undefined,
    })

    setSearchModalOpen(false)
    setModalSearchQuery("")
    setSearchResults([])
    toast.success(`Filled spotlight from "${title}"`)
  }

  const handleClearDetails = () => {
    onChange({
      ...(spotlight || {}),
      title: "",
      subtitle: "",
      imageUrl: "",
      link: "",
    })
    toast.info("Spotlight details cleared.")
  }

  return (
    <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <IconSparkles className="size-4 text-primary" />
            Profile Spotlight Showcase
          </CardTitle>
        </div>

        <Button
          type="button"
          variant={isEnabled ? "default" : "outline"}
          size="sm"
          onClick={handleToggle}
          disabled={disabled}
          className="cursor-pointer gap-1.5 rounded-xl font-semibold shadow-2xs"
        >
          {isEnabled ? "Enabled" : "Enable"}
        </Button>
      </CardHeader>

      {isEnabled && spotlight && (
        <CardContent className="space-y-5 border-t border-border/40 pt-5">
          {/* Action Row: Category Picker Modal Button & Search Database Modal Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Category Modal Button */}
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs transition-all hover:border-primary/50 hover:bg-muted/70"
            >
              <CategoryIcon className="size-4 text-primary" />
              <span>Category: <strong className="text-foreground">{currentCategoryConfig.name}</strong></span>
              <IconChevronDown className="size-3.5 text-muted-foreground" />
            </button>

            {/* 2. Search Database Modal Button (for all non-custom types) */}
            {selectedCategory !== "CUSTOM" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenSearchModal}
                className="cursor-pointer gap-2 rounded-xl border-primary/40 bg-primary/5 text-xs font-semibold text-primary shadow-2xs transition-all hover:border-primary hover:bg-primary/10"
              >
                <IconSearch className="size-3.5" />
                <span>Search {currentCategoryConfig.name} Database...</span>
              </Button>
            )}

            {/* 3. Clear Details Button (if filled) */}
            {(spotlight.title || spotlight.imageUrl || spotlight.link) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearDetails}
                className="cursor-pointer gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-destructive"
              >
                <IconTrash className="size-3.5" />
                <span>Clear Fields</span>
              </Button>
            )}
          </div>

          {/* Spotlight Details Fields Form */}
          <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Title / Entity Name
                </label>
                <Input
                  value={spotlight.title || ""}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                  placeholder="e.g. Frieren: Beyond Journey's End"
                  disabled={disabled}
                  className="h-9 text-xs"
                />
              </div>

              {/* Subtitle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Subtitle / Native / Extra Info
                </label>
                <Input
                  value={spotlight.subtitle || ""}
                  onChange={(e) => handleFieldChange("subtitle", e.target.value)}
                  placeholder="e.g. 葬送のフリーレン / 2023"
                  disabled={disabled}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Cover Artwork Image URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Cover Artwork / Image URL
                </label>
                <Input
                  value={spotlight.imageUrl || ""}
                  onChange={(e) => handleFieldChange("imageUrl", e.target.value)}
                  placeholder="https://..."
                  disabled={disabled}
                  className="h-9 text-xs"
                />
              </div>

              {/* Redirection Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Detail Page Link
                </label>
                <Input
                  value={spotlight.link || ""}
                  onChange={(e) => handleFieldChange("link", e.target.value)}
                  placeholder="/IRIS-list/anime/123 or https://..."
                  disabled={disabled}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Custom Quote / Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Personal Note / Quote / Thoughts
              </label>
              <Textarea
                value={spotlight.customNote || ""}
                onChange={(e) => handleFieldChange("customNote", e.target.value)}
                placeholder="Write a brief personal comment or favorite quote about this..."
                disabled={disabled}
                className="min-h-[70px] resize-none text-xs"
              />
            </div>

            {/* Live Preview of Spotlight Card */}
            {(spotlight.title || spotlight.customNote || spotlight.imageUrl) && (
              <div className="pt-2">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Live Preview on Profile
                </label>
                <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card/90 via-card/50 to-primary/5 p-4 shadow-xs">
                  <div className="flex items-start gap-4">
                    {spotlight.imageUrl ? (
                      <div className="relative aspect-[3/4] size-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/40 shadow-xs">
                        <Image
                          src={spotlight.imageUrl}
                          alt={spotlight.title || "Spotlight"}
                          fill
                          sizes="64px"
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <CategoryIcon className="size-7" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="gap-1 border-primary/20 bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary"
                        >
                          <CategoryIcon className="size-2.5" />
                          <span>{currentCategoryConfig.name}</span>
                        </Badge>
                      </div>
                      <h4 className="font-heading text-sm font-bold text-foreground truncate">
                        {spotlight.title || "Untitled Spotlight"}
                      </h4>
                      {spotlight.subtitle && (
                        <p className="text-xs font-medium text-muted-foreground truncate">
                          {spotlight.subtitle}
                        </p>
                      )}
                      {spotlight.customNote && (
                        <p className="mt-1 text-xs italic text-foreground/90">
                          &ldquo;{spotlight.customNote}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* 1. Category Selection Modal Dialog */}
      <Dialog
        isOpen={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        className="w-full sm:max-w-xl p-6"
      >
        <DialogHeader className="pe-8">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <IconSparkles className="size-4 text-primary" />
            Select Spotlight Category
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose what category of entity or media you want to spotlight.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
          {SPOTLIGHT_CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.id)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-start transition-all",
                  isSelected
                    ? "border-primary bg-primary/15 shadow-2xs ring-1 ring-primary/40"
                    : "border-border/60 bg-card/60 hover:border-border hover:bg-muted/50"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      {cat.name}
                    </span>
                    {isSelected && <IconCheck className="size-3.5 text-primary" />}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {cat.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </Dialog>

      {/* 2. Search & Select Modal Dialog */}
      <Dialog
        isOpen={searchModalOpen}
        onOpenChange={setSearchModalOpen}
        className="w-full sm:max-w-3xl p-6 max-h-[85vh] overflow-hidden [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:flex-col [&>[data-slot=dialog]]:gap-3 [&>[data-slot=dialog]]:w-full [&>[data-slot=dialog]]:min-h-0"
      >
        <DialogHeader className="pb-2 pe-8">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <IconSearch className="size-4 text-primary" />
            Search Database
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Search and select an item to automatically populate title, cover artwork, and link.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-3 pt-1 w-full min-h-0 flex-1 overflow-hidden">
          {/* Category Switcher Tabs inside Search Modal */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin w-full shrink-0">
            {SPOTLIGHT_CATEGORIES.filter((c) => c.id !== "CUSTOM").map((cat) => {
              const Icon = cat.icon
              const isSelected = modalSearchCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setModalSearchCategory(cat.id)
                    setSearchResults([])
                  }}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
                    isSelected
                      ? "border border-primary bg-primary/15 font-bold text-primary shadow-2xs"
                      : "border border-border/50 bg-background/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{cat.name}</span>
                </button>
              )
            })}
          </div>

          {/* Search Input Bar */}
          <div className="relative w-full">
            <Input
              ref={searchInputRef}
              placeholder={`Search ${SPOTLIGHT_CATEGORIES.find((c) => c.id === modalSearchCategory)?.name || "media"} by title, name, or keyword...`}
              value={modalSearchQuery}
              onChange={(e) => setModalSearchQuery(e.target.value)}
              className="h-10 pe-9 ps-9 text-xs"
            />
            <div className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground">
              {isSearching ? (
                <IconLoader2 className="size-4 animate-spin text-primary" />
              ) : (
                <IconSearch className="size-4" />
              )}
            </div>
            {modalSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setModalSearchQuery("")
                  setSearchResults([])
                }}
                className="absolute inset-y-0 end-2.5 flex cursor-pointer items-center text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </div>

          {/* Results Grid / States */}
          <div className="min-h-[220px] max-h-[48vh] overflow-y-auto pe-1 w-full">
            {isSearching && (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                <IconLoader2 className="size-6 animate-spin text-primary" />
                <span>Searching database...</span>
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 w-full">
                {searchResults.map((result) => {
                  const title =
                    result.titlePrimary ||
                    result.namePrimary ||
                    result.name ||
                    result.title ||
                    "Item"
                  const subtitle =
                    result.titleSecondary ||
                    result.nameSecondary ||
                    result.nameNative ||
                    result.titleNative ||
                    (result.seasonYear
                      ? `${result.seasonSeason ? result.seasonSeason + " " : ""}${result.seasonYear}`
                      : null) ||
                    (result.releaseDateYear ? String(result.releaseDateYear) : null) ||
                    (result.startDateYear ? String(result.startDateYear) : null) ||
                    (result.releaseYear ? String(result.releaseYear) : null) ||
                    (result.publishedYear ? String(result.publishedYear) : null) ||
                    (Array.isArray(result.primaryOccupations)
                      ? result.primaryOccupations.slice(0, 2).join(", ")
                      : null) ||
                    (Array.isArray(result.platforms)
                      ? result.platforms.slice(0, 3).join(", ")
                      : null) ||
                    ""
                  const cover = result.coverImage || result.image || result.cover || null
                  const format = result.format || result.mediaType || result.type || null

                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelectResult(result)}
                      className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-2.5 text-start transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-xs"
                    >
                      <div className="relative aspect-[3/4] size-12 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted/40 shadow-2xs">
                        {cover ? (
                          <Image
                            src={cover}
                            alt={title}
                            fill
                            sizes="48px"
                            unoptimized
                            className="object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                            No img
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-heading text-xs font-bold text-foreground truncate group-hover:text-primary">
                            {title}
                          </h5>
                          {format && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1 text-[9px] font-semibold uppercase"
                            >
                              {format}
                            </Badge>
                          )}
                        </div>
                        {subtitle && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                            {subtitle}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {!isSearching &&
              modalSearchQuery.trim().length >= 2 &&
              searchResults.length === 0 && (
                <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                  <IconSearch className="mb-2 size-6 opacity-40" />
                  <span>No matches found for &ldquo;{modalSearchQuery}&rdquo; in {modalSearchCategory}</span>
                </div>
              )}

            {!isSearching && modalSearchQuery.trim().length < 2 && (
              <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                <IconSearch className="mb-2 size-6 text-primary/60" />
                <span>Type at least 2 characters to search the {modalSearchCategory} database</span>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </Card>
  )
}
