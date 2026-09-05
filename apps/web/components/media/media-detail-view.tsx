"use client"

import React, { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { MediaHero } from "./media-hero"
import { MediaTabNav } from "./media-tab-nav"
import { OverviewTab } from "./tabs/overview-tab"
import { CharactersTab } from "./tabs/characters-tab"
import { StaffTab } from "./tabs/staff-tab"
import { EpisodesTab } from "./tabs/episodes-tab"
import { TracksTab } from "./tabs/tracks-tab"
import { LyricsTab } from "./tabs/lyrics-tab"
import { ImagesTab } from "./tabs/images-tab"
import { TrailersTab } from "./tabs/trailers-tab"
import { StatsTab } from "./tabs/stats-tab"
import { EmptyTab } from "./tabs/empty-tab"
import { MediaFooter } from "./media-footer"
import type {
  MediaTabItem,
  MediaTabKey,
  NormalizedMediaData,
  SimilarMediaCardItem,
} from "./media-types"

interface MediaDetailViewProps {
  media: NormalizedMediaData
  similarList: SimilarMediaCardItem[]
  isQueuedFetch?: boolean
}

export function MediaDetailView({
  media,
  similarList,
  isQueuedFetch,
}: MediaDetailViewProps) {
  const searchParams = useSearchParams()
  const initialTabFromUrl =
    (searchParams.get("tab") as MediaTabKey) || "overview"

  const [activeTab, setActiveTab] = useState<MediaTabKey>(initialTabFromUrl)

  // Keep state in sync with URL searchParams (e.g. on browser back/forward)
  useEffect(() => {
    const tabParam = (searchParams.get("tab") as MediaTabKey) || "overview"
    setActiveTab(tabParam)
  }, [searchParams])

  // Compute available tabs according to media category and available data
  const availableTabs = useMemo(() => {
    const uniqueCharCount = new Set(media.characters.map((c) => c.characterId))
      .size

    const tabs: MediaTabItem[] = [{ key: "overview", label: "Overview" }]

    // Music: Tracks tab for albums
    if (media.category === "music" && media.tracks && media.tracks.length > 0) {
      tabs.push({
        key: "tracks",
        label: "Tracks",
        count: media.tracks.length,
      })
    }

    // Music: Lyrics tab for tracks
    if (media.category === "music" && (media.lyrics || media.syncedLyrics)) {
      tabs.push({
        key: "lyrics",
        label: "Lyrics",
      })
    }

    // Characters tab (only if characters exist or not music)
    if (media.category !== "music" || uniqueCharCount > 0) {
      tabs.push({
        key: "characters",
        label: "Characters",
        count: uniqueCharCount > 0 ? uniqueCharCount : undefined,
      })
    }

    // Staff tab
    if (media.staff.length > 0 || media.category !== "music") {
      tabs.push({
        key: "staff",
        label: media.category === "music" ? "Credits" : "Staff",
        count: media.staff.length > 0 ? media.staff.length : undefined,
      })
    }

    // Episodes tab for Anime and TV
    if (media.category === "anime" || media.category === "tv") {
      tabs.push({
        key: "episodes",
        label: "Episodes",
        count: media.episodes?.length ?? media.episodeCount ?? undefined,
      })
    }

    // Images tab
    const imageCount = media.images
      ? Object.values(media.images).reduce(
          (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
          0
        )
      : 0
    tabs.push({
      key: "images",
      label: "Images",
      count: imageCount > 0 ? imageCount : undefined,
    })

    // Trailers tab (only for non-music media with trailers)
    if (media.category !== "music") {
      const trailerCount = media.trailers?.length ?? 0
      if (trailerCount > 0) {
        tabs.push({
          key: "trailers",
          label: "Trailers",
          count: trailerCount,
        })
      }
    }

    // Stats, Reviews, Recommendations
    tabs.push(
      { key: "stats", label: "Stats" },
      { key: "reviews", label: "Reviews" },
      { key: "recommendations", label: "Recommendations" }
    )

    return tabs
  }, [media])

  // Fallback if URL tab is not in available tabs
  const validActiveTab = useMemo(() => {
    const exists = availableTabs.some((t) => t.key === activeTab)
    return exists ? activeTab : "overview"
  }, [availableTabs, activeTab])

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Top Hero Section with Navigation Tabs integrated at the bottom */}
      <MediaHero
        media={media}
        isQueuedFetch={isQueuedFetch}
        tabs={availableTabs}
        activeTab={validActiveTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Tab Content Pane */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {validActiveTab === "overview" && (
          <OverviewTab
            media={media}
            similarList={similarList}
            onViewAllCharacters={() => setActiveTab("characters")}
            onViewAllTracks={() => setActiveTab("tracks")}
            onViewAllLyrics={() => setActiveTab("lyrics")}
          />
        )}

        {validActiveTab === "tracks" && (
          <TracksTab
            tracks={media.tracks ?? []}
            albumTitle={media.titlePrimary}
            albumArtistPersonId={media.artistPersonId}
          />
        )}

        {validActiveTab === "lyrics" && (
          <LyricsTab
            lyrics={media.lyrics}
            syncedLyrics={media.syncedLyrics}
            title={media.titlePrimary}
            artist={media.artist}
          />
        )}

        {validActiveTab === "characters" && (
          <CharactersTab characters={media.characters} />
        )}

        {validActiveTab === "staff" && <StaffTab staff={media.staff} />}

        {validActiveTab === "episodes" && (
          <EpisodesTab
            episodes={media.episodes ?? []}
            seasons={media.seasons}
            airingSchedule={media.airingSchedule}
            nextAiringEpisodeNumber={media.nextAiringEpisodeNumber}
            nextAiringAt={media.nextAiringAt}
            status={media.status}
          />
        )}

        {validActiveTab === "images" && (
          <ImagesTab
            coverImage={media.coverImage}
            bannerImage={media.bannerImage}
            images={media.images ?? null}
          />
        )}

        {validActiveTab === "trailers" && (
          <TrailersTab trailers={media.trailers ?? null} />
        )}

        {validActiveTab === "stats" && <StatsTab media={media} />}

        {validActiveTab === "reviews" && <EmptyTab type="reviews" />}

        {validActiveTab === "recommendations" && (
          <EmptyTab type="recommendations" />
        )}
      </main>

      {/* Sources & Footer */}
      <MediaFooter media={media} />
    </div>
  )
}
