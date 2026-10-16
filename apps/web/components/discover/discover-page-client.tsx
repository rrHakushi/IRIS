"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useUser } from "@/context/user-context"
import { getMediaPreferences } from "@IRIS/shared"
import { elysia } from "@/lib/elysia"
import { DiscoverStatusCard } from "./discover-status-card"
import { DiscoverMediaGrid } from "./discover-media-grid"
import type {
  DiscoverCategory,
  DiscoverSortByOption,
  DiscoverSortOrderOption,
  DiscoverFilterFacets,
  DiscoverItem,
} from "./discover-types"

const DEFAULT_FACETS: DiscoverFilterFacets = {
  statuses: [],
  formats: [],
  genres: [],
  years: [],
  seasons: [],
  artists: [],
}

interface DiscoverPageClientProps {
  category: DiscoverCategory
}

export function DiscoverPageClient({ category }: DiscoverPageClientProps) {
  const { user } = useUser()
  const mediaTitlePreference =
    getMediaPreferences(user?.customization).title || "primary"

  // ---------------------------------------------------------------------------
  // Filter & Search States
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedFormats, setSelectedFormats] = useState<string[]>([])
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedYears, setSelectedYears] = useState<string[]>([])
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([])
  const [selectedArtists, setSelectedArtists] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<DiscoverSortByOption>("popularity")
  const [sortOrder, setSortOrder] = useState<DiscoverSortOrderOption>("desc")

  // ---------------------------------------------------------------------------
  // Data States
  // ---------------------------------------------------------------------------
  const [items, setItems] = useState<DiscoverItem[]>([])
  const [facets, setFacets] = useState<DiscoverFilterFacets>(DEFAULT_FACETS)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [nextCursor, setNextCursor] = useState<string | number | null>(null)
  const [hasMore, setHasMore] = useState<boolean>(false)

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)

  // Request deduplication refs (React 19 StrictMode safety)
  const isFetchingRef = useRef(false)
  const isFetchingMoreRef = useRef(false)
  const lastFetchedItemsKeyRef = useRef<string | null>(null)
  const lastFetchedFacetsKeyRef = useRef<string | null>(null)
  const isFetchingFacetsRef = useRef(false)

  // ---------------------------------------------------------------------------
  // URL Query State Synchronization
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const qParam = params.get("q")
      if (qParam) {
        const clean = qParam.trim()
        setSearchQuery(clean)
        setDebouncedSearch(clean)
      }
      const statusesParam = params.get("statuses") || params.get("status")
      if (statusesParam) {
        setSelectedStatuses(statusesParam.split(",").filter(Boolean))
      }
      const formatsParam = params.get("formats")
      if (formatsParam) {
        setSelectedFormats(formatsParam.split(",").filter(Boolean))
      }
      const genresParam = params.get("genres")
      if (genresParam) {
        setSelectedGenres(genresParam.split(",").filter(Boolean))
      }
      const yearsParam = params.get("years")
      if (yearsParam) {
        setSelectedYears(yearsParam.split(",").filter(Boolean))
      }
      const seasonsParam = params.get("seasons")
      if (seasonsParam) {
        setSelectedSeasons(seasonsParam.split(",").filter(Boolean))
      }
      const artistsParam = params.get("artists")
      if (artistsParam) {
        setSelectedArtists(artistsParam.split(",").filter(Boolean))
      }
      const sortParam = params.get("sortBy") as DiscoverSortByOption
      if (
        sortParam === "popularity" ||
        sortParam === "score" ||
        sortParam === "favorites" ||
        sortParam === "title" ||
        sortParam === "releaseDate" ||
        sortParam === "updatedAt"
      ) {
        setSortBy(sortParam)
      }
      const orderParam = params.get("order") as DiscoverSortOrderOption
      if (orderParam === "asc" || orderParam === "desc") {
        setSortOrder(orderParam)
      }
    }
  }, [])

  // Listen to browser popstate (back/forward) navigation
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      setSearchQuery(params.get("q") || "")
      setDebouncedSearch((params.get("q") || "").trim())
      const st = params.get("statuses") || params.get("status")
      setSelectedStatuses(st ? st.split(",").filter(Boolean) : [])
      setSelectedFormats(
        params.get("formats") ? params.get("formats")!.split(",") : []
      )
      setSelectedGenres(
        params.get("genres") ? params.get("genres")!.split(",") : []
      )
      setSelectedYears(
        params.get("years") ? params.get("years")!.split(",") : []
      )
      setSelectedSeasons(
        params.get("seasons") ? params.get("seasons")!.split(",") : []
      )
      setSelectedArtists(
        params.get("artists") ? params.get("artists")!.split(",") : []
      )
      setSortBy((params.get("sortBy") as DiscoverSortByOption) || "popularity")
      setSortOrder((params.get("order") as DiscoverSortOrderOption) || "desc")
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Debounce search query changes (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Sync state to URL search parameters without full reload
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      const updateParam = (key: string, val?: string) => {
        if (val) {
          url.searchParams.set(key, val)
        } else {
          url.searchParams.delete(key)
        }
      }

      updateParam("q", debouncedSearch || undefined)
      updateParam(
        "statuses",
        selectedStatuses.length > 0 ? selectedStatuses.join(",") : undefined
      )
      updateParam(
        "formats",
        selectedFormats.length > 0 ? selectedFormats.join(",") : undefined
      )
      updateParam(
        "genres",
        selectedGenres.length > 0 ? selectedGenres.join(",") : undefined
      )
      updateParam(
        "years",
        selectedYears.length > 0 ? selectedYears.join(",") : undefined
      )
      updateParam(
        "seasons",
        selectedSeasons.length > 0 ? selectedSeasons.join(",") : undefined
      )
      updateParam(
        "artists",
        selectedArtists.length > 0 ? selectedArtists.join(",") : undefined
      )
      updateParam("sortBy", sortBy !== "popularity" ? sortBy : undefined)
      updateParam("order", sortOrder !== "desc" ? sortOrder : undefined)

      window.history.replaceState({}, "", url.toString())
    }
  }, [
    debouncedSearch,
    selectedStatuses,
    selectedFormats,
    selectedGenres,
    selectedYears,
    selectedSeasons,
    selectedArtists,
    sortBy,
    sortOrder,
  ])

  // ---------------------------------------------------------------------------
  // 1. Fetch Filter Facets & Counts
  // ---------------------------------------------------------------------------
