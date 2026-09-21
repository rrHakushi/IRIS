"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconSearch,
  IconPlus,
  IconCheck,
  IconFolder,
  IconMovie,
  IconDeviceTv,
  IconSparkles,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"

export interface ServarrAddMediaDialogProps {
  isOpen: boolean
  onClose: () => void
  provider: "SONARR" | "RADARR"
  initialQuery?: string
  onAdded?: () => void
}

export function ServarrAddMediaDialog({
  isOpen,
  onClose,
  provider,
  initialQuery = "",
  onAdded,
}: ServarrAddMediaDialogProps) {
  const [searchTerm, setSearchTerm] = useState(initialQuery)
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [rootFolders, setRootFolders] = useState<any[]>([])
  const [qualityProfiles, setQualityProfiles] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<any | null>(null)

  // Form options for adding
  const [selectedRootFolder, setSelectedRootFolder] = useState<string>("")
  const [selectedProfileId, setSelectedProfileId] = useState<number>(1)
  const [monitored, setMonitored] = useState(true)
  const [seasonFolder, setSeasonFolder] = useState(true)
  const [seriesType, setSeriesType] = useState<"standard" | "anime" | "daily">(
    "standard"
  )
  const [minimumAvailability, setMinimumAvailability] = useState("released")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch root folders and profiles on open
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    const initOptions = async () => {
      try {
        let res: any
        if (provider === "SONARR") {
          res = await elysia.servarr.sonarr.lookup.get({
            query: { term: "" },
          })
        } else {
          res = await elysia.servarr.radarr.lookup.get({
            query: { term: "" },
          })
        }

        if (isMounted && res?.data) {
          if (res.data.rootFolders && res.data.rootFolders.length > 0) {
            setRootFolders(res.data.rootFolders)
            setSelectedRootFolder(res.data.rootFolders[0].path)
          }
          if (res.data.qualityProfiles && res.data.qualityProfiles.length > 0) {
            setQualityProfiles(res.data.qualityProfiles)
            setSelectedProfileId(res.data.qualityProfiles[0].id)
          }
        }
      } catch {
        // Ignored
      }
    }

    initOptions()
    if (initialQuery) {
      handleSearch(initialQuery)
    }

    return () => {
      isMounted = false
    }
  }, [isOpen, provider])

  const handleSearch = async (termToSearch: string) => {
    if (!termToSearch || !termToSearch.trim()) return

    setIsSearching(true)
    setSelectedItem(null)
    try {
      let res: any
      if (provider === "SONARR") {
        res = await elysia.servarr.sonarr.lookup.get({
          query: { term: termToSearch.trim() },
        })
      } else {
        res = await elysia.servarr.radarr.lookup.get({
          query: { term: termToSearch.trim() },
        })
      }

      if (res?.data?.success && Array.isArray(res.data.records)) {
        setResults(res.data.records)
        if (res.data.records.length > 0) {
          setSelectedItem(res.data.records[0])
          // Detect anime type
          if (res.data.records[0].seriesType) {
            setSeriesType(res.data.records[0].seriesType)
          }
        }
      } else {
        setResults([])
        toast.error("No results found", {
          description: res?.data?.message || "Check your search query",
        })
      }
    } catch (err: any) {
      toast.error("Lookup failed", {
        description: err.message || "Network error",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleAddMedia = async (searchNow: boolean = false) => {
    if (!selectedItem) return

    setIsSubmitting(true)
    try {
      let payload: any
      let res: any

      if (provider === "SONARR") {
        payload = {
          ...selectedItem,
          rootFolderPath: selectedRootFolder,
          qualityProfileId: selectedProfileId,
          monitored,
          seasonFolder,
          seriesType,
          addOptions: {
            searchForMissingEpisodes: searchNow,
          },
        }
        res = await elysia.servarr.sonarr.lookup.post(payload)
      } else {
        payload = {
          ...selectedItem,
          rootFolderPath: selectedRootFolder,
          qualityProfileId: selectedProfileId,
          monitored,
          minimumAvailability,
          addOptions: {
            searchForMovie: searchNow,
          },
        }
        res = await elysia.servarr.radarr.lookup.post(payload)
      }

      if (res?.data?.success) {
        toast.success(
          `Added "${selectedItem.title}" to ${provider === "SONARR" ? "Sonarr" : "Radarr"}${
            searchNow ? " & started search" : ""
          }`
        )
        onAdded?.()
        onClose()
      } else {
        toast.error("Failed to add media", {
          description: res?.data?.message || "Unknown error",
        })
      }
    } catch (err: any) {
      toast.error("Request failed", {
        description: err.message || "Network error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-5xl"
    >
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DialogHeader>
          <div className="flex items-center gap-3 pe-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
              {provider === "SONARR" ? (
                <IconDeviceTv className="size-5" />
              ) : (
                <IconMovie className="size-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Add New {provider === "SONARR" ? "Series" : "Movie"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                Search TVDB / TheMovieDB index to add and monitor media in{" "}
                {provider === "SONARR" ? "Sonarr" : "Radarr"}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSearch(searchTerm)
          }}
          className="flex items-center gap-3"
        >
          <div className="relative flex-1">
            <IconSearch className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${provider === "SONARR" ? "series title, TVDB id, or anime name..." : "movie title, TMDB id, or IMDB id..."}`}
              className="h-10 rounded-xl ps-10"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            variant="default"
            disabled={isSearching || !searchTerm.trim()}
            className="h-10 gap-2 rounded-xl px-5 font-semibold shadow-xs"
          >
            {isSearching ? (
              <Spinner className="size-4" />
            ) : (
              <IconSearch className="size-4" />
            )}
            Search
          </Button>
        </form>

        {/* Main Content Area */}
        <div className="grid max-h-[500px] min-h-[360px] grid-cols-1 gap-5 overflow-hidden md:grid-cols-12">
          {/* Results List */}
          <div className="flex flex-col gap-2 overflow-y-auto rounded-2xl border border-border/40 bg-card p-2 pe-1 text-card-foreground shadow-xs ring-1 ring-foreground/5 md:col-span-5 dark:ring-foreground/10">
            {isSearching ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Spinner className="size-6 text-primary" />
                <span className="text-sm font-medium">
                  Searching remote index...
                </span>
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <IconSearch className="size-8 opacity-40" />
                <p className="font-heading text-sm font-semibold">
                  No results found
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Type a title in the search box above to find and add content.
                </p>
              </div>
            ) : (
              results.map((item) => {
                const poster =
                  item.images?.find((img: any) => img.coverType === "poster")
                    ?.remoteUrl ||
                  item.images?.find((img: any) => img.coverType === "poster")
                    ?.url ||
                  item.remotePoster
                const isSelected =
                  selectedItem &&
                  (selectedItem.tvdbId === item.tvdbId ||
                    selectedItem.tmdbId === item.tmdbId ||
                    selectedItem.title === item.title)
                const inLibrary = item.id && item.id > 0

                return (
                  <div
                    key={item.tvdbId || item.tmdbId || item.id || item.title}
                    onClick={() => setSelectedItem(item)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-2.5 transition-all",
                      isSelected
                        ? "border-primary/30 bg-primary/10 shadow-xs dark:bg-primary/15"
                        : "border-border/30 bg-background/60 hover:bg-muted/40"
                    )}
                  >
                    <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {poster ? (
                        <img
                          src={poster}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          ?
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="max-w-[200px] truncate font-heading text-xs font-semibold text-foreground">
                          {item.title}
                        </h4>
                        {item.year && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            ({item.year})
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {item.overview || "No overview available."}
                      </p>
                      {inLibrary && (
                        <Badge
                          variant="outline"
                          className="mt-1 gap-1 border-emerald-500/30 py-0 text-[10px] font-medium text-emerald-500"
                        >
                          <IconCheck className="size-2.5" /> In Library
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Configuration Form & Preview */}
          <div className="flex flex-col justify-between overflow-y-auto rounded-2xl border border-border/40 bg-card p-4 text-card-foreground shadow-xs ring-1 ring-foreground/5 md:col-span-7 dark:ring-foreground/10">
            {selectedItem ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  {(() => {
                    const poster =
                      selectedItem.images?.find(
                        (img: any) => img.coverType === "poster"
                      )?.remoteUrl ||
                      selectedItem.images?.find(
                        (img: any) => img.coverType === "poster"
                      )?.url ||
                      selectedItem.remotePoster
                    return (
                      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted shadow-xs">
                        {poster ? (
                          <img
                            src={poster}
                            alt={selectedItem.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            ?
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
                      {selectedItem.title}
                      {selectedItem.year && (
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                          ({selectedItem.year})
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {selectedItem.overview || "No description provided."}
                    </p>
                  </div>
                </div>

                {/* Form Options */}
                <div className="grid grid-cols-1 gap-3 border-t border-border/30 pt-2 sm:grid-cols-2">
                  {/* Root Folder */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">
                      Root Folder
                    </label>
                    <select
                      value={selectedRootFolder}
                      onChange={(e) => setSelectedRootFolder(e.target.value)}
                      className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden"
                    >
                      {rootFolders.map((rf) => (
                        <option key={rf.id || rf.path} value={rf.path}>
                          {rf.path} (
                          {((rf.freeSpace || 0) / 1024 ** 3).toFixed(1)} GB
                          free)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quality Profile */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">
                      Quality Profile
                    </label>
                    <select
                      value={selectedProfileId}
                      onChange={(e) =>
                        setSelectedProfileId(Number(e.target.value))
                      }
                      className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden"
                    >
                      {qualityProfiles.map((qp) => (
                        <option key={qp.id} value={qp.id}>
                          {qp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sonarr Series Type */}
                  {provider === "SONARR" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Series Type
                      </label>
                      <select
                        value={seriesType}
                        onChange={(e) => setSeriesType(e.target.value as any)}
                        className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden"
                      >
                        <option value="standard">Standard</option>
                        <option value="anime">Anime</option>
                        <option value="daily">Daily</option>
                      </select>
                    </div>
                  )}

                  {/* Radarr Minimum Availability */}
                  {provider === "RADARR" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Minimum Availability
                      </label>
                      <select
                        value={minimumAvailability}
                        onChange={(e) => setMinimumAvailability(e.target.value)}
                        className="h-9 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs text-foreground focus:ring-2 focus:ring-ring focus:outline-hidden"
                      >
                        <option value="announced">Announced</option>
                        <option value="inCinemas">In Cinemas</option>
                        <option value="released">Released</option>
                      </select>
                    </div>
                  )}

                  {/* Toggles */}
                  <div className="flex flex-col gap-2 pt-2 sm:col-span-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        isSelected={monitored}
                        onChange={setMonitored}
                      />
                      <span className="text-xs font-medium text-foreground">
                        Monitor for new releases
                      </span>
                    </div>

                    {provider === "SONARR" && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          isSelected={seasonFolder}
                          onChange={setSeasonFolder}
                        />
                        <span className="text-xs font-medium text-foreground">
                          Create season sub-folders
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <IconFolder className="size-8 opacity-40" />
                <p className="font-heading text-sm font-medium">
                  Select a result to configure
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/40 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-xl"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedItem || isSubmitting}
              onClick={() => handleAddMedia(false)}
              className="gap-2 rounded-xl text-xs"
            >
              {isSubmitting ? (
                <Spinner className="size-4" />
              ) : (
                <IconPlus className="size-4" />
              )}
              Add
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!selectedItem || isSubmitting}
              onClick={() => handleAddMedia(true)}
              className="gap-2 rounded-xl text-xs font-semibold shadow-xs"
            >
              {isSubmitting ? (
                <Spinner className="size-4" />
              ) : (
                <IconSparkles className="size-4" />
              )}
              Add + Search
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
