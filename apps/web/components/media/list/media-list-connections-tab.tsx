"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import {
  IconLink,
  IconCheck,
  IconExternalLink,
  IconSearch,
  IconChevronUp,
  IconChevronDown,
  IconX,
  IconMinus,
  IconPlus,
  IconLoader2,
  IconAlertCircle,
  IconCalendar,
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconFlame,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import {
  ModalOverlay as AriaModalOverlay,
  Modal as AriaModal,
  Dialog as AriaDialog,
  Heading as AriaHeading,
} from "react-aria-components"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { DatePicker } from "./date-picker"
import type { NormalizedMediaData } from "../media-types"
import { type CanonicalMediaCategory, formatDateToYmd } from "./types"

export interface ConnectionItem {
  id: string | number
  title?: string | null
  cover?: string | null
  coverImage?: string | null
  year?: number | null
  format?: string | null
  externalUrl?: string | null
  overrideStatus?: boolean
  status?: string | null
  overrideProgress?: boolean
  progress?: number | null
  overrideDates?: boolean
  startedAt?: string | null
  completedAt?: string | null
  extra?: any
}

export interface MediaListConnectionsTabProps {
  media: NormalizedMediaData
  category: CanonicalMediaCategory
  connections?: Record<string, ConnectionItem> | null
  onConnectionsChange?: (connections: Record<string, ConnectionItem>) => void
  inheritedStatus?: string | null
  inheritedProgress?: number | null
  inheritedStartedAt?: string | null
  inheritedCompletedAt?: string | null
  progressUnitLabel?: string
}

export interface ProviderMeta {
  key: string
  name: string
  detectedId: string | number | null
  externalUrl?: string | null
}

export interface ProviderSearchResult {
  externalId: string
  title: string
  titleSecondary?: string | null
  coverImage?: string | null
  releaseYear?: number | null
  format?: string | null
  episodes?: number | null
  status?: string | null
  url?: string | null
}