const getMediaCategory = (cat: string): "anime" | "manga" | "movies" | "tv" | "games" | "books" | "music" => {
  const c = cat.toLowerCase()
  if (c === "movie" || c === "movies") return "movies"
  if (c === "game" || c === "games") return "games"
  if (c === "book" || c === "books") return "books"
  if (c === "manga") return "manga"
  if (c === "tv") return "tv"
  if (c === "music") return "music"
  return "anime"
}

const getEntitySortBy = (
  sort: DiscoverSortByOption
): "popularity" | "favorites" | "name" => {
  if (sort === "title") return "name"
  if (sort === "favorites") return "favorites"
  return "popularity"
}

const getStudioAnimationFilter = (formats: string[]): boolean | undefined => {
  if (!formats || formats.length === 0) return undefined
  const hasAnimation = formats.some((f) => f.toLowerCase().includes("animation"))
  const hasOther = formats.some(
    (f) => f.toLowerCase().includes("other") || f.toLowerCase() === "studio"
  )
  if (hasAnimation && !hasOther) return true
  if (hasOther && !hasAnimation) return false
  return undefined
}

const mapCharacterItem = (c: any): DiscoverItem => ({
  id: c.id,
  titlePrimary: c.namePrimary,
  titleNative: c.nameNative,
  coverImage: c.image,
  format: c.gender || null,
  favorites: c.favorites,
  genres: c.age ? [`Age: ${c.age}`] : [],
  isAdult: false,
})

const mapPersonItem = (p: any): DiscoverItem => ({
  id: p.id,
  titlePrimary: p.namePrimary,
  titleNative: p.nameNative,
  coverImage: p.image,
  format: p.primaryOccupations?.[0] || p.gender || null,
  favorites: p.favorites,
  genres: p.primaryOccupations || [],
  isAdult: false,
})

const mapStudioItem = (s: any): DiscoverItem => ({
  id: s.id,
  titlePrimary: s.name,
  coverImage: null,
  format: s.isAnimationStudio ? "Animation Studio" : "Studio",
  favorites: s.favorites,
  genres: s.isAnimationStudio ? ["Animation"] : ["Production"],
  isAdult: false,
})

