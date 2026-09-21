"use client"

import React from "react"
import { Card } from "@workspace/ui/components/card"
import { IconStar, IconClock } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"

export interface TopGenreData {
  genre: string
  count: number
  meanScore: number
  hours: number
}

export interface TopCreatorData {
  name: string
  count: number
  meanScore: number
}

interface GenreStudioBreakdownProps {
  genres: TopGenreData[]
  creators: TopCreatorData[]
  mediaType: string
}

export function GenreStudioBreakdown({
  genres,
  creators,
  mediaType,
}: GenreStudioBreakdownProps): React.JSX.Element {
  const getCreatorTitle = () => {
    switch (mediaType) {
      case "anime":
      case "movie":
        return "Top Studios"
      case "manga":
      case "book":
        return "Top Authors & Creators"
      case "tv":
        return "Top Networks"
      case "game":
        return "Top Developers"
      case "music":
        return "Top Artists"
      default:
        return "Top Studios & Creators"
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Top Genres Card */}
      <Card className="flex h-[380px] flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
        <h3 className="mb-3 shrink-0 font-heading text-sm font-semibold tracking-wide text-foreground uppercase">
          Top Genres
        </h3>

        <div className="flex-1 space-y-2 overflow-y-auto pe-1.5">
          {genres.length === 0 ? (
            <p className="text-xs text-muted-foreground">No genres recorded</p>
          ) : (
            genres.slice(0, 30).map((g, idx) => (
              <div
                key={g.genre}
                className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 p-2.5 transition-colors hover:border-border/80"
              >
                <div className="flex items-center gap-3">
                  <span className="w-4 font-mono text-xs font-semibold text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-foreground">
                      {g.genre}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{g.count.toLocaleString()} titles</span>
                      {g.hours > 0 && (
                        <span className="flex items-center gap-0.5">
                          • <IconClock className="ms-0.5 size-2.5" /> {g.hours}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {g.meanScore > 0 ? (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 rounded-xl text-xs font-semibold"
                  >
                    <IconStar className="size-3 fill-amber-500 text-amber-500" />
                    {g.meanScore.toFixed(1)}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Top Creators / Studios Card */}
      <Card className="flex h-[380px] flex-col rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
        <h3 className="mb-3 shrink-0 font-heading text-sm font-semibold tracking-wide text-foreground uppercase">
          {getCreatorTitle()}
        </h3>

        <div className="flex-1 space-y-2 overflow-y-auto pe-1.5">
          {creators.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No creator data available
            </p>
          ) : (
            creators.slice(0, 30).map((c, idx) => (
              <div
                key={c.name}
                className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 p-2.5 transition-colors hover:border-border/80"
              >
                <div className="flex items-center gap-3">
                  <span className="w-4 font-mono text-xs font-semibold text-muted-foreground">
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="line-clamp-1 text-xs font-semibold text-foreground">
                      {c.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {c.count.toLocaleString()}{" "}
                      {c.count === 1 ? "title" : "titles"}
                    </span>
                  </div>
                </div>

                {c.meanScore > 0 ? (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 rounded-xl text-xs font-semibold"
                  >
                    <IconStar className="size-3 fill-amber-500 text-amber-500" />
                    {c.meanScore.toFixed(1)}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
