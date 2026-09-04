"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import {
  IconCalendar,
  IconClock,
  IconEye,
  IconEyeOff,
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
import type { CharacterDetails } from "@IRIS/elysia"
import { FormattedDescription } from "@/components/media/formatted-description"
import { FavoriteButton } from "../favorite-button"

interface CharacterDetailViewProps {
  character: CharacterDetails
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

export function CharacterDetailView({ character }: CharacterDetailViewProps) {
  const [showSpoilers, setShowSpoilers] = useState(false)
  const [selectedMediaType, setSelectedMediaType] =
    useState<MediaFilterKey>("ALL")
  const [isBioExpanded, setIsBioExpanded] = useState(false)

  // Format Birthday
  const formattedBirthday = useMemo(() => {
    if (!character.dateOfBirthMonth && !character.dateOfBirthDay) return null
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]
    const monthName = character.dateOfBirthMonth
      ? months[character.dateOfBirthMonth - 1]
      : ""
    const day = character.dateOfBirthDay ? `${character.dateOfBirthDay}` : ""
    const year = character.dateOfBirthYear
      ? `, ${character.dateOfBirthYear}`
      : ""
    return [monthName, day].filter(Boolean).join(" ") + year
  }, [
    character.dateOfBirthMonth,
    character.dateOfBirthDay,
    character.dateOfBirthYear,
  ])

  // Extract unique voice actors / actors across all media appearances
  const uniqueActors = useMemo(() => {
    const actorMap = new Map<
      number,
      {
        id: number
        namePrimary: string
        nameNative: string | null
        image: string | null
        language: string | null
        rolesCount: number
      }
    >()

    character.mediaCharacters.forEach((mc) => {
      if (mc.actor) {
        const existing = actorMap.get(mc.actor.id)
        if (existing) {
          existing.rolesCount += 1
        } else {
          actorMap.set(mc.actor.id, {
            id: mc.actor.id,
            namePrimary: mc.actor.namePrimary,
            nameNative: mc.actor.nameNative,
            image: mc.actor.image,
            language: mc.actor.language,
            rolesCount: 1,
          })
        }
      }
    })

    // Sort: Japanese first, then English, then others
    return Array.from(actorMap.values()).sort((a, b) => {
      if (a.language === "Japanese") return -1
      if (b.language === "Japanese") return 1
      if (a.language === "English") return -1
      if (b.language === "English") return 1
      return a.namePrimary.localeCompare(b.namePrimary)
    })
  }, [character.mediaCharacters])

