"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { elysia } from "@/lib/elysia"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconHeart,
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconDeviceGamepad,
  IconHeadphones,
  IconUser,
  IconBuildingCommunity,
  IconSparkles,
  IconStar,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

export interface FavoritesTabProps {
  username: string
  isOwner: boolean
}

const FAVORITE_CATEGORIES = [
  { id: "ALL", name: "All Favorites", icon: IconHeart },
  { id: "ANIME", name: "Anime", icon: IconDeviceTv },
  { id: "MANGA", name: "Manga", icon: IconBook },
  { id: "MOVIE", name: "Movies", icon: IconMovie },
  { id: "TV", name: "TV Series", icon: IconDeviceTv },
  { id: "GAME", name: "Games", icon: IconDeviceGamepad },
  { id: "BOOK", name: "Books", icon: IconBook },
  { id: "MUSIC_TRACK", name: "Music", icon: IconHeadphones },
  { id: "CHARACTER", name: "Characters", icon: IconSparkles },
  { id: "PERSON", name: "Staff & Cast", icon: IconUser },
  { id: "STUDIO", name: "Studios", icon: IconBuildingCommunity },
]

const inFlightRequests = new Map<string, Promise<any>>()
const favoritesClientCache = new Map<string, { data: any[]; timestamp: number }>()
const CLIENT_CACHE_TTL_MS = 30_000

export function invalidateClientFavorites(username?: string, category?: string) {
  if (username && category) {
    favoritesClientCache.delete(`${username}:${category}`)
  } else {
    favoritesClientCache.clear()
  }
}

export function FavoritesTab({ username, isOwner }: FavoritesTabProps): React.JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const cacheKey = `${username}:${selectedCategory}`
  const cached = favoritesClientCache.get(cacheKey)
  const isFresh = Boolean(cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS)

  const [favorites, setFavorites] = useState<any[]>(() => (isFresh && cached ? cached.data : []))
  const [isLoading, setIsLoading] = useState(!isFresh)

  useEffect(() => {
    let isMounted = true

    if (favoritesClientCache.has(cacheKey)) {
      const entry = favoritesClientCache.get(cacheKey)!
      if (Date.now() - entry.timestamp < CLIENT_CACHE_TTL_MS) {
        setFavorites(entry.data)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)

    async function fetchFavorites() {
      let promise = inFlightRequests.get(cacheKey)
      if (!promise) {
        promise = (async () => {
          const queryType = selectedCategory !== "ALL" ? (selectedCategory as any) : undefined
          return await elysia.user({ username }).favorites.get({
            query: { type: queryType },
          })
        })().finally(() => {
          inFlightRequests.delete(cacheKey)
        })
        inFlightRequests.set(cacheKey, promise)
      }

      try {
        const res = await promise
        if (isMounted && !res.error && res.data?.success) {
          const data = res.data.data || []
          favoritesClientCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
          })
          setFavorites(data)
        }
      } catch (err) {
        console.error("[FavoritesTab] Failed to fetch favorites:", err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchFavorites()

    return () => {
      isMounted = false
    }
  }, [cacheKey, username, selectedCategory])

  const filteredFavorites =
    selectedCategory === "ALL"
      ? favorites
      : favorites.filter((f) => {
          if (selectedCategory === "MUSIC_TRACK") {
            return f.type === "MUSIC_TRACK" || f.type === "MUSIC_ALBUM" || f.type === "MUSIC"
          }
          return f.type === selectedCategory
        })

  return (
    <div className="space-y-6">
      {/* Category Pills Bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-card/60 p-3.5 shadow-xs">
        {FAVORITE_CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const isSelected = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                isSelected
                  ? "border border-rose-500 bg-rose-500/15 font-bold text-rose-400 shadow-2xs"
                  : "border border-border/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span>{cat.name}</span>
            </button>
          )
        })}
      </div>

      {/* Favorites Grid */}
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
      ) : filteredFavorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/20 py-16 text-center">
          <IconHeart className="size-8 text-muted-foreground/40" />
          <h4 className="font-heading text-sm font-bold text-foreground">
            No favorites in this category
          </h4>
          <p className="text-xs text-muted-foreground">
            @{username} hasn&apos;t added any {selectedCategory.toLowerCase()} items to their favorites yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filteredFavorites.map((fav) => {
            const entity = fav.entity || {}
            const title = entity.title || `${fav.type} #${fav.targetId}`
            const subtitle = entity.subtitle
            const coverImage = entity.coverImage
            const score = entity.score
            const typeLower = fav.type.toLowerCase()
            const linkPath =
              typeLower === "anime"
                ? "anime"
                : typeLower === "manga"
                  ? "manga"
                  : typeLower === "movie"
                    ? "movies"
                    : typeLower === "tv"
                      ? "tv"
                      : typeLower === "game"
                        ? "games"
                        : typeLower === "book"
                          ? "books"
                          : typeLower.startsWith("music")
                            ? "music"
                            : typeLower === "character"
                              ? "characters"
                              : typeLower === "person"
                                ? "people"
                                : typeLower === "studio"
                                  ? "studios"
                                  : typeLower
            const link = (
              entity.link || `/IRIS-list/${linkPath}/${fav.targetId}`
            ).replace("/IRIS-media/media/", "/IRIS-list/")
            const formatBadge = entity.format || fav.type

            return (
              <Link
                key={fav.id}
                href={link}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-2.5 shadow-xs transition-all hover:border-border hover:bg-card/90"
              >
                {/* Media Poster / Picture */}
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted/40 shadow-xs">
                  {coverImage ? (
                    <Image
                      src={coverImage}
                      alt={title}
                      fill
                      sizes="(max-width: 768px) 50vw, 200px"
                      unoptimized
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-background to-muted/40 p-3 text-center">
                      <IconSparkles className="size-6 text-primary/40" />
                      <span className="font-heading text-xs font-bold text-foreground line-clamp-3">
                        {title}
                      </span>
                    </div>
                  )}

                  {/* User Score Overlay if rated */}
                  {typeof score === "number" && score > 0 && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 rounded-lg border border-amber-500/20 bg-background/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 shadow-sm backdrop-blur-xs">
                      <IconStar className="size-2.5 fill-amber-400 text-amber-400" />
                      <span>{score}</span>
                    </div>
                  )}

                  {/* Format Badge Pill at bottom */}
                  <div className="absolute bottom-2 left-2">
                    <Badge
                      variant="outline"
                      className="h-4.5 border-border/70 bg-background/80 px-1.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur-xs"
                    >
                      {formatBadge}
                    </Badge>
                  </div>
                </div>

                {/* Title & Subtitle Details */}
                <div className="mt-2.5 flex flex-1 flex-col justify-between space-y-1">
                  <h4
                    className="line-clamp-2 text-xs font-bold leading-tight text-foreground transition-colors group-hover:text-rose-400"
                    title={title}
                  >
                    {title}
                  </h4>

                  {subtitle ? (
                    <p className="line-clamp-1 text-[10px] text-muted-foreground" title={subtitle}>
                      {subtitle}
                    </p>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      Added {new Date(fav.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
