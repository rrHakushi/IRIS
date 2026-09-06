"use client"

import React, {
  useState,
  useEffect,
  useRef,
  useTransition,
  useCallback,
} from "react"
import { useTranslations } from "next-intl"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { IconMusic, IconDisc } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  type BrowseCategory,
  type VisitedMediaItem,
  BROWSE_CATEGORIES,
} from "@/lib/browse-history"
import { useBrowseHistory } from "@/hooks/use-browse-history"
import { searchCategoryMedia } from "@/lib/browse-search"
import { BrowseCategoryNav, getCategoryLabel } from "./browse-category-nav"
import { BrowseSearchBar } from "./browse-search-bar"
import { BrowseRecentQueries } from "./browse-recent-queries"
import { BrowseVisitedGrid } from "./browse-visited-grid"
import {
  BrowseSearchResults,
  type SearchResultItem,
} from "./browse-search-results"
import { useUser } from "@/context/user-context"
import { getMediaPreferences } from "@IRIS/shared"

type MusicBrowseType = "all" | "tracks" | "albums"

export function BrowsePageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Category state (synced with URL ?category=...)
  const urlCategory =
    (searchParams.get("category") as BrowseCategory) || "anime"
  const isValidCategory = BROWSE_CATEGORIES.some((c) => c.key === urlCategory)
  const initialCategory = isValidCategory ? urlCategory : "anime"
  const initialQuery = searchParams.get("q") || ""

  const urlType = searchParams.get("type") as MusicBrowseType | null
  const initialMusicType: MusicBrowseType =
    urlType === "tracks" || urlType === "albums" ? urlType : "all"

  const [activeCategory, setActiveCategory] =
    useState<BrowseCategory>(initialCategory)
  const [musicType, setMusicType] = useState<MusicBrowseType>(initialMusicType)

  const { user } = useUser()
  const mediaTitlePreference =
    getMediaPreferences(user?.customization).title || "primary"

  // Search state initialized from URL query parameter
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim())
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [, startTransition] = useTransition()

  // Browse history hook
  const {
    history,
    isLoaded,
    getCategoryHistory,
    addQuery,
    addVisit,
    removeQuery,
    removeVisit,
    clearCategory,
    clearAll,
  } = useBrowseHistory()

  const currentCategoryHistory = getCategoryHistory(activeCategory)
  const t = useTranslations("browse")
  const categoryLabel = getCategoryLabel(activeCategory, t)

  // Keep URL query parameter in sync when category changes
  const handleSelectCategory = useCallback(
    (category: BrowseCategory) => {
      if (category === activeCategory) return
      setActiveCategory(category)
      setSearchQuery("")
      setDebouncedQuery("")
      setSearchResults([])
      setMusicType("all")

      // Update URL without full reload (clear q, clear type when switching category)
      const params = new URLSearchParams(searchParams.toString())
      params.set("category", category)
      params.delete("q")
      params.delete("type")
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [activeCategory, pathname, router, searchParams]
  )

  const handleSelectMusicType = useCallback(
    (type: MusicBrowseType) => {
      setMusicType(type)
      const params = new URLSearchParams(searchParams.toString())
      if (type === "all") {
        params.delete("type")
      } else {
        params.set("type", type)
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  // Debounce search query changes (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim())
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Sync debounced search query to URL ?q=...
  useEffect(() => {
    const currentQ = searchParams.get("q") || ""
    if (debouncedQuery !== currentQ) {
      const params = new URLSearchParams(searchParams.toString())
      if (debouncedQuery) {
        params.set("q", debouncedQuery)
      } else {
        params.delete("q")
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }, [debouncedQuery, pathname, router, searchParams])

  // Restore state when user navigates with browser Back / Forward buttons
  useEffect(() => {
    const catParam = searchParams.get("category") as BrowseCategory
    const qParam = searchParams.get("q") || ""
    const typeParam = searchParams.get("type") as MusicBrowseType | null

    if (catParam && BROWSE_CATEGORIES.some((c) => c.key === catParam)) {
      setActiveCategory((prev) => (prev !== catParam ? catParam : prev))
    }

    if (typeParam === "tracks" || typeParam === "albums") {
      setMusicType(typeParam)
    } else if (!typeParam) {
      setMusicType("all")
    }

    if (qParam !== debouncedQuery) {
      setSearchQuery(qParam)
      setDebouncedQuery(qParam.trim())
    }
  }, [searchParams])

  // Execute search when debounced query or active category changes
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastSavedQueryRef = useRef<{ category: string; query: string } | null>(
    null
  )

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsSearching(true)

    // Save query to history once per unique category + query combo
    if (
      lastSavedQueryRef.current?.category !== activeCategory ||
      lastSavedQueryRef.current?.query !== debouncedQuery
    ) {
      lastSavedQueryRef.current = {
        category: activeCategory,
        query: debouncedQuery,
      }
      addQuery(activeCategory, debouncedQuery)
    }

    searchCategoryMedia(
      activeCategory,
      debouncedQuery,
      controller.signal,
      mediaTitlePreference,
      activeCategory === "music" ? musicType : undefined
    )
      .then((items) => {
        startTransition(() => {
          setSearchResults(items)
          setIsSearching(false)
        })
      })
      .catch((err) => {
        if ((err as Error)?.name !== "AbortError") {
          setIsSearching(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [
    debouncedQuery,
    activeCategory,
    addQuery,
    mediaTitlePreference,
    musicType,
  ])

  const handleQuerySelect = (query: string) => {
    setSearchQuery(query)
  }

  const handleClear = useCallback(() => {
    setSearchQuery("")
    setDebouncedQuery("")
    setSearchResults([])
    const params = new URLSearchParams(searchParams.toString())
    params.delete("q")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  const handleVisit = (item: VisitedMediaItem) => {
    addVisit(activeCategory, item)
  }

  return (
    <div className="flex w-full flex-1 flex-col bg-background text-foreground">
      {/* Main Browse Container */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
        {/* Search header & input */}
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <h1 className="sr-only">
            {t("title")} - {categoryLabel}
          </h1>

          {/* Category pill navigation above search input */}
          <BrowseCategoryNav
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
            className="w-full"
          />

          <BrowseSearchBar
            category={activeCategory}
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={handleClear}
            onSwitchCategory={handleSelectCategory}
            isLoading={isSearching}
          />

          {/* Music-specific sub-type selector: All, Tracks, Albums */}
          {activeCategory === "music" && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <div
                role="radiogroup"
                aria-label={t("filterByType")}
                className="inline-flex items-center gap-1 rounded-2xl bg-muted/60 p-1 text-xs font-medium text-muted-foreground backdrop-blur-xs"
              >
                <Button
                  variant={musicType === "all" ? "default" : "ghost"}
                  size="xs"
                  onPress={() => handleSelectMusicType("all")}
                  className={cn(
                    "rounded-xl px-3 py-1 text-xs font-medium transition-all select-none",
                    musicType === "all"
                      ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{t("all")}</span>
                </Button>
                <Button
                  variant={musicType === "tracks" ? "default" : "ghost"}
                  size="xs"
                  onPress={() => handleSelectMusicType("tracks")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-medium transition-all select-none",
                    musicType === "tracks"
                      ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <IconMusic className="size-3.5" aria-hidden="true" />
                  <span>{t("tracks")}</span>
                </Button>
                <Button
                  variant={musicType === "albums" ? "default" : "ghost"}
                  size="xs"
                  onPress={() => handleSelectMusicType("albums")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-medium transition-all select-none",
                    musicType === "albums"
                      ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <IconDisc className="size-3.5" aria-hidden="true" />
                  <span>{t("albums")}</span>
                </Button>
              </div>
            </div>
          )}

          {/* 5 Recent Search Queries & Clear Actions */}
          <BrowseRecentQueries
            queries={isLoaded ? currentCategoryHistory.recentBrowseQueries : []}
            categoryLabel={categoryLabel}
            onSelectQuery={handleQuerySelect}
            onRemoveQuery={(q) => removeQuery(activeCategory, q)}
            onClearCategory={() => clearCategory(activeCategory)}
            onClearAll={clearAll}
            hasVisitedItems={
              isLoaded && currentCategoryHistory.recentBrowseVisits.length > 0
            }
          />
        </div>

        {/* Content Area: Active Search Results OR 18 Last Visited Grid */}
        {debouncedQuery.length >= 2 ? (
          <BrowseSearchResults
            results={searchResults}
            query={debouncedQuery}
            category={activeCategory}
            categoryLabel={categoryLabel}
            isLoading={isSearching}
            onVisit={handleVisit}
            musicType={musicType}
          />
        ) : (
          <BrowseVisitedGrid
            items={isLoaded ? currentCategoryHistory.recentBrowseVisits : []}
            category={activeCategory}
            categoryLabel={categoryLabel}
            onVisit={handleVisit}
            onRemove={(id, type) => removeVisit(activeCategory, id, type)}
            musicType={musicType}
          />
        )}
      </main>
    </div>
  )
}
