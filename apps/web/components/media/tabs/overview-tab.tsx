"use client"

import React, { useMemo, useRef } from "react"
import Link from "next/link"
import {
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCpu,
  IconDisc,
  IconExternalLink,
  IconHash,
  IconLink,
  IconPhotoOff,
  IconSparkles,
  IconTrophy,
  IconWorld,
  IconMicrophone,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useUser } from "@/context/user-context"
import { getMediaPreferences } from "@IRIS/shared"
import { formatMediaTitle } from "@/lib/browse-search"
import { getMediaDetailHref } from "@/lib/media-routes"
import type {
  NormalizedMediaData,
  RelationItem,
  SimilarMediaCardItem,
} from "../media-types"
import { MusicTracklist } from "../music/music-tracklist"
import { MusicPlayerPreview } from "../music/music-player-preview"
import { MusicLyrics } from "../music/music-lyrics"

interface OverviewTabProps {
  media: NormalizedMediaData
  similarList: SimilarMediaCardItem[]
  onViewAllCharacters?: () => void
  onViewAllTracks?: () => void
  onViewAllLyrics?: () => void
}

export function OverviewTab({
  media,
  similarList,
  onViewAllCharacters,
  onViewAllTracks,
  onViewAllLyrics,
}: OverviewTabProps) {
  const { user } = useUser()
  const titlePref = getMediaPreferences(user?.customization).title || "primary"

  const similarScrollRef = useRef<HTMLDivElement>(null)
  const similarListMax12 = useMemo(
    () => similarList.slice(0, 12),
    [similarList]
  )

  const scrollSimilar = (direction: "left" | "right") => {
    if (similarScrollRef.current) {
      const scrollAmount =
        direction === "left"
          ? -similarScrollRef.current.clientWidth
          : similarScrollRef.current.clientWidth
      similarScrollRef.current.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      })
    }
  }

  // 8 characters prioritized by MAIN, with Japanese VA if available
  const featuredCharacters = useMemo(() => {
    const list = [...media.characters]

    // Sort: MAIN first, then order
    list.sort((a, b) => {
      if (a.role === "MAIN" && b.role !== "MAIN") return -1
      if (b.role === "MAIN" && a.role !== "MAIN") return 1
      return (a.order ?? 999) - (b.order ?? 999)
    })

    // Take top 8 unique characters
    const seen = new Set<number>()
    const top8 = []
    for (const char of list) {
      if (!seen.has(char.characterId)) {
        seen.add(char.characterId)
        top8.push(char)
        if (top8.length >= 8) break
      }
    }
    return top8
  }, [media.characters])

  // Parse description cleanly
  const cleanDescription = useMemo(() => {
    if (!media.description) return null
    return media.description
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .trim()
  }, [media.description])

  // Group relations by targetType (e.g. ANIME, MANGA, MOVIE, TV, BOOK, GAME)
  const relationsByType = useMemo(() => {
    const map = new Map<string, RelationItem[]>()
    for (const rel of media.relations) {
      const typeKey = rel.targetType.toUpperCase()
      const list = map.get(typeKey) ?? []
      list.push(rel)
      map.set(typeKey, list)
    }

    const formatTypeHeading = (type: string) => {
      switch (type) {
        case "ANIME":
          return "Related Anime"
        case "MANGA":
          return "Related Manga"
        case "MOVIE":
          return "Related Movies"
        case "TV":
          return "Related TV Shows"
        case "BOOK":
          return "Related Light Novels & Books"
        case "GAME":
          return "Related Games"
        default:
          return `Related ${type.charAt(0) + type.slice(1).toLowerCase()}`
      }
    }

    return Array.from(map.entries()).map(([rawType, items]) => ({
      rawType,
      heading: formatTypeHeading(rawType),
      items,
    }))
  }, [media.relations])

  // Helper to format full dates
  const formatFullDate = (
    year?: number | null,
    month?: number | null,
    day?: number | null
  ) => {
    if (!year) return null
    if (!month) return `${year}`
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]
    const monthStr = monthNames[month - 1] || `${month}`
    if (!day) return `${monthStr} ${year}`
    return `${monthStr} ${day}, ${year}`
  }

  const startDateFormatted = formatFullDate(
    media.startDateYear,
    media.startDateMonth,
    media.startDateDay
  )
  const endDateFormatted = formatFullDate(
    media.endDateYear,
    media.endDateMonth,
    media.endDateDay
  )

  const airedRange = useMemo(() => {
    if (
      media.category === "movies" ||
      media.category === "games" ||
      media.category === "books" ||
      media.format === "MOVIE" ||
      media.format === "GAME" ||
      media.format === "BOOK"
    ) {
      return startDateFormatted ?? null
    }
    if (startDateFormatted && endDateFormatted) {
      return `${startDateFormatted} to ${endDateFormatted}`
    }
    if (startDateFormatted) {
      if (
        media.status?.toUpperCase() === "FINISHED" ||
        media.status?.toUpperCase() === "RELEASED" ||
        media.status?.toUpperCase() === "PUBLISHED"
      ) {
        return startDateFormatted
      }
      return `${startDateFormatted} to ?`
    }
    return null
  }, [
    media.category,
    media.format,
    media.status,
    startDateFormatted,
    endDateFormatted,
  ])

  const opSongs = media.themeSongs?.op ?? []
  const edSongs = media.themeSongs?.ed ?? []
  const hasThemeSongs = opSongs.length > 0 || edSongs.length > 0

  // Studios breakdown
  const animationStudios = media.studios
    .filter((s) => s.studio.isAnimationStudio || s.isMain)
    .map((s) => s.studio.name)

  const producerStudios = media.studios
    .filter((s) => !s.studio.isAnimationStudio && !s.isMain)
    .map((s) => s.studio.name)

  const isReleasing = media.status?.toUpperCase() === "RELEASING"

  // Resolve next airing episode if status is releasing:
  // If nextAiringDate is older than current date/time say "airing now", if older than 1 day, show when next episode
  const nextAiring = useMemo(() => {
    if (!isReleasing) return null

    const now = Date.now()
    const ONE_DAY_MS = 24 * 60 * 60 * 1000

    const evaluateCandidate = (
      epNum: number,
      dateVal: string | Date | null | undefined
    ) => {
      if (!dateVal)
        return { episodeNumber: epNum, date: null, isAiringNow: false }
      const d = new Date(dateVal)
      if (isNaN(d.getTime()))
        return { episodeNumber: epNum, date: null, isAiringNow: false }

      const diff = now - d.getTime()

      // If older than 1 day, it has already passed: move on to the next episode
      if (diff >= ONE_DAY_MS) {
        return null
      }

      // If older than current time (< 1 day old), it's currently airing
      if (diff >= 0) {
        return {
          episodeNumber: epNum,
          date: d,
          isAiringNow: true,
        }
      }

      // In the future
      return {
        episodeNumber: epNum,
        date: d,
        isAiringNow: false,
      }
    }

    // 1. Direct nextAiringEpisodeNumber & nextAiringAt
    if (media.nextAiringEpisodeNumber && media.nextAiringAt) {
      const candidate = evaluateCandidate(
        media.nextAiringEpisodeNumber,
        media.nextAiringAt
      )
      if (candidate) {
        return candidate
      }
      // If direct next airing is older than 1 day, fall through to dig up the actual next episode
    }

    // 2. Dig up from airingSchedule by current date
    if (media.airingSchedule && media.airingSchedule.length > 0) {
      const sortedSchedule = media.airingSchedule
        .slice()
        .sort((a, b) => a.episodeNumber - b.episodeNumber)

      // First check if an episode is "airing now" (aired within the last 24h)
      const airingNowItem = sortedSchedule.find((item) => {
        const t = new Date(item.airingAt).getTime()
        if (isNaN(t)) return false
        const diff = now - t
        return diff >= 0 && diff < ONE_DAY_MS
      })

      if (airingNowItem) {
        return {
          episodeNumber: airingNowItem.episodeNumber,
          date: new Date(airingNowItem.airingAt),
          isAiringNow: true,
        }
      }

      // Otherwise find the first upcoming episode strictly in the future (airingAt > now)
      const futureItem = sortedSchedule.find((item) => {
        const t = new Date(item.airingAt).getTime()
        return !isNaN(t) && t > now
      })

      if (futureItem) {
        return {
          episodeNumber: futureItem.episodeNumber,
          date: new Date(futureItem.airingAt),
          isAiringNow: false,
        }
      }
    }

    // 3. Dig up from episodes airDate
    if (media.episodes && media.episodes.length > 0) {
      const sortedEps = media.episodes
        .filter((ep) => ep.airDate)
        .sort((a, b) => a.number - b.number)

      const airingNowEp = sortedEps.find((ep) => {
        const t = new Date(ep.airDate!).getTime()
        if (isNaN(t)) return false
        const diff = now - t
        return diff >= 0 && diff < ONE_DAY_MS
      })

      if (airingNowEp) {
        return {
          episodeNumber: airingNowEp.number,
          date: new Date(airingNowEp.airDate!),
          isAiringNow: true,
        }
      }

      const futureEp = sortedEps.find((ep) => {
        const t = new Date(ep.airDate!).getTime()
        return !isNaN(t) && t > now
      })

      if (futureEp) {
        return {
          episodeNumber: futureEp.number,
          date: new Date(futureEp.airDate!),
          isAiringNow: false,
        }
      }

      // 4. Fallback: next episode after current highest
      const maxEp = Math.max(...media.episodes.map((e) => e.number))
      return {
        episodeNumber: maxEp + 1,
        date: null,
        isAiringNow: false,
      }
    }

    return null
  }, [
    isReleasing,
    media.nextAiringEpisodeNumber,
    media.nextAiringAt,
    media.airingSchedule,
    media.episodes,
  ])

  const formatTimeUntil = (targetDate: Date) => {
    const diffMs = targetDate.getTime() - Date.now()
    if (diffMs <= 0) return "Airing now"
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const days = Math.floor(diffHours / 24)
    const hours = diffHours % 24
    if (days > 0) {
      return `in ${days}d ${hours}h`
    }
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `in ${hours}h ${minutes}m`
  }

  const formatCurrency = (val: number | bigint | string | null | undefined) => {
    if (val === null || val === undefined) return null
    const num =
      typeof val === "bigint"
        ? Number(val)
        : typeof val === "string"
          ? parseFloat(val)
          : val
    if (isNaN(num) || num <= 0) return null
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num)
  }

  const formatLanguage = (langCode: string | null | undefined) => {
    if (!langCode) return null
    try {
      const name = new Intl.DisplayNames(["en"], { type: "language" }).of(
        langCode
      )
      return name
        ? `${name} (${langCode.toUpperCase()})`
        : langCode.toUpperCase()
    } catch {
      return langCode.toUpperCase()
    }
  }

  const formatCountry = (countryCode: string | null | undefined) => {
    if (!countryCode) return null
    try {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(
        countryCode
      )
      return name
        ? `${name} (${countryCode.toUpperCase()})`
        : countryCode.toUpperCase()
    } catch {
      return countryCode.toUpperCase()
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* 1. Main Column (Synopsis, Characters, Themes, Relations, Similar) + Narrow Right-Aligned Sidebar */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
        {/* Main Column */}
        <div className="flex min-w-0 flex-col gap-8">
          {/* Next Airing Episode Highlight Banner if status is Releasing */}
          {isReleasing && nextAiring && (
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 shadow-xs sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <IconClock className="size-5" aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Episode {nextAiring.episodeNumber}
                      {nextAiring.isAiringNow && " - Airing now"}
                    </span>
                    {!nextAiring.isAiringNow && (
                      <Badge
                        variant="outline"
                        className="h-4 border-emerald-500/40 px-1.5 py-0 text-[10px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400"
                      >
                        Airing Next
                      </Badge>
                    )}
                  </div>
                  {nextAiring.date && (
                    <span className="text-xs text-muted-foreground">
                      {nextAiring.isAiringNow
                        ? `Aired today at ${nextAiring.date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                        : nextAiring.date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                    </span>
                  )}
                </div>
              </div>

              {!nextAiring.isAiringNow && nextAiring.date && (
                <div className="hidden shrink-0 flex-col items-end text-end sm:flex">
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    Countdown
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                    {formatTimeUntil(nextAiring.date)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Synopsis in Card */}
          <section aria-labelledby="synopsis-heading">
            <div className="rounded-2xl border border-border/40 bg-card/60 p-4 shadow-xs sm:p-5">
              <h2
                id="synopsis-heading"
                className="mb-2.5 text-base font-semibold text-foreground"
              >
                Synopsis
              </h2>
              {cleanDescription ? (
                <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">
                  {cleanDescription}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No synopsis available.
                </p>
              )}
            </div>
          </section>

          {/* Awards & Accolades */}
          {media.awards && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs shadow-xs">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <IconTrophy className="size-5" aria-hidden="true" />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[11px] font-semibold tracking-wider text-amber-600 text-foreground uppercase dark:text-amber-400">
                  Awards & Accolades
                </span>
                <p className="text-xs leading-relaxed text-foreground/90">
                  {media.awards}
                </p>
              </div>
            </div>
          )}

          {/* Game: PC System Requirements */}
          {media.requirements &&
            (media.requirements.minimum || media.requirements.recommended) && (
              <section aria-labelledby="requirements-heading">
                <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-card/60 p-4 shadow-xs sm:p-5">
                  <div className="flex items-center gap-2">
                    <IconCpu
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    <h2
                      id="requirements-heading"
                      className="text-base font-semibold text-foreground"
                    >
                      System Requirements
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {media.requirements.minimum && (
                      <div className="flex flex-col gap-1.5 rounded-xl border border-border/30 bg-muted/20 p-3 text-xs">
                        <span className="text-[11px] font-semibold tracking-wider text-foreground text-muted-foreground uppercase">
                          Minimum
                        </span>
                        <div className="text-[11px] leading-relaxed whitespace-pre-line text-muted-foreground select-text">
                          {typeof media.requirements.minimum === "string"
                            ? media.requirements.minimum
                                .replace(/<[^>]*>/g, "")
                                .trim()
                            : Object.entries(media.requirements.minimum).map(
                                ([k, v]) => (
                                  <div
                                    key={k}
                                    className="flex justify-between border-b border-border/10 py-0.5"
                                  >
                                    <span className="font-medium capitalize">
                                      {k}:
                                    </span>
                                    <span className="text-end text-foreground">
                                      {String(v)}
                                    </span>
                                  </div>
                                )
                              )}
                        </div>
                      </div>
                    )}
                    {media.requirements.recommended && (
                      <div className="flex flex-col gap-1.5 rounded-xl border border-border/30 bg-muted/20 p-3 text-xs">
                        <span className="text-[11px] font-semibold tracking-wider text-foreground text-muted-foreground uppercase">
                          Recommended
                        </span>
                        <div className="text-[11px] leading-relaxed whitespace-pre-line text-muted-foreground select-text">
                          {typeof media.requirements.recommended === "string"
                            ? media.requirements.recommended
                                .replace(/<[^>]*>/g, "")
                                .trim()
                            : Object.entries(
                                media.requirements.recommended
                              ).map(([k, v]) => (
                                <div
                                  key={k}
                                  className="flex justify-between border-b border-border/10 py-0.5"
                                >
                                  <span className="font-medium capitalize">
                                    {k}:
                                  </span>
                                  <span className="text-end text-foreground">
                                    {String(v)}
                                  </span>
                                </div>
                              ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

          {/* Music: Audio Preview Player for Tracks */}
          {media.category === "music" && media.audioPreviewUrl && (
            <section
              aria-labelledby="preview-heading"
              className="flex flex-col gap-2"
            >
              <MusicPlayerPreview
                audioUrl={media.audioPreviewUrl}
                title={media.titlePrimary}
                artist={media.artist}
              />
            </section>
          )}

          {/* Music: From the Album Card for Tracks */}
          {media.category === "music" && media.album && media.albumId && (
            <section
              aria-labelledby="parent-album-heading"
              className="flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-2">
                <IconDisc className="size-4 text-primary" aria-hidden="true" />
                <h2
                  id="parent-album-heading"
                  className="text-base font-semibold text-foreground"
                >
                  From the Album
                </h2>
              </div>

              <Link
                href={`/IRIS-list/media/music/albums/${media.albumId}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-card p-3.5 shadow-xs transition-all hover:border-primary/40 hover:bg-accent/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative aspect-square size-14 shrink-0 overflow-hidden rounded-xl bg-muted shadow-2xs">
                    {media.coverImage ? (
                      <img
                        src={media.coverImage}
                        alt={media.album}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                        <IconPhotoOff className="size-5" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {media.album}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {media.artist && <span>{media.artist}</span>}
                      {typeof media.trackNumber === "number" && (
                        <>
                          <span>•</span>
                          <span>Track #{media.trackNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                  <span className="hidden sm:inline">View Album</span>
                  <IconArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </section>
          )}

          {/* Music: Album Tracklist Preview for Albums */}
          {media.category === "music" &&
            media.tracks &&
            media.tracks.length > 0 && (
              <section
                aria-labelledby="tracklist-heading"
                className="flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconDisc
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    <h2
                      id="tracklist-heading"
                      className="text-base font-semibold text-foreground"
                    >
                      Tracklist
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      ({media.tracks.length} tracks)
                    </span>
                  </div>
                  {media.tracks.length > 8 && onViewAllTracks && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onViewAllTracks}
                      className="h-7 gap-1 text-xs text-primary hover:text-primary/80"
                    >
                      <span>View all</span>
                      <IconArrowRight className="size-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>

                <MusicTracklist
                  tracks={media.tracks}
                  albumTitle={media.titlePrimary}
                  albumArtistPersonId={media.artistPersonId}
                  limit={8}
                  onViewAll={onViewAllTracks}
                />
              </section>
            )}

          {/* Music: Lyrics for Tracks */}
          {media.category === "music" &&
            (media.lyrics || media.syncedLyrics) && (
              <MusicLyrics
                lyrics={media.lyrics}
                syncedLyrics={media.syncedLyrics}
                title={media.titlePrimary}
                artist={media.artist}
              />
            )}

          {/* 2. Featured Characters (MAX 2 next to each other) */}
          {featuredCharacters.length > 0 && (
            <section aria-labelledby="characters-preview-heading">
              <div className="mb-3.5">
                <h2
                  id="characters-preview-heading"
                  className="text-base font-semibold text-foreground"
                >
                  {media.category === "movies" || media.format === "MOVIE"
                    ? "Characters & Cast"
                    : "Characters & Voice Actors"}
                </h2>
              </div>

              {/* Max 2 characters per row as requested */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {featuredCharacters.map((item) => {
                  const charName =
                    titlePref === "native" && item.nameNative
                      ? item.nameNative
                      : item.namePrimary
                  const actorName =
                    titlePref === "native" && item.actor?.nameNative
                      ? item.actor.nameNative
                      : item.actor?.namePrimary

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-border/40 bg-card p-2.5"
                    >
                      {/* Character Side */}
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Link
                          href={`/IRIS-list/media/characters/${item.characterId}`}
                          className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={charName}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                              <IconPhotoOff
                                className="size-4"
                                aria-hidden="true"
                              />
                            </div>
                          )}
                        </Link>

                        <div className="flex min-w-0 flex-col">
                          <Link
                            href={`/IRIS-list/media/characters/${item.characterId}`}
                            className="truncate text-xs font-medium text-foreground outline-none hover:underline focus-visible:underline"
                          >
                            {charName}
                          </Link>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            {item.role}
                          </span>
                        </div>
                      </div>

                      {/* Voice Actor Side */}
                      {item.actor && (
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 pl-2 text-end">
                          <div className="flex min-w-0 flex-col">
                            <Link
                              href={`/IRIS-list/media/people/${item.actor.id}`}
                              className="truncate text-xs font-medium text-foreground outline-none hover:underline focus-visible:underline"
                            >
                              {actorName}
                            </Link>
                            {item.actor.language && (
                              <span className="text-[10px] text-muted-foreground">
                                {item.actor.language}
                              </span>
                            )}
                          </div>

                          <Link
                            href={`/IRIS-list/media/people/${item.actor.id}`}
                            className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {item.actor.image ? (
                              <img
                                src={item.actor.image}
                                alt={actorName ?? "Actor"}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                                <IconPhotoOff
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* 3. Theme Songs */}
          {hasThemeSongs && (
            <section aria-labelledby="themes-heading">
              <div className="mb-3 flex items-center gap-2">
                <IconDisc className="size-4 text-primary" aria-hidden="true" />
                <h2
                  id="themes-heading"
                  className="text-base font-semibold text-foreground"
                >
                  Theme Songs
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {opSongs.length > 0 && (
                  <div className="rounded-2xl border border-border/40 bg-card p-4">
                    <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Opening Themes
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {opSongs.map((op, idx) => {
                        const text = typeof op === "string" ? op : op.text
                        return (
                          <li
                            key={idx}
                            className="flex gap-2 text-xs text-foreground/90"
                          >
                            <span className="font-semibold text-muted-foreground tabular-nums">
                              {idx + 1}.
                            </span>
                            <span className="break-words">{text}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {edSongs.length > 0 && (
                  <div className="rounded-2xl border border-border/40 bg-card p-4">
                    <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Ending Themes
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {edSongs.map((ed, idx) => {
                        const text = typeof ed === "string" ? ed : ed.text
                        return (
                          <li
                            key={idx}
                            className="flex gap-2 text-xs text-foreground/90"
                          >
                            <span className="font-semibold text-muted-foreground tabular-nums">
                              {idx + 1}.
                            </span>
                            <span className="break-words">{text}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 4. Relations split by targetType - side by side if <= 3 items to save space */}
          {relationsByType.length > 0 && (
            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
              {relationsByType.map(({ rawType, heading, items }) => {
                const isSmall = items.length <= 3

                return (
                  <section
                    key={rawType}
                    aria-labelledby={`relation-${rawType}`}
                    className={isSmall ? "col-span-1" : "col-span-full"}
                  >
                    <div className="mb-2.5 flex items-center gap-2">
                      <IconLink
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      <h2
                        id={`relation-${rawType}`}
                        className="text-base font-semibold text-foreground"
                      >
                        {heading}
                      </h2>
                    </div>

                    {/* Denser grid: 3-cols if side-by-side, 6-cols if full width */}
                    <div
                      className={
                        isSmall
                          ? "grid grid-cols-3 gap-2.5"
                          : "grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
                      }
                    >
                      {items.map((rel) => {
                        const targetTitle = rel.target
                          ? formatMediaTitle(rel.target, titlePref)
                          : `Media #${rel.targetId}`
                        const targetCover = rel.target?.coverImage ?? null
                        const targetFormat = rel.target?.format ?? null
                        const href = getMediaDetailHref(rel.targetType, rel.targetId)

                        return (
                          <Link
                            key={rel.id}
                            href={href}
                            className="group flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
                              {targetCover ? (
                                <img
                                  src={targetCover}
                                  alt={targetTitle}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                                  <IconPhotoOff
                                    className="size-6"
                                    aria-hidden="true"
                                  />
                                </div>
                              )}

                              {/* Inline Badges at the bottom of the cover image */}
                              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-1.5">
                                <Badge
                                  variant="secondary"
                                  className="h-3.5 px-1 py-0 text-[8px] leading-none font-bold tracking-wider uppercase backdrop-blur-xs"
                                >
                                  {rel.type.replace(/_/g, " ")}
                                </Badge>
                                {targetFormat && (
                                  <Badge
                                    variant="outline"
                                    className="h-3.5 bg-background/80 px-1 py-0 text-[8px] leading-none font-semibold uppercase backdrop-blur-xs"
                                  >
                                    {targetFormat}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-0.5 p-2">
                              <span className="line-clamp-2 text-[11px] leading-tight font-medium text-foreground group-hover:underline">
                                {targetTitle}
                              </span>
                              {rel.target?.seasonYear && (
                                <span className="text-[9px] text-muted-foreground">
                                  {rel.target.seasonYear}
                                </span>
                              )}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {/* 5. Similar Titles (Max 12 items, stretched to fill container, horizontally scrollable) */}
          {similarListMax12.length > 0 && (
            <section aria-labelledby="similar-heading">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconSparkles
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  <h2
                    id="similar-heading"
                    className="text-base font-semibold text-foreground"
                  >
                    Similar Titles
                  </h2>
                </div>
                {similarListMax12.length > 6 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7 rounded-lg"
                      onClick={() => scrollSimilar("left")}
                      aria-label="Scroll similar titles left"
                    >
                      <IconChevronLeft
                        className="size-3.5"
                        aria-hidden="true"
                      />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7 rounded-lg"
                      onClick={() => scrollSimilar("right")}
                      aria-label="Scroll similar titles right"
                    >
                      <IconChevronRight
                        className="size-3.5"
                        aria-hidden="true"
                      />
                    </Button>
                  </div>
                )}
              </div>

              {/* Single horizontal scrollable row with all similar titles - stretched and scrollbar hidden */}
              <div
                ref={similarScrollRef}
                className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth pt-1 pb-1"
              >
                {similarListMax12.map((item) => {
                  const itemTitle = formatMediaTitle(
                    {
                      titlePrimary: item.titlePrimary,
                      titleSecondary: item.titleSecondary,
                      titleNative: item.titleNative,
                    },
                    titlePref
                  )

                  return (
                    <Link
                      key={item.id}
                      href={`/IRIS-list/media/${media.category}/${item.id}`}
                      className="group flex w-[calc((100%-0.75rem)/2)] shrink-0 flex-col overflow-hidden rounded-xl border border-border/40 bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2.25rem)/4)] lg:w-[calc((100%-3.75rem)/6)]"
                    >
                      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
                        {item.coverImage ? (
                          <img
                            src={item.coverImage}
                            alt={itemTitle}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                            <IconPhotoOff
                              className="size-8"
                              aria-hidden="true"
                            />
                          </div>
                        )}

                        {/* Inline Badges at the bottom of the cover image like relations */}
                        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-1.5">
                          {item.type && (
                            <Badge
                              variant="secondary"
                              className="h-3.5 px-1 py-0 text-[8px] leading-none font-bold tracking-wider uppercase backdrop-blur-xs"
                            >
                              {item.type.replace(/_/g, " ")}
                            </Badge>
                          )}
                          {item.format && (
                            <Badge
                              variant="outline"
                              className="h-3.5 bg-background/80 px-1 py-0 text-[8px] leading-none font-semibold uppercase backdrop-blur-xs"
                            >
                              {item.format}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 p-2">
                        <span className="line-clamp-2 text-xs font-medium text-foreground group-hover:underline">
                          {itemTitle}
                        </span>
                        {item.year && (
                          <span className="text-[10px] text-muted-foreground">
                            {item.year}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Info Sidebar: NARROW & ALIGNED TO THE RIGHT */}
        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-card/60 p-4 text-xs">
            <h3 className="mb-1 border-b border-border/40 pb-2 text-sm font-semibold text-foreground">
              Information
            </h3>

            <div className="flex flex-col">
              {/* Format */}
              <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                <span className="shrink-0 text-muted-foreground">Format</span>
                <span className="text-end font-medium text-foreground uppercase">
                  {media.format ?? "Unknown"}
                </span>
              </div>

              {/* Source Material */}
              {media.source && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Source</span>
                  <span className="text-end font-medium text-foreground capitalize">
                    {media.source.replace(/_/g, " ").toLowerCase()}
                  </span>
                </div>
              )}

              {/* Status */}
              <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                <span className="shrink-0 text-muted-foreground">Status</span>
                <span className="text-end font-medium text-foreground capitalize">
                  {media.status?.replace(/_/g, " ").toLowerCase() ?? "Unknown"}
                </span>
              </div>

              {/* Next Airing Episode if status is Releasing */}
              {isReleasing && nextAiring && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    {nextAiring.isAiringNow ? "Broadcast" : "Next Episode"}
                  </span>
                  <div className="flex flex-col items-end text-end">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Ep {nextAiring.episodeNumber}{" "}
                      {nextAiring.isAiringNow && "• Airing Now"}
                    </span>
                    {!nextAiring.isAiringNow && nextAiring.date && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimeUntil(nextAiring.date)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Episode Count */}
              {typeof media.episodeCount === "number" &&
                media.episodeCount > 0 && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Episodes
                    </span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.episodeCount}
                    </span>
                  </div>
                )}

              {/* Episode Duration */}
              {typeof media.episodeDuration === "number" &&
                media.episodeDuration > 0 && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Duration
                    </span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.episodeDuration} min
                    </span>
                  </div>
                )}
              {typeof media.runtime === "number" && media.runtime > 0 && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Runtime
                  </span>
                  <span className="text-end font-medium text-foreground tabular-nums">
                    {media.runtime} min
                  </span>
                </div>
              )}

              {/* Aired / Released Dates */}
              {airedRange && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    {media.category === "movies" ||
                    media.category === "games" ||
                    media.category === "books"
                      ? "Release Date"
                      : "Aired"}
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {airedRange}
                  </span>
                </div>
              )}

              {/* Season */}
              {media.seasonYear && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Season</span>
                  <span className="text-end font-medium text-foreground capitalize">
                    {media.seasonSeason
                      ? `${media.seasonSeason.toLowerCase()} ${media.seasonYear}`
                      : media.seasonYear}
                  </span>
                </div>
              )}

              {/* Budget (Movies) */}
              {media.budget && formatCurrency(media.budget) && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Budget</span>
                  <span className="text-end font-medium text-foreground tabular-nums">
                    {formatCurrency(media.budget)}
                  </span>
                </div>
              )}

              {/* Box Office / Revenue (Movies) */}
              {media.revenue && formatCurrency(media.revenue) && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Box Office
                  </span>
                  <span className="text-end font-medium text-foreground tabular-nums">
                    {formatCurrency(media.revenue)}
                  </span>
                </div>
              )}

              {/* Animation Studio (Anime) / Production (Movies) */}
              {media.category === "movies" ? (
                (animationStudios.length > 0 || producerStudios.length > 0) && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Production
                    </span>
                    <span className="text-end font-medium text-foreground">
                      {[...animationStudios, ...producerStudios].join(", ")}
                    </span>
                  </div>
                )
              ) : (
                <>
                  {animationStudios.length > 0 && (
                    <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                      <span className="shrink-0 text-muted-foreground">
                        Studio
                      </span>
                      <span className="text-end font-medium text-foreground">
                        {animationStudios.join(", ")}
                      </span>
                    </div>
                  )}

                  {producerStudios.length > 0 && (
                    <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                      <span className="shrink-0 text-muted-foreground">
                        Producers
                      </span>
                      <span className="text-end font-medium text-foreground">
                        {producerStudios.join(", ")}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Original Language */}
              {media.originalLanguage &&
                formatLanguage(media.originalLanguage) && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Language
                    </span>
                    <span className="text-end font-medium text-foreground">
                      {formatLanguage(media.originalLanguage)}
                    </span>
                  </div>
                )}

              {/* Country of Origin */}
              {media.countryOfOrigin && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Country
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {formatCountry(media.countryOfOrigin)}
                  </span>
                </div>
              )}

              {/* Game: Platforms */}
              {media.platforms && media.platforms.length > 0 && (
                <div className="flex flex-col gap-1 border-b border-border/20 py-1.5 text-xs">
                  <span className="text-muted-foreground">Platforms</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {media.platforms.map((plat, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-[10px]"
                      >
                        {plat}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Game: Developers */}
              {media.developers && media.developers.length > 0 && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Developers
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {media.developers.join(", ")}
                  </span>
                </div>
              )}

              {/* Game/Book: Publishers */}
              {media.publishers && media.publishers.length > 0 && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Publishers
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {media.publishers.join(", ")}
                  </span>
                </div>
              )}

              {/* Game: Franchise */}
              {media.franchise && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Franchise
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {media.franchise}
                  </span>
                </div>
              )}

              {/* Game: Game Modes */}
              {media.gameModes && media.gameModes.length > 0 && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Modes</span>
                  <span className="text-end font-medium text-foreground">
                    {media.gameModes.join(", ")}
                  </span>
                </div>
              )}

              {/* Game: Perspectives */}
              {media.playerPerspectives &&
                media.playerPerspectives.length > 0 && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Perspectives
                    </span>
                    <span className="text-end font-medium text-foreground">
                      {media.playerPerspectives.join(", ")}
                    </span>
                  </div>
                )}

              {/* Game: Steam Deck */}
              {media.steamDeckStatus && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Steam Deck
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold"
                  >
                    {media.steamDeckStatus}
                  </Badge>
                </div>
              )}

              {/* Music: Artist */}
              {media.artist && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Artist</span>
                  {media.artistPersonId ? (
                    <Link
                      href={`/IRIS-list/media/people/${media.artistPersonId}`}
                      className="text-end font-medium text-primary transition-colors hover:underline"
                    >
                      {media.artist}
                    </Link>
                  ) : (
                    <span className="text-end font-medium text-foreground">
                      {media.artist}
                    </span>
                  )}
                </div>
              )}

              {/* Music: Album (for Tracks) */}
              {media.album && media.albumId && media.format === "TRACK" && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Album</span>
                  <Link
                    href={`/IRIS-list/media/music/albums/${media.albumId}`}
                    className="text-end font-medium text-primary hover:underline"
                  >
                    {media.album}
                  </Link>
                </div>
              )}

              {/* Music: Track & Disc Number (for Tracks) */}
              {typeof media.trackNumber === "number" && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Track</span>
                  <span className="text-end font-medium text-foreground tabular-nums">
                    #{media.trackNumber}
                    {typeof media.discNumber === "number" &&
                    media.discNumber > 1
                      ? ` (Disc ${media.discNumber})`
                      : ""}
                  </span>
                </div>
              )}

              {/* Music: Total Tracks (for Albums) */}
              {typeof media.totalTracks === "number" &&
                media.totalTracks > 0 && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Tracks
                    </span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.totalTracks}
                    </span>
                  </div>
                )}

              {/* Music: Duration */}
              {typeof media.duration === "number" && media.duration > 0 && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Duration
                  </span>
                  <span className="text-end font-mono font-medium text-foreground tabular-nums">
                    {media.duration >= 3600
                      ? `${Math.floor(media.duration / 3600)}h ${Math.floor((media.duration % 3600) / 60)}m`
                      : `${Math.floor(media.duration / 60)}m ${media.duration % 60}s`}
                  </span>
                </div>
              )}

              {/* Music: ISRC (for Tracks) */}
              {media.isrc && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">ISRC</span>
                  <span className="text-end font-mono text-[11px] text-foreground">
                    {media.isrc}
                  </span>
                </div>
              )}

              {/* Music: Local Listeners */}
              {typeof media.listeners === "number" &&
                media.category === "music" && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Listeners
                    </span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.listeners.toLocaleString()}
                    </span>
                  </div>
                )}

              {/* Music: Local Scrobbles */}
              {typeof media.playCount === "number" &&
                media.category === "music" && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Scrobbles
                    </span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.playCount.toLocaleString()}
                    </span>
                  </div>
                )}

              {/* Status */}
              {media.status && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Status</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold capitalize"
                  >
                    {media.status.toLowerCase().replace(/_/g, " ")}
                  </Badge>
                </div>
              )}

              {/* Show Type (TV) */}
              {media.showType && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Type</span>
                  <span className="text-end font-medium text-foreground capitalize">
                    {media.showType}
                  </span>
                </div>
              )}

              {/* Seasons Count (TV) */}
              {typeof media.seasonCount === "number" &&
                media.seasonCount > 0 && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Seasons
                    </span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.seasonCount}
                    </span>
                  </div>
                )}

              {/* Episodes Count (Anime/TV) */}
              {typeof media.episodeCount === "number" &&
                media.episodeCount > 0 && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Episodes
                    </span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.episodeCount}
                    </span>
                  </div>
                )}

              {/* Episode Duration (Anime/TV) */}
              {typeof media.episodeDuration === "number" &&
                media.episodeDuration > 0 && (
                  <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Duration
                    </span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.episodeDuration}m
                    </span>
                  </div>
                )}

              {/* Broadcast Schedule (TV) */}
              {((media.broadcastDays && media.broadcastDays.length > 0) ||
                media.broadcastTime) && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Broadcast
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {[
                      media.broadcastDays?.join(", "),
                      media.broadcastTime ? `at ${media.broadcastTime}` : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </span>
                </div>
              )}

              {/* TV Networks */}
              {media.networks && media.networks.length > 0 && (
                <div className="flex flex-col gap-1 border-b border-border/20 py-1.5 text-xs">
                  <span className="text-muted-foreground">Networks</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {media.networks.map((net, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-[10px] font-medium"
                      >
                        {net}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* TV: First Aired / Last Aired */}
              {media.firstAiredYear && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    First Aired
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {formatFullDate(
                      media.firstAiredYear,
                      media.firstAiredMonth,
                      media.firstAiredDay
                    )}
                  </span>
                </div>
              )}
              {media.lastAiredYear && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Last Aired
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {formatFullDate(
                      media.lastAiredYear,
                      media.lastAiredMonth,
                      media.lastAiredDay
                    )}
                  </span>
                </div>
              )}

              {/* Game: Controller Support */}
              {media.controllerSupport && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Controller
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {media.controllerSupport}
                  </span>
                </div>
              )}

              {/* Book: Authors */}
              {media.authors && media.authors.length > 0 && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Authors
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {media.authors.join(", ")}
                  </span>
                </div>
              )}

              {/* Book: Series */}
              {media.series && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Series</span>
                  <span className="text-end font-medium text-foreground">
                    {media.series}
                    {typeof media.seriesPosition === "number"
                      ? ` #${media.seriesPosition}`
                      : ""}
                  </span>
                </div>
              )}

              {/* Book: Page Count */}
              {typeof media.pageCount === "number" && media.pageCount > 0 && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Pages</span>
                  <span className="text-end font-medium text-foreground tabular-nums">
                    {media.pageCount.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Book: Retail Price */}
              {typeof media.retailPrice === "number" && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Price</span>
                  <span className="text-end font-medium text-foreground tabular-nums">
                    {media.retailPriceCurrency
                      ? `${media.retailPriceCurrency} `
                      : "$"}
                    {media.retailPrice.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Book: Subjects */}
              {media.subjects && media.subjects.length > 0 && (
                <div className="flex flex-col gap-1 border-b border-border/20 py-1.5 text-xs">
                  <span className="text-muted-foreground">Subjects</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {media.subjects.slice(0, 5).map((subj, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-[10px]"
                      >
                        {subj}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Age Rating & Guide */}
              {(media.ageRating || media.ageRatingGuide) && (
                <div className="flex flex-col gap-0.5 border-b border-border/20 py-1.5 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground">
                      Rating
                    </span>
                    <span className="text-end font-medium text-foreground">
                      {media.ageRating
                        ? media.ageRating.toUpperCase().replace(/_/g, "-")
                        : "Not Rated"}
                    </span>
                  </div>
                  {media.ageRatingGuide && (
                    <span className="text-end text-[10px] leading-tight text-muted-foreground">
                      {media.ageRatingGuide}
                    </span>
                  )}
                </div>
              )}

              {/* Official Hashtag */}
              {media.hashtag && (
                <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Hashtag
                  </span>
                  <div className="flex flex-wrap justify-end gap-1 text-end">
                    {media.hashtag
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((tag, idx) => {
                        const cleanTag = tag.replace(/^#/, "")
                        return (
                          <a
                            key={idx}
                            href={`https://twitter.com/hashtag/${cleanTag}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary hover:underline"
                          >
                            #{cleanTag}
                          </a>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Genres */}
              {media.genres && media.genres.length > 0 && (
                <div className="flex flex-col gap-1.5 border-b border-border/20 py-1.5 text-xs">
                  <span className="text-muted-foreground">Genres</span>
                  <div className="flex flex-wrap gap-1">
                    {media.genres.map((genre) => (
                      <Badge
                        key={genre.id}
                        variant="secondary"
                        className="text-[11px] font-medium"
                      >
                        {genre.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {media.tags && media.tags.length > 0 && (
                <div className="flex flex-col gap-1.5 border-b border-border/20 py-1.5 text-xs">
                  <span className="text-muted-foreground">Tags</span>
                  <div className="flex flex-wrap gap-1">
                    {media.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        title={tag.description ?? undefined}
                        className="text-[10px] font-normal text-muted-foreground hover:text-foreground"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Community metrics */}
              <div className="flex items-start justify-between gap-3 border-b border-border/20 py-1.5 text-xs">
                <span className="shrink-0 text-muted-foreground">
                  Favorites
                </span>
                <span className="text-end font-medium text-foreground tabular-nums">
                  {typeof media.favorites === "number"
                    ? media.favorites.toLocaleString()
                    : "0"}
                </span>
              </div>
              {typeof media.popularity === "number" && media.popularity > 0 && (
                <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Popularity
                  </span>
                  <span className="text-end font-medium text-foreground tabular-nums">
                    #{media.popularity}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Synonyms / Alternative Titles */}
          {media.synonyms && media.synonyms.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-card/60 p-3.5 text-xs">
              <h4 className="text-[11px] font-semibold tracking-wider text-foreground text-muted-foreground uppercase">
                Alternative Titles
              </h4>
              <ul className="flex flex-col gap-1 text-end">
                {media.synonyms.map((syn, idx) => (
                  <li
                    key={idx}
                    className="text-[11px] break-words text-foreground/80"
                  >
                    {syn}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* External Links */}
          {((media.externalLinks && media.externalLinks.length > 0) ||
            media.siteUrl ||
            media.buyLink ||
            media.previewLink ||
            media.infoLink) && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-card/60 p-3.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-foreground text-muted-foreground uppercase">
                <span>External Links</span>
                <IconWorld className="size-3.5" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap justify-end gap-1.5 pt-1">
                {/* Music streaming links */}
                {media.lastFmUrl && (
                  <a
                    href={media.lastFmUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#D51007]/10 px-2 py-1 text-[11px] font-medium text-[#D51007] hover:bg-[#D51007]/20"
                  >
                    <span>Last.fm</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )}
                {media.spotifyId && (
                  <a
                    href={`https://open.spotify.com/${media.format === "TRACK" ? "track" : "album"}/${media.spotifyId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#1DB954]/10 px-2 py-1 text-[11px] font-medium text-[#1DB954] hover:bg-[#1DB954]/20"
                  >
                    <span>Spotify</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )}
                {media.appleMusicId && (
                  <a
                    href={`https://music.apple.com/song/${media.appleMusicId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#FA243C]/10 px-2 py-1 text-[11px] font-medium text-[#FA243C] hover:bg-[#FA243C]/20"
                  >
                    <span>Apple Music</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )}
                {media.youtubeMusicId && (
                  <a
                    href={`https://music.youtube.com/watch?v=${media.youtubeMusicId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#FF0000]/10 px-2 py-1 text-[11px] font-medium text-[#FF0000] hover:bg-[#FF0000]/20"
                  >
                    <span>YouTube Music</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )}
                {media.musicBrainzId && (
                  <a
                    href={`https://musicbrainz.org/${media.format === "TRACK" ? "recording" : "release-group"}/${media.musicBrainzId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#BA478F]/10 px-2 py-1 text-[11px] font-medium text-[#BA478F] hover:bg-[#BA478F]/20"
                  >
                    <span>MusicBrainz</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )}
                {media.siteUrl && (
                  <a
                    href={media.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/80"
                  >
                    <span>Official Site</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )}
                {media.buyLink && (
                  <a
                    href={media.buyLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
                  >
                    <span>Buy</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )}
                {media.previewLink && (
                  <a
                    href={media.previewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/80"
                  >
                    <span>Preview</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )}
                {media.infoLink && (
                  <a
                    href={media.infoLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/80"
                  >
                    <span>Info</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )}
                {media.externalLinks?.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/80"
                  >
                    <span>{link.site || link.type || "Link"}</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Provider IDs: Direct clickable links */}
          {(media.anilistId ||
            media.malId ||
            media.aniDBId ||
            media.tvDBId ||
            media.bangumiId ||
            media.kitsuId ||
            media.tmdbId ||
            media.imdbId ||
            media.simklId ||
            media.igdbId ||
            media.steamAppId ||
            media.rawgId ||
            media.giantbombId ||
            media.vndbId ||
            media.googleBookId ||
            media.isbn10 ||
            media.isbn13 ||
            media.openLibraryId) && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-card/60 p-3.5 text-xs">
              <h4 className="text-[11px] font-semibold tracking-wider text-foreground text-muted-foreground uppercase">
                IDs
              </h4>
              <div className="flex flex-col gap-1 text-xs">
                {/* Games IDs */}
                {media.igdbId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">IGDB</span>
                    <a
                      href={`https://www.igdb.com/games/${media.igdbId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.igdbId}
                    </a>
                  </div>
                )}
                {media.steamAppId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">Steam</span>
                    <a
                      href={`https://store.steampowered.com/app/${media.steamAppId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.steamAppId}
                    </a>
                  </div>
                )}
                {media.rawgId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">RAWG</span>
                    <a
                      href={`https://rawg.io/games/${media.rawgId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.rawgId}
                    </a>
                  </div>
                )}
                {media.giantbombId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">Giant Bomb</span>
                    <span className="text-end font-medium text-foreground">
                      {media.giantbombId}
                    </span>
                  </div>
                )}
                {media.vndbId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">VNDB</span>
                    <a
                      href={`https://vndb.org/v${media.vndbId.replace(/^v/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      {media.vndbId}
                    </a>
                  </div>
                )}

                {/* TV IDs */}
                {media.tvmazeId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">TVmaze</span>
                    <a
                      href={`https://www.tvmaze.com/shows/${media.tvmazeId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.tvmazeId}
                    </a>
                  </div>
                )}

                {/* Books IDs */}
                {media.googleBookId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">Google Books</span>
                    <a
                      href={`https://books.google.com/books?id=${media.googleBookId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      {media.googleBookId}
                    </a>
                  </div>
                )}
                {media.isbn13 && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">ISBN-13</span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.isbn13}
                    </span>
                  </div>
                )}
                {media.isbn10 && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">ISBN-10</span>
                    <span className="text-end font-medium text-foreground tabular-nums">
                      {media.isbn10}
                    </span>
                  </div>
                )}
                {media.openLibraryId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">Open Library</span>
                    <a
                      href={`https://openlibrary.org/books/${media.openLibraryId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      {media.openLibraryId}
                    </a>
                  </div>
                )}
                {media.imdbId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">IMDb</span>
                    <a
                      href={`https://www.imdb.com/title/${media.imdbId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      {media.imdbId}
                    </a>
                  </div>
                )}
                {media.tmdbId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">TMDB</span>
                    <a
                      href={
                        media.category === "movies"
                          ? `https://www.themoviedb.org/movie/${media.tmdbId}`
                          : `https://www.themoviedb.org/tv/${media.tmdbId}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.tmdbId}
                    </a>
                  </div>
                )}
                {media.tvDBId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">TheTVDB</span>
                    <a
                      href={
                        media.category === "movies"
                          ? `https://thetvdb.com/dereferrer/movie/${media.tvDBId}`
                          : `https://thetvdb.com/dereferrer/series/${media.tvDBId}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.tvDBId}
                    </a>
                  </div>
                )}
                {media.simklId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">Simkl</span>
                    <a
                      href={
                        media.category === "movies"
                          ? `https://simkl.com/movies/${media.simklId}`
                          : `https://simkl.com/anime/${media.simklId}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.simklId}
                    </a>
                  </div>
                )}
                {media.anilistId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">AniList</span>
                    <a
                      href={`https://anilist.co/anime/${media.anilistId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.anilistId}
                    </a>
                  </div>
                )}
                {media.malId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">MyAnimeList</span>
                    <a
                      href={`https://myanimelist.net/anime/${media.malId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.malId}
                    </a>
                  </div>
                )}
                {media.aniDBId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">AniDB</span>
                    <a
                      href={`https://anidb.net/anime/${media.aniDBId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.aniDBId}
                    </a>
                  </div>
                )}
                {media.bangumiId && (
                  <div className="flex items-center justify-between border-b border-border/20 py-1">
                    <span className="text-muted-foreground">Bangumi</span>
                    <a
                      href={`https://bgm.tv/subject/${media.bangumiId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.bangumiId}
                    </a>
                  </div>
                )}
                {media.kitsuId && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Kitsu</span>
                    <a
                      href={`https://kitsu.io/anime/${media.kitsuId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-end font-medium text-primary hover:underline"
                    >
                      #{media.kitsuId}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
