"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconHistory,
  IconSearch,
  IconTrash,
  IconClock,
  IconCalendar,
  IconExternalLink,
  IconWorld,
  IconPhoto,
  IconPlayerPlay,
  IconNews,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"
import type { HistoryItem } from "./types"

export interface KiroshiHistoryViewProps {
  onSelectQuery: (query: string, category?: string) => void
  onBackToSearch: () => void
}

type TypeFilter = "all" | "query" | "site"
type CategoryFilter = "all" | "general" | "images" | "videos" | "news"

export function KiroshiHistoryView({
  onSelectQuery,
  onBackToSearch,
}: KiroshiHistoryViewProps): React.JSX.Element {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterText, setFilterText] = useState("")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await elysia.kiroshi.history.get({
        query: { limit: "150" },
      })
      if (res.data?.success && Array.isArray(res.data.history)) {
        setHistory(res.data.history)
      }
    } catch (err) {
      console.warn("Failed to load search history:", err)
      toast.error("Could not load search history")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await elysia.kiroshi.history.delete({
        query: { id },
      })
      setHistory((prev) => prev.filter((item) => item.id !== id))
      toast.success("History entry removed")
    } catch {
      toast.error("Failed to delete history item")
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearAll = async () => {
    setIsClearing(true)
    try {
      const res = await elysia.kiroshi.history.delete()
      if (res.data?.success) {
        setHistory([])
        setClearDialogOpen(false)
        toast.success("All history cleared")
      } else {
        toast.error("Failed to clear history")
      }
    } catch {
      toast.error("Failed to clear history")
    } finally {
      setIsClearing(false)
    }
  }

  // Filter history
  const filteredHistory = useMemo(() => {
    const q = filterText.trim().toLowerCase()

    return history.filter((item) => {
      // Type filter
      const itemType = item.type || "query"
      if (typeFilter !== "all" && itemType !== typeFilter) {
        return false
      }

      // Category filter
      if (categoryFilter !== "all") {
        const itemCat = (item.category || "general").toLowerCase()
        if (itemCat !== categoryFilter) return false
      }

      // Text query search filter
      if (q) {
        const matchQuery = item.query?.toLowerCase().includes(q)
        const matchTitle = item.title?.toLowerCase().includes(q)
        const matchUrl = item.url?.toLowerCase().includes(q)
        const matchCat = item.category?.toLowerCase().includes(q)
        if (!matchQuery && !matchTitle && !matchUrl && !matchCat) {
          return false
        }
      }

      return true
    })
  }, [history, typeFilter, categoryFilter, filterText])

  // Group history by date
  const groupedHistory = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterday = today - 24 * 60 * 60 * 1000
    const sevenDaysAgo = today - 7 * 24 * 60 * 60 * 1000

    const groups: {
      today: HistoryItem[]
      yesterday: HistoryItem[]
      pastWeek: HistoryItem[]
      older: HistoryItem[]
    } = {
      today: [],
      yesterday: [],
      pastWeek: [],
      older: [],
    }

    for (const item of filteredHistory) {
      const itemTime = new Date(item.createdAt).getTime()
      if (itemTime >= today) {
        groups.today.push(item)
      } else if (itemTime >= yesterday) {
        groups.yesterday.push(item)
      } else if (itemTime >= sevenDaysAgo) {
        groups.pastWeek.push(item)
      } else {
        groups.older.push(item)
      }
    }

    return [
      { title: "Today", items: groups.today },
      { title: "Yesterday", items: groups.yesterday },
      { title: "Past 7 Days", items: groups.pastWeek },
      { title: "Older", items: groups.older },
    ].filter((g) => g.items.length > 0)
  }, [filteredHistory])

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return ""
    }
  }

  const getDomain = (urlStr?: string) => {
    if (!urlStr) return ""
    try {
      return new URL(urlStr).hostname.replace(/^www\./, "")
    } catch {
      return urlStr
    }
  }

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case "images":
        return <IconPhoto className="size-3.5" />
      case "videos":
        return <IconPlayerPlay className="size-3.5" />
      case "news":
        return <IconNews className="size-3.5" />
      default:
        return <IconWorld className="size-3.5" />
    }
  }

  return (
    <div className="flex flex-1 flex-col w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 text-start">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <IconHistory className="size-5 sm:size-6 text-primary" />
            <span>Search & Activity History</span>
          </h1>
        </div>

        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClearDialogOpen(true)}
            className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 self-start sm:self-auto"
          >
            <IconTrash className="size-3.5" />
            <span>Clear History</span>
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      {history.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <IconSearch className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search queries and visited sites..."
                className="ps-9 pe-4 h-9 rounded-xl bg-muted/30 border-border/60 text-xs"
              />
            </div>

            {/* Type Filter Tabs */}
            <div className="flex items-center rounded-xl bg-muted/40 p-1 border border-border/40 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === "all"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("query")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  typeFilter === "query"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <IconSearch className="size-3" />
                <span>Searches</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("site")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  typeFilter === "site"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <IconExternalLink className="size-3" />
                <span>Visited Sites</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 text-xs ${
                categoryFilter === "all"
                  ? "bg-primary/10 text-primary border border-primary/30 font-medium"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              All Categories
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("general")}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 text-xs flex items-center gap-1.5 ${
                categoryFilter === "general"
                  ? "bg-primary/10 text-primary border border-primary/30 font-medium"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <IconWorld className="size-3" />
              <span>Web</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("images")}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 text-xs flex items-center gap-1.5 ${
                categoryFilter === "images"
                  ? "bg-primary/10 text-primary border border-primary/30 font-medium"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <IconPhoto className="size-3" />
              <span>Images</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("videos")}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 text-xs flex items-center gap-1.5 ${
                categoryFilter === "videos"
                  ? "bg-primary/10 text-primary border border-primary/30 font-medium"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <IconPlayerPlay className="size-3" />
              <span>Videos</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("news")}
              className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 text-xs flex items-center gap-1.5 ${
                categoryFilter === "news"
                  ? "bg-primary/10 text-primary border border-primary/30 font-medium"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <IconNews className="size-3" />
              <span>News</span>
            </button>
          </div>
        </div>
      )}

      {/* History Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Spinner className="size-6 text-primary" />
          <span className="text-xs text-muted-foreground">Loading history...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-start justify-center py-16 space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground">
            <IconHistory className="size-6" />
          </div>
          <h2 className="text-base font-semibold">No search or activity history yet</h2>
          <p className="text-xs text-muted-foreground max-w-md">
            Searches and clicked results across web, images, and videos will be securely organized here.
          </p>
          <Button size="sm" onClick={onBackToSearch} className="mt-2 text-xs">
            Start Searching
          </Button>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          No history records match the current filters.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedHistory.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-1">
                <IconCalendar className="size-3.5" />
                <span>{group.title}</span>
              </div>

              <div className="divide-y divide-border/30 rounded-2xl border border-border/40 bg-card/40 overflow-hidden shadow-2xs">
                {group.items.map((item) => {
                  const isDeleting = deletingId === item.id
                  const isSite = item.type === "site"

                  if (isSite) {
                    const domain = getDomain(item.url)
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Thumbnail / Category Icon */}
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="size-9 rounded-lg object-cover border border-border/40 bg-muted/30 shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex size-9 items-center justify-center rounded-lg bg-muted/40 border border-border/40 text-muted-foreground shrink-0">
                              {getCategoryIcon(item.category)}
                            </div>
                          )}

                          <div className="flex flex-col min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              {domain && (
                                <span className="text-[11px] font-mono text-muted-foreground/80 truncate">
                                  {domain}
                                </span>
                              )}
                              {item.category && item.category !== "general" && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 font-normal shrink-0"
                                >
                                  {item.category}
                                </Badge>
                              )}
                            </div>

                            <a
                              href={item.url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-foreground hover:text-primary transition-colors hover:underline truncate inline-flex items-center gap-1.5"
                            >
                              <span className="truncate">{item.title || item.url || "Visited Site"}</span>
                              <IconExternalLink className="size-3.5 shrink-0 opacity-0 group-hover:opacity-70 transition-opacity" />
                            </a>

                            {item.query && item.query !== item.title && (
                              <button
                                type="button"
                                onClick={() => onSelectQuery(item.query, item.category)}
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-start truncate"
                              >
                                From search: <span className="italic font-medium">&ldquo;{item.query}&rdquo;</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-muted-foreground/70 font-mono">
                            {formatTime(item.createdAt)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDeleting}
                            onClick={(e) => handleDeleteItem(e, item.id)}
                            className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={`Delete ${item.title || "site"}`}
                          >
                            {isDeleting ? (
                              <Spinner className="size-3" />
                            ) : (
                              <IconTrash className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  // Default / Search query item
                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectQuery(item.query, item.category)}
                      className="group flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <IconClock className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium text-foreground truncate">
                          {item.query}
                        </span>
                        {item.category && item.category !== "general" && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-normal shrink-0"
                          >
                            {item.category}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground/70 font-mono">
                          {formatTime(item.createdAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isDeleting}
                          onClick={(e) => handleDeleteItem(e, item.id)}
                          className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Delete ${item.query}`}
                        >
                          {isDeleting ? (
                            <Spinner className="size-3" />
                          ) : (
                            <IconTrash className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      <Dialog
        isOpen={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
      >
        <div className="p-5 space-y-4 max-w-md">
          <DialogHeader className="space-y-1.5 text-start">
            <DialogTitle className="text-base font-semibold">
              Clear entire history?
            </DialogTitle>
            <p className="text-xs text-muted-foreground leading-normal">
              This action will permanently delete all your encrypted search query logs and visited site activity. This cannot be undone.
            </p>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              disabled={isClearing}
              onClick={() => setClearDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isClearing}
              onClick={handleClearAll}
              className="gap-1.5 text-xs font-semibold"
            >
              {isClearing ? <Spinner className="size-3.5" /> : <IconTrash className="size-3.5" />}
              <span>Clear Everything</span>
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
