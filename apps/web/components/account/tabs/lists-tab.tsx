"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
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
  IconStar,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

export interface ListsTabProps {
  username: string
  isOwner: boolean
}

const MEDIA_TYPES = [
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

export function ListsTab({ username, isOwner }: ListsTabProps): React.JSX.Element {
  const [activeType, setActiveType] = useState<string>("anime")
  const cacheKey = `${username}:${activeType}`
  const cached = listClientCache.get(cacheKey)
  const isFresh = Boolean(cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS)

  const [items, setItems] = useState<any[]>(() => (isFresh && cached ? cached.items : []))
  const [totalCount, setTotalCount] = useState<number>(() => (isFresh && cached ? cached.totalCount : 0))
  const [isLoading, setIsLoading] = useState(!isFresh)

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
          let statusFilter = "WATCHING"
          if (activeType === "manga" || activeType === "book") statusFilter = "READING"
          else if (activeType === "game") statusFilter = "PLAYING"
          else if (activeType === "music") statusFilter = "LISTENING"

          let res: any
          if (activeType === "anime") {
            res = await elysia.user({ username }).lists.anime.get({
              query: { status: statusFilter, limit: 12 },
            })
          } else if (activeType === "manga") {
            res = await elysia.user({ username }).lists.manga.get({
              query: { status: statusFilter, limit: 12 },
            })
          } else if (activeType === "movie") {
            res = await elysia.user({ username }).lists.movie.get({
              query: { status: statusFilter, limit: 12 },
            })
          } else if (activeType === "tv") {
            res = await elysia.user({ username }).lists.tv.get({
              query: { status: statusFilter, limit: 12 },
            })
          } else if (activeType === "game") {
            res = await elysia.user({ username }).lists.game.get({
              query: { status: statusFilter, limit: 12 },
            })
          } else if (activeType === "book") {
            res = await elysia.user({ username }).lists.book.get({
              query: { status: statusFilter, limit: 12 },
            })
          } else if (activeType === "music") {
            res = await elysia.user({ username }).lists.music.get({
              query: { status: statusFilter, limit: 12 },
            })
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
          const listData = res.data.items || res.data.data || []
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
  }, [cacheKey, username, activeType])

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
          href={`/IRIS-list/lists/${username}/${activeType}`}
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse space-y-2 rounded-2xl border border-border/40 bg-card/40 p-3">
                <div className="aspect-[3/4] w-full rounded-xl bg-muted/70" />
                <div className="h-3 w-3/4 rounded bg-muted/60" />
                <div className="h-2 w-1/2 rounded bg-muted/40" />
              </div>
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
              href={`/IRIS-list/lists/${username}/${activeType}`}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
            >
              View Full List
            </LinkButton>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item, idx) => {
              const entry = item.entry ?? item
              const media = item.media ?? item.anime ?? item.manga ?? item.movie ?? item.tv ?? item.game ?? item.book ?? item.music ?? {}
              const mediaId = media.id ?? entry.animeId ?? entry.mangaId ?? entry.movieId ?? entry.tvId ?? entry.gameId ?? entry.bookId ?? entry.musicId ?? entry.id
              const title = media.titlePrimary || media.titleSecondary || media.titleNative || media.title?.english || media.title?.romaji || media.title || `Item #${entry.id ?? idx}`
              const coverUrl = media.coverImage?.large || media.coverImage || media.coverUrl || media.posterUrl || null
              const progress = entry.progress ?? entry.chaptersProgress ?? entry.episodesProgress ?? 0
              const totalUnits = media.episodeCount ?? media.chapterCount ?? media.pageCount ?? media.episodes ?? media.chapters ?? null
              const score = entry.score
              const detailUrl = `/IRIS-list/${currentMediaConfig.path}/${mediaId}`

              return (
                <Link
                  key={entry.id ?? idx}
                  href={detailUrl}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-2.5 shadow-xs transition-all hover:border-border hover:bg-card/90"
                >
                  {/* Poster Thumbnail */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted/40 shadow-xs">
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={title}
                        fill
                        sizes="(max-width: 768px) 50vw, 200px"
                        unoptimized
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center p-2 text-center text-xs font-bold text-muted-foreground">
                        {title}
                      </div>
                    )}

                    {/* Score Badge Overlay */}
                    {score && (
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-lg bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 shadow-sm backdrop-blur-xs">
                        <IconStar className="size-2.5 fill-amber-400 text-amber-400" />
                        <span>{score}</span>
                      </div>
                    )}
                  </div>

                  {/* Title & Progress Details */}
                  <div className="mt-2.5 flex flex-1 flex-col justify-between space-y-1">
                    <h4
                      className="line-clamp-2 text-xs font-bold leading-tight text-foreground group-hover:text-primary transition-colors"
                      title={title}
                    >
                      {title}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                      <span className="font-semibold text-primary">
                        {progress} {totalUnits ? `/ ${totalUnits}` : "consumed"}
                      </span>
                      <span className="capitalize">{entry.status?.toLowerCase()}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
