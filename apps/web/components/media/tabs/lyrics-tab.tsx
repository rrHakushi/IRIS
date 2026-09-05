"use client"

import React from "react"
import { IconMicrophone } from "@tabler/icons-react"
import { MusicLyrics } from "../music/music-lyrics"

interface LyricsTabProps {
  lyrics?: string | null
  syncedLyrics?: string | null
  title?: string
  artist?: string | null
}

export function LyricsTab({
  lyrics,
  syncedLyrics,
  title,
  artist,
}: LyricsTabProps) {
  if (!lyrics && !syncedLyrics) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-12 text-center">
        <IconMicrophone className="size-8 text-muted-foreground/40" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">
          No lyrics available for this track.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <MusicLyrics
        lyrics={lyrics}
        syncedLyrics={syncedLyrics}
        title={title}
        artist={artist}
        defaultExpanded={true}
      />
    </div>
  )
}