function formatStatusLabel(
  status?: string | null,
  category?: CanonicalMediaCategory
): string {
  if (!status) return "Planning"
  const upper = status.toUpperCase()
  if (upper === "PLANNING") return "Planning"
  if (upper === "WATCHING")
    return category === "manga"
      ? "Reading"
      : category === "game"
        ? "Playing"
        : "Watching"
  if (upper === "READING") return "Reading"
  if (upper === "PLAYING") return "Playing"
  if (upper === "COMPLETED") return "Completed"
  if (upper === "PAUSED") return "On Hold"
  if (upper === "DROPPED") return "Dropped"
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function formatInheritedDates(
  startedAt?: unknown,
  completedAt?: unknown
): string {
  const start = formatDateToYmd(startedAt) || null
  const finish = formatDateToYmd(completedAt) || null
  if (start && finish) {
    return `${start} - ${finish}`
  }
  if (start && !finish) {
    return `${start} - No Finish Date`
  }
  if (!start && finish) {
    return `No Start Date - ${finish}`
  }
  return "No Dates Set"
}

async function fetchRemoteMediaDetails(
  providerKey: string,
  externalId: string | number,
  category: CanonicalMediaCategory
): Promise<{
  title?: string
  cover?: string
  coverImage?: string
  year?: number | null
  format?: string | null
  externalUrl?: string | null
} | null> {
  const strId = String(externalId).trim()
  if (!strId || strId === "linked" || strId === "undefined" || strId === "null")
    return null

  // 1. Simkl: Query via server proxy
  if (providerKey === "simkl") {
    try {
      const searchType =
        category === "manga"
          ? "MANGA"
          : category === "tv"
            ? "TV"
            : category === "movie"
              ? "MOVIE"
              : "ANIME"

      const res = await (elysia.connections.search as any).get({
        query: {
          provider: "SIMKL",
          id: strId,
          type: searchType,
        },
      })

      if (
        res.data?.success &&
        Array.isArray(res.data?.results) &&
        res.data.results.length > 0
      ) {
        const item = res.data.results[0]
        const coverUrl =
          item.coverImage?.large ||
          item.coverImage?.medium ||
          (typeof item.coverImage === "string" ? item.coverImage : null)
        const primaryTitle =
          item.title?.userPreferred ||
          item.title?.english ||
          item.title?.romaji ||
          item.title ||
          null

        return {
          title: primaryTitle,
          cover: coverUrl,
          coverImage: coverUrl,
          year: item.releaseYear ?? null,
          format: item.format ?? null,
          externalUrl:
            item.url ||
            (category === "movie"
              ? `https://simkl.com/movies/${strId}`
              : category === "tv"
                ? `https://simkl.com/tv/${strId}`
                : `https://simkl.com/anime/${strId}`),
        }
      }
    } catch {
      return null
    }
    return null
  }

  // 1b. Last.fm: Query via server proxy
  if (providerKey === "lastfm") {
    try {
      const res = await (elysia.connections.search as any).get({
        query: {
          provider: "LASTFM",
          id: strId,
          type: category === "music" ? "TRACK" : undefined,
        },
      })

      if (
        res.data?.success &&
        Array.isArray(res.data?.results) &&
        res.data.results.length > 0
      ) {
        const item = res.data.results[0]
        const coverUrl =
          item.coverImage?.large ||
          item.coverImage?.medium ||
          (typeof item.coverImage === "string" ? item.coverImage : null)
        const primaryTitle =
          item.title?.userPreferred ||
          item.title?.english ||
          item.title?.romaji ||
          item.title ||
          null

        return {
          title: primaryTitle,
          cover: coverUrl,
          coverImage: coverUrl,
          year: item.releaseYear ?? null,
          format: item.format ?? null,
          externalUrl:
            item.url ||
            (strId.startsWith("http")
              ? strId
              : `https://www.last.fm/music/${strId}`),
        }
      }
    } catch {
      return null
    }
    return null
  }

  const numId = Number(externalId)
  if (!numId || isNaN(numId)) return null

  // 2. AniList: GraphQL
  if (providerKey === "anilist") {
    try {
      const resp = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: `
            query ($id: Int) {
              Media(id: $id) {
                id
                format
                status
                episodes
                chapters
                seasonYear
                siteUrl
                title {
                  userPreferred
                  english
                  romaji
                }
                coverImage {
                  large
                  medium
                }
              }
            }
          `,
          variables: { id: numId },
        }),
      })
      const json = await resp.json()
      const m = json?.data?.Media
      if (!m) return null
      const coverUrl = m.coverImage?.large || m.coverImage?.medium || null
      return {
        title: m.title?.userPreferred || m.title?.english || m.title?.romaji,
        cover: coverUrl,
        coverImage: coverUrl,
        year: m.seasonYear ?? null,
        format: m.format ?? null,
        externalUrl:
          m.siteUrl ||
          `https://anilist.co/${category === "manga" ? "manga" : "anime"}/${m.id}`,
      }
    } catch {
      return null
    }
  }

  // 3. MAL: Query via server proxy with fallback to Jikan API
  if (providerKey === "mal") {
    try {
      const searchType = category === "manga" ? "MANGA" : "ANIME"
      const res = await (elysia.connections.search as any).get({
        query: {
          provider: "MAL",
          id: strId,
          type: searchType,
        },
      })

      if (
        res.data?.success &&
        Array.isArray(res.data?.results) &&
        res.data.results.length > 0
      ) {
        const item = res.data.results[0]
        const coverUrl =
          item.coverImage?.large ||
          item.coverImage?.medium ||
          (typeof item.coverImage === "string" ? item.coverImage : null)
        const primaryTitle =
          item.title?.userPreferred ||
          item.title?.english ||
          item.title?.romaji ||
          item.title ||
          null

        return {
          title: primaryTitle,
          cover: coverUrl,
          coverImage: coverUrl,
          year: item.releaseYear ?? null,
          format: item.format ?? null,
          externalUrl:
            item.url ||
            `https://myanimelist.net/${category === "manga" ? "manga" : "anime"}/${strId}`,
        }
      }
    } catch {
      // Fallback to Jikan API below
    }

    try {
      const malType = category === "manga" ? "manga" : "anime"
      const resp = await fetch(`https://api.jikan.moe/v4/${malType}/${numId}`)
      const json = await resp.json()
      const d = json?.data
      if (!d) return null
      const coverUrl =
        d.images?.jpg?.large_image_url || d.images?.jpg?.image_url || null
      return {
        title: d.title || d.title_english,
        cover: coverUrl,
        coverImage: coverUrl,
        year:
          d.year ||
          (d.aired?.from ? new Date(d.aired.from).getFullYear() : null),
        format: d.type ?? null,
        externalUrl: d.url || `https://myanimelist.net/${malType}/${numId}`,
      }
    } catch {
      return null
    }
  }

  return null
}

