"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import {
  IconBriefcase,
  IconClock,
  IconExternalLink,
  IconHeart,
  IconMicrophone,
  IconMovie,
  IconPhotoOff,
  IconUser,
  IconWorld,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { PersonDetails } from "@IRIS/elysia"
import { FormattedDescription } from "@/components/media/formatted-description"
import { FavoriteButton } from "../favorite-button"

interface PersonDetailViewProps {
  person: PersonDetails
}

type MediaFilterKey = "ALL" | "ANIME" | "MANGA" | "MOVIE" | "TV" | "BOOK"

function formatMediaFormat(format?: string | null, mediaType?: string): string {
  if (!format) {
    if (!mediaType) return ""
    return mediaType.charAt(0).toUpperCase() + mediaType.slice(1).toLowerCase()
  }
  const f = format.toUpperCase()
  switch (f) {
    case "TV":
      return "TV"
    case "TV_SHORT":
      return "TV Short"
    case "MOVIE":
      return "Movie"
    case "SPECIAL":
      return "Special"
    case "OVA":
      return "OVA"
    case "ONA":
      return "ONA"
    case "MUSIC":
      return "Music"
    case "MANGA":
      return "Manga"
    case "NOVEL":
      return "Novel"
    case "LIGHT_NOVEL":
      return "Light Novel"
    case "ONE_SHOT":
      return "One Shot"
    case "DOUJINSHI":
      return "Doujinshi"
    default:
      return format
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

export function PersonDetailView({ person }: PersonDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"VOICED" | "STAFF">("VOICED")
  const [selectedVoicedMediaType, setSelectedVoicedMediaType] =
    useState<MediaFilterKey>("ALL")
  const [selectedStaffMediaType, setSelectedStaffMediaType] =
    useState<MediaFilterKey>("ALL")

  // Deduplicate and process voiced characters
  const deduplicatedVoicedRoles = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        characterId: number
        characterNamePrimary: string
        characterNameNative: string | null
        characterImage: string | null
        mediaType: "ANIME" | "MOVIE" | "TV" | "BOOK"
        mediaId: number
        mediaTitle: string
        mediaTitleNative?: string | null
        mediaCover?: string | null
        mediaYear?: number | null
        mediaScore?: number | null
        mediaFormat?: string | null
        role: string
      }
    >()

    person.voicedCharacters.forEach((vc) => {
      const type = vc.mediaType.toUpperCase() as
        "ANIME" | "MOVIE" | "TV" | "BOOK"
      const key = `${vc.character.id}-${type}-${vc.mediaId}`

      if (!map.has(key)) {
        const mediaObj = vc.anime || vc.movie || vc.tv || vc.book
        const mediaTitle =
          mediaObj?.titlePrimary || `${vc.mediaType} #${vc.mediaId}`
        const mediaNative = (mediaObj as any)?.titleNative
        const mediaCover = mediaObj?.coverImage
        const mediaYear =
          vc.anime?.startDateYear ||
          vc.movie?.releaseDateYear ||
          vc.tv?.firstAiredYear ||
          vc.book?.releaseDateYear
        const mediaScore = mediaObj?.averageScore
        const mediaFormat =
          vc.anime?.format ||
          (vc.tv ? vc.tv.showType || "TV" : null) ||
          vc.book?.format ||
          (vc.movie ? "MOVIE" : null)

        map.set(key, {
          key,
          characterId: vc.character.id,
          characterNamePrimary: vc.character.namePrimary,
          characterNameNative: vc.character.nameNative,
          characterImage: vc.character.image,
          mediaType: type,
          mediaId: vc.mediaId,
          mediaTitle,
          mediaTitleNative: mediaNative ?? null,
          mediaCover: mediaCover ?? null,
          mediaYear: mediaYear ?? null,
          mediaScore: mediaScore ?? null,
          mediaFormat: mediaFormat ?? null,
          role: vc.role,
        })
      }
    })

    return Array.from(map.values())
  }, [person.voicedCharacters])

  // Group voiced characters by media type
  const voicedByType = useMemo(() => {
    const anime = deduplicatedVoicedRoles.filter((m) => m.mediaType === "ANIME")
    const movies = deduplicatedVoicedRoles.filter(
      (m) => m.mediaType === "MOVIE"
    )
    const tv = deduplicatedVoicedRoles.filter((m) => m.mediaType === "TV")
    const books = deduplicatedVoicedRoles.filter((m) => m.mediaType === "BOOK")

    return [
      {
        type: "ANIME" as const,
        title: "Anime",
        count: anime.length,
        items: anime,
      },
      {
        type: "MOVIE" as const,
        title: "Movies",
        count: movies.length,
        items: movies,
      },
      { type: "TV" as const, title: "TV Shows", count: tv.length, items: tv },
      {
        type: "BOOK" as const,
        title: "Books",
        count: books.length,
        items: books,
      },
    ].filter((group) => group.count > 0)
  }, [deduplicatedVoicedRoles])

  // Counts for voiced roles
  const voicedCounts = useMemo(() => {
    const counts: Record<MediaFilterKey, number> = {
      ALL: deduplicatedVoicedRoles.length,
      ANIME: 0,
      MANGA: 0,
      MOVIE: 0,
      TV: 0,
      BOOK: 0,
    }
    deduplicatedVoicedRoles.forEach((m) => {
      counts[m.mediaType] += 1
    })
    return counts
  }, [deduplicatedVoicedRoles])

  const visibleVoicedGroups = useMemo(() => {
    if (selectedVoicedMediaType === "ALL") {
      return voicedByType
    }
    return voicedByType.filter((g) => g.type === selectedVoicedMediaType)
  }, [voicedByType, selectedVoicedMediaType])

  // Deduplicate and process media staff credits
  const deduplicatedStaffRoles = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        mediaType: "ANIME" | "MANGA" | "MOVIE" | "TV" | "BOOK"
        mediaId: number
        role: string
        customRole?: string | null
        mediaTitle: string
        mediaTitleNative?: string | null
        mediaCover?: string | null
        mediaYear?: number | null
        mediaScore?: number | null
        mediaFormat?: string | null
      }
    >()

    person.mediaStaff.forEach((ms) => {
      const type = ms.mediaType.toUpperCase() as
        "ANIME" | "MANGA" | "MOVIE" | "TV" | "BOOK"
      const key = `${type}-${ms.mediaId}-${ms.role}`

      if (!map.has(key)) {
        const mediaObj = ms.anime || ms.manga || ms.movie || ms.tv || ms.book
        const mediaTitle =
          mediaObj?.titlePrimary || `${ms.mediaType} #${ms.mediaId}`
        const mediaNative = (mediaObj as any)?.titleNative
        const mediaCover = mediaObj?.coverImage
        const mediaYear =
          ms.anime?.startDateYear ||
          ms.manga?.startDateYear ||
          ms.movie?.releaseDateYear ||
          ms.tv?.firstAiredYear ||
          ms.book?.releaseDateYear
        const mediaScore = mediaObj?.averageScore
        const mediaFormat =
          ms.anime?.format ||
          ms.manga?.format ||
          (ms.tv ? ms.tv.showType || "TV" : null) ||
          ms.book?.format ||
          (ms.movie ? "MOVIE" : null)

        map.set(key, {
          key,
          mediaType: type,
          mediaId: ms.mediaId,
          role: ms.role,
          customRole: ms.customRole,
          mediaTitle,
          mediaTitleNative: mediaNative,
          mediaCover,
          mediaYear,
          mediaScore,
          mediaFormat,
        })
      }
    })

    return Array.from(map.values())
  }, [person.mediaStaff])

  // Group staff credits by media type
  const staffByType = useMemo(() => {
    const anime = deduplicatedStaffRoles.filter((m) => m.mediaType === "ANIME")
    const manga = deduplicatedStaffRoles.filter((m) => m.mediaType === "MANGA")
    const movies = deduplicatedStaffRoles.filter((m) => m.mediaType === "MOVIE")
    const tv = deduplicatedStaffRoles.filter((m) => m.mediaType === "TV")
    const books = deduplicatedStaffRoles.filter((m) => m.mediaType === "BOOK")

    return [
      {
        type: "ANIME" as const,
        title: "Anime",
        count: anime.length,
        items: anime,
      },
      {
        type: "MANGA" as const,
        title: "Manga",
        count: manga.length,
        items: manga,
      },
      {
        type: "MOVIE" as const,
        title: "Movies",
        count: movies.length,
        items: movies,
      },
      { type: "TV" as const, title: "TV Shows", count: tv.length, items: tv },
      {
        type: "BOOK" as const,
        title: "Books",
        count: books.length,
        items: books,
      },
    ].filter((group) => group.count > 0)
  }, [deduplicatedStaffRoles])

  const staffCounts = useMemo(() => {
    const counts: Record<MediaFilterKey, number> = {
      ALL: deduplicatedStaffRoles.length,
      ANIME: 0,
      MANGA: 0,
      MOVIE: 0,
      TV: 0,
      BOOK: 0,
    }
    deduplicatedStaffRoles.forEach((m) => {
      counts[m.mediaType] += 1
    })
    return counts
  }, [deduplicatedStaffRoles])

  const visibleStaffGroups = useMemo(() => {
    if (selectedStaffMediaType === "ALL") {
      return staffByType
    }
    return staffByType.filter((g) => g.type === selectedStaffMediaType)
  }, [staffByType, selectedStaffMediaType])

  return (
    <div className="flex flex-col gap-6 pb-12 sm:gap-8">
      {/* 1. Person Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/60 p-5 shadow-xs sm:p-7">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:gap-7">
          {/* Portrait Image */}
          <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-2xl border border-border/40 bg-muted shadow-sm sm:w-36 md:w-44">
            {person.image ? (
              <img
                src={person.image}
                alt={person.namePrimary}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                <IconUser className="size-10" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Names, Badges, and Actions */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              {typeof person.favorites === "number" && person.favorites > 0 && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] font-semibold text-rose-500"
                >
                  <IconHeart
                    className="size-3 fill-current"
                    aria-hidden="true"
                  />
                  <span>{person.favorites.toLocaleString()}</span>
                </Badge>
              )}
              <FavoriteButton
                targetId={person.id}
                type="PERSON"
                title={person.namePrimary}
                size="sm"
                variant="secondary"
                showLabel
              />
            </div>

            {/* Primary Name */}
            <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-3xl lg:text-4xl">
              {person.namePrimary}
            </h1>

            {/* Native Name */}
            {person.nameNative && (
              <p className="font-japanese text-sm text-muted-foreground sm:text-base">
                {person.nameNative}
              </p>
            )}

            {/* Quick Profile Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-xs text-muted-foreground">
              {person.language && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 font-medium text-foreground">
                  <IconWorld
                    className="size-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>{person.language}</span>
                </span>
              )}
              {deduplicatedVoicedRoles.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 font-medium text-foreground">
                  <IconMicrophone
                    className="size-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>{deduplicatedVoicedRoles.length} Roles</span>
                </span>
              )}
              {deduplicatedStaffRoles.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 font-medium text-foreground">
                  <IconBriefcase
                    className="size-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>{deduplicatedStaffRoles.length} Staff Credits</span>
                </span>
              )}
            </div>

            {/* Alternative Names (Aliases) */}
            {person.nameAlternative && person.nameAlternative.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-1.5">
                <span className="mr-1 text-[11px] font-medium text-muted-foreground">
                  Aliases:
                </span>
                {person.nameAlternative.map((alias, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[10px] font-normal text-muted-foreground"
                  >
                    {alias}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
        {/* Left Column: Information Sidebar (1 col) */}
        <aside className="order-2 flex flex-col gap-4 lg:order-1">
          {/* Information Card */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-card/60 p-4 text-xs shadow-xs">
            <h3 className="text-[11px] font-semibold tracking-wider text-foreground text-muted-foreground uppercase">
              Person Information
            </h3>

            <div className="flex flex-col divide-y divide-border/20">
              {person.nameNative && (
                <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Native Name
                  </span>
                  <span className="font-japanese text-end font-medium text-foreground">
                    {person.nameNative}
                  </span>
                </div>
              )}

              {person.language && (
                <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Language
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {person.language}
                  </span>
                </div>
              )}

              {typeof person.favorites === "number" && (
                <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Favorites
                  </span>
                  <span className="text-end font-medium text-foreground tabular-nums">
                    {person.favorites.toLocaleString()}
                  </span>
                </div>
              )}

              {person.nameAlternative && person.nameAlternative.length > 0 && (
                <div className="flex flex-col gap-1 py-1.5 text-xs">
                  <span className="text-muted-foreground">
                    Alternative Names
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {person.nameAlternative.map((alt, idx) => (
                      <span
                        key={idx}
                        className="text-end text-[11px] break-words text-foreground"
                      >
                        {alt}
                        {idx < person.nameAlternative.length - 1 ? "," : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Provider IDs Card */}
          {(person.anilistId ||
            person.malId ||
            person.aniDBId ||
            person.tvDBId ||
            person.bangumiId ||
            person.imdbId ||
            person.tmdbId) && (
            <div className="flex flex-col gap-2.5 rounded-2xl border border-border/40 bg-card/60 p-4 text-xs shadow-xs">
              <h3 className="text-[11px] font-semibold tracking-wider text-foreground text-muted-foreground uppercase">
                External IDs
              </h3>
              <div className="flex flex-col divide-y divide-border/20">
                {person.anilistId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">AniList</span>
                    <a
                      href={`https://anilist.co/staff/${person.anilistId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{person.anilistId}
                    </a>
                  </div>
                )}
                {person.malId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">MyAnimeList</span>
                    <a
                      href={`https://myanimelist.net/people/${person.malId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{person.malId}
                    </a>
                  </div>
                )}
                {person.aniDBId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">AniDB</span>
                    <a
                      href={`https://anidb.net/creator/${person.aniDBId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{person.aniDBId}
                    </a>
                  </div>
                )}
                {person.tvDBId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">TheTVDB</span>
                    <a
                      href={`https://thetvdb.com/dereferrer/people/${person.tvDBId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{person.tvDBId}
                    </a>
                  </div>
                )}
                {person.bangumiId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">Bangumi</span>
                    <a
                      href={`https://bgm.tv/person/${person.bangumiId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{person.bangumiId}
                    </a>
                  </div>
                )}
                {person.imdbId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">IMDb</span>
                    <a
                      href={`https://www.imdb.com/name/${person.imdbId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {person.imdbId}
                    </a>
                  </div>
                )}
                {person.tmdbId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">TMDB</span>
                    <a
                      href={`https://www.themoviedb.org/person/${person.tmdbId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{person.tmdbId}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Database Info Card */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-card/60 p-4 text-xs shadow-xs">
            <h3 className="text-[11px] font-semibold tracking-wider text-foreground text-muted-foreground uppercase">
              Database Info
            </h3>
            <div className="flex flex-col divide-y divide-border/20">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Created</span>
                <span className="text-muted-foreground tabular-nums">
                  {new Date(person.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Updated</span>
                <span className="text-muted-foreground tabular-nums">
                  {new Date(person.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: Biography, Roles Tabs (Voiced Roles & Staff Credits) */}
        <div className="order-1 flex flex-col gap-6 lg:order-2 lg:col-span-3">
          {/* Biography Card */}
          <section
            aria-labelledby="bio-heading"
            className="rounded-2xl border border-border/40 bg-card/60 p-5 shadow-xs"
          >
            <h2
              id="bio-heading"
              className="mb-2.5 text-base font-semibold text-foreground"
            >
              Biography
            </h2>
            <FormattedDescription
              text={person.description}
              fallbackText="No biography available for this person."
            />
          </section>

          {/* Role Mode Toggle (Voiced Roles vs Staff Credits) */}
          {deduplicatedStaffRoles.length > 0 &&
            deduplicatedVoicedRoles.length > 0 && (
              <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("VOICED")}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeTab === "VOICED"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <IconMicrophone className="size-3.5" aria-hidden="true" />
                  <span>Voiced Characters</span>
                  <span
                    className={cn(
                      "py-0.2 rounded-full px-1.5 text-[10px] font-bold",
                      activeTab === "VOICED"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background/80 text-muted-foreground"
                    )}
                  >
                    {deduplicatedVoicedRoles.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("STAFF")}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeTab === "STAFF"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <IconBriefcase className="size-3.5" aria-hidden="true" />
                  <span>Production Staff</span>
                  <span
                    className={cn(
                      "py-0.2 rounded-full px-1.5 text-[10px] font-bold",
                      activeTab === "STAFF"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background/80 text-muted-foreground"
                    )}
                  >
                    {deduplicatedStaffRoles.length}
                  </span>
                </button>
              </div>
            )}

          {/* 1. Voiced Roles Section */}
          {(activeTab === "VOICED" || deduplicatedStaffRoles.length === 0) && (
            <section
              aria-labelledby="voiced-heading"
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <IconMicrophone
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  <h2
                    id="voiced-heading"
                    className="text-base font-semibold text-foreground"
                  >
                    Voiced Characters ({deduplicatedVoicedRoles.length})
                  </h2>
                </div>

                {/* Media Type Filter Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {(["ALL", "ANIME", "MOVIE", "TV", "BOOK"] as const).map(
                    (type) => {
                      const count = voicedCounts[type]
                      if (type !== "ALL" && count === 0) return null
                      const isSelected = selectedVoicedMediaType === type
                      const labelMap: Record<MediaFilterKey, string> = {
                        ALL: "All",
                        ANIME: "Anime",
                        MANGA: "Manga",
                        MOVIE: "Movies",
                        TV: "TV Shows",
                        BOOK: "Books",
                      }
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedVoicedMediaType(type)}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <span>{labelMap[type]}</span>
                          <span
                            className={cn(
                              "py-0.2 rounded-full px-1.5 text-[9px] font-bold",
                              isSelected
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-background/80 text-muted-foreground"
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      )
                    }
                  )}
                </div>
              </div>

              {/* Render Voiced Groups Separated by Media Type */}
              {visibleVoicedGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                  No voiced roles found in this category.
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {visibleVoicedGroups.map((group) => (
                    <div key={group.type} className="flex flex-col gap-3">
                      {/* Section Header */}
                      <div className="flex items-center gap-2 border-b border-border/20 pb-1.5">
                        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                          {group.title}
                        </h3>
                        <span className="py-0.2 rounded-full bg-muted px-2 text-[10px] font-semibold text-muted-foreground tabular-nums">
                          {group.count}
                        </span>
                      </div>

                      {/* Voiced Roles Grid: Left Character, Right Media */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {group.items.map((item) => {
                          const mediaTypeSlug =
                            item.mediaType.toLowerCase() === "movie"
                              ? "movies"
                              : item.mediaType.toLowerCase()
                          const mediaHref = `/IRIS-list/media/${mediaTypeSlug}/${item.mediaId}`
                          const characterHref = `/IRIS-list/media/characters/${item.characterId}`

                          return (
                            <div
                              key={item.key}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card/60 p-2.5 transition-colors hover:border-border/60"
                            >
                              {/* Left Side: Character Details */}
                              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                <Link
                                  href={characterHref}
                                  className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {item.characterImage ? (
                                    <img
                                      src={item.characterImage}
                                      alt={item.characterNamePrimary}
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                                      <IconPhotoOff
                                        className="size-4"
                                        aria-hidden="true"
                                      />
                                    </div>
                                  )}
                                </Link>

                                <div className="flex min-w-0 flex-1 flex-col">
                                  <Link
                                    href={characterHref}
                                    className="truncate text-xs font-semibold text-foreground outline-none hover:underline focus-visible:underline"
                                  >
                                    {item.characterNamePrimary}
                                  </Link>
                                  {item.characterNameNative && (
                                    <span className="font-japanese truncate text-[10px] text-muted-foreground opacity-75">
                                      {item.characterNameNative}
                                    </span>
                                  )}
                                  <div className="pt-0.5">
                                    <Badge
                                      variant="outline"
                                      className="px-1.5 py-0 text-[9px] font-semibold uppercase"
                                    >
                                      {item.role}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              {/* Right Side: Media Details */}
                              <Link
                                href={mediaHref}
                                className="flex max-w-[150px] shrink-0 items-center gap-2 rounded-xl bg-muted/40 p-1.5 transition-colors hover:bg-muted/80"
                              >
                                <div className="flex min-w-0 flex-col text-end">
                                  <span className="truncate text-[10px] font-semibold text-foreground">
                                    {item.mediaTitle}
                                  </span>
                                  <div className="flex items-center justify-end gap-1 text-[9px] text-muted-foreground">
                                    <span>
                                      {formatMediaFormat(
                                        item.mediaFormat,
                                        item.mediaType
                                      )}
                                    </span>
                                    {item.mediaYear && (
                                      <span>• {item.mediaYear}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="relative aspect-[3/4] w-8 shrink-0 overflow-hidden rounded-lg bg-muted">
                                  {item.mediaCover ? (
                                    <img
                                      src={item.mediaCover}
                                      alt={item.mediaTitle}
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                                      <IconPhotoOff
                                        className="size-3"
                                        aria-hidden="true"
                                      />
                                    </div>
                                  )}
                                </div>
                              </Link>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 2. Staff Credits Section */}
          {(activeTab === "STAFF" || deduplicatedVoicedRoles.length === 0) &&
            deduplicatedStaffRoles.length > 0 && (
              <section
                aria-labelledby="staff-heading"
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <IconBriefcase
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    <h2
                      id="staff-heading"
                      className="text-base font-semibold text-foreground"
                    >
                      Production Staff ({deduplicatedStaffRoles.length})
                    </h2>
                  </div>

                  {/* Media Type Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      ["ALL", "ANIME", "MANGA", "MOVIE", "TV", "BOOK"] as const
                    ).map((type) => {
                      const count = staffCounts[type]
                      if (type !== "ALL" && count === 0) return null
                      const isSelected = selectedStaffMediaType === type
                      const labelMap: Record<MediaFilterKey, string> = {
                        ALL: "All",
                        ANIME: "Anime",
                        MANGA: "Manga",
                        MOVIE: "Movies",
                        TV: "TV Shows",
                        BOOK: "Books",
                      }
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedStaffMediaType(type)}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <span>{labelMap[type]}</span>
                          <span
                            className={cn(
                              "py-0.2 rounded-full px-1.5 text-[9px] font-bold",
                              isSelected
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-background/80 text-muted-foreground"
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Render Staff Groups Separated by Media Type */}
                {visibleStaffGroups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                    No staff credits found in this category.
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {visibleStaffGroups.map((group) => (
                      <div key={group.type} className="flex flex-col gap-3">
                        {/* Section Header */}
                        <div className="flex items-center gap-2 border-b border-border/20 pb-1.5">
                          <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                            {group.title}
                          </h3>
                          <span className="py-0.2 rounded-full bg-muted px-2 text-[10px] font-semibold text-muted-foreground tabular-nums">
                            {group.count}
                          </span>
                        </div>

                        {/* Staff Cards Grid */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {group.items.map((item) => {
                            const mediaTypeSlug =
                              item.mediaType.toLowerCase() === "movie"
                                ? "movies"
                                : item.mediaType.toLowerCase()
                            const mediaHref = `/IRIS-list/media/${mediaTypeSlug}/${item.mediaId}`

                            return (
                              <div
                                key={item.key}
                                className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/60 p-2.5 transition-colors hover:border-border/60"
                              >
                                <Link
                                  href={mediaHref}
                                  className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {item.mediaCover ? (
                                    <img
                                      src={item.mediaCover}
                                      alt={item.mediaTitle}
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                                      <IconPhotoOff
                                        className="size-4"
                                        aria-hidden="true"
                                      />
                                    </div>
                                  )}
                                </Link>

                                <div className="flex min-w-0 flex-1 flex-col">
                                  <Link
                                    href={mediaHref}
                                    className="truncate text-xs font-semibold text-foreground outline-none hover:underline focus-visible:underline"
                                  >
                                    {item.mediaTitle}
                                  </Link>

                                  {item.mediaTitleNative &&
                                    item.mediaTitleNative !==
                                      item.mediaTitle && (
                                      <span className="font-japanese truncate text-[10px] text-muted-foreground opacity-75">
                                        {item.mediaTitleNative}
                                      </span>
                                    )}

                                  <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                                    <Badge
                                      variant="outline"
                                      className="px-1.5 py-0 text-[9px] font-semibold uppercase"
                                    >
                                      {item.customRole ||
                                        item.role.replace(/_/g, " ")}
                                    </Badge>
                                    <span>
                                      {formatMediaFormat(
                                        item.mediaFormat,
                                        item.mediaType
                                      )}
                                    </span>
                                    {item.mediaYear && (
                                      <span>• {item.mediaYear}</span>
                                    )}
                                    {typeof item.mediaScore === "number" &&
                                      item.mediaScore > 0 && (
                                        <span className="font-medium text-amber-500 tabular-nums">
                                          • {item.mediaScore}%
                                        </span>
                                      )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
        </div>
      </div>
    </div>
  )
}