const mapMediaItem = (x: any): DiscoverItem => ({
  ...x,
  genres: Array.isArray(x.genres)
    ? x.genres
        .map((g: any) =>
          typeof g === "string" ? g : g?.name || g?.genre?.name || ""
        )
        .filter(Boolean)
    : [],
  releaseYear: x.year ?? x.releaseYear ?? x.seasonYear,
  seasonSeason: x.season ?? x.seasonSeason,
})

  const fetchFacets = useCallback(
    async (force = false) => {
      if (!category) return

      const facetsKey = `discover:${category}:filters`
      if (
        !force &&
        (lastFetchedFacetsKeyRef.current === facetsKey ||
          isFetchingFacetsRef.current)
      ) {
        return
      }

      lastFetchedFacetsKeyRef.current = facetsKey
      isFetchingFacetsRef.current = true

      try {
        if (category === "characters") {
          const { data, error } = await elysia.borealis.characters.filters.get()
          if (!error && data && data.success) {
            setFacets({
              statuses: [],
              formats: (data.genders || []).map((g) => ({
                value: g.value,
                count: g.count,
              })),
              genres: [],
              years: [],
              seasons: [],
              artists: [],
            })
          }
        } else if (category === "staff") {
          const { data, error } = await elysia.borealis.people.filters.get()
          if (!error && data && data.success) {
            setFacets({
              statuses: [],
              formats: (data.genders || []).map((g) => ({
                value: g.value,
                count: g.count,
              })),
              genres: (data.occupations || []).map((o) => ({
                value: o.value,
                count: o.count,
              })),
              years: [],
              seasons: [],
              artists: [],
            })
          }
        } else if (category === "studios") {
          const { data, error } = await elysia.borealis.studios.filters.get()
          if (!error && data && data.success) {
            setFacets({
              statuses: [],
              formats: (data.types || []).map((t) => ({
                value: t.value,
                count: t.count,
              })),
              genres: [],
              years: [],
              seasons: [],
              artists: [],
            })
          }
        } else {
          const targetCat = getMediaCategory(category)
          const { data, error } = await elysia.borealis.media[targetCat].filters.get()

          if (!error && data && data.success) {
            setFacets({
              statuses: data.statuses || [],
              formats: data.formats || [],
              genres: data.genres || [],
              years: data.years || [],
              seasons: (data as any).seasons || [],
              artists: [],
            })
          }
        }
      } catch (err) {
        console.error("[Discover] Failed to fetch filter facets:", err)
      } finally {
        isFetchingFacetsRef.current = false
      }
    },
    [category]
  )

  useEffect(() => {
    fetchFacets()
  }, [fetchFacets])

  // ---------------------------------------------------------------------------
  // 2. Fetch Initial / Filtered Items
  // ---------------------------------------------------------------------------
  const fetchItems = useCallback(
    async (force = false) => {
      if (!category) return

      const statusParam =
        selectedStatuses.length > 0 ? selectedStatuses.join(",") : undefined
      const formatsParam =
        selectedFormats.length > 0 ? selectedFormats.join(",") : undefined
      const genresParam =
        selectedGenres.length > 0 ? selectedGenres.join(",") : undefined
      const yearsParam =
        selectedYears.length > 0 ? selectedYears.join(",") : undefined
      const seasonsParam =
        selectedSeasons.length > 0 ? selectedSeasons.join(",") : undefined
      const artistsParam =
        selectedArtists.length > 0 ? selectedArtists.join(",") : undefined

      const cleanSearch = debouncedSearch.trim()
      const queryKey = `${category}:${statusParam}:${formatsParam}:${genresParam}:${yearsParam}:${seasonsParam}:${artistsParam}:${sortBy}:${sortOrder}:${cleanSearch}`

      if (
        !force &&
        (lastFetchedItemsKeyRef.current === queryKey || isFetchingRef.current)
      ) {
        return
      }

      lastFetchedItemsKeyRef.current = queryKey
      isFetchingRef.current = true
      setIsLoading(true)

      try {
        if (category === "characters") {
          const entitySortBy = getEntitySortBy(sortBy)
          const { data, error } = await elysia.borealis.characters.get({
            query: {
              page: 1,
              limit: 40,
              search: cleanSearch || undefined,
              gender: selectedFormats[0] || undefined,
              sortBy: entitySortBy,
              sortOrder,
            },
          })

          if (!error && data && data.success) {
            setItems((data.items || []).map(mapCharacterItem))
            setNextCursor(data.pagination?.hasMore ? 2 : null)
            setHasMore(Boolean(data.pagination?.hasMore))
            setTotalCount(data.pagination?.total ?? 0)
          } else {
            setItems([])
            setNextCursor(null)
            setHasMore(false)
          }
        } else if (category === "staff") {
          const entitySortBy = getEntitySortBy(sortBy)
          const { data, error } = await elysia.borealis.people.get({
            query: {
              page: 1,
              limit: 40,
              search: cleanSearch || undefined,
              gender: selectedFormats[0] || undefined,
              occupation: selectedGenres[0] || undefined,
              sortBy: entitySortBy,
              sortOrder,
            },
          })

          if (!error && data && data.success) {
            setItems((data.items || []).map(mapPersonItem))
            setNextCursor(data.pagination?.hasMore ? 2 : null)
            setHasMore(Boolean(data.pagination?.hasMore))
            setTotalCount(data.pagination?.total ?? 0)
          } else {
            setItems([])
            setNextCursor(null)
            setHasMore(false)
          }
        } else if (category === "studios") {
          const entitySortBy = getEntitySortBy(sortBy)
          const { data, error } = await elysia.borealis.studios.get({
            query: {
              page: 1,
              limit: 40,
              search: cleanSearch || undefined,
              isAnimationStudio: getStudioAnimationFilter(selectedFormats),
              sortBy: entitySortBy,
              sortOrder,
            },
          })

          if (!error && data && data.success) {
            setItems((data.items || []).map(mapStudioItem))
            setNextCursor(data.pagination?.hasMore ? 2 : null)
            setHasMore(Boolean(data.pagination?.hasMore))
            setTotalCount(data.pagination?.total ?? 0)
          } else {
            setItems([])
            setNextCursor(null)
            setHasMore(false)
          }
        } else {
          const targetCat = getMediaCategory(category)
          const { data, error } = await elysia.borealis.media[targetCat].get({
            query: {
              page: 1,
              limit: 32,
              statuses: statusParam,
              formats: formatsParam,
              genres: genresParam,
              years: yearsParam,
              season: seasonsParam,
              sortBy: sortBy as any,
              sortOrder: sortOrder as any,
              search: cleanSearch || undefined,
            },
          })

          if (!error && data && data.success) {
            setItems((data.items || []).map(mapMediaItem))
            setNextCursor(data.pagination?.hasMore ? 2 : null)
            setHasMore(Boolean(data.pagination?.hasMore))
            setTotalCount(data.pagination?.total ?? 0)
          } else {
            setItems([])
            setNextCursor(null)
            setHasMore(false)
          }
        }
      } catch (err) {
        console.error("[Discover] Failed to fetch items:", err)
        setItems([])
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [
      category,
      selectedStatuses,
      selectedFormats,
      selectedGenres,
      selectedYears,
      selectedSeasons,
      selectedArtists,
      sortBy,
      sortOrder,
      debouncedSearch,
    ]
  )

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // ---------------------------------------------------------------------------
  // 3. Infinite Scrolling (Fetch Next Page)
  // ---------------------------------------------------------------------------
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isFetchingMoreRef.current || isLoading)
      return

    isFetchingMoreRef.current = true
    setIsLoadingMore(true)

    try {
      const statusParam =
        selectedStatuses.length > 0 ? selectedStatuses.join(",") : undefined
      const formatsParam =
        selectedFormats.length > 0 ? selectedFormats.join(",") : undefined
      const genresParam =
        selectedGenres.length > 0 ? selectedGenres.join(",") : undefined
      const yearsParam =
        selectedYears.length > 0 ? selectedYears.join(",") : undefined
      const seasonsParam =
        selectedSeasons.length > 0 ? selectedSeasons.join(",") : undefined

      const cleanSearch = debouncedSearch.trim()
      const pageToFetch = typeof nextCursor === "number" ? nextCursor : 2

      if (category === "characters") {
        const entitySortBy = getEntitySortBy(sortBy)
        const { data, error } = await elysia.borealis.characters.get({
          query: {
            page: pageToFetch,
            limit: 40,
            search: cleanSearch || undefined,
            gender: selectedFormats[0] || undefined,
            sortBy: entitySortBy,
            sortOrder,
          },
        })

        if (!error && data && data.success) {
          const newItems = (data.items || []).map(mapCharacterItem)
          setItems((prev) => [...prev, ...newItems])
          setNextCursor(data.pagination?.hasMore ? pageToFetch + 1 : null)
          setHasMore(Boolean(data.pagination?.hasMore))
        } else {
          setHasMore(false)
        }
      } else if (category === "staff") {
        const entitySortBy = getEntitySortBy(sortBy)
        const { data, error } = await elysia.borealis.people.get({
          query: {
            page: pageToFetch,
            limit: 40,
            search: cleanSearch || undefined,
            gender: selectedFormats[0] || undefined,
            occupation: selectedGenres[0] || undefined,
            sortBy: entitySortBy,
            sortOrder,
          },
        })

        if (!error && data && data.success) {
          const newItems = (data.items || []).map(mapPersonItem)
          setItems((prev) => [...prev, ...newItems])
          setNextCursor(data.pagination?.hasMore ? pageToFetch + 1 : null)
          setHasMore(Boolean(data.pagination?.hasMore))
        } else {
          setHasMore(false)
        }
      } else if (category === "studios") {
        const entitySortBy = getEntitySortBy(sortBy)
        const { data, error } = await elysia.borealis.studios.get({
          query: {
            page: pageToFetch,
            limit: 40,
            search: cleanSearch || undefined,
            isAnimationStudio: getStudioAnimationFilter(selectedFormats),
            sortBy: entitySortBy,
            sortOrder,
          },
        })

        if (!error && data && data.success) {
          const newItems = (data.items || []).map(mapStudioItem)
          setItems((prev) => [...prev, ...newItems])
          setNextCursor(data.pagination?.hasMore ? pageToFetch + 1 : null)
          setHasMore(Boolean(data.pagination?.hasMore))
        } else {
          setHasMore(false)
        }
      } else {
        const targetCat = getMediaCategory(category)
        const { data, error } = await elysia.borealis.media[targetCat].get({
          query: {
            page: pageToFetch,
            limit: 32,
            statuses: statusParam,
            formats: formatsParam,
            genres: genresParam,
            years: yearsParam,
            season: seasonsParam,
            sortBy: sortBy as any,
            sortOrder: sortOrder as any,
            search: cleanSearch || undefined,
          },
        })

        if (!error && data && data.success) {
          const newItems = (data.items || []).map(mapMediaItem)
          setItems((prev) => [...prev, ...newItems])
          setNextCursor(data.pagination?.hasMore ? pageToFetch + 1 : null)
          setHasMore(Boolean(data.pagination?.hasMore))
        } else {
          setHasMore(false)
        }
      }
    } catch (err) {
      console.error("[Discover] Failed to load more items:", err)
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
      isFetchingMoreRef.current = false
    }
  }, [
    category,
    hasMore,
    nextCursor,
    isLoading,
    selectedStatuses,
    selectedFormats,
    selectedGenres,
    selectedYears,
    selectedSeasons,
    sortBy,
    sortOrder,
    debouncedSearch,
  ])

  // Clear all active filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery("")
    setDebouncedSearch("")
    setSelectedStatuses([])
    setSelectedFormats([])
    setSelectedGenres([])
    setSelectedYears([])
    setSelectedSeasons([])
    setSelectedArtists([])
    setSortBy("popularity")
    setSortOrder("desc")
  }, [])

  const isSearching = Boolean(
    searchQuery.trim() &&
    (isLoading ||
      isFetchingRef.current ||
      searchQuery.trim() !== debouncedSearch)
  )

  return (
    <div className="flex w-full flex-1 flex-col gap-6 py-4">
      {/* 1. Discover Status & Filter Card (Media Types on Top Row, Search & Multi-Filters on Bottom Row) */}
      <DiscoverStatusCard
        category={category}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearching={isSearching}
        facets={facets}
        selectedStatuses={selectedStatuses}
        onStatusesChange={setSelectedStatuses}
        selectedFormats={selectedFormats}
        onFormatsChange={setSelectedFormats}
        selectedGenres={selectedGenres}
        onGenresChange={setSelectedGenres}
        selectedYears={selectedYears}
        onYearsChange={setSelectedYears}
        selectedSeasons={selectedSeasons}
        onSeasonsChange={setSelectedSeasons}
        selectedArtists={selectedArtists}
        onArtistsChange={setSelectedArtists}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

      {/* 2. Infinitely Scrollable Media Grid */}
      <DiscoverMediaGrid
        category={category}
        items={items}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        mediaTitlePreference={mediaTitlePreference}
        searchQuery={searchQuery.trim()}
        onClearFilters={handleClearFilters}
      />
    </div>
  )
}
