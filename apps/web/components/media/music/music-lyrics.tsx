"use client"

import React, { useMemo, useState } from "react"
import {
  IconMicrophone,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

interface MusicLyricsProps {
  lyrics?: string | null
  syncedLyrics?: string | null
  title?: string
  artist?: string | null
  defaultExpanded?: boolean
  className?: string
}

export function MusicLyrics({
  lyrics,
  syncedLyrics,
  title,
  artist,
  defaultExpanded = false,
  className,
}: MusicLyricsProps) {
  const [copied, setCopied] = useState(false)
  const [showSynced, setShowSynced] = useState(false)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const hasSynced = Boolean(syncedLyrics && syncedLyrics.trim().length > 0)
  const hasPlain = Boolean(lyrics && lyrics.trim().length > 0)

  // Default active text
  const activeText = useMemo(() => {
    if (showSynced && hasSynced) {
      return syncedLyrics!
    }
    if (hasPlain) {
      return lyrics!
    }
    if (hasSynced) {
      return syncedLyrics!
    }
    return ""
  }, [showSynced, hasSynced, hasPlain, syncedLyrics, lyrics])

  // Parse lines for synced view or line count
  const parsedLines = useMemo(() => {
    if (!activeText) return []
    return activeText.split("\n").map((line) => {
      if (showSynced && hasSynced) {
        const match = line.match(/^\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\](.*)$/)
        if (match && match[1] && match[2] !== undefined) {
          return {
            timestamp: match[1],
            text: match[2].trim(),
          }
        }
      }
      return {
        timestamp: null,
        text: line,
      }
    })
  }, [activeText, showSynced, hasSynced])

  const nonEmptyLinesCount = useMemo(() => {
    return parsedLines.filter((l) => l.text.trim().length > 0).length
  }, [parsedLines])

  const isLong = nonEmptyLinesCount > 20 || activeText.length > 700

  const handleCopy = () => {
    if (!activeText) return
    navigator.clipboard.writeText(activeText)
    setCopied(true)
    toast.success("Lyrics copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  if (!hasPlain && !hasSynced) {
    return null
  }

  return (
    <section
      aria-labelledby="lyrics-section-heading"
      className={cn("flex flex-col gap-3", className)}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconMicrophone className="size-4" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-2">
            <h2
              id="lyrics-section-heading"
              className="text-base font-semibold text-foreground"
            >
              Lyrics
            </h2>
            {artist && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {title ? `"${title}" by ` : "by "}
                {artist}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasSynced && hasPlain && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSynced((prev) => !prev)}
              className="h-7 rounded-xl px-2.5 text-xs font-medium"
            >
              {showSynced ? "Plain Text" : "Synced (LRC)"}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 gap-1.5 rounded-xl px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <IconCheck className="size-3.5 text-primary" aria-hidden="true" />
            ) : (
              <IconCopy className="size-3.5" aria-hidden="true" />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
      </div>

      {/* Lyrics Container */}
      <div
        className={cn(
          "rounded-2xl border border-border/40 bg-card/60 p-5 shadow-xs transition-all sm:p-6",
          !isExpanded && isLong && "relative max-h-[400px] overflow-hidden"
        )}
      >
        <div className="flex flex-col gap-1 select-text">
          {parsedLines.map((line, idx) => {
            if (!line.text && !line.timestamp) {
              return <div key={idx} className="h-3.5" />
            }

            return (
              <div
                key={idx}
                className="flex items-baseline gap-3 text-sm leading-relaxed text-foreground/90"
              >
                {line.timestamp && (
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 select-none">
                    [{line.timestamp}]
                  </span>
                )}
                <span className="break-words">{line.text || " "}</span>
              </div>
            )
          })}
        </div>

        {/* Gradient fade and Expand button when collapsed */}
        {!isExpanded && isLong && (
          <div className="absolute inset-x-0 bottom-0 flex h-24 items-end justify-center bg-gradient-to-t from-card via-card/90 to-transparent pb-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="h-8 gap-1.5 rounded-xl border border-border/40 bg-background/95 px-3.5 text-xs font-medium shadow-xs hover:bg-accent"
            >
              <span>Show full lyrics ({nonEmptyLinesCount} lines)</span>
              <IconChevronDown className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {/* Collapse button when expanded */}
      {isExpanded && isLong && !defaultExpanded && (
        <div className="flex justify-center pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-7 gap-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <span>Show less</span>
            <IconChevronUp className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}
    </section>
  )
}
