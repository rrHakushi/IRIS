"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signIn } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { IrisUserMenu } from "@/components/navigation/iris-user-menu"
import { elysia } from "@/lib/elysia"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  IconSearch,
  IconX,
  IconWorld,
  IconPhoto,
  IconPlayerPlay,
  IconNews,
  IconMap,
  IconMusic,
  IconCode,
  IconAtom,
  IconFolder,
  IconUsers,
  IconChevronDown,
  IconHistory,
  IconTrash,
  IconExternalLink,
  IconShieldCheck,
  IconClock,
  IconSparkles,
  IconInfoCircle,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

export interface SearchCategoryItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const CATEGORIES: SearchCategoryItem[] = [
  { id: "general", label: "General", icon: IconWorld },
  { id: "images", label: "Images", icon: IconPhoto },
  { id: "videos", label: "Videos", icon: IconPlayerPlay },
  { id: "news", label: "News", icon: IconNews },
  { id: "map", label: "Map", icon: IconMap },
  { id: "music", label: "Music", icon: IconMusic },
  { id: "it", label: "It", icon: IconCode },
  { id: "science", label: "Science", icon: IconAtom },
  { id: "files", label: "Files", icon: IconFolder },
  { id: "social_media", label: "Social Media", icon: IconUsers },
]

const TIME_RANGES = [
  { id: "anytime", label: "Anytime", value: "" },
  { id: "day", label: "Past day", value: "day" },
  { id: "week", label: "Past week", value: "week" },
  { id: "month", label: "Past month", value: "month" },
  { id: "year", label: "Past year", value: "year" },
]

const LANGUAGES = [
  { id: "auto", label: "Auto-detect (en-US)", value: "auto" },
  { id: "en-US", label: "English (US)", value: "en-US" },
  { id: "ja-JP", label: "Japanese (日本語)", value: "ja-JP" },
  { id: "de-DE", label: "German (Deutsch)", value: "de-DE" },
  { id: "fr-FR", label: "French (Français)", value: "fr-FR" },
  { id: "all", label: "All Languages", value: "all" },
]

const SAFE_SEARCH_OPTIONS = [
  { id: "0", label: "SafeSearch: None", value: "0" },
  { id: "1", label: "SafeSearch: Moderate", value: "1" },
  { id: "2", label: "SafeSearch: Strict", value: "2" },
]

interface SearchResult {
  title: string
  url: string
  content: string
  engine?: string
  engines?: string[]
  publishedDate?: string | Date | null
  thumbnail?: string | null
  img_src?: string | null
  resolution?: string | null
  template?: string
  score?: number
}

interface InfoboxItem {
  infobox: string
  id?: string
  content?: string
  img_src?: string | null
  urls?: Array<{ title: string; url: string }>
  attributes?: Array<{ label: string; value: string }>
}

interface HistoryItem {
  id: string
  query: string
  category: string
  createdAt: string
}

