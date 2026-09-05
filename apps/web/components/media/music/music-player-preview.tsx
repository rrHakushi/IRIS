"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconVolume,
  IconVolumeOff,
  IconHeadphones,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

interface MusicPlayerPreviewProps {
  audioUrl: string
  title: string
  artist?: string | null
  className?: string
}

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return "0:00"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function MusicPlayerPreview({
  audioUrl,
  title,
  artist,
  className,
}: MusicPlayerPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(30)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration)
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.pause()
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("ended", handleEnded)
      audioRef.current = null
    }
  }, [audioUrl])

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch(() => {
        setIsPlaying(false)
      })
      setIsPlaying(true)
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    audioRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border border-primary/20 bg-card/80 p-4 shadow-sm backdrop-blur-xs transition-all hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            onClick={togglePlay}
            className="size-10 rounded-full bg-primary text-primary-foreground shadow-xs transition-transform hover:scale-105 hover:bg-primary/90"
            aria-label={isPlaying ? "Pause audio preview" : "Play audio preview"}
          >
            {isPlaying ? (
              <IconPlayerPause className="size-5 fill-current" aria-hidden="true" />
            ) : (
              <IconPlayerPlay className="size-5 fill-current ps-0.5" aria-hidden="true" />
            )}
          </Button>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {title}
              </span>
              <Badge variant="secondary" className="text-[10px] font-mono py-0 h-4">
                30s Preview
              </Badge>
            </div>
            {artist && (
              <span className="truncate text-xs text-muted-foreground">
                {artist}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label={isMuted ? "Unmute audio" : "Mute audio"}
          >
            {isMuted ? (
              <IconVolumeOff className="size-4" aria-hidden="true" />
            ) : (
              <IconVolume className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Progress Bar & Timestamps */}
      <div className="flex flex-col gap-1">
        <div className="relative flex w-full items-center">
          <input
            type="range"
            min={0}
            max={duration || 30}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary focus-visible:outline-hidden"
            aria-label="Seek audio preview"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  )
}
