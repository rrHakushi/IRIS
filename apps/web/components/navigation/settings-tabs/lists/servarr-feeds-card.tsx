"use client"

import React, { useState, useEffect } from "react"
import { useUser } from "@/context/user-context"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Switch } from "@workspace/ui/components/switch"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconDeviceTv,
  IconMovie,
  IconCopy,
  IconCheck,
  IconRotate2,
  IconDeviceFloppy,
  IconInfoCircle,
  IconServer,
  IconChevronDown,
  IconAdjustments,
  IconHelpCircle,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { API_URL } from "@/lib/elysia"
import { cn } from "@workspace/ui/lib/utils"

interface OptionItem {
  id: string
  label: string
}

const LIST_STATUS_OPTIONS: OptionItem[] = [
  { id: "PLANNING", label: "Planning" },
  { id: "WATCHING", label: "Watching" },
  { id: "COMPLETED", label: "Completed" },
  { id: "ON_HOLD", label: "On Hold" },
  { id: "DROPPED", label: "Dropped" },
]

const MOVIE_LIST_STATUS_OPTIONS: OptionItem[] = [
  { id: "PLANNING", label: "Planning" },
  { id: "WATCHING", label: "Watching" },
  { id: "COMPLETED", label: "Completed" },
  { id: "DROPPED", label: "Dropped" },
]

const TV_RELEASE_STATUS_OPTIONS: OptionItem[] = [
  { id: "RETURNING_SERIES", label: "Returning Series" },
  { id: "ENDED", label: "Ended" },
  { id: "CANCELED", label: "Canceled" },
  { id: "IN_PRODUCTION", label: "In Production" },
  { id: "UPCOMING", label: "Upcoming" },
]

const ANIME_RELEASE_STATUS_OPTIONS: OptionItem[] = [
  { id: "FINISHED", label: "Finished" },
  { id: "RELEASING", label: "Releasing" },
  { id: "NOT_YET_RELEASED", label: "Not Yet Released" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "HIATUS", label: "Hiatus" },
]

const MOVIE_RELEASE_STATUS_OPTIONS: OptionItem[] = [
  { id: "RELEASED", label: "Released" },
  { id: "IN_PRODUCTION", label: "In Production" },
  { id: "POST_PRODUCTION", label: "Post-Production" },
  { id: "RUMORED", label: "Rumored" },
  { id: "CANCELLED", label: "Cancelled" },
]

const ANIME_FORMAT_OPTIONS: OptionItem[] = [
  { id: "TV", label: "TV" },
  { id: "TV_SHORT", label: "TV Short" },
  { id: "ONA", label: "ONA" },
  { id: "OVA", label: "OVA" },
  { id: "SPECIAL", label: "Special" },
]

const ANIME_MOVIE_FORMAT_OPTIONS: OptionItem[] = [
  { id: "MOVIE", label: "Movie" },
  { id: "SPECIAL", label: "Special" },
  { id: "OVA", label: "OVA" },
  { id: "ONA", label: "ONA" },
]

interface SonarrAnimeState {
  enabled: boolean
  monitored: boolean
  listStatuses: string[]
  animeStatuses: string[]
  animeFormats: string[]
}

interface SonarrTvState {
  enabled: boolean
  monitored: boolean
  listStatuses: string[]
  tvStatuses: string[]
}

interface RadarrMovieState {
  enabled: boolean
  monitored: boolean
  listStatuses: string[]
  movieStatuses: string[]
}

interface RadarrAnimeState {
  enabled: boolean
  monitored: boolean
  listStatuses: string[]
  animeStatuses: string[]
  animeMovieFormats: string[]
}

const DEFAULT_SONARR_ANIME: SonarrAnimeState = {
  enabled: true,
  monitored: true,
  listStatuses: ["PLANNING", "WATCHING"],
  animeStatuses: ["FINISHED", "RELEASING"],
  animeFormats: ["TV", "TV_SHORT"],
}

const DEFAULT_SONARR_TV: SonarrTvState = {
  enabled: true,
  monitored: true,
  listStatuses: ["PLANNING", "WATCHING"],
  tvStatuses: ["RETURNING_SERIES", "ENDED"],
}

