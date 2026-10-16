"use client"

import React, { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { elysia } from "@/lib/elysia"
import { LinkButton } from "@workspace/ui/components/button"
import {
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconDeviceGamepad,
  IconHeadphones,
  IconArrowRight,
  IconPlayerPlay,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { resolveUserId } from "@/lib/user-profile"
import { MediaListCard } from "@/components/lists/media-list-card"
import {
  toNormalizedMedia,
  toMediaListEntry,
} from "@/components/lists/media-list-grid"
import type { ListEntryData, MediaListType } from "@/components/lists/types"

const MediaListModal = dynamic(
  () =>
    import("@/components/media/list/media-list-modal").then(
      (m) => m.MediaListModal
    ),
  { ssr: false }
)

export interface ListsTabProps {
  username: string
  userId?: string
  isOwner: boolean
}

interface MediaConfig {
  id: MediaListType
  name: string
  action: string
  icon: React.ComponentType<{ className?: string }>
  path: string
}

const MEDIA_TYPES: MediaConfig[] = [
  { id: "anime", name: "Anime", action: "Watching", icon: IconDeviceTv, path: "anime" },
  { id: "manga", name: "Manga", action: "Reading", icon: IconBook, path: "manga" },
  { id: "movie", name: "Movies", action: "Watching", icon: IconMovie, path: "movies" },
  { id: "tv", name: "TV Series", action: "Watching", icon: IconDeviceTv, path: "tv" },
  { id: "game", name: "Games", action: "Playing", icon: IconDeviceGamepad, path: "games" },
  { id: "book", name: "Books", action: "Reading", icon: IconBook, path: "books" },
  { id: "music", name: "Music", action: "Listening", icon: IconHeadphones, path: "music" },
]

const inFlightRequests = new Map<string, Promise<any>>()
const listClientCache = new Map<string, { items: any[]; totalCount: number; timestamp: number }>()
const CLIENT_CACHE_TTL_MS = 30_000

export function invalidateClientLists(username?: string, activeType?: string) {
  if (username && activeType) {
    listClientCache.delete(`${username}:${activeType}`)
  } else {
    listClientCache.clear()
  }
}

export function ListsTab({ username, userId, isOwner }: ListsTabProps): React.JSX.Element {
  const [activeType, setActiveType] = useState<MediaListType>("anime")
  const [resolvedId, setResolvedId] = useState<string | undefined>(userId)
  const cacheKey = `${username}:${activeType}`
  const cached = listClientCache.get(cacheKey)
  const isFresh = Boolean(cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS)

  const [items, setItems] = useState<ListEntryData[]>(() => (isFresh && cached ? cached.items : []))
  const [, setTotalCount] = useState<number>(() => (isFresh && cached ? cached.totalCount : 0))
  const [isLoading, setIsLoading] = useState(!isFresh)
  const [editingItem, setEditingItem] = useState<ListEntryData | null>(null)

  const currentMediaConfig =
    MEDIA_TYPES.find((m) => m.id === activeType) ?? MEDIA_TYPES[0]!

  useEffect(() => {
    let isMounted = true

    if (listClientCache.has(cacheKey)) {
      const entry = listClientCache.get(cacheKey)!
      if (Date.now() - entry.timestamp < CLIENT_CACHE_TTL_MS) {
        setItems(entry.items)
        setTotalCount(entry.totalCount)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)

    async function fetchActiveItems() {
      let promise = inFlightRequests.get(cacheKey)
      if (!promise) {
        promise = (async () => {
          let targetId = userId
          if (!targetId) {
            targetId = (await resolveUserId(username)) || undefined
          }
          if (targetId && isMounted) {
            setResolvedId(targetId)
          }

          let statusFilter = "WATCHING"
          if (activeType === "manga" || activeType === "book") statusFilter = "READING"
          else if (activeType === "game") statusFilter = "PLAYING"
          else if (activeType === "music") statusFilter = "LISTENING"

          const query: any = { status: statusFilter, limit: 16 }
          if (targetId) query.userId = targetId

          let res: any
          if (activeType === "anime") {
            res = await elysia.borealis.lists.anime.get({ query })
          } else if (activeType === "manga") {
            res = await elysia.borealis.lists.manga.get({ query })
          } else if (activeType === "movie") {
            res = await elysia.borealis.lists.movies.get({ query })
          } else if (activeType === "tv") {
            res = await elysia.borealis.lists.tv.get({ query })
          } else if (activeType === "game") {
            res = await elysia.borealis.lists.games.get({ query })
          } else if (activeType === "book") {
            res = await elysia.borealis.lists.books.get({ query })
          } else if (activeType === "music") {
            res = await elysia.borealis.lists.music.get({ query })
          }
          return res
        })().finally(() => {
          inFlightRequests.delete(cacheKey)
        })
        inFlightRequests.set(cacheKey, promise)
      }

      try {
        const res = await promise
        if (isMounted && res && !res.error && res.data?.success) {
          const listData = (res.data.items || res.data.data || []) as ListEntryData[]
          const count = res.data.pagination?.total ?? listData.length
          listClientCache.set(cacheKey, {
            items: listData,
            totalCount: count,
            timestamp: Date.now(),
          })
          setItems(listData)
          setTotalCount(count)
        }
      } catch (err) {
        console.error(`[ListsTab] Failed to fetch ${activeType} list:`, err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchActiveItems()

    return () => {
      isMounted = false
    }
  }, [cacheKey, username, userId, activeType])

  const handleOpenEditModal = useCallback(
    (item: ListEntryData) => {
      if (isOwner) {
        setEditingItem(item)
      }
    },
    [isOwner]
  )

  const handleIncrementProgress = useCallback(
    async (item: ListEntryData, count: number, mediaType?: MediaListType) => {
      const type = mediaType || activeType
      const entryId = item.entry.id
      const mediaId =
        (item.media as any)?.id ??
        (item.entry as any)?.animeId ??
        (item.entry as any)?.mangaId ??
        (item.entry as any)?.movieId ??
        (item.entry as any)?.tvId ??
        (item.entry as any)?.gameId ??
        (item.entry as any)?.bookId ??
        (item.entry as any)?.musicId

      if (!mediaId) return

      // Optimistic state update
      setItems((prev) =>
        prev.map((it) => {
          if (it.entry.id === entryId) {
            if (type === "manga") {
              return {
                ...it,
                entry: {
                  ...it.entry,
                  chaptersProgress: (it.entry.chaptersProgress ?? 0) + count,
                },
              }
            }
            return {
              ...it,
              entry: {
                ...it.entry,
                progress: (it.entry.progress ?? 0) + count,
              },
            }
          }
          return it
        })
      )

      try {
        const numMediaId = Number(mediaId)
        if (type === "anime") {
          await elysia.borealis.lists.anime({ animeId: numMediaId }).increment.post({ count })
        } else if (type === "tv") {
          await elysia.borealis.lists.tv({ tvId: numMediaId }).increment.post({ count })
        } else if (type === "manga") {
          await elysia.borealis.lists.manga({ mangaId: numMediaId }).increment.post({ count, type: "chapter" })
        } else if (type === "movie") {
          await elysia.borealis.lists.movies({ movieId: numMediaId }).increment.post({ count: 1 })
        } else if (type === "game") {
          await elysia.borealis.lists.games({ gameId: numMediaId }).increment.post({ count })
        } else if (type === "book") {
          await elysia.borealis.lists.books({ bookId: numMediaId }).increment.post({ count, type: "chapter" })
        }
      } catch (err) {
        console.error("[ListsTab] Failed to increment progress:", err)
      }
    },
    [activeType]
  )

  const handleItemUpdated = useCallback(
    (entryId: number, updated: any) => {
      if (!updated) {
        setItems((prev) => prev.filter((it) => it.entry.id !== entryId))
      } else {
        setItems((prev) =>
          prev.map((it) => {
            if (it.entry.id === entryId) {
              return {
                ...it,
                entry: {
                  ...it.entry,
                  ...updated,
                },
              }
            }
            return it
          })
        )
      }
      invalidateClientLists(username, activeType)
    },
    [username, activeType]
  )

  return (
    <div className="space-y-6">
      {/* 1. Header with Type Switcher & Full List Redirect */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 shadow-xs">
        {/* Type Switcher Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {MEDIA_TYPES.map((type) => {
            const Icon = type.icon
            const isSelected = activeType === type.id
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setActiveType(type.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                  isSelected
                    ? "border border-primary bg-primary/15 font-bold text-primary shadow-2xs"
                    : "border border-border/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{type.name}</span>
              </button>
            )
          })}
        </div>

        {/* See All Button */}
        <LinkButton
          href={`/borealis/lists/${resolvedId || userId || username}/${activeType}`}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-xl border-primary/30 bg-primary/10 text-xs font-bold text-primary shadow-xs hover:bg-primary/20"
        >
          <span>See Full {currentMediaConfig.name} List</span>
          <IconArrowRight className="size-3.5" />
        </LinkButton>
      </div>

      {/* 2. Currently Consuming Items Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <IconPlayerPlay className="size-4 text-primary" />
            <h3 className="font-heading text-sm font-bold text-foreground">
              Currently {currentMediaConfig.action} ({items.length})
            </h3>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5 sm:gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div
                key={i}
                className="aspect-2/3 animate-pulse rounded-xl border border-border/40 bg-card/40"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card/20 py-12 text-center">
            <currentMediaConfig.icon className="size-8 text-muted-foreground/40" />
            <div className="space-y-1">
              <h4 className="font-heading text-sm font-bold text-foreground">
                No currently {currentMediaConfig.action.toLowerCase()} {currentMediaConfig.name.toLowerCase()}
              </h4>
              <p className="text-xs text-muted-foreground">
                @{username} doesn&apos;t have any {currentMediaConfig.name.toLowerCase()} marked as in-progress right now.
              </p>
            </div>
            <LinkButton
              href={`/borealis/lists/${resolvedId || userId || username}/${activeType}`}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
            >
              View Full List
            </LinkButton>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5 sm:gap-3">
            {items.map((item, idx) => {
              const normalizedItem: ListEntryData =
                item.entry && item.media
                  ? item
                  : {
                      entry: (item as any).entry || item,
                      media:
                        (item as any).media ||
                        (item as any).anime ||
                        (item as any).manga ||
                        (item as any).movie ||
                        (item as any).tv ||
                        (item as any).game ||
                        (item as any).book ||
                        (item as any).music ||
                        {},
                    }

              return (
                <MediaListCard
                  key={`${normalizedItem.entry?.id ?? idx}-${normalizedItem.media?.id ?? idx}`}
                  item={normalizedItem}
                  mediaType={activeType}
                  onOpenEditModal={handleOpenEditModal}
                  onIncrementProgress={isOwner ? handleIncrementProgress : undefined}
                  priority={idx < 4}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Edit List Modal */}
      {editingItem && (
        <MediaListModal
          isOpen={Boolean(editingItem)}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null)
          }}
          media={toNormalizedMedia(editingItem.media, activeType)}
          initialEntry={toMediaListEntry(editingItem.entry)}
          onEntryUpdated={(updated) => {
            handleItemUpdated(editingItem.entry.id, updated)
            setEditingItem(null)
          }}
        />
      )}
    </div>
  )
}
