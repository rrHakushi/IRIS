"use client"

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
  Suspense,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signIn } from "next-auth/react"
import { elysia } from "@/lib/elysia"
import { Spinner } from "@workspace/ui/components/spinner"
import { IconSearch, IconInfoCircle, IconSparkles } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { SearchResult, InfoboxItem, HistoryItem } from "./components/types"
import { KiroshiHome } from "./components/kiroshi-home"
import { KiroshiHistoryView } from "./components/kiroshi-history-view"
import { KiroshiResultsHeader } from "./components/kiroshi-results-header"
import { KiroshiWebResults } from "./components/kiroshi-web-results"
import { KiroshiImagesGrid } from "./components/kiroshi-images-grid"
import { KiroshiVideosList } from "./components/kiroshi-videos-list"
import { KiroshiAnswersCard } from "./components/kiroshi-answers-card"
import { KiroshiInfobox } from "./components/kiroshi-infobox"

interface CachedSearchPayload {
  results: SearchResult[]
  infoboxes: InfoboxItem[]
  answers: string[]
  corrections: string[]
  numberOfResults: number
  responseTimeMs: number
}

// Client-side in-memory cache to eliminate repeated server roundtrips
const clientSearchCache = new Map<string, CachedSearchPayload>()
const MAX_CACHE_ENTRIES = 60

function getClientCache(key: string): CachedSearchPayload | undefined {
  return clientSearchCache.get(key)
}

function setClientCache(key: string, data: CachedSearchPayload) {
  if (clientSearchCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = clientSearchCache.keys().next().value
    if (oldestKey) clientSearchCache.delete(oldestKey)
  }
  clientSearchCache.set(key, data)
}