const DEFAULT_RADARR_MOVIE: RadarrMovieState = {
  enabled: true,
  monitored: true,
  listStatuses: ["PLANNING"],
  movieStatuses: ["RELEASED"],
}

const DEFAULT_RADARR_ANIME: RadarrAnimeState = {
  enabled: true,
  monitored: true,
  listStatuses: ["PLANNING"],
  animeStatuses: ["FINISHED", "RELEASING"],
  animeMovieFormats: ["MOVIE"],
}

export function ServarrFeedsCard(): React.JSX.Element {
  const { user, updateUser } = useUser()

  // App group toggles
  const [sonarrGroupEnabled, setSonarrGroupEnabled] = useState(true)
  const [radarrGroupEnabled, setRadarrGroupEnabled] = useState(true)

  // Individual feed states
  const [sonarrAnime, setSonarrAnime] =
    useState<SonarrAnimeState>(DEFAULT_SONARR_ANIME)
  const [sonarrTv, setSonarrTv] = useState<SonarrTvState>(DEFAULT_SONARR_TV)
  const [radarrMovie, setRadarrMovie] =
    useState<RadarrMovieState>(DEFAULT_RADARR_MOVIE)
  const [radarrAnime, setRadarrAnime] =
    useState<RadarrAnimeState>(DEFAULT_RADARR_ANIME)

  const [isSaving, setIsSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedFeeds, setExpandedFeeds] = useState<Record<string, boolean>>({
    "sonarr-anime": false,
    "sonarr-tv": false,
    "radarr-movies": false,
    "radarr-anime": false,
  })

  const toggleFeedExpanded = (id: string) => {
    setExpandedFeeds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const [showGuide, setShowGuide] = useState(false)

  // Initialize from user settings
  useEffect(() => {
    if (user?.settings) {
      const servarr = (user.settings as any).servarr
      if (servarr) {
        if (typeof servarr.sonarrEnabled === "boolean") {
          setSonarrGroupEnabled(servarr.sonarrEnabled)
        }
        if (typeof servarr.radarrEnabled === "boolean") {
          setRadarrGroupEnabled(servarr.radarrEnabled)
        }
        if (servarr.sonarrAnime) {
          setSonarrAnime({
            enabled: servarr.sonarrAnime.enabled ?? true,
            monitored: servarr.sonarrAnime.monitored ?? true,
            listStatuses:
              servarr.sonarrAnime.listStatuses ??
              DEFAULT_SONARR_ANIME.listStatuses,
            animeStatuses:
              servarr.sonarrAnime.animeStatuses ??
              DEFAULT_SONARR_ANIME.animeStatuses,
            animeFormats:
              servarr.sonarrAnime.animeFormats ??
              DEFAULT_SONARR_ANIME.animeFormats,
          })
        }
        if (servarr.sonarrTv) {
          setSonarrTv({
            enabled: servarr.sonarrTv.enabled ?? true,
            monitored: servarr.sonarrTv.monitored ?? true,
            listStatuses:
              servarr.sonarrTv.listStatuses ?? DEFAULT_SONARR_TV.listStatuses,
            tvStatuses:
              servarr.sonarrTv.tvStatuses ?? DEFAULT_SONARR_TV.tvStatuses,
          })
        }
        if (servarr.radarrMovie) {
          setRadarrMovie({
            enabled: servarr.radarrMovie.enabled ?? true,
            monitored: servarr.radarrMovie.monitored ?? true,
            listStatuses:
              servarr.radarrMovie.listStatuses ??
              DEFAULT_RADARR_MOVIE.listStatuses,
            movieStatuses:
              servarr.radarrMovie.movieStatuses ??
              DEFAULT_RADARR_MOVIE.movieStatuses,
          })
        }
        if (servarr.radarrAnime) {
          setRadarrAnime({
            enabled: servarr.radarrAnime.enabled ?? true,
            monitored: servarr.radarrAnime.monitored ?? true,
            listStatuses:
              servarr.radarrAnime.listStatuses ??
              DEFAULT_RADARR_ANIME.listStatuses,
            animeStatuses:
              servarr.radarrAnime.animeStatuses ??
              DEFAULT_RADARR_ANIME.animeStatuses,
            animeMovieFormats:
              servarr.radarrAnime.animeMovieFormats ??
              DEFAULT_RADARR_ANIME.animeMovieFormats,
          })
        }
      }
    }
  }, [user?.settings])

  const toggleItem = (
    currentList: string[],
    item: string,
    setter: (newList: string[]) => void
  ) => {
    if (currentList.includes(item)) {
      if (currentList.length === 1) return // Keep at least one selected
      setter(currentList.filter((i) => i !== item))
    } else {
      setter([...currentList, item])
    }
  }

  const handleCopyUrl = async (id: string, path: string) => {
    const fullUrl = `${API_URL}${path}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedId(id)
      toast.success("Feed URL copied to clipboard!")
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("Failed to copy URL to clipboard")
    }
  }

  const handleResetDefaults = () => {
    setSonarrGroupEnabled(true)
    setRadarrGroupEnabled(true)
    setSonarrAnime(DEFAULT_SONARR_ANIME)
    setSonarrTv(DEFAULT_SONARR_TV)
    setRadarrMovie(DEFAULT_RADARR_MOVIE)
    setRadarrAnime(DEFAULT_RADARR_ANIME)
    toast.info("Reset Servarr feed settings to default values")
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      const currentSettings = user?.settings || {}
      await updateUser({
        settings: {
          ...currentSettings,
          servarr: {
            sonarrEnabled: sonarrGroupEnabled,
            radarrEnabled: radarrGroupEnabled,
            sonarrAnime,
            sonarrTv,
            radarrMovie,
            radarrAnime,
          },
        },
      })
      toast.success("Servarr automation settings saved successfully!")
    } catch (err: any) {
      toast.error(err?.message || "Failed to save Servarr settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconServer className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Servarr Automation
          </h3>
        </div>

        <Button
          type="button"
          variant={showGuide ? "secondary" : "ghost"}
          size="icon"
          onClick={() => setShowGuide((prev) => !prev)}
          className={cn(
            "h-7 w-7 rounded-lg transition-colors",
            showGuide
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="How to configure Sonarr & Radarr"
        >
          <IconHelpCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Info Instruction Banner (Toggled by ?) */}
      {showGuide && (
        <div className="mb-4 flex animate-in items-start justify-between gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground duration-200 fade-in slide-in-from-top-1">
          <div className="flex items-start gap-2.5">
            <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-0.5">
              <span className="font-semibold text-primary">
                How to configure in Sonarr & Radarr:
              </span>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                In Sonarr / Radarr, navigate to{" "}
                <strong>Settings &gt; Import Lists &gt; (+) &gt; Sonarr</strong>{" "}
                (or <strong>Radarr</strong>). Paste the feed URL as the{" "}
                <strong>Base URL</strong> and enter your IRIS API Key (generate
                one under{" "}
                <span className="underline decoration-dotted">
                  Settings &gt; API Keys
                </span>
                ) in the <strong>API Key</strong> field. Click <em>Test</em> to
                verify connection.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowGuide(false)}
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Close guide"
          >
            <IconX className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Groups Container */}
      <div className="mt-4 space-y-5">
        {/* ========================================================= */}
        {/* 1. SONARR GROUP                                           */}
        {/* ========================================================= */}
        <div className="rounded-xl border border-border/60 bg-muted/5 p-3.5 sm:p-4">
          {/* Sonarr Group Header */}
          <div className="flex flex-col gap-2 border-b border-border/40 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                <IconDeviceTv className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Sonarr
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Anime and TV show import feeds for Sonarr
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-medium text-muted-foreground">
                {sonarrGroupEnabled ? "Enabled" : "Disabled"}
              </span>
              <Switch
                isSelected={sonarrGroupEnabled}
                onChange={setSonarrGroupEnabled}
                aria-label="Toggle all Sonarr feeds"
              />
            </div>
          </div>

          {/* Sonarr Feeds List */}
          <div
            className={cn(
              "mt-3 space-y-3 transition-opacity duration-200",
              !sonarrGroupEnabled && "opacity-60"
            )}
          >
            {/* Feed 1: Sonarr Anime */}
            <div
              className={cn(
                "rounded-xl border bg-background/50 p-3 transition-colors duration-200 sm:p-3.5",
                expandedFeeds["sonarr-anime"]
                  ? "border-primary"
                  : "border-border/50 hover:border-border/80"
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    Anime Feed
                  </span>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {API_URL}/servarr/sonarr/anime
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                  {/* Route Enable/Disable Switch */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/40 px-2 py-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {!sonarrGroupEnabled
                        ? "Group Off"
                        : sonarrAnime.enabled
                          ? "Active"
                          : "Disabled"}
                    </span>
                    <Switch
                      isSelected={sonarrGroupEnabled && sonarrAnime.enabled}
                      onChange={(val) =>
                        setSonarrAnime((prev) => ({ ...prev, enabled: val }))
                      }
                      isDisabled={!sonarrGroupEnabled}
                      aria-label="Toggle Sonarr Anime route"
                    />
                  </div>

                  {/* Configure Toggle Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFeedExpanded("sonarr-anime")}
                    disabled={!sonarrGroupEnabled || !sonarrAnime.enabled}
                    className="h-7 gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    <IconAdjustments className="h-3.5 w-3.5" />
                    <span>
                      {expandedFeeds["sonarr-anime"] ? "Hide" : "Configure"}
                    </span>
                    <IconChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        expandedFeeds["sonarr-anime"] && "rotate-180"
                      )}
                    />
                  </Button>

                  {/* Copy URL Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleCopyUrl("sonarr-anime", "/servarr/sonarr/anime")
                    }
                    className="h-7 gap-1 rounded-xl text-xs"
                  >
                    {copiedId === "sonarr-anime" ? (
                      <>
                        <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <IconCopy className="h-3.5 w-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Collapsible Configuration Options */}
              {expandedFeeds["sonarr-anime"] && (
                <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
                  {/* Monitored Switch */}
                  <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-2.5">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-foreground">
                        Set Imported Series as Monitored
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        When enabled, Sonarr automatically monitors imported
                        anime series and searches for missing episodes.
                      </p>
                    </div>
                    <Switch
                      isSelected={sonarrAnime.monitored}
                      onChange={(checked) =>
                        setSonarrAnime((prev) => ({
                          ...prev,
                          monitored: checked,
                        }))
                      }
                      aria-label="Set Sonarr Anime as Monitored"
                    />
                  </div>

                  {/* Filter Checkbox Groups */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* List Statuses */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        List Statuses
                      </span>
                      <div className="space-y-1">
                        {LIST_STATUS_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={sonarrAnime.listStatuses.includes(
                                opt.id
                              )}
                              onChange={() =>
                                toggleItem(
                                  sonarrAnime.listStatuses,
                                  opt.id,
                                  (list) =>
                                    setSonarrAnime((prev) => ({
                                      ...prev,
                                      listStatuses: list,
                                    }))
                                )
                              }
                              aria-label={`Sonarr Anime ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Airing Statuses */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Airing Statuses
                      </span>
                      <div className="space-y-1">
                        {ANIME_RELEASE_STATUS_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={sonarrAnime.animeStatuses.includes(
                                opt.id
                              )}
                              onChange={() =>
                                toggleItem(
                                  sonarrAnime.animeStatuses,
                                  opt.id,
                                  (list) =>
                                    setSonarrAnime((prev) => ({
                                      ...prev,
                                      animeStatuses: list,
                                    }))
                                )
                              }
                              aria-label={`Sonarr Anime Airing ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Formats */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Formats
                      </span>
                      <div className="space-y-1">
                        {ANIME_FORMAT_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={sonarrAnime.animeFormats.includes(
                                opt.id
                              )}
                              onChange={() =>
                                toggleItem(
                                  sonarrAnime.animeFormats,
                                  opt.id,
                                  (list) =>
                                    setSonarrAnime((prev) => ({
                                      ...prev,
                                      animeFormats: list,
                                    }))
                                )
                              }
                              aria-label={`Sonarr Anime Format ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feed 2: Sonarr TV */}
            <div
              className={cn(
                "rounded-xl border bg-background/50 p-3 transition-colors duration-200 sm:p-3.5",
                expandedFeeds["sonarr-tv"]
                  ? "border-primary"
                  : "border-border/50 hover:border-border/80"
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    TV Shows Feed
                  </span>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {API_URL}/servarr/sonarr/tv
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                  {/* Route Enable/Disable Switch */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/40 px-2 py-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {!sonarrGroupEnabled
                        ? "Group Off"
                        : sonarrTv.enabled
                          ? "Active"
                          : "Disabled"}
                    </span>
                    <Switch
                      isSelected={sonarrGroupEnabled && sonarrTv.enabled}
                      onChange={(val) =>
                        setSonarrTv((prev) => ({ ...prev, enabled: val }))
                      }
                      isDisabled={!sonarrGroupEnabled}
                      aria-label="Toggle Sonarr TV route"
                    />
                  </div>

                  {/* Configure Toggle Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFeedExpanded("sonarr-tv")}
                    disabled={!sonarrGroupEnabled || !sonarrTv.enabled}
                    className="h-7 gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    <IconAdjustments className="h-3.5 w-3.5" />
                    <span>
                      {expandedFeeds["sonarr-tv"] ? "Hide" : "Configure"}
                    </span>
                    <IconChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        expandedFeeds["sonarr-tv"] && "rotate-180"
                      )}
                    />
                  </Button>

                  {/* Copy URL Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleCopyUrl("sonarr-tv", "/servarr/sonarr/tv")
                    }
                    className="h-7 gap-1 rounded-xl text-xs"
                  >
                    {copiedId === "sonarr-tv" ? (
                      <>
                        <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <IconCopy className="h-3.5 w-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Collapsible Configuration Options */}
              {expandedFeeds["sonarr-tv"] && (
                <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
                  {/* Monitored Switch */}
                  <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-2.5">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-foreground">
                        Set Imported Series as Monitored
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        When enabled, Sonarr automatically monitors imported
                        standard TV shows and searches for missing episodes.
                      </p>
                    </div>
                    <Switch
                      isSelected={sonarrTv.monitored}
                      onChange={(checked) =>
                        setSonarrTv((prev) => ({ ...prev, monitored: checked }))
                      }
                      aria-label="Set Sonarr TV as Monitored"
                    />
                  </div>

                  {/* Filter Checkbox Groups */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* List Statuses */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        List Statuses
                      </span>
                      <div className="space-y-1">
                        {LIST_STATUS_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={sonarrTv.listStatuses.includes(
                                opt.id
                              )}
                              onChange={() =>
                                toggleItem(
                                  sonarrTv.listStatuses,
                                  opt.id,
                                  (list) =>
                                    setSonarrTv((prev) => ({
                                      ...prev,
                                      listStatuses: list,
                                    }))
                                )
                              }
                              aria-label={`Sonarr TV ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Release Statuses */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Series Statuses
                      </span>
                      <div className="space-y-1">
                        {TV_RELEASE_STATUS_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={sonarrTv.tvStatuses.includes(opt.id)}
                              onChange={() =>
                                toggleItem(
                                  sonarrTv.tvStatuses,
                                  opt.id,
                                  (list) =>
                                    setSonarrTv((prev) => ({
                                      ...prev,
                                      tvStatuses: list,
                                    }))
                                )
                              }
                              aria-label={`Sonarr TV Status ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. RADARR GROUP                                           */}
        {/* ========================================================= */}
        <div className="rounded-xl border border-border/60 bg-muted/5 p-3.5 sm:p-4">
          {/* Radarr Group Header */}
          <div className="flex flex-col gap-2 border-b border-border/40 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                <IconMovie className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Radarr
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Movie and Anime movie import feeds for Radarr
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs font-medium text-muted-foreground">
                {radarrGroupEnabled ? "Enabled" : "Disabled"}
              </span>
              <Switch
                isSelected={radarrGroupEnabled}
                onChange={setRadarrGroupEnabled}
                aria-label="Toggle all Radarr feeds"
              />
            </div>
          </div>

          {/* Radarr Feeds List */}
          <div
            className={cn(
              "mt-3 space-y-3 transition-opacity duration-200",
              !radarrGroupEnabled && "opacity-60"
            )}
          >
            {/* Feed 3: Radarr Movies */}
            <div
              className={cn(
                "rounded-xl border bg-background/50 p-3 transition-colors duration-200 sm:p-3.5",
                expandedFeeds["radarr-movies"]
                  ? "border-primary"
                  : "border-border/50 hover:border-border/80"
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    Movies Feed
                  </span>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {API_URL}/servarr/radarr/movies
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                  {/* Route Enable/Disable Switch */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/40 px-2 py-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {!radarrGroupEnabled
                        ? "Group Off"
                        : radarrMovie.enabled
                          ? "Active"
                          : "Disabled"}
                    </span>
                    <Switch
                      isSelected={radarrGroupEnabled && radarrMovie.enabled}
                      onChange={(val) =>
                        setRadarrMovie((prev) => ({ ...prev, enabled: val }))
                      }
                      isDisabled={!radarrGroupEnabled}
                      aria-label="Toggle Radarr Movies route"
                    />
                  </div>

                  {/* Configure Toggle Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFeedExpanded("radarr-movies")}
                    disabled={!radarrGroupEnabled || !radarrMovie.enabled}
                    className="h-7 gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    <IconAdjustments className="h-3.5 w-3.5" />
                    <span>
                      {expandedFeeds["radarr-movies"] ? "Hide" : "Configure"}
                    </span>
                    <IconChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        expandedFeeds["radarr-movies"] && "rotate-180"
                      )}
                    />
                  </Button>

                  {/* Copy URL Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleCopyUrl("radarr-movies", "/servarr/radarr/movies")
                    }
                    className="h-7 gap-1 rounded-xl text-xs"
                  >
                    {copiedId === "radarr-movies" ? (
                      <>
                        <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <IconCopy className="h-3.5 w-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Collapsible Configuration Options */}
              {expandedFeeds["radarr-movies"] && (
                <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
                  {/* Monitored Switch */}
                  <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-2.5">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-foreground">
                        Set Imported Movies as Monitored
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        When enabled, Radarr automatically monitors imported
                        movies and searches for releases matching your quality
                        profiles.
                      </p>
                    </div>
                    <Switch
                      isSelected={radarrMovie.monitored}
                      onChange={(checked) =>
                        setRadarrMovie((prev) => ({
                          ...prev,
                          monitored: checked,
                        }))
                      }
                      aria-label="Set Radarr Movies as Monitored"
                    />
                  </div>

                  {/* Filter Checkbox Groups */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* List Statuses */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        List Statuses
                      </span>
                      <div className="space-y-1">
                        {MOVIE_LIST_STATUS_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={radarrMovie.listStatuses.includes(
                                opt.id
                              )}
                              onChange={() =>
                                toggleItem(
                                  radarrMovie.listStatuses,
                                  opt.id,
                                  (list) =>
                                    setRadarrMovie((prev) => ({
                                      ...prev,
                                      listStatuses: list,
                                    }))
                                )
                              }
                              aria-label={`Radarr Movie ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Release Statuses */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Movie Statuses
                      </span>
                      <div className="space-y-1">
                        {MOVIE_RELEASE_STATUS_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={radarrMovie.movieStatuses.includes(
                                opt.id
                              )}
                              onChange={() =>
                                toggleItem(
                                  radarrMovie.movieStatuses,
                                  opt.id,
                                  (list) =>
                                    setRadarrMovie((prev) => ({
                                      ...prev,
                                      movieStatuses: list,
                                    }))
                                )
                              }
                              aria-label={`Radarr Movie Status ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feed 4: Radarr Anime Movies */}
            <div
              className={cn(
                "rounded-xl border bg-background/50 p-3 transition-colors duration-200 sm:p-3.5",
                expandedFeeds["radarr-anime"]
                  ? "border-primary"
                  : "border-border/50 hover:border-border/80"
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    Anime Movies Feed
                  </span>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {API_URL}/servarr/radarr/movies/anime
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                  {/* Route Enable/Disable Switch */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/40 px-2 py-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {!radarrGroupEnabled
                        ? "Group Off"
                        : radarrAnime.enabled
                          ? "Active"
                          : "Disabled"}
                    </span>
                    <Switch
                      isSelected={radarrGroupEnabled && radarrAnime.enabled}
                      onChange={(val) =>
                        setRadarrAnime((prev) => ({ ...prev, enabled: val }))
                      }
                      isDisabled={!radarrGroupEnabled}
                      aria-label="Toggle Radarr Anime Movies route"
                    />
                  </div>

                  {/* Configure Toggle Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFeedExpanded("radarr-anime")}
                    disabled={!radarrGroupEnabled || !radarrAnime.enabled}
                    className="h-7 gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    <IconAdjustments className="h-3.5 w-3.5" />
                    <span>
                      {expandedFeeds["radarr-anime"] ? "Hide" : "Configure"}
                    </span>
                    <IconChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        expandedFeeds["radarr-anime"] && "rotate-180"
                      )}
                    />
                  </Button>

                  {/* Copy URL Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleCopyUrl(
                        "radarr-anime",
                        "/servarr/radarr/movies/anime"
                      )
                    }
                    className="h-7 gap-1 rounded-xl text-xs"
                  >
                    {copiedId === "radarr-anime" ? (
                      <>
                        <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <IconCopy className="h-3.5 w-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Collapsible Configuration Options */}
              {expandedFeeds["radarr-anime"] && (
                <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
                  {/* Monitored Switch */}
                  <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-2.5">
                    <div className="space-y-0.5">
                      <span className="text-xs font-medium text-foreground">
                        Set Imported Movies as Monitored
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        When enabled, Radarr automatically monitors imported
                        anime movies and searches for releases.
                      </p>
                    </div>
                    <Switch
                      isSelected={radarrAnime.monitored}
                      onChange={(checked) =>
                        setRadarrAnime((prev) => ({
                          ...prev,
                          monitored: checked,
                        }))
                      }
                      aria-label="Set Radarr Anime Movies as Monitored"
                    />
                  </div>

                  {/* Filter Checkbox Groups */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* List Statuses */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        List Statuses
                      </span>
                      <div className="space-y-1">
                        {MOVIE_LIST_STATUS_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={radarrAnime.listStatuses.includes(
                                opt.id
                              )}
                              onChange={() =>
                                toggleItem(
                                  radarrAnime.listStatuses,
                                  opt.id,
                                  (list) =>
                                    setRadarrAnime((prev) => ({
                                      ...prev,
                                      listStatuses: list,
                                    }))
                                )
                              }
                              aria-label={`Radarr Anime Movie ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Release Statuses */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Airing Statuses
                      </span>
                      <div className="space-y-1">
                        {ANIME_RELEASE_STATUS_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={radarrAnime.animeStatuses.includes(
                                opt.id
                              )}
                              onChange={() =>
                                toggleItem(
                                  radarrAnime.animeStatuses,
                                  opt.id,
                                  (list) =>
                                    setRadarrAnime((prev) => ({
                                      ...prev,
                                      animeStatuses: list,
                                    }))
                                )
                              }
                              aria-label={`Radarr Anime Movie Airing ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Formats */}
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Formats
                      </span>
                      <div className="space-y-1">
                        {ANIME_MOVIE_FORMAT_OPTIONS.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <Checkbox
                              isSelected={radarrAnime.animeMovieFormats.includes(
                                opt.id
                              )}
                              onChange={() =>
                                toggleItem(
                                  radarrAnime.animeMovieFormats,
                                  opt.id,
                                  (list) =>
                                    setRadarrAnime((prev) => ({
                                      ...prev,
                                      animeMovieFormats: list,
                                    }))
                                )
                              }
                              aria-label={`Radarr Anime Movie Format ${opt.label}`}
                            />
                            <span className="text-xs text-foreground">
                              {opt.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Actions */}
      <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetDefaults}
          disabled={isSaving}
          className="h-8 gap-1.5 rounded-xl text-xs"
        >
          <IconRotate2 className="h-3.5 w-3.5" />
          <span>Reset Defaults</span>
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="h-8 gap-1.5 rounded-xl text-xs font-semibold"
        >
          {isSaving ? (
            <>
              <Spinner className="h-3.5 w-3.5" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <IconDeviceFloppy className="h-3.5 w-3.5" />
              <span>Save Settings</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
