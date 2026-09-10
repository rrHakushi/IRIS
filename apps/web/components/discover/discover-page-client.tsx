"use client"

import React, {
  useState,
  useTransition,
  useCallback,
  useRef,
  useEffect,
} from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { elysia } from "@/lib/elysia"
import { DiscoverMediaNav } from "./discover-media-nav"
import { DiscoverHeroBanner } from "./discover-hero-banner"
import { DiscoverGenreBar } from "./discover-genre-bar"
import { DiscoverSectionCarousel } from "./discover-section-carousel"
import { DiscoverEmptyState } from "./discover-empty-state"
import {
  type DiscoverCategory,
  type DiscoverResponse,
  DISCOVER_MEDIA_METAS,
} from "./discover-types"

interface DiscoverPageClientProps {
  category: DiscoverCategory
  initialData: DiscoverResponse
  initialGenre?: string
}

export function DiscoverPageClient({
  category,
  initialData,
  initialGenre,
}: DiscoverPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [currentGenre, setCurrentGenre] = useState<string | undefined>(
    initialGenre
  )
  const [data, setData] = useState<DiscoverResponse>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Track the last requested category and genre to prevent duplicate fetches
  const lastFetchKeyRef = useRef<string>(`${category}:${initialGenre || "all"}`)
  const isFetchingRef = useRef(false)

  // Keep data in sync when category changes via SSR navigation
  useEffect(() => {
    setData(initialData)
    setCurrentGenre(initialGenre)
    lastFetchKeyRef.current = `${category}:${initialGenre || "all"}`
  }, [category, initialData, initialGenre])

  // Handle genre filter selection
  const handleSelectGenre = useCallback(
    (genre?: string) => {
      if (genre === currentGenre) return

      const fetchKey = `${category}:${genre || "all"}`
      setCurrentGenre(genre)

      // Update URL query parameters without a full page reload
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (genre) {
          params.set("genre", genre)
        } else {
          params.delete("genre")
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })

      // If already fetched or currently fetching this key, skip
      if (lastFetchKeyRef.current === fetchKey || isFetchingRef.current) return

      lastFetchKeyRef.current = fetchKey
      isFetchingRef.current = true
      setIsLoading(true)

      let isMounted = true

      async function fetchFiltered() {
        try {
          const { data: resData, error } = await elysia
            .discover({ media: category })
            .get({
              query: { genre: genre || undefined },
            })

          if (isMounted && !error && resData) {
            setData(resData as DiscoverResponse)
          }
        } catch (err) {
          console.error("[Discover] Failed to fetch filtered media:", err)
        } finally {
          isFetchingRef.current = false
          if (isMounted) setIsLoading(false)
        }
      }

      fetchFiltered()

      return () => {
        isMounted = false
      }
    },
    [category, currentGenre, pathname, router, searchParams]
  )

  const meta = DISCOVER_MEDIA_METAS.find((m) => m.key === category)
  const hasSections = data.sections.some((s) => s.items.length > 0)
  const showHero = !currentGenre && data.hero.length > 0

  return (
    <div className="flex w-full flex-1 flex-col gap-6 py-4">
      {/* Top Media Tabs Navigation Bar */}
      <DiscoverMediaNav activeCategory={category} />

      {/* Hero Spotlight Banner (displayed when no specific genre filter is active) */}
      {showHero ? (
        <DiscoverHeroBanner items={data.hero} category={category} />
      ) : null}

      {/* Genre Quick Filter Bar */}
      <DiscoverGenreBar
        category={category}
        genres={data.genres}
        selectedGenre={currentGenre}
        onSelectGenre={handleSelectGenre}
      />

      {/* Loading Overlay State during non-blocking transition */}
      <div
        className={`flex flex-col gap-8 transition-opacity duration-200 ${
          isLoading || isPending
            ? "pointer-events-none opacity-60"
            : "opacity-100"
        }`}
      >
        {hasSections ? (
          data.sections.map((section) => (
            <DiscoverSectionCarousel
              key={section.id}
              section={section}
              category={category}
            />
          ))
        ) : (
          <DiscoverEmptyState
            category={category}
            selectedGenre={currentGenre}
            onClearFilter={() => handleSelectGenre(undefined)}
          />
        )}
      </div>
    </div>
  )
}
