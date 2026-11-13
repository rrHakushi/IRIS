"use client"

import React, { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useUser } from "@/context/user-context"
import { getMediaPreferences } from "@IRIS/shared"
import { MediaHero } from "./media-hero"
import { MediaTabNav } from "./media-tab-nav"
import { OverviewTab } from "./tabs/overview-tab"
import { RelationsTab } from "./tabs/relations-tab"
import { CharactersTab } from "./tabs/characters-tab"
import { StaffTab } from "./tabs/staff-tab"
import { EpisodesTab } from "./tabs/episodes-tab"
import { TracksTab } from "./tabs/tracks-tab"
import { LyricsTab } from "./tabs/lyrics-tab"
import { ImagesTab } from "./tabs/images-tab"
import { TrailersTab } from "./tabs/trailers-tab"
import { StatsTab } from "./tabs/stats-tab"
import { FriendsMediaTab } from "./tabs/friends-tab"
import { PeopleTab } from "./tabs/people-tab"
import { RecommendationsMediaTab } from "./tabs/recommendations-tab"
import { MediaFooter } from "./media-footer"
import { useMediaSection, pickList, type MediaSection } from "./use-media-section"
import { addBrowseVisitToStore, type BrowseCategory } from "@/lib/browse-history"
import type {
  MediaTabItem,
  MediaTabKey,
  NormalizedMediaData,
  SimilarMediaCardItem,
} from "./media-types"

function mapCharacter(c: any) {
  const d = c.characterData ?? c.character ?? {}
  const a = c.actorData ?? c.actor ?? null
  return {
    id: c.id,
    characterId: c.characterId ?? d.id,
    namePrimary: d.namePrimary ?? "",
    nameNative: d.nameNative ?? null,
    image: d.image ?? null,
    role: c.role,
    order: c.order ?? null,
    description: d.description ?? null,
    gender: d.gender ?? null,
    age: d.age ?? null,
    actor: a
      ? {
          id: a.id,
          namePrimary: a.namePrimary,
          nameNative: a.nameNative ?? null,
          image: a.image ?? null,
          language: a.language ?? null,
        }
      : null,
  }
}

function mapStaff(s: any) {
  const p = s.personData ?? s.person ?? {}
  return {
    id: s.id,
    personId: s.personId ?? p.id,
    role: s.role,
    customRole: s.customRole ?? null,
    person: {
      id: p.id,
      namePrimary: p.namePrimary ?? "",
      nameNative: p.nameNative ?? null,
      image: p.image ?? null,
      language: p.language ?? null,
      description: p.description ?? null,
      gender: p.gender ?? null,
    },
  }
}
interface MediaDetailViewProps {
  media: NormalizedMediaData
  similarList?: SimilarMediaCardItem[]
  isQueuedFetch?: boolean
}

