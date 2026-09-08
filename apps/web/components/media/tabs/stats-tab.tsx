"use client"

import React, { useMemo } from "react"
import {
  IconChartBar,
  IconClock,
  IconExternalLink,
  IconHeadphones,
  IconHeart,
  IconPlayerPlay,
  IconRepeat,
  IconStarFilled,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react"
import type { NormalizedMediaData } from "../media-types"

interface StatsTabProps {
  media: NormalizedMediaData
}

export function StatsTab({ media }: StatsTabProps) {
  // Score Distribution data
  const scoreData = useMemo(() => {
    if (
      !media.scoreDistribution ||
      typeof media.scoreDistribution !== "object"
    ) {
      return []
    }
    const entries = Object.entries(media.scoreDistribution).map(
      ([scoreStr, count]) => ({
        score: Number(scoreStr),
        count: Number(count) || 0,
      })
    )
    entries.sort((a, b) => a.score - b.score)
    const maxCount = Math.max(1, ...entries.map((e) => e.count))
    return entries.map((e) => ({
      ...e,
      percentage: Math.round((e.count / maxCount) * 100),
    }))
  }, [media.scoreDistribution])

  // Status Distribution data
  const statusData = useMemo(() => {
    if (
      !media.statusDistribution ||
      typeof media.statusDistribution !== "object"
    ) {
      return []
    }
    const colorMap: Record<string, string> = {
      current: "bg-emerald-500",
      watching: "bg-emerald-500",
      reading: "bg-emerald-500",
      completed: "bg-blue-500",
      planning: "bg-amber-500",
      paused: "bg-orange-500",
      onHold: "bg-orange-500",
      dropped: "bg-rose-500",
    }

    const items = Object.entries(media.statusDistribution).map(
      ([status, count]) => {
        const numCount = Number(count) || 0
        const formattedStatus =
          status.charAt(0).toUpperCase() +
          status.slice(1).replace(/([A-Z])/g, " $1")
        return {
          key: status,
          label: formattedStatus,
          count: numCount,
          color: colorMap[status.toLowerCase()] || "bg-muted-foreground",
        }
      }
    )

    const total = items.reduce((acc, i) => acc + i.count, 0)
    return items.map((item) => ({
      ...item,
      share: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }))
  }, [media.statusDistribution])

  const totalStatusUsers = statusData.reduce((acc, i) => acc + i.count, 0)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Rankings & Community Stats
        </h2>
      </div>

      {/* 1. Score Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Local IRIS Score */}
        <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
          <span className="text-xs text-muted-foreground">Local Score</span>
          <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
            <IconStarFilled
              className="size-5 text-amber-500"
              aria-hidden="true"
            />
            <span>
              {typeof media.averageScore === "number" && media.averageScore > 0
                ? `${media.averageScore}%`
                : "No ratings yet"}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {typeof media.scoredCount === "number" && media.scoredCount > 0
              ? `${media.scoredCount.toLocaleString()} votes`
              : "0 votes"}
          </span>
        </div>

        {/* IMDb Rating (for movies/tv) */}
        {typeof media.imdbRating === "number" && media.imdbRating > 0 && (
          <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
            <span className="text-xs text-muted-foreground">IMDb Rating</span>
            <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
              <IconStarFilled
                className="size-5 text-amber-500"
                aria-hidden="true"
              />
              <span>{media.imdbRating.toFixed(1)} / 10</span>
            </div>
            {typeof media.imdbVotes === "number" && media.imdbVotes > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {media.imdbVotes.toLocaleString()} votes
              </span>
            )}
          </div>
        )}

        {/* AniList Score (only for anime) */}
        {media.category === "anime" &&
          typeof media.alAverageScore === "number" && (
            <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
              <span className="text-xs text-muted-foreground">
                AniList Score
              </span>
              <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
                <IconStarFilled
                  className="size-5 text-sky-500"
                  aria-hidden="true"
                />
                <span>{`${media.alAverageScore}%`}</span>
              </div>
            </div>
          )}

        {/* MAL Score (only for anime) */}
        {media.category === "anime" &&
          typeof media.malAverageScore === "number" && (
            <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
              <span className="text-xs text-muted-foreground">MyAnimeList</span>
              <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
                <IconStarFilled
                  className="size-5 text-indigo-500"
                  aria-hidden="true"
                />
                <span>{`${media.malAverageScore}%`}</span>
              </div>
            </div>
          )}

        {/* IGDB Rating (for games) */}
        {media.category === "games" &&
          typeof media.igdbRating === "number" &&
          media.igdbRating > 0 && (
            <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
              <span className="text-xs text-muted-foreground">IGDB Rating</span>
              <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
                <IconStarFilled
                  className="size-5 text-emerald-500"
                  aria-hidden="true"
                />
                <span>{media.igdbRating.toFixed(1)}%</span>
              </div>
              {typeof media.igdbRatingCount === "number" &&
                media.igdbRatingCount > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {media.igdbRatingCount.toLocaleString()} votes
                  </span>
                )}
            </div>
          )}

        {/* Google Books Rating (for books) */}
        {media.category === "books" &&
          typeof media.googleBooksRating === "number" &&
          media.googleBooksRating > 0 && (
            <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
              <span className="text-xs text-muted-foreground">
                Google Books
              </span>
              <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
                <IconStarFilled
                  className="size-5 text-amber-500"
                  aria-hidden="true"
                />
                <span>{media.googleBooksRating.toFixed(1)} / 5</span>
              </div>
              {typeof media.googleBooksRatingsCount === "number" &&
                media.googleBooksRatingsCount > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {media.googleBooksRatingsCount.toLocaleString()} ratings
                  </span>
                )}
            </div>
          )}

        {/* Rotten Tomatoes Score (TV) */}
        {typeof media.rottenTomatoesScore === "number" &&
          media.rottenTomatoesScore > 0 && (
            <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
              <span className="text-xs text-muted-foreground">
                Rotten Tomatoes
              </span>
              <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
                <IconStarFilled
                  className="size-5 text-rose-500"
                  aria-hidden="true"
                />
                <span>{Math.round(media.rottenTomatoesScore)}%</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Tomatometer
              </span>
            </div>
          )}

        {/* TVmaze Rating (TV) */}
        {typeof media.tvmazeRating === "number" && media.tvmazeRating > 0 && (
          <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
            <span className="text-xs text-muted-foreground">TVmaze Rating</span>
            <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
              <IconStarFilled
                className="size-5 text-teal-500"
                aria-hidden="true"
              />
              <span>{media.tvmazeRating.toFixed(1)} / 10</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Community score
            </span>
          </div>
        )}

        {/* Average Playtime (Games) */}
        {typeof media.averagePlaytime === "number" &&
          media.averagePlaytime > 0 && (
            <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
              <span className="text-xs text-muted-foreground">
                Average Playtime
              </span>
              <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
                <IconClock
                  className="size-5 text-blue-500"
                  aria-hidden="true"
                />
                <span>{media.averagePlaytime.toFixed(1)} hrs</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Estimated duration
              </span>
            </div>
          )}

        {/* Local Listeners (Music) */}
        {media.category === "music" && (
          <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
            <span className="text-xs text-muted-foreground">
              Local Listeners
            </span>
            <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
              <IconHeadphones
                className="size-5 text-primary"
                aria-hidden="true"
              />
              <span>
                {typeof media.listeners === "number"
                  ? media.listeners.toLocaleString()
                  : "0"}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Unique IRIS users
            </span>
          </div>
        )}

        {/* Local Scrobbles (Music) */}
        {media.category === "music" && (
          <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
            <span className="text-xs text-muted-foreground">
              Local Scrobbles
            </span>
            <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
              <IconPlayerPlay
                className="size-5 text-primary"
                aria-hidden="true"
              />
              <span>
                {typeof media.playCount === "number"
                  ? media.playCount.toLocaleString()
                  : "0"}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Total plays tracked
            </span>
          </div>
        )}

        {/* Community Engagement */}
        <div className="flex flex-col gap-1 rounded-2xl border border-border/40 bg-card p-4">
          <span className="text-xs text-muted-foreground">Favorites</span>
          <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
            <IconHeart className="size-5 text-rose-500" aria-hidden="true" />
            <span>
              {typeof media.favorites === "number"
                ? media.favorites.toLocaleString()
                : "0"}
            </span>
          </div>
          {typeof media.popularity === "number" && media.popularity > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <IconTrendingUp className="size-3" aria-hidden="true" />
              <span>Rank #{media.popularity}</span>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Last.fm Engagement Section for Music */}
      {Boolean(
        media.lastFmListeners || media.lastFmPlayCount || media.lastFmUrl
      ) && (
        <section
          aria-labelledby="lastfm-heading"
          className="rounded-2xl border border-border/40 bg-card p-5"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-[#D51007]/10 text-[#D51007]">
                <IconHeadphones className="size-4" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <h3
                  id="lastfm-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  Last.fm Statistics
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Global streaming metrics and scrobble data
                </span>
              </div>
            </div>

            {media.lastFmUrl && (
              <a
                href={media.lastFmUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <span>View on Last.fm</span>
                <IconExternalLink
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-xl border border-border/20 bg-muted/20 p-3.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Listeners
              </span>
              <span className="text-lg font-bold text-foreground tabular-nums">
                {media.lastFmListeners
                  ? media.lastFmListeners.toLocaleString()
                  : "0"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Total unique listeners
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-border/20 bg-muted/20 p-3.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Scrobbles
              </span>
              <span className="text-lg font-bold text-foreground tabular-nums">
                {media.lastFmPlayCount
                  ? media.lastFmPlayCount.toLocaleString()
                  : "0"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Total scrobbles
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-border/20 bg-muted/20 p-3.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Plays per Listener
              </span>
              <span className="text-lg font-bold text-foreground tabular-nums">
                {(() => {
                  const l = media.lastFmListeners ?? 0
                  const p = media.lastFmPlayCount ?? 0
                  if (l > 0 && p > 0) {
                    return (p / l).toFixed(1)
                  }
                  return "—"
                })()}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Average replay rate
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-border/20 bg-muted/20 p-3.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Replay Engagement
              </span>
              <span className="text-lg font-bold text-foreground tabular-nums">
                {(() => {
                  const l = media.lastFmListeners ?? 0
                  const p = media.lastFmPlayCount ?? 0
                  const ratio = l > 0 ? p / l : 0
                  if (ratio >= 20) return "Very High"
                  if (ratio >= 10) return "High"
                  if (ratio >= 4) return "Moderate"
                  if (ratio > 0) return "Normal"
                  return "—"
                })()}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Listener retention
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 2. Status Distribution */}
      {statusData.length > 0 && (
        <section
          aria-labelledby="status-dist-heading"
          className="rounded-2xl border border-border/40 bg-card p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconUsers className="size-4 text-primary" aria-hidden="true" />
              <h3
                id="status-dist-heading"
                className="text-sm font-semibold text-foreground"
              >
                Status Distribution
              </h3>
            </div>
            {totalStatusUsers > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {totalStatusUsers.toLocaleString()} Total Users
              </span>
            )}
          </div>

          {/* Stacked Progress Bar */}
          <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-muted/60">
            {statusData.map((item) => (
              <div
                key={item.key}
                style={{ width: `${item.share}%` }}
                className={`h-full ${item.color}`}
                title={`${item.label}: ${item.count.toLocaleString()} (${item.share}%)`}
              />
            ))}
          </div>

          {/* Status Breakdown Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {statusData.map((item) => (
              <div key={item.key} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${item.color}`} />
                  <span className="text-xs text-muted-foreground">
                    {item.label}
                  </span>
                </div>
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  {item.count.toLocaleString()}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({item.share}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Score Distribution */}
      {scoreData.length > 0 && (
        <section
          aria-labelledby="score-dist-heading"
          className="rounded-2xl border border-border/40 bg-card p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <IconChartBar className="size-4 text-primary" aria-hidden="true" />
            <h3
              id="score-dist-heading"
              className="text-sm font-semibold text-foreground"
            >
              Score Distribution
            </h3>
          </div>

          <div className="flex h-40 w-full items-end justify-between gap-1.5 pt-4">
            {scoreData.map((item) => (
              <div
                key={item.score}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="hidden text-[10px] text-muted-foreground tabular-nums sm:block">
                  {item.count > 0
                    ? item.count > 999
                      ? `${(item.count / 1000).toFixed(1)}k`
                      : item.count
                    : ""}
                </span>
                <div
                  className="w-full max-w-[28px] rounded-t-lg bg-primary/75 hover:bg-primary"
                  style={{ height: `${Math.max(4, item.percentage)}%` }}
                  title={`Score ${item.score}: ${item.count.toLocaleString()} votes`}
                />
                <span className="text-[10px] font-medium text-foreground/80 tabular-nums">
                  {item.score}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