  // Deduplicate media appearances by mediaType + mediaId
  const deduplicatedMedia = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        mediaType: "ANIME" | "MANGA" | "MOVIE" | "TV" | "BOOK"
        mediaId: number
        role: string
        order: number | null
        titlePrimary: string
        titleSecondary?: string | null
        titleNative?: string | null
        coverImage?: string | null
        year?: number | null
        score?: number | null
        format?: string | null
        actors: Array<{
          id: number
          namePrimary: string
          nameNative: string | null
          image: string | null
          language: string | null
        }>
        primaryActor: {
          id: number
          namePrimary: string
          nameNative: string | null
          image: string | null
          language: string | null
        } | null
      }
    >()

    character.mediaCharacters.forEach((mc) => {
      const type = mc.mediaType.toUpperCase() as
        "ANIME" | "MANGA" | "MOVIE" | "TV" | "BOOK"
      const key = `${type}-${mc.mediaId}`

      let existing = map.get(key)
      if (!existing) {
        const mediaObj = mc.anime || mc.manga || mc.movie || mc.tv || mc.book
        const mediaTitle =
          mediaObj?.titlePrimary || `${mc.mediaType} #${mc.mediaId}`
        const mediaNative = (mediaObj as any)?.titleNative
        const mediaSecondary = mediaObj?.titleSecondary
        const mediaImage = mediaObj?.coverImage
        const mediaYear =
          mc.anime?.startDateYear ||
          mc.manga?.startDateYear ||
          mc.movie?.releaseDateYear ||
          mc.tv?.firstAiredYear ||
          mc.book?.releaseDateYear
        const mediaScore = mediaObj?.averageScore
        const mediaFormat =
          mc.anime?.format ||
          mc.manga?.format ||
          (mc.tv ? mc.tv.showType || "TV" : null) ||
          mc.book?.format ||
          (mc.movie ? "MOVIE" : null)

        existing = {
          key,
          mediaType: type,
          mediaId: mc.mediaId,
          role: mc.role,
          order: mc.order,
          titlePrimary: mediaTitle,
          titleSecondary: mediaSecondary,
          titleNative: mediaNative,
          coverImage: mediaImage,
          year: mediaYear,
          score: mediaScore,
          format: mediaFormat,
          actors: [],
          primaryActor: null,
        }
        map.set(key, existing)
      }

      if (mc.actor && !existing.actors.some((a) => a.id === mc.actor!.id)) {
        existing.actors.push({
          id: mc.actor.id,
          namePrimary: mc.actor.namePrimary,
          nameNative: mc.actor.nameNative,
          image: mc.actor.image,
          language: mc.actor.language,
        })
      }
    })

    // Resolve primary actor for each media (Japanese first, English second)
    for (const item of map.values()) {
      item.actors.sort((a, b) => {
        if (a.language === "Japanese") return -1
        if (b.language === "Japanese") return 1
        if (a.language === "English") return -1
        if (b.language === "English") return 1
        return a.namePrimary.localeCompare(b.namePrimary)
      })
      item.primaryActor = item.actors[0] || null
    }

    return Array.from(map.values())
  }, [character.mediaCharacters])

  // Group deduplicated media appearances by type
  const mediaByType = useMemo(() => {
    const anime = deduplicatedMedia.filter((m) => m.mediaType === "ANIME")
    const manga = deduplicatedMedia.filter((m) => m.mediaType === "MANGA")
    const movies = deduplicatedMedia.filter((m) => m.mediaType === "MOVIE")
    const tv = deduplicatedMedia.filter((m) => m.mediaType === "TV")
    const books = deduplicatedMedia.filter((m) => m.mediaType === "BOOK")

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
  }, [deduplicatedMedia])

  // Counts by media type based on deduplicated items
  const mediaCounts = useMemo(() => {
    const counts: Record<MediaFilterKey, number> = {
      ALL: deduplicatedMedia.length,
      ANIME: 0,
      MANGA: 0,
      MOVIE: 0,
      TV: 0,
      BOOK: 0,
    }
    deduplicatedMedia.forEach((m) => {
      counts[m.mediaType] += 1
    })
    return counts
  }, [deduplicatedMedia])

  // Groups to display based on selected filter
  const visibleGroups = useMemo(() => {
    if (selectedMediaType === "ALL") {
      return mediaByType
    }
    return mediaByType.filter((g) => g.type === selectedMediaType)
  }, [mediaByType, selectedMediaType])

  return (
    <div className="flex flex-col gap-6 pb-12 sm:gap-8">
      {/* 1. Character Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/60 p-5 shadow-xs sm:p-7">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:gap-7">
          {/* Portrait Image */}
          <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-2xl border border-border/40 bg-muted shadow-sm sm:w-36 md:w-44">
            {character.image ? (
              <img
                src={character.image}
                alt={character.namePrimary}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                <IconPhotoOff className="size-8" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Names, Badges, and Actions */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              {typeof character.favorites === "number" &&
                character.favorites > 0 && (
                  <Badge
                    variant="secondary"
                    className="gap-1 text-[11px] font-semibold text-rose-500"
                  >
                    <IconHeart
                      className="size-3 fill-current"
                      aria-hidden="true"
                    />
                    <span>{character.favorites.toLocaleString()}</span>
                  </Badge>
                )}
              <FavoriteButton
                targetId={character.id}
                type="CHARACTER"
                title={character.namePrimary}
                size="sm"
                variant="secondary"
                showLabel
              />
            </div>

            {/* Primary Name */}
            <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-3xl lg:text-4xl">
              {character.namePrimary}
            </h1>

            {/* Native Name */}
            {character.nameNative && (
              <p className="font-japanese text-sm text-muted-foreground sm:text-base">
                {character.nameNative}
              </p>
            )}

            {/* Quick Profile Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-xs text-muted-foreground">
              {character.gender && (
                <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 font-medium text-foreground">
                  {character.gender}
                </span>
              )}
              {character.age && (
                <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 font-medium text-foreground">
                  Age {character.age}
                </span>
              )}
              {formattedBirthday && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 font-medium text-foreground">
                  <IconCalendar
                    className="size-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>{formattedBirthday}</span>
                </span>
              )}
              {deduplicatedMedia.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 font-medium text-foreground">
                  <IconMovie
                    className="size-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>{deduplicatedMedia.length} Appearances</span>
                </span>
              )}
            </div>

            {/* Alternative Names (Aliases) */}
            {character.nameAlternative &&
              character.nameAlternative.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-1.5">
                  <span className="mr-1 text-[11px] font-medium text-muted-foreground">
                    Aliases:
                  </span>
                  {character.nameAlternative.map((alias, idx) => (
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

            {/* Spoiler Aliases */}
            {character.nameAlternativeSpoiler &&
              character.nameAlternativeSpoiler.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSpoilers((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-amber-500 transition-colors hover:bg-amber-500/10"
                  >
                    {showSpoilers ? (
                      <IconEyeOff className="size-3" aria-hidden="true" />
                    ) : (
                      <IconEye className="size-3" aria-hidden="true" />
                    )}
                    <span>
                      {showSpoilers
                        ? "Hide Spoilers"
                        : `Show Spoilers (${character.nameAlternativeSpoiler.length})`}
                    </span>
                  </button>
                  {showSpoilers &&
                    character.nameAlternativeSpoiler.map((spoiler, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="border-amber-500/40 text-[10px] font-normal text-amber-600 dark:text-amber-400"
                      >
                        {spoiler}
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
              Character Information
            </h3>

            <div className="flex flex-col divide-y divide-border/20">
              {character.nameNative && (
                <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Native Name
                  </span>
                  <span className="font-japanese text-end font-medium text-foreground">
                    {character.nameNative}
                  </span>
                </div>
              )}

              {character.gender && (
                <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Gender</span>
                  <span className="text-end font-medium text-foreground">
                    {character.gender}
                  </span>
                </div>
              )}

              {character.age && (
                <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">Age</span>
                  <span className="text-end font-medium text-foreground">
                    {character.age}
                  </span>
                </div>
              )}

              {formattedBirthday && (
                <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Birthday
                  </span>
                  <span className="text-end font-medium text-foreground">
                    {formattedBirthday}
                  </span>
                </div>
              )}

              {typeof character.favorites === "number" && (
                <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    Favorites
                  </span>
                  <span className="text-end font-medium text-foreground tabular-nums">
                    {character.favorites.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Aliases List in sidebar */}
              {character.nameAlternative &&
                character.nameAlternative.length > 0 && (
                  <div className="flex flex-col gap-1 py-1.5 text-xs">
                    <span className="text-muted-foreground">
                      Alternative Names
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {character.nameAlternative.map((alt, idx) => (
                        <span
                          key={idx}
                          className="text-end text-[11px] break-words text-foreground"
                        >
                          {alt}
                          {idx < character.nameAlternative.length - 1
                            ? ","
                            : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Provider IDs Card */}
          {(character.anilistId ||
            character.malId ||
            character.aniDBId ||
            character.tvDBId ||
            character.bangumiId) && (
            <div className="flex flex-col gap-2.5 rounded-2xl border border-border/40 bg-card/60 p-4 text-xs shadow-xs">
              <h3 className="text-[11px] font-semibold tracking-wider text-foreground text-muted-foreground uppercase">
                External IDs
              </h3>
              <div className="flex flex-col divide-y divide-border/20">
                {character.anilistId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">AniList</span>
                    <a
                      href={`https://anilist.co/character/${character.anilistId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{character.anilistId}
                    </a>
                  </div>
                )}
                {character.malId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">MyAnimeList</span>
                    <a
                      href={`https://myanimelist.net/character/${character.malId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{character.malId}
                    </a>
                  </div>
                )}
                {character.aniDBId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">AniDB</span>
                    <a
                      href={`https://anidb.net/character/${character.aniDBId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{character.aniDBId}
                    </a>
                  </div>
                )}
                {character.tvDBId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">TheTVDB</span>
                    <a
                      href={`https://thetvdb.com/dereferrer/people/${character.tvDBId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{character.tvDBId}
                    </a>
                  </div>
                )}
                {character.bangumiId && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-muted-foreground">Bangumi</span>
                    <a
                      href={`https://bgm.tv/character/${character.bangumiId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      #{character.bangumiId}
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
                  {new Date(character.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Updated</span>
                <span className="text-muted-foreground tabular-nums">
                  {new Date(character.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: Biography, Voice Actors & Media Appearances (3 cols) */}
        <div className="order-1 flex flex-col gap-6 lg:order-2 lg:col-span-3">
          {/* 1. Biography Card */}
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
              text={character.description}
              fallbackText="No biography available for this character."
            />
          </section>

          {/* 2. Voice Actors / Actors Section */}
          {uniqueActors.length > 0 && (
            <section
              aria-labelledby="actors-heading"
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <IconMicrophone
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                <h2
                  id="actors-heading"
                  className="text-base font-semibold text-foreground"
                >
                  Voice Actors & Cast ({uniqueActors.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {uniqueActors.map((actor) => (
                  <Link
                    key={actor.id}
                    href={`/IRIS-list/media/people/${actor.id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-card/60 p-2.5 transition-colors outline-none hover:border-border/60 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {actor.image ? (
                        <img
                          src={actor.image}
                          alt={actor.namePrimary}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                          <IconUser className="size-5" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
                        {actor.namePrimary}
                      </span>
                      {actor.nameNative && (
                        <span className="font-japanese truncate text-[10px] text-muted-foreground">
                          {actor.nameNative}
                        </span>
                      )}
                      {actor.language && (
                        <Badge
                          variant="secondary"
                          className="mt-0.5 w-fit px-1.5 py-0 text-[9px]"
                        >
                          {actor.language}
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 3. Media Appearances Section with Category Tabs */}
          <section
            aria-labelledby="appearances-heading"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <IconMovie className="size-4 text-primary" aria-hidden="true" />
                <h2
                  id="appearances-heading"
                  className="text-base font-semibold text-foreground"
                >
                  Media Appearances ({deduplicatedMedia.length})
                </h2>
              </div>

              {/* Media Type Filter Pills */}
              <div className="flex flex-wrap items-center gap-1">
                {(
                  ["ALL", "ANIME", "MANGA", "MOVIE", "TV", "BOOK"] as const
                ).map((type) => {
                  const count = mediaCounts[type]
                  if (type !== "ALL" && count === 0) return null
                  const isSelected = selectedMediaType === type
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
                      onClick={() => setSelectedMediaType(type)}
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

            {/* Render Groups Separated by Type */}
            {visibleGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                No media appearances found in this category.
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {visibleGroups.map((group) => (
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

                    {/* Cards Grid */}
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
                            className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card/60 p-2.5 transition-colors hover:border-border/60"
                          >
                            {/* Media Link & Details */}
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <Link
                                href={mediaHref}
                                className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {item.coverImage ? (
                                  <img
                                    src={item.coverImage}
                                    alt={item.titlePrimary}
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
                                  {item.titlePrimary}
                                </Link>

                                {item.titleNative &&
                                  item.titleNative !== item.titlePrimary && (
                                    <span className="font-japanese truncate text-[10px] text-muted-foreground opacity-75">
                                      {item.titleNative}
                                    </span>
                                  )}

                                <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                                  <Badge
                                    variant="outline"
                                    className="px-1.5 py-0 text-[9px] font-semibold uppercase"
                                  >
                                    {item.role}
                                  </Badge>
                                  <span>
                                    {formatMediaFormat(
                                      item.format,
                                      item.mediaType
                                    )}
                                  </span>
                                  {item.year && <span>• {item.year}</span>}
                                  {typeof item.score === "number" &&
                                    item.score > 0 && (
                                      <span className="font-medium text-amber-500 tabular-nums">
                                        • {item.score}%
                                      </span>
                                    )}
                                </div>
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
        </div>
      </div>
    </div>
  )
}
