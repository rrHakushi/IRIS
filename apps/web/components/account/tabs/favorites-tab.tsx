"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { elysia } from "@/lib/elysia"
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
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { resolveUserId } from "@/lib/user-profile"
import { BorealisCard, BorealisCardGroup, type BorealisEntityType } from "@Runa/borealis"
import type { ListEntryData, MediaListType } from "@/components/lists/types"
import { getMediaDetailHref } from "@/lib/media-routes"

export interface FavoritesTabProps {
  username: string
  userId?: string
  isOwner: boolean
}

const FAVORITE_CATEGORIES = [
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

const CATEGORY_TO_MEDIA_TYPE: Record<string, MediaListType> = {
  ANIME: "anime",
  MANGA: "manga",
  MOVIE: "movie",
  TV: "tv",
  GAME: "game",
  BOOK: "book",
  MUSIC_TRACK: "music",
}

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

export function FavoritesTab({ username, userId, isOwner }: FavoritesTabProps): React.JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState<string>("ANIME")
  const [refreshKey, setRefreshKey] = useState(0)
  const cacheKey = `${username}:${selectedCategory}`
  const cached = favoritesClientCache.get(cacheKey)
  const isFresh = Boolean(cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS)

  const [favorites, setFavorites] = useState<any[]>(() => (isFresh && cached ? cached.data : []))
  const [isLoading, setIsLoading] = useState(!isFresh)

  useEffect(() => {
    let isMounted = true

    if (refreshKey === 0 && favoritesClientCache.has(cacheKey)) {
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
      if (!promise || refreshKey > 0) {
        promise = (async () => {
          let targetId = userId
          if (!targetId) {
            targetId = (await resolveUserId(username)) || undefined
          }
          if (!targetId) return null

          const cat = selectedCategory.toLowerCase().replace("_track", "")
          return await elysia.carina.users({ userId: targetId }).favorites({ category: cat }).get({
            query: { limit: 50 },
          })
        })().finally(() => {
          inFlightRequests.delete(cacheKey)
        })
        inFlightRequests.set(cacheKey, promise)
      }

      try {
        const res = await promise
        if (isMounted && res && !res.error && res.data?.success) {
          const data = (res.data as any).favorites || (res.data as any).data || []
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
  }, [cacheKey, username, userId, selectedCategory, refreshKey])

  const filteredFavorites = favorites.filter((f) => {
    if (selectedCategory === "MUSIC_TRACK") {
      return f.type === "MUSIC_TRACK" || f.type === "MUSIC_ALBUM" || f.type === "MUSIC"
    }
    return f.type === selectedCategory
  })

  const currentMediaType = CATEGORY_TO_MEDIA_TYPE[selectedCategory]

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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5 sm:gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <div
              key={i}
              className="aspect-2/3 animate-pulse rounded-xl border border-border/40 bg-card/40"
            />
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
        <BorealisCardGroup grid variant="none" gap="md" className="w-full">
          {filteredFavorites.map((fav, idx) => {
            const entity = fav.entity || {}
            const title = entity.title || `${fav.type} #${fav.targetId}`
            const subtitle = entity.subtitle
            const coverImage = entity.coverImage

            if (fav.type === "CHARACTER") {
              return (
                <BorealisCard
                  key={`${fav.id}-${fav.targetId}`}
                  type="character"
                  data={{
                    id: fav.targetId,
                    namePrimary: title,
                    image: coverImage,
                    role: "FAVORITE",
                  }}
                  priority={idx < 4}
                />
              )
            }

            if (fav.type === "PERSON") {
              return (
                <BorealisCard
                  key={`${fav.id}-${fav.targetId}`}
                  type="staff"
                  data={{
                    id: fav.targetId,
                    namePrimary: title,
                    image: coverImage,
                    customRole: subtitle || "Staff",
                  }}
                  priority={idx < 4}
                />
              )
            }

            if (fav.type === "STUDIO") {
              return (
                <BorealisCard
                  key={`${fav.id}-${fav.targetId}`}
                  type="studio"
                  data={{
                    id: fav.targetId,
                    name: title,
                    image: coverImage,
                  }}
                  priority={idx < 4}
                />
              )
            }

            // Media Items
            const rawType =
              fav.type === "MUSIC_TRACK" || fav.type === "MUSIC_ALBUM" || fav.type === "MUSIC"
                ? "music"
                : CATEGORY_TO_MEDIA_TYPE[fav.type] || currentMediaType || "anime"

            const rawMediaData = entity.raw || {}
            const normalizedItem: ListEntryData = {
              entry: {
                id: fav.targetId,
                status: "FAVORITE",
                score: typeof entity.score === "number" ? entity.score : null,
                notes: null,
                private: false,
                itemType:
                  fav.type === "MUSIC_TRACK"
                    ? "TRACK"
                    : fav.type === "MUSIC_ALBUM"
                      ? "ALBUM"
                      : undefined,
                trackId: fav.type === "MUSIC_TRACK" ? fav.targetId : undefined,
                albumId: fav.type === "MUSIC_ALBUM" ? fav.targetId : undefined,
                createdAt: fav.createdAt,
                updatedAt: fav.createdAt,
              },
              media: {
                ...rawMediaData,
                id: fav.targetId,
                titlePrimary: title,
                title,
                titleSecondary: subtitle,
                coverImage,
                format: entity.format || rawMediaData.format,
                artistName: subtitle,
                updatedAt: fav.createdAt,
              },
            }

            return (
              <BorealisCard
                key={`${fav.id}-${fav.targetId}`}
                type={rawType as BorealisEntityType}
                data={normalizedItem}
                showTabNav={isOwner}
                showExtras={true}
                statusIconOnly={true}
                canEdit={isOwner}
                priority={idx < 4}
              />
            )
          })}
        </BorealisCardGroup>
      )}
    </div>
  )
}