export default function IrisSearchPage(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  // URL query state
  const qParam = searchParams.get("q") || ""
  const categoryParam = searchParams.get("category") || "general"
  const pageParam = parseInt(searchParams.get("page") || "1", 10) || 1
  const timeRangeParam = searchParams.get("time_range") || ""
  const languageParam = searchParams.get("language") || "auto"
  const safeSearchParam = searchParams.get("safesearch") || "0"

  // Local input state
  const [queryInput, setQueryInput] = useState(qParam)
  const [activeCategory, setActiveCategory] = useState(categoryParam)
  const [activeTimeRange, setActiveTimeRange] = useState(timeRangeParam)
  const [activeLanguage, setActiveLanguage] = useState(languageParam)
  const [activeSafeSearch, setActiveSafeSearch] = useState(safeSearchParam)
  const [currentPage, setCurrentPage] = useState(pageParam)

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const headerInputRef = useRef<HTMLInputElement>(null)
  const homeContainerRef = useRef<HTMLDivElement>(null)
  const headerContainerRef = useRef<HTMLDivElement>(null)

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      const isInsideHome = homeContainerRef.current?.contains(target)
      const isInsideHeader = headerContainerRef.current?.contains(target)
      if (!isInsideHome && !isInsideHeader) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Search Results state
  const [results, setResults] = useState<SearchResult[]>([])
  const [infoboxes, setInfoboxes] = useState<InfoboxItem[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [numberOfResults, setNumberOfResults] = useState<number>(0)
  const [responseTimeMs, setResponseTimeMs] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // History state
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([])
  const [isPrivateMode, setIsPrivateMode] = useState(false)

  // Sync state when URL params change
  useEffect(() => {
    setQueryInput(qParam)
    setActiveCategory(categoryParam)
    setCurrentPage(pageParam)
    setActiveTimeRange(timeRangeParam)
    setActiveLanguage(languageParam)
    setActiveSafeSearch(safeSearchParam)
  }, [qParam, categoryParam, pageParam, timeRangeParam, languageParam, safeSearchParam])

  // Redirect to login if unauthenticated
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

  // Load user's recent search history on mount / home view
  const loadHistory = useCallback(async () => {
    if (status !== "authenticated") return
    try {
      const res = await elysia.webSearch.history.get({
        query: { limit: "15" },
      })
      if (res.data?.success && Array.isArray(res.data.history)) {
        setRecentHistory(res.data.history)
      }
    } catch (err) {
      console.warn("Could not load search history:", err)
    }
  }, [status])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Autocomplete fetch on input change
  useEffect(() => {
    const trimmed = queryInput.trim()
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await elysia.webSearch.suggestions.get({
          query: { q: trimmed },
        })
        if (res.data) {
          const list = (res.data as any).suggestions || (Array.isArray(res.data) ? res.data[1] : [])
          if (Array.isArray(list) && list.length > 0) {
            setSuggestions(list.slice(0, 8))
            setShowSuggestions(true)
            setFocusedSuggestionIndex(-1)
          } else {
            setSuggestions([])
            setShowSuggestions(false)
          }
        }
      } catch {
        setSuggestions([])
      }
    }, 180)

    return () => clearTimeout(timer)
  }, [queryInput])

  // Execute Search Query when qParam exists
  useEffect(() => {
    if (!qParam.trim()) {
      setResults([])
      setInfoboxes([])
      setAnswers([])
      setIsLoading(false)
      setSearchError(null)
      return
    }

    let isMounted = true
    setIsLoading(true)
    setSearchError(null)

    async function executeSearch() {
      try {
        const res = await elysia.webSearch.get({
          query: {
            q: qParam,
            category: categoryParam,
            pageno: String(pageParam),
            time_range: timeRangeParam || undefined,
            language: languageParam || undefined,
            safesearch: safeSearchParam || undefined,
            isPrivate: isPrivateMode ? "true" : undefined,
          },
        })

        if (!isMounted) return

        if (res.error) {
          const errMsg = (res.error as any)?.value?.message || "An error occurred while fetching search results."
          setSearchError(errMsg)
          setResults([])
          setAnswers([])
          setIsLoading(false)
          return
        }

        if (res.data && res.data.success) {
          setResults(res.data.results || [])
          setInfoboxes(res.data.infoboxes || [])
          const rawAnswers = (res.data as any).answers || []
          const parsedAnswers: string[] = rawAnswers
            .map((ans: any) => {
              if (typeof ans === "string") return ans
              if (ans && typeof ans === "object") {
                return ans.answer || ans.content || ans.text || ""
              }
              return ""
            })
            .filter((s: string) => s.trim().length > 0)
          setAnswers(parsedAnswers)
          setNumberOfResults(res.data.numberOfResults || 0)
          setResponseTimeMs(res.data.responseTimeMs || 0)
          loadHistory()
        }
      } catch (err: any) {
        if (!isMounted) return
        setSearchError(err?.message || "Failed to connect to search engine.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    executeSearch()

    return () => {
      isMounted = false
    }
  }, [qParam, categoryParam, pageParam, timeRangeParam, languageParam, safeSearchParam, isPrivateMode, loadHistory])

  // Navigation Trigger helper
  const navigateSearch = (
    newQ: string,
    newCat = activeCategory,
    newPage = 1,
    newTime = activeTimeRange,
    newLang = activeLanguage,
    newSafe = activeSafeSearch
  ) => {
    const trimmed = newQ.trim()
    if (!trimmed) {
      router.push("/IRIS-search")
      return
    }

    setShowSuggestions(false)
    const params = new URLSearchParams()
    params.set("q", trimmed)
    if (newCat && newCat !== "general") params.set("category", newCat)
    if (newPage > 1) params.set("page", String(newPage))
    if (newTime) params.set("time_range", newTime)
    if (newLang && newLang !== "auto") params.set("language", newLang)
    if (newSafe && newSafe !== "0") params.set("safesearch", newSafe)

    router.push(`/IRIS-search?${params.toString()}`)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (focusedSuggestionIndex >= 0 && suggestions[focusedSuggestionIndex]) {
      navigateSearch(suggestions[focusedSuggestionIndex])
    } else {
      navigateSearch(queryInput)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocusedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocusedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await elysia.webSearch.history.delete({
        query: { id },
      })
      setRecentHistory((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      console.warn("Failed to delete history item:", err)
    }
  }

  const highlightSnippet = (snippet: string, query: string) => {
    if (!snippet || !query) return snippet
    const words = query
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    if (words.length === 0) return snippet
    const regex = new RegExp(`(${words.join("|")})`, "gi")
    const parts = snippet.split(regex)

    return parts.map((part, i) =>
      regex.test(part) ? (
        <strong key={i} className="font-semibold text-foreground">
          {part}
        </strong>
      ) : (
        part
      )
    )
  }

  // Format breadcrumb URL
  const formatBreadcrumb = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr)
      const pathname = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean)
      const pathParts = pathname.slice(0, 3).map((p) => decodeURIComponent(p))
      return [parsed.origin, ...pathParts].join(" › ")
    } catch {
      return urlStr
    }
  }

  // Format published date safely for React rendering
  const formatPublishedDate = (dateVal: unknown): string | null => {
    if (!dateVal) return null
    if (dateVal instanceof Date) {
      return dateVal.toLocaleDateString()
    }
    if (typeof dateVal === "string") {
      const parsed = new Date(dateVal)
      return isNaN(parsed.getTime()) ? dateVal : parsed.toLocaleDateString()
    }
    if (typeof dateVal === "number") {
      return new Date(dateVal).toLocaleDateString()
    }
    return null
  }

  // Loading state while verifying authentication
  if (status === "loading") {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const isHomeView = !qParam.trim()

  return (
    <div className="relative flex min-h-full w-full flex-col bg-background text-foreground select-text">
      {/* Persistent Top Right User Menu across Home and Results */}
      <div className="fixed top-2.5 end-3 sm:end-6 z-40 flex items-center justify-end w-auto sm:w-[240px] pointer-events-auto">
        <IrisUserMenu placement="bottom end" triggerVariant="responsive" />
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. HOME VIEW (when no query is present)             */}
      {/* ---------------------------------------------------- */}
      {isHomeView ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
          <div className="relative z-10 flex w-full max-w-2xl flex-col items-center space-y-6 sm:space-y-8 text-center">
            {/* Title */}
            <div className="flex flex-col items-center">
              <h1
                className="bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-5xl"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #10b981 0%, #06b6d4 25%, #2563eb 50%, #7c3aed 75%, #1e1b4b 100%)",
                }}
              >
                IRIS Search
              </h1>
            </div>

            {/* Search Input Box with Autocomplete */}
            <div ref={homeContainerRef} className="relative w-full">
              <form onSubmit={handleFormSubmit} className="relative w-full">
                <div className="group relative flex w-full items-center rounded-2xl border border-border/60 bg-muted/30 shadow-lg shadow-black/10 backdrop-blur-md transition-all focus-within:border-primary/80 focus-within:ring-2 focus-within:ring-primary/20">
                  <IconSearch className="ms-3 sm:ms-4 size-4 sm:size-5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    ref={inputRef}
                    type="text"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Search the web, images, code, news..."
                    className="h-12 sm:h-14 flex-1 border-0 bg-transparent px-2.5 sm:px-3 text-sm sm:text-base shadow-none focus-visible:ring-0"
                    autoFocus
                  />
                  {queryInput.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQueryInput("")
                        setSuggestions([])
                        inputRef.current?.focus()
                      }}
                      className="me-1 sm:me-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <IconX className="size-3.5 sm:size-4" />
                    </button>
                  )}
                  <Button
                    type="submit"
                    size="icon"
                    className="me-2 size-8 sm:size-10 rounded-xl bg-primary text-primary-foreground hover:opacity-90 shrink-0"
                    aria-label="Search"
                  >
                    <IconSearch className="size-4 sm:size-5" />
                  </Button>
                </div>
              </form>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  className="absolute top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border/60 bg-popover/95 p-1 text-start shadow-xl backdrop-blur-md"
                >
                  {suggestions.map((sug, idx) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => navigateSearch(sug)}
                      onMouseEnter={() => setFocusedSuggestionIndex(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        focusedSuggestionIndex === idx
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <IconSearch className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{sug}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent History Chips */}
            {recentHistory.length > 0 && (
              <div className="w-full space-y-2 pt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium">
                    <IconHistory className="size-3.5" />
                    <span>Recent Searches</span>
                  </div>
                  {isPrivateMode && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <IconShieldCheck className="size-3 text-emerald-500" />
                      Private Window (History Paused)
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {recentHistory.slice(0, 10).map((hist) => (
                    <div
                      key={hist.id}
                      onClick={() => navigateSearch(hist.query, hist.category)}
                      className="group flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/70 hover:text-foreground"
                    >
                      <IconClock className="size-3 shrink-0 opacity-60" />
                      <span className="max-w-[140px] truncate">{hist.query}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteHistoryItem(e, hist.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                      >
                        <IconX className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ---------------------------------------------------- */
        /* 2. RESULTS VIEW (when query is present)             */
        /* ---------------------------------------------------- */
        <div className="flex min-h-screen w-full flex-col">
          {/* Top Bar with Search Input & Navigation */}
          <div className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur-md">
            <div className="flex max-w-6xl flex-col gap-2.5 sm:gap-3 px-3 sm:px-6 pt-2.5 sm:pt-3 pb-2 mx-auto lg:mx-0 lg:ms-[max(2rem,calc((100vw-72rem)/4))]">
              {/* Header row: Logo icon + Search Input (reserving right space for persistent user menu) */}
              <div className="flex items-center justify-between gap-2 sm:gap-3 pe-11 sm:pe-[250px] lg:pe-0">
                <div className="flex flex-1 items-center gap-2 sm:gap-3 max-w-2xl min-w-0">
                  <Link
                    href="/IRIS-search"
                    className="shrink-0 transition-transform hover:scale-105"
                    title="IRIS Search Home"
                  >
                    <Image
                      src="/iris-icons/iris-search-ring-left.png"
                      alt="IRIS Search"
                      width={36}
                      height={36}
                      className="size-8 sm:size-9 rounded-full object-contain"
                    />
                  </Link>

                  <div ref={headerContainerRef} className="relative flex-1 min-w-0">
                  <form onSubmit={handleFormSubmit} className="relative w-full">
                    <div className="group relative flex w-full items-center rounded-full border border-border/60 bg-muted/40 transition-colors focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/20">
                      <Input
                        ref={headerInputRef}
                        type="text"
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        placeholder="Search the web..."
                        className="h-9 sm:h-10 flex-1 border-0 bg-transparent ps-3.5 pe-1 text-xs sm:text-sm shadow-none focus-visible:ring-0"
                      />
                      {queryInput.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setQueryInput("")
                            inputRef.current?.focus()
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <IconX className="size-3.5 sm:size-4" />
                        </button>
                      )}
                      <button
                        type="submit"
                        className="pe-2.5 ps-1 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <IconSearch className="size-4 sm:size-4.5" />
                      </button>
                    </div>
                  </form>

                  {/* Autocomplete in Header */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border/60 bg-popover/95 p-1 text-start shadow-xl backdrop-blur-md"
                    >
                      {suggestions.map((sug, idx) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => navigateSearch(sug)}
                          onMouseEnter={() => setFocusedSuggestionIndex(idx)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                            focusedSuggestionIndex === idx
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          )}
                        >
                          <IconSearch className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{sug}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

              {/* Category Tabs (matching screenshot) */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-border/30 pt-0.5 sm:pt-1 -mx-3 px-3 sm:mx-0 sm:px-0">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  const isActive = activeCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(cat.id)
                        navigateSearch(queryInput, cat.id, 1)
                      }}
                      className={cn(
                        "relative flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                        isActive
                          ? "text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5 sm:size-4 shrink-0" />
                      <span>{cat.label}</span>
                      {isActive && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Filters Row: Language, Time range, SafeSearch (matching screenshot) */}
              <div className="flex items-center justify-between gap-2 pt-0.5 sm:pt-1 text-xs text-muted-foreground overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {/* Language Dropdown */}
                  <DropdownMenuTrigger>
                    <Button variant="ghost" size="sm" className="h-6 sm:h-7 gap-1 px-1.5 sm:px-2 text-[11px] sm:text-xs font-normal text-muted-foreground hover:text-foreground shrink-0">
                      <span>{LANGUAGES.find((l) => l.value === activeLanguage)?.label || "Auto-detect"}</span>
                      <IconChevronDown className="size-3 opacity-60" />
                    </Button>
                    <DropdownMenu placement="bottom start">
                      {LANGUAGES.map((l) => (
                        <DropdownMenuItem
                          key={l.id}
                          onAction={() => {
                            setActiveLanguage(l.value)
                            navigateSearch(queryInput, activeCategory, 1, activeTimeRange, l.value, activeSafeSearch)
                          }}
                          className={cn(activeLanguage === l.value && "font-semibold text-primary")}
                        >
                          {l.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenu>
                  </DropdownMenuTrigger>

                  {/* Time Range Dropdown */}
                  <DropdownMenuTrigger>
                    <Button variant="ghost" size="sm" className="h-6 sm:h-7 gap-1 px-1.5 sm:px-2 text-[11px] sm:text-xs font-normal text-muted-foreground hover:text-foreground shrink-0">
                      <span>{TIME_RANGES.find((t) => t.value === activeTimeRange)?.label || "Anytime"}</span>
                      <IconChevronDown className="size-3 opacity-60" />
                    </Button>
                    <DropdownMenu placement="bottom start">
                      {TIME_RANGES.map((t) => (
                        <DropdownMenuItem
                          key={t.id}
                          onAction={() => {
                            setActiveTimeRange(t.value)
                            navigateSearch(queryInput, activeCategory, 1, t.value, activeLanguage, activeSafeSearch)
                          }}
                          className={cn(activeTimeRange === t.value && "font-semibold text-primary")}
                        >
                          {t.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenu>
                  </DropdownMenuTrigger>

                  {/* SafeSearch Dropdown */}
                  <DropdownMenuTrigger>
                    <Button variant="ghost" size="sm" className="h-6 sm:h-7 gap-1 px-1.5 sm:px-2 text-[11px] sm:text-xs font-normal text-muted-foreground hover:text-foreground shrink-0">
                      <span>{SAFE_SEARCH_OPTIONS.find((s) => s.value === activeSafeSearch)?.label || "SafeSearch"}</span>
                      <IconChevronDown className="size-3 opacity-60" />
                    </Button>
                    <DropdownMenu placement="bottom start">
                      {SAFE_SEARCH_OPTIONS.map((s) => (
                        <DropdownMenuItem
                          key={s.id}
                          onAction={() => {
                            setActiveSafeSearch(s.value)
                            navigateSearch(queryInput, activeCategory, 1, activeTimeRange, activeLanguage, s.value)
                          }}
                          className={cn(activeSafeSearch === s.value && "font-semibold text-primary")}
                        >
                          {s.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenu>
                  </DropdownMenuTrigger>
                </div>

                {/* Right Stat: Response time widget (matching screenshot) */}
                {responseTimeMs > 0 && (
                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground/80 shrink-0">
                    <span>▸ Response time: {(responseTimeMs / 1000).toFixed(1)} seconds</span>
                    {numberOfResults > 0 && (
                      <span className="hidden sm:inline">({numberOfResults.toLocaleString()} results)</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Main Body */}
          <div className="flex w-full max-w-6xl flex-1 px-3 sm:px-6 py-4 sm:py-6 mx-auto lg:mx-0 lg:ms-[max(2rem,calc((100vw-72rem)/4))] min-w-0">
            <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start lg:gap-10 min-w-0 w-full">
              {/* Left Column: Results List */}
              <div className="flex-1 min-w-0 w-full space-y-4 sm:space-y-6">
                {isLoading ? (
                  /* Loading Skeletons */
                  <div className="space-y-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="space-y-2 animate-pulse">
                        <div className="h-3.5 w-64 rounded bg-muted/60" />
                        <div className="h-5 w-4/5 rounded bg-muted/80" />
                        <div className="h-4 w-full rounded bg-muted/40" />
                        <div className="h-4 w-2/3 rounded bg-muted/40" />
                      </div>
                    ))}
                  </div>
                ) : searchError ? (
                  /* Error Alert */
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-start space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-destructive">
                      <IconInfoCircle className="size-5" />
                      <span>Search Notice</span>
                    </div>
                    <p className="text-sm text-foreground/90">{searchError}</p>
                    <p className="text-xs text-muted-foreground">
                      SearXNG is running on <code className="bg-muted px-1.5 py-0.5 rounded">SEARXNG_URL</code>. Verify that <code className="bg-muted px-1.5 py-0.5 rounded">formats: [html, json]</code> is active in <code className="bg-muted px-1.5 py-0.5 rounded">settings.yml</code>.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Instant Answers on Top of Search Results */}
                    {answers.length > 0 && (
                      <div className="space-y-3 min-w-0 w-full">
                        {answers.map((ans, aIdx) => (
                          <div
                            key={aIdx}
                            className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5 text-start shadow-sm backdrop-blur-sm space-y-2 min-w-0 w-full overflow-hidden"
                          >
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                              <IconSparkles className="size-4 shrink-0" />
                              <span>Quick Answer</span>
                            </div>
                            <p className="text-sm sm:text-base leading-relaxed text-foreground/95 break-words">
                              {ans}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {results.length === 0 ? (
                  /* Empty Results */
                  <div className="py-16 text-center space-y-3">
                    <IconSearch className="mx-auto size-10 text-muted-foreground/40" />
                    <h3 className="text-base font-semibold">No results found for &ldquo;{qParam}&rdquo;</h3>
                    <p className="text-sm text-muted-foreground">
                      Try different keywords, adjust SafeSearch, or switch categories.
                    </p>
                  </div>
                ) : activeCategory === "images" ? (
                  /* Images Grid */
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {results.map((res, i) => (
                      <a
                        key={i}
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card transition-all hover:border-primary/50 hover:shadow-md"
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-muted">
                          {res.img_src || res.thumbnail ? (
                            <img
                              src={res.img_src || res.thumbnail || ""}
                              alt={res.title}
                              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground">
                              <IconPhoto className="size-8" />
                            </div>
                          )}
                        </div>
                        <div className="p-2 space-y-1">
                          <p className="line-clamp-1 text-xs font-medium text-foreground group-hover:text-primary">
                            {res.title}
                          </p>
                          <p className="line-clamp-1 text-[10px] text-muted-foreground">
                            {formatBreadcrumb(res.url)}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : activeCategory === "videos" ? (
                  /* Videos List */
                  <div className="space-y-4">
                    {results.map((res, i) => (
                      <div
                        key={i}
                        className="flex flex-col sm:flex-row gap-3 rounded-xl border border-border/40 bg-card p-3 transition-colors hover:border-primary/40"
                      >
                        {res.thumbnail && (
                          <div className="relative aspect-video w-full sm:w-48 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <img
                              src={res.thumbnail}
                              alt={res.title}
                              className="size-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <IconPlayerPlay className="size-6 text-white drop-shadow" />
                            </div>
                          </div>
                        )}
                        <div className="flex-1 space-y-1">
                          <span className="text-[11px] text-muted-foreground">
                            {formatBreadcrumb(res.url)}
                          </span>
                          <h3 className="text-base font-semibold leading-snug">
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {res.title}
                            </a>
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {highlightSnippet(res.content, qParam)}
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground">
                            {res.engine && <Badge variant="secondary" className="text-[10px]">{res.engine}</Badge>}
                            {res.publishedDate && <span>{formatPublishedDate(res.publishedDate)}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Standard Web Search Results (matching screenshot with wrapping) */
                  <div className="space-y-3.5 sm:space-y-4 min-w-0 w-full">
                    {results.map((res, i) => {
                      const thumbUrl = res.thumbnail || res.img_src
                      return (
                        <article
                          key={i}
                          className="group relative flex flex-col space-y-2 rounded-2xl border border-border/40 bg-card/40 p-3.5 sm:p-4 text-start transition-all hover:border-primary/40 hover:bg-card/60 shadow-xs min-w-0 w-full overflow-hidden"
                        >
                          {/* URL Breadcrumb - wraps naturally without cutting off */}
                          <div className="text-[11px] sm:text-xs text-muted-foreground/80 break-all leading-normal">
                            {formatBreadcrumb(res.url)}
                          </div>

                          <div className="flex items-start justify-between gap-3 sm:gap-4 min-w-0 w-full">
                            <div className="flex-1 min-w-0 space-y-1">
                              {/* Title Link - wraps naturally */}
                              <h2 className="text-base sm:text-lg font-medium leading-snug break-words">
                                <a
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#60a5fa] hover:text-[#93c5fd] hover:underline break-words"
                                >
                                  {res.title}
                                </a>
                              </h2>

                              {/* Content Snippet - wraps naturally */}
                              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground line-clamp-4 break-words">
                                {highlightSnippet(res.content, qParam)}
                              </p>
                            </div>

                            {/* Thumbnail if present */}
                            {thumbUrl && (
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group/thumb shrink-0 overflow-hidden rounded-lg sm:rounded-xl border border-border/40 bg-muted/30 transition-transform hover:scale-105"
                              >
                                <img
                                  src={thumbUrl}
                                  alt={res.title}
                                  className="size-16 sm:size-20 rounded-lg sm:rounded-xl object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    const parent = e.currentTarget.parentElement
                                    if (parent) {
                                      parent.style.display = "none"
                                    }
                                  }}
                                />
                              </a>
                            )}
                          </div>

                          {/* Engine Badges & Cached Link - wraps cleanly */}
                          <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5 text-[10px] sm:text-[11px] text-muted-foreground/70">
                            {res.engines && res.engines.length > 0 ? (
                              res.engines.map((eng) => (
                                <span key={eng} className="hover:text-foreground">
                                  {eng}
                                </span>
                              ))
                            ) : res.engine ? (
                              <span className="hover:text-foreground">{res.engine}</span>
                            ) : null}
                            <span>⋮</span>
                            <a
                              href={`https://web.archive.org/web/${res.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline hover:text-foreground"
                            >
                              cached
                            </a>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}

                    {/* Pagination */}
                    {results.length > 0 && (
                      <div className="flex items-center justify-between border-t border-border/40 pt-4 pb-12 sm:pt-6 sm:pb-0">
                        <Button
                          variant="outline"
                          size="sm"
                          isDisabled={currentPage <= 1 || isLoading}
                          onClick={() => navigateSearch(queryInput, activeCategory, currentPage - 1)}
                        >
                          Previous
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Page {currentPage}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          isDisabled={isLoading}
                          onClick={() => navigateSearch(queryInput, activeCategory, currentPage + 1)}
                        >
                          Next Page
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Column: Infoboxes (Wikipedia extract, quick answers) */}
              {infoboxes.length > 0 && (
                <div className="w-full lg:w-80 shrink-0 space-y-4">
                  {infoboxes.map((ib, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 text-start shadow-sm"
                    >
                      {ib.img_src && (
                        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
                          <img
                            src={ib.img_src}
                            alt={ib.infobox}
                            className="size-full object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <h4 className="text-base font-bold">{ib.infobox}</h4>
                        {ib.content && (
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-5">
                            {ib.content}
                          </p>
                        )}
                      </div>

                      {ib.attributes && ib.attributes.length > 0 && (
                        <div className="space-y-1 border-t border-border/40 pt-2 text-xs">
                          {ib.attributes.slice(0, 5).map((attr, aIdx) => (
                            <div key={aIdx} className="flex justify-between gap-2">
                              <span className="text-muted-foreground">{attr.label}</span>
                              <span className="font-medium text-end">{attr.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {ib.urls && ib.urls.length > 0 && (
                        <div className="border-t border-border/40 pt-2 flex flex-wrap gap-2">
                          {ib.urls.map((u, uIdx) => (
                            <a
                              key={uIdx}
                              href={u.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <span>{u.title}</span>
                              <IconExternalLink className="size-3" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
