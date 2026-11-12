"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  IconEyeOff,
  IconLoader2,
  IconLock,
  IconSearch,
  IconSend,
  IconTag,
  IconX,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"
import { API_URL, elysia } from "@/lib/elysia"
import {
  formatMediaTypeBadge,
  resolveCoverUrl,
  type ActivityItem,
} from "./types"

interface TaggedMediaOption {
  id: number
  mediaType: string
  titlePrimary: string
  titleSecondary?: string | null
  coverImage?: string | null
  format?: string | null
}

export interface ActivityPostComposerProps {
  onCreated?: (activity: ActivityItem) => void
  className?: string
}

export function ActivityPostComposer({
  onCreated,
  className,
}: ActivityPostComposerProps): React.JSX.Element {
  const [content, setContent] = useState("")
  const [isSpoiler, setIsSpoiler] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [tagOpen, setTagOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<TaggedMediaOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<TaggedMediaOption | null>(
    null
  )

  const searchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tagOpen) return
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data, error } = await elysia.borealis.search.get({
          query: {
            q,
            category: "media",
            limit: 8,
          },
        })
        if (cancelled) return
        if (error) {
          setSearchResults([])
          return
        }
        const results = Array.isArray((data as any)?.results)
          ? ((data as any).results as any[])
              .filter((r) => typeof r?.id === "number" && r?.mediaType)
              .map((r) => ({
                id: Number(r.id),
                mediaType: String(r.mediaType),
                titlePrimary:
                  String(r.titlePrimary || r.titleSecondary || `${r.mediaType} #${r.id}`),
                titleSecondary: r.titleSecondary ?? null,
                coverImage: r.coverImage ?? null,
                format: r.format ?? null,
              }))
          : []
        setSearchResults(results)
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 260)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery, tagOpen])

  useEffect(() => {
    if (!tagOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setTagOpen(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [tagOpen])

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      const { data, error } = await elysia.carina.activity.post({
        content: trimmed,
        isSpoiler,
        isPrivate,
        mediaType: selectedMedia?.mediaType ?? null,
        mediaId: selectedMedia?.id ?? null,
      })

      if (error || !data?.activity) {
        toast.error(
          (error?.value as any)?.detail ||
            (error?.value as any)?.message ||
            "Failed to publish status post"
        )
        return
      }

      setContent("")
      setIsSpoiler(false)
      setIsPrivate(false)
      setSelectedMedia(null)
      setSearchQuery("")
      setSearchResults([])
      setTagOpen(false)
      toast.success("Status posted")
      onCreated?.(data.activity as ActivityItem)
    } catch {
      toast.error("Failed to publish status post")
    } finally {
      setSubmitting(false)
    }
  }

  const trimmedLength = content.trim().length

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/50 p-4 shadow-xs transition-colors focus-within:border-border",
        className
      )}
    >
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault()
            void handleSubmit()
          }
        }}
        placeholder="Share an update, quick thought, or tag what you're experiencing..."
        maxLength={2000}
        rows={3}
        className="min-h-[78px] resize-none border-border/50 bg-background/60 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1"
      />

      {/* Selected media preview */}
      {selectedMedia && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/40 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            {resolveCoverUrl(selectedMedia.coverImage, API_URL) ? (
              <img
                src={resolveCoverUrl(selectedMedia.coverImage, API_URL)!}
                alt={selectedMedia.titlePrimary}
                className="h-8 w-6 shrink-0 rounded object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {selectedMedia.titlePrimary}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatMediaTypeBadge(selectedMedia.mediaType)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onPress={() => setSelectedMedia(null)}
            aria-label="Remove tagged media"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <IconX className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Tag media inline search popover */}
      {tagOpen && (
        <div
          ref={searchContainerRef}
          className="mt-2.5 rounded-xl border border-border/60 bg-popover p-2.5 shadow-md"
        >
          <div className="relative flex items-center">
            <IconSearch className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search anime, manga, movies, games, books..."
              className="h-8 ps-8 pe-7 text-xs"
            />
            {searching ? (
              <IconLoader2 className="absolute end-2.5 size-3.5 animate-spin text-muted-foreground" />
            ) : (
              searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("")
                    setSearchResults([])
                  }}
                  aria-label="Clear search"
                  className="absolute end-2 text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3.5" />
                </button>
              )
            )}
          </div>

          {searchQuery.trim().length >= 2 && (
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
              {searchResults.length === 0 && !searching ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  No matching media found.
                </p>
              ) : (
                searchResults.map((item) => {
                  const thumb = resolveCoverUrl(item.coverImage, API_URL)
                  return (
                    <button
                      key={`${item.mediaType}-${item.id}`}
                      type="button"
                      onClick={() => {
                        setSelectedMedia(item)
                        setTagOpen(false)
                        setSearchQuery("")
                        setSearchResults([])
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-muted/70"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={item.titlePrimary}
                          className="h-9 w-6.5 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-6.5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground">
                          {item.mediaType.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {item.titlePrimary}
                        </p>
                        {item.titleSecondary && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {item.titleSecondary}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px] font-medium"
                      >
                        {formatMediaTypeBadge(item.mediaType)}
                      </Badge>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer action controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant={tagOpen || selectedMedia ? "secondary" : "ghost"}
            size="sm"
            onPress={() => setTagOpen((prev) => !prev)}
            className="h-7 gap-1.5 rounded-lg px-2.5 text-xs"
          >
            <IconTag className="size-3.5" />
            <span>{selectedMedia ? "Change Media" : "Tag Media"}</span>
          </Button>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
            <Switch
              isSelected={isSpoiler}
              onChange={setIsSpoiler}
              aria-label="Mark post as spoiler"
            />
            <span className="inline-flex items-center gap-1">
              <IconEyeOff className="size-3.5" />
              Spoiler
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
            <Switch
              isSelected={isPrivate}
              onChange={setIsPrivate}
              aria-label="Make post private"
            />
            <span className="inline-flex items-center gap-1">
              <IconLock className="size-3.5" />
              Private
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2.5 ms-auto">
          {content.length > 0 && (
            <span
              className={cn(
                "text-[11px] tabular-nums",
                content.length > 1850
                  ? "text-amber-500"
                  : "text-muted-foreground/70"
              )}
            >
              {content.length}/2000
            </span>
          )}
          <Button
            type="button"
            size="sm"
            disabled={submitting || trimmedLength === 0}
            onPress={() => void handleSubmit()}
            className="h-7 gap-1.5 rounded-lg px-3 text-xs font-medium"
          >
            {submitting ? (
              <IconLoader2 className="size-3.5 animate-spin" />
            ) : (
              <IconSend className="size-3.5" />
            )}
            <span>Post</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

