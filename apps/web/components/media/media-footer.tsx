"use client"

import React from "react"
import { IconClock, IconExternalLink, IconWorld } from "@tabler/icons-react"
import type { NormalizedMediaData } from "./media-types"

interface MediaFooterProps {
  media: NormalizedMediaData
}

export function MediaFooter({ media }: MediaFooterProps) {
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
                  typeof info === "object" && info !== null && "url" in info && typeof info.url === "string"
                    ? info.url
                    : typeof info === "string" && (info.startsWith("http://") || info.startsWith("https://"))
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
                            : provider.charAt(0).toUpperCase() + provider.slice(1)

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

        {/* Last Updated Timestamp */}
        {updatedFormatted && (
          <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <IconClock className="size-3.5" aria-hidden="true" />
            <span>Last updated: {updatedFormatted}</span>
          </div>
        )}
      </div>
    </footer>
  )
}
