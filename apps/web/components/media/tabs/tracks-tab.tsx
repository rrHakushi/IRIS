"use client"

import React, { useState, useMemo } from "react"
import { IconDisc, IconSearch, IconClock } from "@tabler/icons-react"
import { Input } from "@workspace/ui/components/input"
import type { MusicTrackItem } from "../media-types"
import { MusicTracklist } from "../music/music-tracklist"

interface TracksTabProps {
  tracks: MusicTrackItem[]
  albumTitle?: string
  albumArtistPersonId?: number | null
}

function formatTotalDuration(tracks: MusicTrackItem[]): string {
  const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0)
  if (totalSeconds <= 0) return ""

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours} hr ${minutes} min`
  }
  return `${minutes} min ${seconds} sec`
}

export function TracksTab({
  tracks,
  albumTitle,
  albumArtistPersonId,
}: TracksTabProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks
    const q = searchQuery.toLowerCase().trim()
    return tracks.filter(
      (t) =>
        t.titlePrimary.toLowerCase().includes(q) ||
        (t.artistName && t.artistName.toLowerCase().includes(q))
    )
  }, [tracks, searchQuery])

  const totalDurationStr = useMemo(() => formatTotalDuration(tracks), [tracks])

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar with count, total duration, and search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <IconDisc className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-base font-semibold text-foreground">
              Album Tracklist
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{tracks.length} tracks</span>
              {totalDurationStr && (
                <>
                  <span>•</span>
                  <span>{totalDurationStr}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {tracks.length > 5 && (
          <div className="relative w-full sm:w-64">
            <IconSearch
              className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Search tracks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 ps-8 rounded-2xl text-xs"
            />
          </div>
        )}
      </div>

      {/* Tracklist content */}
      <MusicTracklist
        tracks={filteredTracks}
        albumTitle={albumTitle}
        albumArtistPersonId={albumArtistPersonId}
      />
    </div>
  )
}