export function MediaDetailView({
  media,
  similarList,
  isQueuedFetch,
}: MediaDetailViewProps) {
  const { user } = useUser()
  const titlePreference =
    getMediaPreferences(user?.customization).title || "primary"
  const searchParams = useSearchParams()
  const initialTabFromUrl =
    (searchParams.get("tab") as MediaTabKey) || "overview"

  const [activeTab, setActiveTab] = useState<MediaTabKey>(initialTabFromUrl)

  // Keep state in sync with URL searchParams and browser history (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href)
      const tabParam =
        (url.searchParams.get("tab") as MediaTabKey) || "overview"
      setActiveTab(tabParam)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    const tabParam = (searchParams.get("tab") as MediaTabKey) || "overview"
    setActiveTab(tabParam)
  }, [searchParams])

  // Track page visit in Browse recently visited
  useEffect(() => {
    if (!media?.id || !media?.category) return

    const isMusic = media.category === "music"
    const isAlbum =
      isMusic &&
      (media.format?.toUpperCase() === "ALBUM" ||
        Boolean(media.tracks && media.tracks.length > 0))

    const year =
      media.seasonYear ??
      media.startDateYear ??
      media.releaseDateYear ??
      null

    addBrowseVisitToStore(media.category as BrowseCategory, {
      id: media.id,
      title: media.titlePrimary,
      titlePrimary: media.titlePrimary,
      titleSecondary: media.titleSecondary,
      titleNative: media.titleNative,
      coverImage: media.coverImage,
      bannerImage: media.bannerImage,
      description: media.description,
      format: media.format,
      status: media.status,
      year,
      seasonYear: media.seasonYear ?? year,
      averageScore: media.averageScore,
      episodeCount: media.episodeCount,
      genres: media.genres ?? [],
      studios: media.studios ?? [],
      queuedForFetch: Boolean(isQueuedFetch),
      type: isMusic ? (isAlbum ? "ALBUM" : "TRACK") : undefined,
    })
  }, [
    media.id,
    media.category,
    media.titlePrimary,
    media.titleSecondary,
    media.titleNative,
    media.coverImage,
    media.bannerImage,
    media.description,
    media.format,
    media.status,
    media.seasonYear,
    media.startDateYear,
    media.releaseDateYear,
    media.averageScore,
    media.episodeCount,
    media.genres,
    media.studios,
    media.tracks,
    isQueuedFetch,
  ])

  // Static tab list (no counts): sections load lazily from their own endpoints
  const availableTabs = useMemo(() => {
    const tabs: MediaTabItem[] = [{ key: "overview", label: "Overview" }]
    const cat = media.category
    const isMusic = cat === "music"

    if (cat === "anime" || cat === "manga") {
      tabs.push({ key: "relations", label: "Relations" })
    }

    if (isMusic && media.tracks && media.tracks.length > 0) {
      tabs.push({ key: "tracks", label: "Tracks" })
    }
    if (isMusic && (media.lyrics || media.syncedLyrics)) {
      tabs.push({ key: "lyrics", label: "Lyrics" })
    }
    if (cat !== "other" && !isMusic) {
      tabs.push({ key: "characters", label: "Characters" })
    }
    if (cat !== "other") {
      tabs.push({ key: "staff", label: isMusic ? "Credits" : "Staff" })
    }
    if (cat === "anime" || cat === "tv") {
      tabs.push({ key: "episodes", label: "Episodes" })
    }
    if (cat !== "other") {
      tabs.push({ key: "images", label: "Images" })
    }
    if (!isMusic && (media.trailers?.length ?? 0) > 0) {
      tabs.push({ key: "trailers", label: "Trailers" })
    }
    tabs.push(
      { key: "stats", label: "Stats" },
      { key: "friends", label: "Friends" },
      { key: "people", label: "People" },
      { key: "recommendations", label: "Recommendations" }
    )
    return tabs
  }, [
    media.category,
    media.tracks,
    media.lyrics,
    media.syncedLyrics,
    media.trailers,
  ])
  // Fallback if URL tab is not in available tabs
  const validActiveTab = useMemo(() => {
    const exists = availableTabs.some((t) => t.key === activeTab)
    return exists ? activeTab : "overview"
  }, [availableTabs, activeTab])

  // Lazy per-tab data (cached across tab switches)
  const hasSections = media.category !== "other"
  const sec = (name: MediaSection, tabs: MediaTabKey[]) =>
    useMediaSection(
      media.category,
      media.id,
      name,
      hasSections && tabs.includes(validActiveTab)
    )
  const similarSec = sec("similar", ["overview"])
  const charactersSec = sec("characters", ["characters"])
  const relationsSec = sec("relations", ["relations"])
  const staffSec = sec("staff", ["staff"])
  const episodesSec = sec("episodes", ["episodes"])
  const seasonsSec = useMediaSection(
    media.category,
    media.id,
    "seasons",
    media.category === "tv" && validActiveTab === "episodes"
  )
  const imagesSec = sec("images", ["images"])
  const statsSec = sec("stats", ["stats"])

  const fullMedia = useMemo<NormalizedMediaData>(() => {
    const m: NormalizedMediaData = {
      ...media,
      characters: (media.characters ?? []).map((c: any) =>
        c.characterData ? mapCharacter(c) : c
      ),
      staff: media.staff ?? [],
      relations: media.relations ?? [],
    }
    if (charactersSec.data) {
      m.characters = pickList(charactersSec.data, ["characters", "items"]).map(
        mapCharacter
      )
    }
    if (staffSec.data) {
      m.staff = pickList(staffSec.data, ["staff", "items"]).map(mapStaff)
    }
    if (relationsSec.data) {
      m.relations = pickList(relationsSec.data, ["relations", "items"]).map(
        (r: any) => ({ ...r, target: r.target ?? r.data ?? null })
      )
    }
    if (episodesSec.data) {
      m.episodes = pickList(episodesSec.data, ["episodes", "items"]).map(
        (e: any) => ({ ...e, number: e.number ?? e.episodeNumber })
      )
    }
    if (seasonsSec.data) {
      m.seasons = pickList(seasonsSec.data, ["seasons", "items"])
    }
    if (imagesSec.data) {
      const d: any = imagesSec.data
      m.images = d.images ?? d
    }
    if (statsSec.data) {
      const d: any = (statsSec.data as any).stats ?? statsSec.data
      Object.assign(m, d)
    }
    return m
  }, [
    media,
    charactersSec.data,
    staffSec.data,
    relationsSec.data,
    episodesSec.data,
    seasonsSec.data,
    imagesSec.data,
    statsSec.data,
  ])

  const similarItems = useMemo<SimilarMediaCardItem[]>(() => {
    if (!similarSec.data) return similarList ?? []
    return pickList(similarSec.data, ["items", "similar"]).map((item: any) => ({
      id: item.id,
      type: item.type ?? item.mediaType ?? media.category,
      format: item.format ?? null,
      coverImage: item.coverImage ?? null,
      bannerImage: item.bannerImage ?? null,
      description: item.description ?? null,
      status: item.status ?? null,
      titlePrimary: item.titlePrimary ?? "",
      titleSecondary: item.titleSecondary ?? null,
      titleNative: item.titleNative ?? null,
      year: item.startDateYear ?? item.year ?? null,
      score: item.averageScore ?? null,
      genres: item.genres ?? [],
    }))
  }, [similarSec.data, similarList, media.category])
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
      <main className="w-full flex-1 px-4 pt-4 pb-8 sm:px-6 lg:px-8">
        {validActiveTab === "overview" && (
          <OverviewTab
            media={fullMedia}
            similarList={similarItems}
            onViewAllCharacters={() => setActiveTab("characters")}
            onViewAllTracks={() => setActiveTab("tracks")}
            onViewAllLyrics={() => setActiveTab("lyrics")}
          />
        )}

        {validActiveTab === "relations" && (
          <RelationsTab
            relations={fullMedia.relations ?? []}
            titlePreference={titlePreference}
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
          <CharactersTab characters={fullMedia.characters} />
        )}

        {validActiveTab === "staff" && <StaffTab staff={fullMedia.staff} />}

        {validActiveTab === "episodes" && (
          <EpisodesTab
            episodes={fullMedia.episodes ?? []}
            seasons={fullMedia.seasons}
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
            images={fullMedia.images ?? null}
          />
        )}

        {validActiveTab === "trailers" && (
          <TrailersTab trailers={media.trailers ?? null} />
        )}

        {validActiveTab === "stats" && <StatsTab media={fullMedia} />}

        {validActiveTab === "friends" && (
          <FriendsMediaTab mediaCategory={media.category} mediaId={media.id} />
        )}

        {validActiveTab === "people" && (
          <PeopleTab mediaCategory={media.category} mediaId={media.id} />
        )}

        {validActiveTab === "recommendations" && (
          <RecommendationsMediaTab media={media} />
        )}
      </main>

      {/* Sources & Footer */}
      <MediaFooter media={media} />
    </div>
  )
}