export function MediaListConnectionsTab({
  media,
  category,
  connections = {},
  onConnectionsChange,
  inheritedStatus = "PLANNING",
  inheritedProgress = 0,
  inheritedStartedAt = "",
  inheritedCompletedAt = "",
  progressUnitLabel = "Ep",
}: MediaListConnectionsTabProps) {
  const localConnections = connections || {}

  // Collapsed / Expanded state per provider card (default to closed)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {}
  )

  // Provider search dialog state
  const [searchModalProvider, setSearchModalProvider] =
    useState<ProviderMeta | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [searchResults, setSearchResults] = useState<ProviderSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)

  // Detect supported external providers for this media type
  const availableProviders: ProviderMeta[] = useMemo(() => {
    const list: ProviderMeta[] = []

    if (category === "anime") {
      list.push(
        {
          key: "anilist",
          name: "AniList",
          detectedId: media.anilistId ?? null,
          externalUrl: media.anilistId
            ? `https://anilist.co/anime/${media.anilistId}`
            : null,
        },
        {
          key: "mal",
          name: "MyAnimeList",
          detectedId: media.malId ?? null,
          externalUrl: media.malId
            ? `https://myanimelist.net/anime/${media.malId}`
            : null,
        },
        {
          key: "simkl",
          name: "Simkl",
          detectedId: media.simklId ?? null,
          externalUrl: media.simklId
            ? `https://simkl.com/anime/${media.simklId}`
            : null,
        }
      )
    } else if (category === "manga") {
      list.push(
        {
          key: "anilist",
          name: "AniList",
          detectedId: media.anilistId ?? null,
          externalUrl: media.anilistId
            ? `https://anilist.co/manga/${media.anilistId}`
            : null,
        },
        {
          key: "mal",
          name: "MyAnimeList",
          detectedId: media.malId ?? null,
          externalUrl: media.malId
            ? `https://myanimelist.net/manga/${media.malId}`
            : null,
        }
      )
    } else if (category === "tv" || category === "movie") {
      list.push({
        key: "simkl",
        name: "Simkl",
        detectedId: media.simklId ?? null,
        externalUrl: media.simklId
          ? `https://simkl.com/${category === "tv" ? "tv" : "movies"}/${media.simklId}`
          : null,
      })
    } else if (category === "game") {
      // External providers disabled for games
    } else if (category === "music") {
      const lastFmUrl = (media as any).lastFmUrl ?? null
      const lastFmSlug = lastFmUrl
        ? lastFmUrl.replace(/^https?:\/\/(www\.)?last\.fm\/music\//i, "")
        : null
      list.push({
        key: "lastfm",
        name: "Last.fm",
        detectedId: lastFmSlug || ((media as any).musicBrainzId ?? null),
        externalUrl: lastFmUrl,
      })
    }

    return list
  }, [category, media])

  // Split providers into connected vs available
  const connectedProviders = useMemo(() => {
    return availableProviders.filter((p) => Boolean(localConnections[p.key]))
  }, [availableProviders, localConnections])

  const unconnectedProviders = useMemo(() => {
    return availableProviders.filter((p) => !localConnections[p.key])
  }, [availableProviders, localConnections])

  // Toggle card expanded state
  const toggleExpand = (key: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const mediaYear =
    media.seasonYear || media.startDateYear || media.releaseDateYear || null

  // Automatically fetch live details from external provider if linked by ID
  useEffect(() => {
    let isCancelled = false

    availableProviders.forEach(async (provider) => {
      const item = localConnections[provider.key]
      if (!item) return
      const activeId = item.id || provider.detectedId
      if (!activeId || activeId === "linked") return

      // If id, title, and cover are already stored in the connections column, don't fetch!
      const hasStoredDetails =
        Boolean(item.id && item.id !== "linked") &&
        Boolean(item.title) &&
        Boolean(item.cover || item.coverImage)

      if (hasStoredDetails) {
        return // Already stored in connections column, no need to fetch!
      }

      // Skip if already fetched from external API in current session
      if (item.extra?.fetchedExternally) return

      const remoteData = await fetchRemoteMediaDetails(
        provider.key,
        activeId,
        category
      )
      if (remoteData && !isCancelled) {
        const coverUrl =
          remoteData.cover ||
          remoteData.coverImage ||
          item.cover ||
          item.coverImage ||
          media.coverImage

        onConnectionsChange?.({
          ...localConnections,
          [provider.key]: {
            ...item,
            id: item.id || activeId,
            title: remoteData.title || item.title || media.titlePrimary,
            cover: coverUrl,
            coverImage: coverUrl,
            year: remoteData.year ?? item.year ?? mediaYear,
            format: remoteData.format ?? item.format ?? media.format,
            externalUrl:
              remoteData.externalUrl ||
              item.externalUrl ||
              provider.externalUrl,
            extra: {
              ...(item.extra || {}),
              fetchedExternally: true,
            },
          },
        })
      }
    })

    return () => {
      isCancelled = true
    }
  }, [category, availableProviders, mediaYear])

  // Connect a provider
  const handleConnect = async (
    provider: ProviderMeta,
    customId?: string | number
  ) => {
    const idToUse = customId || provider.detectedId || "linked"
    const currentItem = localConnections[provider.key]

    // If id, title, and cover are already stored for this ID, use them
    const hasStoredDetails =
      currentItem &&
      currentItem.id === idToUse &&
      Boolean(currentItem.title) &&
      Boolean(currentItem.cover || currentItem.coverImage)

    const initialCover =
      currentItem?.cover || currentItem?.coverImage || media.coverImage

    const updated: Record<string, ConnectionItem> = {
      ...localConnections,
      [provider.key]: {
        ...(currentItem || {}),
        id: idToUse,
        title: currentItem?.title || media.titlePrimary,
        cover: initialCover,
        coverImage: initialCover,
        year: currentItem?.year ?? mediaYear,
        format: currentItem?.format ?? media.format,
        externalUrl: currentItem?.externalUrl || provider.externalUrl,
      },
    }
    toast.success(`Connected to ${provider.name}`)
    onConnectionsChange?.(updated)

    if (hasStoredDetails) return

    // Attempt live metadata fetch from external site
    if (idToUse !== "linked") {
      const remoteData = await fetchRemoteMediaDetails(
        provider.key,
        idToUse,
        category
      )
      if (remoteData) {
        const coverUrl =
          remoteData.cover || remoteData.coverImage || initialCover

        onConnectionsChange?.({
          ...updated,
          [provider.key]: {
            ...(updated[provider.key] || {}),
            id: idToUse,
            title: remoteData.title || media.titlePrimary,
            cover: coverUrl,
            coverImage: coverUrl,
            year: remoteData.year ?? mediaYear,
            format: remoteData.format ?? media.format,
            externalUrl: remoteData.externalUrl || provider.externalUrl,
            extra: {
              ...(updated[provider.key]?.extra || {}),
              fetchedExternally: true,
            },
          },
        })
      }
    }
  }

  // Disconnect a provider
  const handleDisconnect = (providerKey: string, providerName: string) => {
    const updated = { ...localConnections }
    delete updated[providerKey]
    toast.info(`Disconnected from ${providerName}`)
    onConnectionsChange?.(updated)
  }

  // Update specific fields of a connection
  const handleUpdateItem = (
    providerKey: string,
    changes: Partial<ConnectionItem>
  ) => {
    const current = localConnections[providerKey]
    if (!current) return
    const updated: Record<string, ConnectionItem> = {
      ...localConnections,
      [providerKey]: {
        ...current,
        ...changes,
      },
    }
    onConnectionsChange?.(updated)
  }

  // Toggle override checkbox (status, progress, dates)
  const handleToggleOverride = (
    providerKey: string,
    field: "overrideStatus" | "overrideProgress" | "overrideDates"
  ) => {
    const current = localConnections[providerKey]
    if (!current) return

    const willBeActive = !current[field]
    const changes: Partial<ConnectionItem> = {
      [field]: willBeActive,
    }

    // Initialize sensible defaults when toggled on
    if (willBeActive) {
      if (field === "overrideStatus" && !current.status) {
        changes.status = inheritedStatus || "PLANNING"
      } else if (
        field === "overrideProgress" &&
        current.progress === undefined
      ) {
        changes.progress = inheritedProgress ?? 0
      } else if (field === "overrideDates") {
        if (!current.startedAt && inheritedStartedAt) {
          changes.startedAt = inheritedStartedAt
        }
        if (!current.completedAt && inheritedCompletedAt) {
          changes.completedAt = inheritedCompletedAt
        }
      }
    }

    handleUpdateItem(providerKey, changes)
  }

  // Available statuses for category
  const statusChoices = useMemo(() => {
    const isManga = category === "manga"
    const isGame = category === "game"
    return [
      { value: "PLANNING", label: "Planning" },
      {
        value: isManga ? "READING" : isGame ? "PLAYING" : "WATCHING",
        label: isManga ? "Reading" : isGame ? "Playing" : "Watching",
      },
      { value: "COMPLETED", label: "Completed" },
      { value: "PAUSED", label: "On Hold" },
      { value: "DROPPED", label: "Dropped" },
    ]
  }, [category])

  // Search logic
  const handleExecuteSearch = useCallback(
    async (provider: ProviderMeta, queryText: string) => {
      const q = queryText.trim()
      if (!q) return

      setIsSearching(true)
      setSearchError(null)

      try {
        // 1. Primary approach: Eden Treaty API search route
        const searchType =
          category === "manga"
            ? "MANGA"
            : category === "tv"
              ? "TV"
              : category === "movie"
                ? "MOVIE"
                : category === "music"
                  ? media.format === "TRACK"
                    ? "TRACK"
                    : "ALBUM"
                  : "ANIME"

        // Check if query is an explicit ID pattern (e.g. id:25623, mal:25623, #25623, or full MAL URL)
        const idPrefixMatch = q.match(/^(?:id:|mal:|#)\s*(\d+)$/i)
        const malUrlMatch = q.match(/myanimelist\.net\/(?:anime|manga)\/(\d+)/i)
        const isNumeric = /^\d+$/.test(q)
        const explicitId =
          idPrefixMatch?.[1] || malUrlMatch?.[1] || (isNumeric ? q : undefined)

        try {
          const res = await (elysia.connections.search as any).get({
            query: {
              provider: provider.key.toUpperCase(),
              q,
              id: explicitId,
              type: searchType,
            },
          })

          if (
            res.data?.success &&
            Array.isArray(res.data?.results) &&
            res.data.results.length > 0
          ) {
            const mapped: ProviderSearchResult[] = res.data.results
              .map((r: any, idx: number) => {
                let resolvedId =
                  r.externalId ??
                  r.id ??
                  r.ids?.simkl ??
                  r.ids?.simkl_id ??
                  r.ids?.id ??
                  r.simkl_id ??
                  r.simkl ??
                  r.mal_id
                if (
                  !resolvedId ||
                  String(resolvedId) === "undefined" ||
                  String(resolvedId) === "null"
                ) {
                  if (r.url) {
                    const match = String(r.url).match(/\/(\d+)(?:\/|$)/)
                    if (match && match[1]) resolvedId = match[1]
                  }
                }
                const extId =
                  resolvedId != null &&
                  String(resolvedId) !== "undefined" &&
                  String(resolvedId) !== "null" &&
                  String(resolvedId).trim() !== ""
                    ? String(resolvedId)
                    : String(idx)

                return {
                  externalId: extId,
                  title:
                    r.title?.userPreferred ||
                    r.title?.english ||
                    r.title?.romaji ||
                    r.title ||
                    "Untitled",
                  titleSecondary:
                    r.title?.english &&
                    r.title?.english !== r.title?.userPreferred
                      ? r.title?.english
                      : r.title?.romaji || null,
                  coverImage:
                    r.coverImage?.large ||
                    r.coverImage?.medium ||
                    (typeof r.coverImage === "string" ? r.coverImage : null),
                  releaseYear: r.releaseYear ?? r.year ?? null,
                  format: r.format ?? null,
                  episodes: r.episodes ?? r.chapters ?? null,
                  status: r.status ?? null,
                  url: r.url ?? null,
                }
              })
              .filter(
                (item: ProviderSearchResult) =>
                  Boolean(item.externalId) && item.externalId !== "undefined"
              )

            if (mapped.length > 0) {
              setSearchResults(mapped)
              setIsSearching(false)
              return
            }
          }
        } catch {
          // Fall through to client direct fallback
        }

        // 2. Client-side direct fallback for AniList
        if (provider.key === "anilist") {
          const gqlQuery = `
            query ($search: String, $type: MediaType) {
              Page(page: 1, perPage: 15) {
                media(search: $search, type: $type, sort: POPULARITY_DESC) {
                  id
                  format
                  status
                  episodes
                  chapters
                  seasonYear
                  siteUrl
                  title {
                    userPreferred
                    english
                    romaji
                  }
                  coverImage {
                    large
                    medium
                  }
                }
              }
            }
          `
          const mediaType = category === "manga" ? "MANGA" : "ANIME"
          const resp = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              query: gqlQuery,
              variables: {
                search: q,
                type: mediaType,
              },
            }),
          })
          const json = await resp.json()
          const mediaItems = json?.data?.Page?.media
          if (Array.isArray(mediaItems) && mediaItems.length > 0) {
            const mapped: ProviderSearchResult[] = mediaItems.map((m: any) => ({
              externalId: String(m.id),
              title: m.title?.userPreferred || m.title?.english || "Untitled",
              titleSecondary:
                m.title?.english && m.title?.english !== m.title?.userPreferred
                  ? m.title?.english
                  : m.title?.romaji || null,
              coverImage: m.coverImage?.large || m.coverImage?.medium || null,
              releaseYear: m.seasonYear ?? null,
              format: m.format ?? null,
              episodes: m.episodes ?? m.chapters ?? null,
              status: m.status ?? null,
              url:
                m.siteUrl ||
                `https://anilist.co/${category === "manga" ? "manga" : "anime"}/${m.id}`,
            }))
            setSearchResults(mapped)
            setIsSearching(false)
            return
          }
        }

        // 3. Client-side direct fallback for MyAnimeList (Jikan)
        if (provider.key === "mal") {
          const malType = category === "manga" ? "manga" : "anime"
          const cleanMalId =
            idPrefixMatch?.[1] || malUrlMatch?.[1] || (isNumeric ? q : null)

          let jikanUrl = `https://api.jikan.moe/v4/${malType}?q=${encodeURIComponent(q)}&limit=15`
          if (cleanMalId) {
            jikanUrl = `https://api.jikan.moe/v4/${malType}/${cleanMalId}`
          }

          const resp = await fetch(jikanUrl)
          const json = await resp.json()
          const rawItems = Array.isArray(json?.data)
            ? json.data
            : json?.data
              ? [json.data]
              : []

          if (rawItems.length > 0) {
            const mapped: ProviderSearchResult[] = rawItems.map(
              (item: any) => ({
                externalId: String(item.mal_id),
                title: item.title || "Untitled",
                titleSecondary:
                  item.title_english || item.title_japanese || null,
                coverImage:
                  item.images?.jpg?.large_image_url ||
                  item.images?.jpg?.image_url ||
                  null,
                releaseYear:
                  item.year ||
                  (item.aired?.from
                    ? new Date(item.aired.from).getFullYear()
                    : null),
                format: item.type ?? null,
                episodes: item.episodes ?? item.chapters ?? null,
                status: item.status ?? null,
                url:
                  item.url ??
                  `https://myanimelist.net/${malType}/${item.mal_id}`,
              })
            )
            setSearchResults(mapped)
            setIsSearching(false)
            return
          }
        }

        setSearchResults([])
        setSearchError(`No results found on ${provider.name} for "${q}".`)
      } catch (err: any) {
        setSearchError(err?.message || "Failed to search provider.")
      } finally {
        setIsSearching(false)
      }
    },
    [category]
  )

  // Open the search modal
  const openSearchModal = (provider: ProviderMeta) => {
    setSearchModalProvider(provider)
    const initialQuery =
      localConnections[provider.key]?.title || media.titlePrimary || ""
    setSearchQuery(initialQuery)
    setSearchResults([])
    setSearchError(null)

    if (initialQuery) {
      handleExecuteSearch(provider, initialQuery)
    }
  }

  // Apply selected series from search
  const handleSelectSeries = (
    provider: ProviderMeta,
    result: ProviderSearchResult
  ) => {
    const current: ConnectionItem = localConnections[provider.key] || {
      id: "linked",
    }
    const coverUrl =
      result.coverImage ||
      current.cover ||
      current.coverImage ||
      media.coverImage

    const updated: Record<string, ConnectionItem> = {
      ...localConnections,
      [provider.key]: {
        ...current,
        id: result.externalId,
        title: result.title,
        cover: coverUrl,
        coverImage: coverUrl,
        year: result.releaseYear ?? current.year ?? mediaYear,
        format: result.format ?? current.format ?? media.format,
        externalUrl: result.url || provider.externalUrl,
        extra: {
          ...(current.extra || {}),
          fetchedExternally: true,
        },
      },
    }
    onConnectionsChange?.(updated)
    toast.success(`Linked to "${result.title}" on ${provider.name}`)
    setSearchModalProvider(null)
  }

  const inheritedStatusLabel = formatStatusLabel(inheritedStatus, category)
  const inheritedDatesSummary = formatInheritedDates(
    inheritedStartedAt,
    inheritedCompletedAt
  )

  return (
    <div className="space-y-4">
      {/* Tab Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <IconLink className="size-4 text-primary" />
          <span>Connected Services</span>
        </h3>
        <span className="text-[11px] font-medium text-muted-foreground">
          {connectedProviders.length} active
        </span>
      </div>

      {/* Connected Providers List */}
      {connectedProviders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
          <IconAlertCircle className="size-8 text-muted-foreground opacity-40" />
          <p className="mt-2 text-xs font-semibold text-foreground">
            No Active Connections
          </p>
          <p className="mt-0.5 max-w-xs text-[11px] text-muted-foreground">
            Connect an external tracking service below to sync status, progress,
            and dates.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {connectedProviders.map((provider) => {
            const item: ConnectionItem = localConnections[provider.key] || {
              id: "linked",
            }
            const isExpanded = Boolean(expandedCards[provider.key])
            const activeId = item.id || provider.detectedId || ""

            return (
              <div
                key={provider.key}
                className="rounded-2xl border border-border bg-card p-4 shadow-xs transition-all"
              >
                {/* Header: ANILIST #184356 ^ X */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xs font-black tracking-wider text-foreground uppercase">
                      {provider.name}
                    </span>

                    {/* Remote ID Badge */}
                    <span className="inline-flex items-center rounded-md border border-border/60 bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                      #{activeId}
                    </span>

                    {/* Chevron Collapse Toggle (Closed by default) */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(provider.key)}
                      aria-label={
                        isExpanded
                          ? `Collapse ${provider.name}`
                          : `Expand ${provider.name}`
                      }
                      className="cursor-pointer p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {isExpanded ? (
                        <IconChevronUp className="size-4" />
                      ) : (
                        <IconChevronDown className="size-4" />
                      )}
                    </button>
                  </div>

                  {/* Disconnect X button */}
                  <button
                    type="button"
                    onClick={() =>
                      handleDisconnect(provider.key, provider.name)
                    }
                    aria-label={`Disconnect ${provider.name}`}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <IconX className="size-3.5" />
                  </button>
                </div>

                {/* Collapsible Content (Closed by default) */}
                {isExpanded && (
                  <div className="mt-1 space-y-3.5 border-t border-border/40 pt-3.5">
                    {/* 1. Override Status */}
                    <div className="space-y-2">
                      <label className="group flex cursor-pointer items-start gap-2.5 select-none">
                        <div
                          role="checkbox"
                          aria-checked={Boolean(item.overrideStatus)}
                          tabIndex={0}
                          onClick={() =>
                            handleToggleOverride(provider.key, "overrideStatus")
                          }
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault()
                              handleToggleOverride(
                                provider.key,
                                "overrideStatus"
                              )
                            }
                          }}
                          className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            item.overrideStatus
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40 bg-muted/20 group-hover:border-muted-foreground/60"
                          }`}
                        >
                          {item.overrideStatus && (
                            <IconCheck className="size-3 stroke-[3]" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs leading-tight font-bold text-foreground">
                            Override status
                          </span>
                          <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground italic">
                            Inherited: {inheritedStatusLabel}
                          </span>
                        </div>
                      </label>

                      {/* Status Selector when checked */}
                      {item.overrideStatus && (
                        <div className="ms-7 flex flex-wrap gap-1.5 pt-1">
                          {statusChoices.map((st) => {
                            const isSelected =
                              (
                                item.status ||
                                inheritedStatus ||
                                "PLANNING"
                              ).toUpperCase() === st.value.toUpperCase()

                            return (
                              <button
                                key={st.value}
                                type="button"
                                onClick={() =>
                                  handleUpdateItem(provider.key, {
                                    status: st.value,
                                  })
                                }
                                className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                                  isSelected
                                    ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                                    : "border border-border/50 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                {st.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* 2. Override Ep progress */}
                    <div className="space-y-2">
                      <label className="group flex cursor-pointer items-start gap-2.5 select-none">
                        <div
                          role="checkbox"
                          aria-checked={Boolean(item.overrideProgress)}
                          tabIndex={0}
                          onClick={() =>
                            handleToggleOverride(
                              provider.key,
                              "overrideProgress"
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault()
                              handleToggleOverride(
                                provider.key,
                                "overrideProgress"
                              )
                            }
                          }}
                          className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            item.overrideProgress
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40 bg-muted/20 group-hover:border-muted-foreground/60"
                          }`}
                        >
                          {item.overrideProgress && (
                            <IconCheck className="size-3 stroke-[3]" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs leading-tight font-bold text-foreground">
                            Override{" "}
                            {progressUnitLabel ? `${progressUnitLabel} ` : ""}
                            progress
                          </span>
                          <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground italic">
                            Inherited: {inheritedProgress ?? 0}
                          </span>
                        </div>
                      </label>

                      {/* Progress Stepper when checked */}
                      {item.overrideProgress && (
                        <div className="ms-7 flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            aria-label="Decrease progress"
                            onClick={() => {
                              const cur =
                                item.progress ?? inheritedProgress ?? 0
                              handleUpdateItem(provider.key, {
                                progress: Math.max(0, cur - 1),
                              })
                            }}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted"
                          >
                            <IconMinus className="size-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={media.episodeCount ?? undefined}
                            value={item.progress ?? inheritedProgress ?? 0}
                            onChange={(e) =>
                              handleUpdateItem(provider.key, {
                                progress: Math.max(
                                  0,
                                  Number(e.target.value) || 0
                                ),
                              })
                            }
                            className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            aria-label="Increase progress"
                            onClick={() => {
                              const cur =
                                item.progress ?? inheritedProgress ?? 0
                              handleUpdateItem(provider.key, {
                                progress: cur + 1,
                              })
                            }}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted"
                          >
                            <IconPlus className="size-3.5" />
                          </button>
                          {media.episodeCount && media.episodeCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              / {media.episodeCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. Override dates */}
                    <div className="space-y-2">
                      <label className="group flex cursor-pointer items-start gap-2.5 select-none">
                        <div
                          role="checkbox"
                          aria-checked={Boolean(item.overrideDates)}
                          tabIndex={0}
                          onClick={() =>
                            handleToggleOverride(provider.key, "overrideDates")
                          }
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault()
                              handleToggleOverride(
                                provider.key,
                                "overrideDates"
                              )
                            }
                          }}
                          className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            item.overrideDates
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40 bg-muted/20 group-hover:border-muted-foreground/60"
                          }`}
                        >
                          {item.overrideDates && (
                            <IconCheck className="size-3 stroke-[3]" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs leading-tight font-bold text-foreground">
                            Override dates
                          </span>
                          <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground italic">
                            Inherited: {inheritedDatesSummary}
                          </span>
                        </div>
                      </label>

                      {/* Date Pickers when checked */}
                      {item.overrideDates && (
                        <div className="ms-7 grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                          <div className="space-y-1">
                            <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                              <IconCalendar className="size-3 text-muted-foreground" />
                              Start Date
                            </span>
                            <DatePicker
                              value={item.startedAt ?? inheritedStartedAt ?? ""}
                              onChange={(val) =>
                                handleUpdateItem(provider.key, {
                                  startedAt: val,
                                })
                              }
                              placeholder="Pick start date"
                              ariaLabel="Override start date"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                              <IconCalendar className="size-3 text-muted-foreground" />
                              Finish Date
                            </span>
                            <DatePicker
                              value={
                                item.completedAt ?? inheritedCompletedAt ?? ""
                              }
                              onChange={(val) =>
                                handleUpdateItem(provider.key, {
                                  completedAt: val,
                                })
                              }
                              placeholder="Pick finish date"
                              ariaLabel="Override finish date"
                              align="end"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. Linked Series & Override Section */}
                    <div className="border-t border-border/50 pt-2">
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/30 p-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {(item.cover ||
                            item.coverImage ||
                            media.coverImage) && (
                            <img
                              src={
                                item.cover ||
                                item.coverImage ||
                                media.coverImage ||
                                ""
                              }
                              alt={item.title || media.titlePrimary}
                              className="size-10 shrink-0 rounded-lg border border-border bg-muted object-cover"
                            />
                          )}
                          <div className="flex min-w-0 flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-foreground">
                                {item.title || media.titlePrimary}
                              </span>
                              {item.externalUrl && (
                                <a
                                  href={item.externalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                                  aria-label={`Open on ${provider.name}`}
                                >
                                  <IconExternalLink className="size-3" />
                                </a>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              {(item.format || media.format) && (
                                <Badge
                                  variant="outline"
                                  className="border-border px-1 py-0 text-[9px]"
                                >
                                  {item.format || media.format}
                                </Badge>
                              )}
                              {(item.year || mediaYear) && (
                                <span>{item.year || mediaYear}</span>
                              )}
                              <span className="font-mono text-muted-foreground/80">
                                #{activeId}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openSearchModal(provider)}
                          className="h-7.5 shrink-0 gap-1.5 border-border bg-card px-2.5 text-xs text-foreground hover:bg-muted"
                        >
                          <IconSearch className="size-3.5 text-muted-foreground" />
                          <span>Override Series</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Unconnected / Available Providers Section */}
      {unconnectedProviders.length > 0 && (
        <div className="space-y-2 border-t border-border/40 pt-2">
          <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
            Available Providers
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {unconnectedProviders.map((provider) => (
              <div
                key={provider.key}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 transition-all hover:border-border/80"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground uppercase">
                    {provider.name.slice(0, 2)}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {provider.name}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {provider.detectedId
                        ? `#${provider.detectedId}`
                        : "Not linked"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {provider.detectedId ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openSearchModal(provider)}
                        className="h-7 gap-1 border-border px-2 text-[11px]"
                        aria-label={`Search ${provider.name}`}
                      >
                        <IconSearch className="size-3 text-muted-foreground" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleConnect(provider)}
                        className="h-7 bg-primary px-2.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Connect
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openSearchModal(provider)}
                      className="h-7 gap-1.5 border-border px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
                    >
                      <IconSearch className="size-3 text-muted-foreground" />
                      <span>Search</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External Series Search Dialog */}
      {searchModalProvider && (
        <AriaModalOverlay
          isOpen={Boolean(searchModalProvider)}
          onOpenChange={(open: boolean) => {
            if (!open) setSearchModalProvider(null)
          }}
          isDismissable
          className="fixed inset-0 isolate z-50 bg-black/40 duration-100 data-entering:animate-in data-entering:fade-in-0 data-exiting:animate-out data-exiting:fade-out-0 supports-backdrop-filter:backdrop-blur-sm"
        >
          <AriaModal className="fixed start-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 overflow-hidden rounded-3xl bg-popover p-6 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-100 outline-none data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 sm:max-w-lg rtl:translate-x-1/2">
            <AriaDialog
              aria-label={`Search ${searchModalProvider.name}`}
              className="[display:inherit] [gap:inherit] outline-none"
            >
              <AriaHeading slot="title" className="sr-only">
                Search {searchModalProvider.name}
              </AriaHeading>
              <div className="w-full max-w-full min-w-0 space-y-3 overflow-hidden">
                <DialogHeader className="space-y-1">
                  <DialogTitle
                    id="search-modal-provider-title"
                    className="flex items-center gap-2 text-base font-bold text-foreground"
                  >
                    <IconSearch className="size-4 text-primary" />
                    <span>Search {searchModalProvider.name}</span>
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Search and select a series on {searchModalProvider.name} to
                    link with this entry.
                  </DialogDescription>
                </DialogHeader>

                <div className="w-full min-w-0 space-y-3 overflow-hidden pt-1">
                  {/* Search Input Row */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (searchModalProvider) {
                        handleExecuteSearch(searchModalProvider, searchQuery)
                      }
                    }}
                    className="flex w-full min-w-0 items-center gap-2"
                  >
                    <div className="relative min-w-0 flex-1">
                      <IconSearch className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={
                          searchModalProvider.key === "mal"
                            ? "Search title or id:25623..."
                            : `Search ${searchModalProvider.name}...`
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 w-full min-w-0 rounded-xl border-border bg-background ps-9 pe-3 text-xs text-foreground"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSearching || !searchQuery.trim()}
                      className="h-8 shrink-0 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSearching ? (
                        <IconLoader2 className="size-3.5 animate-spin" />
                      ) : (
                        "Search"
                      )}
                    </Button>
                  </form>

                  {/* Search Results / Status */}
                  <div className="no-scrollbar max-h-72 w-full min-w-0 space-y-2 overflow-x-hidden overflow-y-auto pe-1 pt-1">
                    {isSearching && (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <IconLoader2 className="size-6 animate-spin text-primary" />
                        <span className="mt-2 text-xs">
                          Searching {searchModalProvider.name}...
                        </span>
                      </div>
                    )}

                    {!isSearching && searchError && (
                      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                        <IconAlertCircle className="size-4 shrink-0" />
                        <span>{searchError}</span>
                      </div>
                    )}

                    {!isSearching &&
                      !searchError &&
                      searchResults.length === 0 && (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                          No series found. Try entering a different title or
                          keywords.
                        </div>
                      )}

                    {!isSearching &&
                      searchResults.map((result, idx) => {
                        const activeConnId =
                          localConnections[searchModalProvider.key]?.id
                        const hasValidActiveId =
                          activeConnId != null &&
                          String(activeConnId).trim() !== "" &&
                          String(activeConnId) !== "undefined" &&
                          String(activeConnId) !== "null" &&
                          String(activeConnId) !== "linked"

                        const hasValidResultId =
                          result.externalId != null &&
                          String(result.externalId).trim() !== "" &&
                          String(result.externalId) !== "undefined" &&
                          String(result.externalId) !== "null"

                        const isCurrent =
                          hasValidActiveId &&
                          hasValidResultId &&
                          String(activeConnId) === String(result.externalId)

                        const itemKey = result.externalId
                          ? `${result.externalId}-${idx}`
                          : `search-result-${idx}`

                        return (
                          <div
                            key={itemKey}
                            className={`flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border p-2.5 transition-all ${
                              isCurrent
                                ? "border-primary/50 bg-primary/10"
                                : "border-border bg-card hover:border-border/80"
                            }`}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                              {result.coverImage ? (
                                <img
                                  src={result.coverImage}
                                  alt={result.title}
                                  className="h-14 w-10 shrink-0 rounded-md border border-border bg-muted object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                                  {category === "manga" ? (
                                    <IconBook className="size-4" />
                                  ) : (
                                    <IconDeviceTv className="size-4" />
                                  )}
                                </div>
                              )}

                              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                                <span className="block truncate text-xs font-semibold text-foreground">
                                  {result.title}
                                </span>
                                {result.titleSecondary && (
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {result.titleSecondary}
                                  </span>
                                )}

                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                                  {result.format && (
                                    <Badge
                                      variant="outline"
                                      className="border-border px-1 py-0 text-[9px]"
                                    >
                                      {result.format}
                                    </Badge>
                                  )}
                                  {result.releaseYear && (
                                    <span>{result.releaseYear}</span>
                                  )}
                                  {result.episodes && (
                                    <span>
                                      {result.episodes}{" "}
                                      {category === "manga"
                                        ? "chapters"
                                        : "episodes"}
                                    </span>
                                  )}
                                  {result.externalId &&
                                    result.externalId !== "undefined" &&
                                    result.externalId !== "null" && (
                                      <span className="font-mono text-muted-foreground/75">
                                        #{result.externalId}
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isCurrent ? (
                                <Badge
                                  variant="outline"
                                  className="border-primary/40 bg-primary/15 text-[10px] text-primary"
                                >
                                  <IconCheck className="me-1 inline size-3" />
                                  Linked
                                </Badge>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() =>
                                    handleSelectSeries(
                                      searchModalProvider,
                                      result
                                    )
                                  }
                                  className="h-7 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                                >
                                  Select
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            </AriaDialog>
          </AriaModal>
        </AriaModalOverlay>
      )}
    </div>
  )
}
