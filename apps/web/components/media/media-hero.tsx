"use client"

import React, { useState } from "react"
import {
  IconAlertTriangle,
  IconBookmark,
  IconPhotoOff,
  IconPlus,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { useUser } from "@/context/user-context"
import { getMediaPreferences } from "@IRIS/shared"
import { formatMediaTitle } from "@/lib/browse-search"
import type {
  MediaTabItem,
  MediaTabKey,
  NormalizedMediaData,
} from "./media-types"
import { MediaTabNav } from "./media-tab-nav"
import { FavoriteButton, type FavoriteType } from "./favorite-button"

const categoryToFavoriteType: Record<string, FavoriteType> = {
  anime: "ANIME",
  manga: "MANGA",
  movies: "MOVIE",
  tv: "TV",
  games: "GAME",
  books: "BOOK",
  music: "MUSIC",
}

interface MediaHeroProps {
  media: NormalizedMediaData
  isQueuedFetch?: boolean
  tabs?: MediaTabItem[]
  activeTab?: MediaTabKey
  onSelectTab?: (tab: MediaTabKey) => void
}

export function MediaHero({
  media,
  isQueuedFetch,
  tabs,
  activeTab,
  onSelectTab,
}: MediaHeroProps) {
  const [posterError, setPosterError] = useState(false)
  const [bannerError, setBannerError] = useState(false)

  const { user } = useUser()
  const titlePref = getMediaPreferences(user?.customization).title || "primary"

  const mainTitle = formatMediaTitle(media, titlePref)
  const subTitle =
    mainTitle === media.titlePrimary ? media.titleSecondary : media.titlePrimary
  const nativeTitle =
    mainTitle !== media.titleNative && subTitle !== media.titleNative
      ? media.titleNative
      : null

  return (
    <div className="relative w-full border-b border-border/40 bg-card/40">
      {/* Backdrop Banner - tightened height */}
      <div className="relative h-32 w-full overflow-hidden bg-muted sm:h-40 md:h-48">
        {media.bannerImage && !bannerError ? (
          <img
            src={media.bannerImage}
            alt=""
            aria-hidden="true"
            onError={() => setBannerError(true)}
            className="h-full w-full object-cover object-center"
          />
        ) : media.coverImage && !posterError ? (
          <img
            src={media.coverImage}
            alt=""
            aria-hidden="true"
            className="h-full w-full scale-105 object-cover object-center opacity-40 blur-md"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-muted/60 to-background/90" />
        )}
        {/* Subtle overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Queued Fetch Warning - compact in top right of banner */}
        {isQueuedFetch && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-black/60 px-3 py-1 text-[11px] font-medium text-amber-300 shadow-xs backdrop-blur-md select-none sm:top-4 sm:right-6">
            <IconAlertTriangle
              className="size-3.5 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            <span>Syncing background details...</span>
          </div>
        )}
      </div>

      {/* Hero Content Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 pb-2 sm:-mt-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Poster Image */}
            <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl border-2 border-background/80 bg-muted shadow-md sm:w-32 md:w-36">
              {media.coverImage && !posterError ? (
                <img
                  src={media.coverImage}
                  alt={media.titlePrimary}
                  onError={() => setPosterError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground/60">
                  <IconPhotoOff className="size-8" aria-hidden="true" />
                  <span className="text-center text-[10px] font-medium">
                    No Image
                  </span>
                </div>
              )}
            </div>

            {/* Right Column: Title + Actions with Tabs directly underneath (zero wasted space) */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {/* Top Row: Title, Subtitle, and Action Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-0.5">
                  {/* Main Title */}
                  <h1 className="text-2xl leading-tight font-bold tracking-tight text-balance text-foreground sm:text-3xl lg:text-4xl">
                    {mainTitle}
                  </h1>

                  {/* Secondary & Native Titles */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {subTitle && subTitle !== mainTitle && (
                      <span>{subTitle}</span>
                    )}
                    {nativeTitle && (
                      <span className="font-japanese opacity-80">
                        {nativeTitle}
                      </span>
                    )}
                  </div>

                  {/* Tagline */}
                  {media.tagline && (
                    <p className="pt-0.5 text-xs text-muted-foreground/90 italic select-text">
                      &ldquo;{media.tagline.replace(/^["“”]|["“”]$/g, "")}
                      &rdquo;
                    </p>
                  )}

                  {/* Genres */}
                  {media.genres && media.genres.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {media.genres.map((genre) => (
                        <span
                          key={genre.id}
                          className="inline-flex items-center rounded-lg border border-border/40 bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                        >
                          {genre.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add to List, Quick Add, & Favorite Buttons */}
                <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 gap-1.5 rounded-xl px-3 text-xs font-semibold shadow-xs"
                  >
                    <IconBookmark className="size-3.5" aria-hidden="true" />
                    <span>Add to List</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 gap-1.5 rounded-xl px-3 text-xs font-medium"
                  >
                    <IconPlus className="size-3.5" aria-hidden="true" />
                    <span>Quick Add</span>
                  </Button>
                  <FavoriteButton
                    targetId={media.id}
                    type={categoryToFavoriteType[media.category] || "ANIME"}
                    title={mainTitle}
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5 rounded-xl px-3"
                    showLabel
                  />
                </div>
              </div>

              {/* Navigation Tabs directly beneath the title */}
              {tabs && activeTab && onSelectTab && (
                <div className="pt-0.5">
                  <MediaTabNav
                    tabs={tabs}
                    activeTab={activeTab}
                    onSelectTab={onSelectTab}
                    embedded
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
