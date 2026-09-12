"use client"

import React, { useState, useRef, useMemo } from "react"
import Link from "next/link"
import {
  IconDisc,
  IconMusic,
  IconPlayerPlay,
  IconPlayerPause,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { MusicTrackItem } from "../media-types"

interface MusicTracklistProps {
  tracks: MusicTrackItem[]
  albumTitle?: string
  albumArtistPersonId?: number | null
  className?: string
  limit?: number
  onViewAll?: () => void
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "--:--"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function MusicTracklist({
  tracks,
  albumTitle,
  albumArtistPersonId,
  className,
  limit,
  onViewAll,
}: MusicTracklistProps) {
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Stop playback when component unmounts
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handleTogglePlay = (e: React.MouseEvent, track: MusicTrackItem) => {
    e.stopPropagation()
    e.preventDefault()

    if (!track.audioPreviewUrl) return

    if (playingTrackId === track.id) {
      // Pause
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setPlayingTrackId(null)
    } else {
      // Play new track
      if (audioRef.current) {
        audioRef.current.pause()
      }
      const audio = new Audio(track.audioPreviewUrl)
      audioRef.current = audio
      audio.play().catch(() => {
        setPlayingTrackId(null)
      })
      audio.onended = () => {
        setPlayingTrackId(null)
      }
      setPlayingTrackId(track.id)
    }
  }

  // Group by discNumber
  const discs = useMemo(() => {
    const map = new Map<number, MusicTrackItem[]>()
    for (const track of tracks) {
      const disc = track.discNumber || 1
      const list = map.get(disc) ?? []
      list.push(track)
      map.set(disc, list)
    }

    // Sort discs ascending
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [tracks])

  const displayedDiscs = useMemo(() => {
    if (!limit) return discs

    let remaining = limit
    const result: Array<[number, MusicTrackItem[]]> = []

    for (const [discNum, discTracks] of discs) {
      if (remaining <= 0) break
      const slice = discTracks.slice(0, remaining)
      result.push([discNum, slice])
      remaining -= slice.length
    }

    return result
  }, [discs, limit])

  const totalTracksCount = tracks.length
  const hasMoreTracks = limit ? totalTracksCount > limit : false

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-10 text-center">
        <IconDisc
          className="size-8 text-muted-foreground/40"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          No tracks available for this album.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {displayedDiscs.map(([discNumber, discTracks]) => (
        <div key={discNumber} className="flex flex-col gap-2.5">
          {discs.length > 1 && (
            <div className="flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
              <IconDisc className="size-3.5 text-primary" aria-hidden="true" />
              <span>Disc {discNumber}</span>
              <span className="text-muted-foreground/60">
                • {discTracks.length} tracks
              </span>
            </div>
          )}

          <div className="divide-y divide-border/20 overflow-hidden rounded-2xl border border-border/40 bg-card/60 shadow-xs">
            {discTracks.map((track, idx) => {
              const trackNum = track.trackNumber ?? idx + 1
              const isPlaying = playingTrackId === track.id
              const hasPreview = Boolean(track.audioPreviewUrl)

              return (
                <div
                  key={track.id}
                  className="group relative flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/40 sm:px-4"
                >
                  {/* Left Column: Track Number / Play Button & Title */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {/* Track Number / Audio Preview Toggle */}
                    <div className="flex size-7 shrink-0 items-center justify-center">
                      {hasPreview ? (
                        <button
                          type="button"
                          onClick={(e) => handleTogglePlay(e, track)}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                            isPlaying
                              ? "scale-105 bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground group-hover:scale-105 hover:bg-primary/10 hover:text-primary"
                          )}
                          title={
                            isPlaying ? "Pause Preview" : "Play 30s Preview"
                          }
                          aria-label={
                            isPlaying
                              ? `Pause preview of ${track.titlePrimary}`
                              : `Play preview of ${track.titlePrimary}`
                          }
                        >
                          {isPlaying ? (
                            <IconPlayerPause
                              className="size-3.5 fill-current"
                              aria-hidden="true"
                            />
                          ) : (
                            <>
                              <span className="font-mono text-xs text-muted-foreground group-hover:hidden">
                                {trackNum}
                              </span>
                              <IconPlayerPlay
                                className="hidden size-3.5 fill-current ps-0.5 group-hover:block"
                                aria-hidden="true"
                              />
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground/80">
                          {trackNum}
                        </span>
                      )}
                    </div>

                    {/* Track Title and Artist */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={`/IRIS-list/music/tracks/${track.id}`}
                        className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-hidden"
                        title={track.titlePrimary}
                      >
                        {track.titlePrimary}
                      </Link>
                      {track.artistName &&
                        (track.artistPersonId || albumArtistPersonId ? (
                          <Link
                            href={`/IRIS-list/people/${track.artistPersonId || albumArtistPersonId}`}
                            className="truncate text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
                          >
                            {track.artistName}
                          </Link>
                        ) : (
                          <span className="truncate text-xs text-muted-foreground">
                            {track.artistName}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Right Column: Duration and Link Arrow */}
                  <div className="flex shrink-0 items-center gap-3">
                    {hasPreview && (
                      <Badge
                        variant="secondary"
                        className="hidden h-4 px-1.5 py-0 font-mono text-[10px] sm:inline-flex"
                      >
                        Preview
                      </Badge>
                    )}
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {formatDuration(track.duration)}
                    </span>
                    <Link
                      href={`/IRIS-list/music/tracks/${track.id}`}
                      className="rounded-lg p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                      aria-label={`View track details for ${track.titlePrimary}`}
                    >
                      <IconMusic className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {hasMoreTracks && onViewAll && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewAll}
            className="gap-1.5 rounded-2xl text-xs font-medium"
          >
            <span>View all {totalTracksCount} tracks</span>
          </Button>
        </div>
      )}
    </div>
  )
}
