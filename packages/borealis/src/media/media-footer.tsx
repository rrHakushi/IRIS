"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconClock,
  IconExternalLink,
  IconRefresh,
  IconUser,
  IconWorld,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { useUser } from "@/context/user-context"
import { hasPermission, IRISFlags } from "@IRIS/permissions"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"
import type { NormalizedMediaData } from "./media-types"

interface MediaFooterProps {
  media: NormalizedMediaData
}

export function MediaFooter({ media }: MediaFooterProps) {
  const router = useRouter()
  const { user } = useUser()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const isAdmin = useMemo(() => {
    if (!user) return false
    if (user.role === "ADMIN" || user.isAdmin === true) return true
    if (Array.isArray(user.permissions)) {
      return hasPermission(user.permissions, IRISFlags.ADMINISTRATOR)
    }
    return false
  }, [user])

  const getSourceUrlFromMap = (key: string): string | null => {
    if (!media.sources || typeof media.sources !== "object") return null
    const entry = (media.sources as Record<string, any>)[key]
    if (!entry) return null
    if (typeof entry === "string" && (entry.startsWith("http://") || entry.startsWith("https://"))) {
      return entry
    }
    if (typeof entry === "object" && typeof entry.url === "string") {
      return entry.url
    }
    return null
  }

  const dataSources = useMemo(() => {
    const items: Array<{ key: string; name: string; href: string; external: boolean }> = []

    switch (media.category) {
      case "anime": {
        items.push({
          key: "anilist",
          name: "AniList",
          href:
            getSourceUrlFromMap("anilist") ||
            getSourceUrlFromMap("al") ||
            (media.anilistId ? `https://anilist.co/anime/${media.anilistId}` : "https://anilist.co"),
          external: true,
        })
        items.push({
          key: "mal",
          name: "MyAnimeList",
          href:
            getSourceUrlFromMap("mal") ||
            (media.malId ? `https://myanimelist.net/anime/${media.malId}` : "https://myanimelist.net"),
          external: true,
        })
        items.push({
          key: "thetvdb",
          name: "TheTVDB",
          href:
            getSourceUrlFromMap("thetvdb") ||
            (media.tvDBId ? `https://thetvdb.com/dereferrer/series/${media.tvDBId}` : "https://thetvdb.com"),
          external: true,
        })
        items.push({
          key: "fribb",
          name: "Fribb/anime-lists",
          href: "https://github.com/Fribb/anime-lists",
          external: true,
        })
        break
      }
      case "manga": {
        items.push({
          key: "anilist",
          name: "AniList",
          href:
            getSourceUrlFromMap("anilist") ||
            getSourceUrlFromMap("al") ||
            (media.anilistId ? `https://anilist.co/manga/${media.anilistId}` : "https://anilist.co"),
          external: true,
        })
        items.push({
          key: "mal",
          name: "MyAnimeList",
          href:
            getSourceUrlFromMap("mal") ||
            (media.malId ? `https://myanimelist.net/manga/${media.malId}` : "https://myanimelist.net"),
          external: true,
        })
        items.push({
          key: "fribb",
          name: "Fribb/anime-lists",
          href: "https://github.com/Fribb/anime-lists",
          external: true,
        })
        break
      }
      case "movies": {
        items.push({
          key: "thetvdb",
          name: "TheTVDB",
          href:
            getSourceUrlFromMap("thetvdb") ||
            (media.tvDBId ? `https://thetvdb.com/dereferrer/movie/${media.tvDBId}` : "https://thetvdb.com"),
          external: true,
        })
        break
      }
      case "tv": {
        items.push({
          key: "thetvdb",
          name: "TheTVDB",
          href:
            getSourceUrlFromMap("thetvdb") ||
            (media.tvDBId ? `https://thetvdb.com/dereferrer/series/${media.tvDBId}` : "https://thetvdb.com"),
          external: true,
        })
        break
      }
      case "games": {
        items.push({
          key: "igdb",
          name: "IGDB",
          href:
            getSourceUrlFromMap("igdb") ||
            (media.igdbId ? `https://www.igdb.com/games/${media.igdbId}` : "https://www.igdb.com"),
          external: true,
        })
        break
      }
      case "books": {
        items.push({
          key: "googlebooks",
          name: "Google Books",
          href:
            getSourceUrlFromMap("googleBooks") ||
            getSourceUrlFromMap("googlebooks") ||
            (media.googleBookId
              ? `https://books.google.com/books?id=${media.googleBookId}`
              : "https://books.google.com"),
          external: true,
        })
        break
      }
      case "music": {
        const isAlbum = media.format?.toUpperCase() === "ALBUM"
        items.push({
          key: "deezer",
          name: "Deezer",
          href:
            getSourceUrlFromMap("deezer") ||
            (media.deezerId
              ? `https://www.deezer.com/${isAlbum ? "album" : "track"}/${media.deezerId}`
              : "https://www.deezer.com"),
          external: true,
        })
        items.push({
          key: "lrclib",
          name: "LRCLIB",
          href: getSourceUrlFromMap("lrclib") || "https://lrclib.net",
          external: true,
        })
        break
      }
      case "other": {
        const creatorSlug = media.creatorUsername || media.creatorId
        const creatorLabel =
          media.creatorDisplayName ||
          (media.creatorUsername ? `@${media.creatorUsername}` : "Creator")
        if (creatorSlug) {
          items.push({
            key: "creator",
            name: `Creator (${creatorLabel})`,
            href: `/carina/users/${creatorSlug}`,
            external: false,
          })
        }
        break
      }
    }

    return items
  }, [media])

  const formatUpdatedDate = (dateVal: string | Date) => {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const updatedFormatted = formatUpdatedDate(media.updatedAt)

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)

    try {
      const payload = { force: true, maxDepth: 0 }
      let res: { error?: any; data?: any } | undefined

      switch (media.category) {
        case "anime":
          res = await (elysia.borealis as any).anime({ animeId: media.id }).refresh.post()
          break
        case "manga":
          res = await (elysia.borealis as any).manga({ mangaId: media.id }).refresh.post()
          break
        case "tv":
          res = await (elysia.borealis as any).tv({ tvId: media.id }).refresh.post()
          break
        case "movies":
          res = await (elysia.borealis as any).movies({ movieId: media.id }).refresh.post()
          break
        case "games":
          res = await (elysia.borealis as any).games({ gameId: media.id }).refresh.post()
          break
        case "books":
          res = await (elysia.borealis as any).books({ bookId: media.id }).refresh.post()
          break
        case "music":
          res = await (elysia.borealis as any).music({ musicId: media.id }).refresh.post()
          break
      }

      if (res?.error) {
        const errorMsg =
          typeof res.error.value === "object" && res.error.value?.message
            ? res.error.value.message
            : typeof res.error.value === "string"
              ? res.error.value
              : "Failed to queue refresh"
        toast.error(errorMsg)
      } else {
        toast.success(res?.data?.message || "Data refresh queued successfully")
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to refresh data")
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <footer className="mt-12 border-t border-border/40 bg-card/30 py-8 text-xs text-muted-foreground">
      <div className="flex w-full flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        {/* Sources Links */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <IconWorld className="size-4 text-primary" aria-hidden="true" />
            <span>Data Sources</span>
          </div>

          {dataSources.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {dataSources.map((source) =>
                source.external ? (
                  <a
                    key={source.key}
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:underline"
                  >
                    <span>{source.name}</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                ) : (
                  <Link
                    key={source.key}
                    href={source.href}
                    className="inline-flex items-center gap-1 text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:underline"
                  >
                    <IconUser className="size-3 opacity-70" aria-hidden="true" />
                    <span>{source.name}</span>
                  </Link>
                )
              )}
            </div>
          ) : (
            <span className="text-muted-foreground/70 italic">
              External sources not linked
            </span>
          )}
        </div>

        {/* Admin Actions & Last Updated Timestamp */}
        <div className="flex shrink-0 flex-col items-start gap-2.5 sm:items-end">
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              isDisabled={isRefreshing}
              onPress={handleRefresh}
              className="cursor-pointer gap-1.5 rounded-xl border-border/70 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
            >
              <IconRefresh
                className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>{isRefreshing ? "Refreshing..." : "Refresh data"}</span>
            </Button>
          )}

          {updatedFormatted && (
            <div className="flex items-center gap-1.5 text-muted-foreground" suppressHydrationWarning>
              <IconClock className="size-3.5" aria-hidden="true" />
              <span suppressHydrationWarning>Last updated: {updatedFormatted}</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
