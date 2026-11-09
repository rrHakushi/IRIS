"use client"

import React, { useState } from "react"
import {
  IconBrandYoutube,
  IconPlayerPlay,
  IconVideo,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import type { TrailerItem } from "../media-types"

interface TrailersTabProps {
  trailers: TrailerItem[] | null
}

export function TrailersTab({ trailers }: TrailersTabProps) {
  const [selectedTrailer, setSelectedTrailer] = useState<TrailerItem | null>(
    null
  )

  const trailerList = trailers ?? []

  const getSite = (trailer: TrailerItem): string => {
    if (trailer.site) return trailer.site.toLowerCase()
    if (
      trailer.url?.includes("youtube.com") ||
      trailer.url?.includes("youtu.be")
    )
      return "youtube"
    if (trailer.url?.includes("dailymotion.com")) return "dailymotion"
    return ""
  }

  const getYouTubeId = (trailer: TrailerItem): string | null => {
    if (
      trailer.id &&
      typeof trailer.id === "string" &&
      trailer.id.length === 11 &&
      !trailer.id.includes("http")
    ) {
      return trailer.id
    }
    if (trailer.url) {
      const match = trailer.url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/
      )
      if (match && match[1]) return match[1]
    }
    return null
  }

  const getEmbedUrl = (trailer: TrailerItem) => {
    const site = getSite(trailer)
    const ytId = getYouTubeId(trailer)
    if (ytId) {
      return `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`
    }
    if (site === "dailymotion" && trailer.id) {
      return `https://www.dailymotion.com/embed/video/${trailer.id}?autoplay=1`
    }
    if (
      trailer.url &&
      (trailer.url.startsWith("http://") || trailer.url.startsWith("https://"))
    ) {
      return trailer.url
    }
    return null
  }

  const getThumbnailUrl = (trailer: TrailerItem) => {
    if (trailer.thumbnail) return trailer.thumbnail
    const ytId = getYouTubeId(trailer)
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    }
    return null
  }

  if (trailerList.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No promotional videos or trailers available for this title.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Trailers & PVs
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trailerList.map((trailer, idx) => {
          const thumbnail = getThumbnailUrl(trailer)
          const site = getSite(trailer)
          const isYouTube = site === "youtube"
          const displayTitle =
            trailer.name ||
            (trailerList.length === 1 ? "Trailer" : `Trailer #${idx + 1}`)

          return (
            <button
              key={`${trailer.id ?? idx}-${idx}`}
              type="button"
              onClick={() => setSelectedTrailer(trailer)}
              className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/40 bg-card text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={displayTitle}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                    <IconVideo className="size-10" aria-hidden="true" />
                  </div>
                )}

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                    <IconPlayerPlay
                      className="size-6 fill-current"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                {/* Site Badge */}
                <Badge
                  variant="secondary"
                  className="absolute start-2 top-2 gap-1 text-[10px] font-semibold uppercase backdrop-blur-xs"
                >
                  {isYouTube && (
                    <IconBrandYoutube
                      className="size-3 text-red-500"
                      aria-hidden="true"
                    />
                  )}
                  <span>{site || "Video"}</span>
                </Badge>
              </div>

              <div className="p-3">
                <span className="line-clamp-1 text-xs font-medium text-foreground group-hover:underline">
                  {displayTitle}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  {site || "Video"}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Video Player Modal */}
      {selectedTrailer && (
        <Dialog
          isOpen={Boolean(selectedTrailer)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedTrailer(null)
          }}
          className="gap-4 p-4 sm:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {selectedTrailer.name || "Trailer"}
            </DialogTitle>
          </DialogHeader>

          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
            {getEmbedUrl(selectedTrailer) ? (
              <iframe
                src={getEmbedUrl(selectedTrailer)!}
                title="Trailer Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                Unable to embed video for site:{" "}
                {getSite(selectedTrailer) || "Video"}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  )
}