function KiroshiSearchContent(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()
  const [, startTransition] = useTransition()

  // Read URL parameters
  const qParam = searchParams.get("q") || ""
  const categoryParam = searchParams.get("category") || "general"
  const timeRangeParam = searchParams.get("time_range") || ""
  const languageParam = searchParams.get("language") || "auto"
  const safeSearchParam = searchParams.get("safesearch") || "0"
  const viewParam = searchParams.get("view") || ""

  // Search Results state
  const [results, setResults] = useState<SearchResult[]>([])
  const [infoboxes, setInfoboxes] = useState<InfoboxItem[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [corrections, setCorrections] = useState<string[]>([])
  const [numberOfResults, setNumberOfResults] = useState<number>(0)
  const [responseTimeMs, setResponseTimeMs] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Infinite Scroll state
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const [isPrivateMode, setIsPrivateMode] = useState(false)

  // Redirect to sign in if unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      signIn()
    }
  }, [status])

  // Detect Private / Incognito Window
  useEffect(() => {
    async function detectPrivate() {
      try {
        if ("storage" in navigator && "estimate" in navigator.storage) {
          const { quota } = await navigator.storage.estimate()
          if (quota && quota < 120000000) {
            setIsPrivateMode(true)
          }
        }
      } catch {
        // Fallback default
      }
    }
    detectPrivate()
  }, [])

  // Initial page 1 search dispatch when query, category, or filter changes
  useEffect(() => {
    const trimmedQ = qParam.trim()
    if (!trimmedQ || viewParam === "history") {
      setResults([])
      setInfoboxes([])
      setAnswers([])
      setCorrections([])
      setPage(1)
      setHasMore(true)
      setIsLoading(false)
      setIsLoadingMore(false)
      setSearchError(null)
      return
    }

    setPage(1)
    setHasMore(true)

    const cacheKey = `${categoryParam}:${languageParam}:${safeSearchParam}:${timeRangeParam}:1:${trimmedQ.toLowerCase()}`

    // 1. Check client cache first
    const cached = getClientCache(cacheKey)
    if (cached) {
      setResults(cached.results)
      setInfoboxes(cached.infoboxes)
      setAnswers(cached.answers)
      setCorrections(cached.corrections)
      setNumberOfResults(cached.numberOfResults)
      setResponseTimeMs(cached.responseTimeMs)
      setIsLoading(false)
      setSearchError(null)
      return
    }

    // 2. Fetch page 1
    let isMounted = true
    setIsLoading(true)
    setSearchError(null)

    async function executeSearch() {
      try {
        const res = await elysia.kiroshi.search.get({
          query: {
            q: trimmedQ,
            category: categoryParam,
            pageno: "1",
            time_range: timeRangeParam || undefined,
            language: languageParam || undefined,
            safesearch: safeSearchParam || undefined,
            isPrivate: isPrivateMode ? "true" : undefined,
          },
        })

        if (!isMounted) return

        if (res.error) {
          const errDetail =
            typeof res.error === "object" && res.error !== null && "value" in res.error
              ? (res.error as { value?: { message?: string; detail?: string } }).value?.detail ||
                (res.error as { value?: { message?: string } }).value?.message
              : "Failed to connect to search engine."
          setSearchError(errDetail || "An error occurred while fetching search results.")
          setResults([])
          setIsLoading(false)
          return
        }

        if (res.data?.success) {
          const rawAnswers = res.data.answers || []
          const parsedAnswers: string[] = rawAnswers
            .map((ans: unknown) => {
              if (typeof ans === "string") return ans
              if (ans && typeof ans === "object") {
                const obj = ans as Record<string, unknown>
                return String(obj.answer || obj.content || obj.text || "")
              }
              return ""
            })
            .filter((s: string) => s.trim().length > 0)

          const rawCorrections = res.data.corrections || []
          const parsedCorrections: string[] = rawCorrections
            .map((c: unknown) => String(c))
            .filter((c: string) => c.trim().length > 0)

          const rawResults = (res.data.results as SearchResult[]) || []

          const payload: CachedSearchPayload = {
            results: rawResults,
            infoboxes: (res.data.infoboxes as InfoboxItem[]) || [],
            answers: parsedAnswers,
            corrections: parsedCorrections,
            numberOfResults: res.data.numberOfResults || 0,
            responseTimeMs: res.data.responseTimeMs || 0,
          }

          setClientCache(cacheKey, payload)

          setResults(rawResults)
          setInfoboxes(payload.infoboxes)
          setAnswers(payload.answers)
          setCorrections(payload.corrections)
          setNumberOfResults(payload.numberOfResults)
          setResponseTimeMs(payload.responseTimeMs)

          if (rawResults.length === 0) {
            setHasMore(false)
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return
        const message = err instanceof Error ? err.message : "Failed to connect to search engine."
        setSearchError(message)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    executeSearch()

    return () => {
      isMounted = false
    }
  }, [
    qParam,
    categoryParam,
    timeRangeParam,
    languageParam,
    safeSearchParam,
    viewParam,
    isPrivateMode,
  ])

  // Infinite Scroll: fetch next page
  const loadNextPage = useCallback(async () => {
    const trimmedQ = qParam.trim()
    if (!trimmedQ || isLoading || isLoadingMore || !hasMore) return

    const nextPage = page + 1
    setIsLoadingMore(true)

    try {
      const res = await elysia.kiroshi.search.get({
        query: {
          q: trimmedQ,
          category: categoryParam,
          pageno: String(nextPage),
          time_range: timeRangeParam || undefined,
          language: languageParam || undefined,
          safesearch: safeSearchParam || undefined,
          isPrivate: isPrivateMode ? "true" : undefined,
        },
      })

      if (res.data?.success) {
        const newResults = (res.data.results as SearchResult[]) || []
        if (newResults.length === 0) {
          setHasMore(false)
        } else {
          setResults((prev) => {
            const seen = new Set(prev.map((r) => r.url))
            const unique = newResults.filter((r) => !seen.has(r.url))
            if (unique.length === 0) {
              setHasMore(false)
              return prev
            }
            return [...prev, ...unique]
          })
          setPage(nextPage)
        }
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    qParam,
    categoryParam,
    timeRangeParam,
    languageParam,
    safeSearchParam,
    isPrivateMode,
    isLoading,
    isLoadingMore,
    hasMore,
    page,
  ])

  // IntersectionObserver for infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !isLoading &&
          !isLoadingMore &&
          hasMore &&
          results.length > 0
        ) {
          loadNextPage()
        }
      },
      { rootMargin: "600px" }
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [isLoading, isLoadingMore, hasMore, results.length, loadNextPage])

  // Navigation Helper
  const navigateToSearch = useCallback(
    (
      newQ: string,
      newCat = categoryParam,
      newTime = timeRangeParam,
      newLang = languageParam,
      newSafe = safeSearchParam
    ) => {
      const trimmed = newQ.trim()
      if (!trimmed) {
        router.push("/kiroshi")
        return
      }

      const params = new URLSearchParams()
      params.set("q", trimmed)
      if (newCat && newCat !== "general") params.set("category", newCat)
      if (newTime) params.set("time_range", newTime)
      if (newLang && newLang !== "auto") params.set("language", newLang)
      if (newSafe && newSafe !== "0") params.set("safesearch", newSafe)

      startTransition(() => {
        router.push(`/kiroshi?${params.toString()}`)
      })
    },
    [router, categoryParam, timeRangeParam, languageParam, safeSearchParam]
  )

  // Category switch
  const handleSelectCategory = useCallback(
    (newCat: string) => {
      if (!qParam.trim()) {
        router.push(newCat === "general" ? "/kiroshi" : `/kiroshi?category=${newCat}`)
        return
      }
      navigateToSearch(qParam, newCat)
    },
    [qParam, navigateToSearch, router]
  )

  // Filter change handler
  const handleChangeFilter = useCallback(
    (key: "timeRange" | "language" | "safeSearch", value: string) => {
      navigateToSearch(
        qParam,
        categoryParam,
        key === "timeRange" ? value : timeRangeParam,
        key === "language" ? value : languageParam,
        key === "safeSearch" ? value : safeSearchParam
      )
    },
    [qParam, categoryParam, timeRangeParam, languageParam, safeSearchParam, navigateToSearch]
  )

  // 1. Loading authentication
  if (status === "loading") {
    return (
      <div className="flex size-full items-center justify-center bg-background min-h-[50vh]">
        <Spinner className="size-8 text-primary" />
      </div>
    )
  }

  // 2. Full History View when ?view=history
  if (viewParam === "history") {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background text-foreground select-text">
        <KiroshiHistoryView
          onSelectQuery={(histQuery, histCat) => {
            navigateToSearch(histQuery, histCat || "general")
          }}
          onBackToSearch={() => router.push(qParam ? `/kiroshi?q=${encodeURIComponent(qParam)}` : "/kiroshi")}
        />
      </div>
    )
  }

  // 3. Home Landing View when no query is present
  if (!qParam.trim()) {
    return (
      <KiroshiHome
        onSearch={(searchQuery) => navigateToSearch(searchQuery, categoryParam)}
      />
    )
  }

  const isImages = categoryParam === "images"

  // 4. Results View
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground select-text">
      {/* Sticky Results Header - Full Width */}
      <KiroshiResultsHeader
        query={qParam}
        activeCategory={categoryParam}
        timeRange={timeRangeParam}
        language={languageParam}
        safeSearch={safeSearchParam}
        responseTimeMs={responseTimeMs}
        numberOfResults={numberOfResults}
        onSubmitSearch={(newQ) => navigateToSearch(newQ, categoryParam)}
        onSelectCategory={handleSelectCategory}
        onChangeFilter={handleChangeFilter}
      />

      {/* Main Results Container - uses full width */}
      <main className="flex w-full flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
        <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start lg:gap-8 min-w-0 w-full">
          {/* Main Column */}
          <div
            className={cn(
              "min-w-0 w-full space-y-4 sm:space-y-6",
              isImages ? "w-full flex-1" : "flex-1 max-w-4xl"
            )}
          >
            {isLoading ? (
              /* Loading Skeletons */
              <div className="space-y-6 animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2 rounded-2xl border border-border/20 bg-muted/10 p-4">
                    <div className="h-3 w-48 rounded bg-muted/60" />
                    <div className="h-5 w-4/5 rounded bg-muted/80" />
                    <div className="h-3.5 w-full rounded bg-muted/40" />
                    <div className="h-3.5 w-2/3 rounded bg-muted/40" />
                  </div>
                ))}
              </div>
            ) : searchError ? (
              /* Error Notice */
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-start space-y-2">
                <div className="flex items-center gap-2 font-semibold text-destructive">
                  <IconInfoCircle className="size-5" />
                  <span>Search Notice</span>
                </div>
                <p className="text-sm text-foreground/90">{searchError}</p>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigateToSearch(qParam, categoryParam)}
                    className="text-xs"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Did you mean spell corrections */}
                {corrections.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-1">
                    <IconSparkles className="size-3.5 text-primary" />
                    <span>Did you mean:</span>
                    {corrections.map((corr) => (
                      <button
                        key={corr}
                        type="button"
                        onClick={() => navigateToSearch(corr, categoryParam)}
                        className="font-semibold text-primary hover:underline italic"
                      >
                        {corr}
                      </button>
                    ))}
                  </div>
                )}

                {/* Instant Answers */}
                <KiroshiAnswersCard answers={answers} />

                {/* Empty State */}
                {results.length === 0 ? (
                  <div className="py-20 text-center space-y-3">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/30 text-muted-foreground/60 mx-auto">
                      <IconSearch className="size-6" />
                    </div>
                    <h3 className="text-base font-semibold">
                      No results found for &ldquo;{qParam}&rdquo;
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Try different keywords, adjust SafeSearch filters, or switch categories.
                    </p>
                  </div>
                ) : isImages ? (
                  /* Images Grid - pure masonry across full width */
                  <KiroshiImagesGrid results={results} />
                ) : categoryParam === "videos" ? (
                  /* Videos List */
                  <KiroshiVideosList results={results} query={qParam} />
                ) : (
                  /* Standard Web Results */
                  <KiroshiWebResults results={results} query={qParam} />
                )}

                {/* Infinite Scroll Sentinel */}
                <div ref={sentinelRef} className="h-6 w-full" />

                {/* Loading indicator during infinite scroll */}
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-6 gap-2">
                    <Spinner className="size-5 text-primary" />
                    <span className="text-xs text-muted-foreground">Loading more results...</span>
                  </div>
                )}

                {/* Manual Load More button fallback */}
                {!isLoading && !isLoadingMore && hasMore && results.length > 0 && (
                  <div className="flex justify-center py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadNextPage}
                      className="text-xs"
                    >
                      Load more results
                    </Button>
                  </div>
                )}

                {/* End of results indicator */}
                {!hasMore && results.length > 0 && (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/60">
                    <span>End of search results</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column: Infobox Knowledge Panel (only when not on images) */}
          {infoboxes.length > 0 && !isLoading && !isImages && (
            <KiroshiInfobox infoboxes={infoboxes} />
          )}
        </div>
      </main>
    </div>
  )
}

export default function IrisSearchPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex size-full items-center justify-center bg-background min-h-[50vh]">
          <Spinner className="size-8 text-primary" />
        </div>
      }
    >
      <KiroshiSearchContent />
    </Suspense>
  )
}
