"use client"

import React, { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  IconClock,
  IconExternalLink,
  IconRefresh,
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

  const sources = media.sources ? Object.entries(media.sources) : []

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
          res = await elysia.media.anime({ id: media.id }).refresh.post(payload)
          break
        case "manga":
          res = await elysia.media.manga({ id: media.id }).refresh.post(payload)
          break
        case "tv":
          res = await elysia.media.tv({ id: media.id }).refresh.post(payload)
          break
        case "movies":
          res = await elysia.media
            .movies({ id: media.id })
            .refresh.post(payload)
          break
        case "games":
          res = await elysia.media.games({ id: media.id }).refresh.post(payload)
          break
        case "books":
          res = await elysia.media.books({ id: media.id }).refresh.post(payload)
          break
        case "music":
          res = await elysia.media.music({ id: media.id }).refresh.post(payload)
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
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        {/* Sources Links */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <IconWorld className="size-4 text-primary" aria-hidden="true" />
            <span>Data Sources</span>
          </div>

          {sources.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {sources.map(([provider, info]) => {
                const url =
                  typeof info === "object" &&
                  info !== null &&
                  "url" in info &&
                  typeof info.url === "string"
                    ? info.url
                    : typeof info === "string" &&
                        (info.startsWith("http://") ||
                          info.startsWith("https://"))
                      ? info
                      : null
                if (!url) return null
                const name =
                  provider === "mal"
                    ? "MyAnimeList"
                    : provider === "al" || provider === "anilist"
                      ? "AniList"
                      : provider === "thetvdb"
                        ? "TheTVDB"
                        : provider === "deezer"
                          ? "Deezer"
                          : provider === "lrclib"
                            ? "LRCLIB"
                            : provider.charAt(0).toUpperCase() +
                              provider.slice(1)

                return (
                  <a
                    key={provider}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:underline"
                  >
                    <span>{name}</span>
                    <IconExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  </a>
                )
              })}
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
              disabled={isRefreshing}
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
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IconClock className="size-3.5" aria-hidden="true" />
              <span>Last updated: {updatedFormatted}</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
