"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import {
  IconListDetails,
  IconPlus,
  IconLock,
  IconWorld,
  IconTrash,
  IconChevronRight,
  IconArrowLeft,
  IconSearch,
  IconLoader2,
  IconMusic,
  IconDeviceTv,
  IconBook2,
  IconMovie,
  IconDeviceGamepad,
  IconBook,
  IconExternalLink,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { UserListBanner } from "./user-list-banner"
import type { UserProfileCustomization } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"

export interface CustomListsViewProps {
  username: string
  initialProfile?: UserProfileCustomization | null
}

type CustomListSupportedMediaType =
  | "ANIME"
  | "MANGA"
  | "MOVIE"
  | "TV"
  | "GAME"
  | "BOOK"
  | "MUSIC"
  | "MUSIC_ALBUM"
  | "MUSIC_TRACK"

interface CustomListMediaItem {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  titleRomaji?: string | null
  titleEnglish?: string | null
  titleNative?: string | null
  coverImage?: string | null
  bannerImage?: string | null
  artistName?: string | null
  type?: string | null
  format?: string | null
  images?: Record<string, string> | null
}

interface CustomListItem {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  isDefault: boolean
  coverImage: string | null
  order: number
  entriesCount: number
  createdAt: string
  updatedAt: string
}

interface CustomListEntryItem {
  entry: {
    id: string
    watchlistId: string
    mediaType: CustomListSupportedMediaType
    mediaId: number
    order: number
    customNotes: string | null
    addedAt: string
  }
  media: CustomListMediaItem | null
}

export function CustomListsView({
  username,
  initialProfile,
}: CustomListsViewProps): React.JSX.Element {
  const { data: session } = useSession()
  const isOwner = session?.user?.username === username

  const [lists, setLists] = useState<CustomListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Selected List State (for viewing entries)
  const [selectedList, setSelectedList] = useState<CustomListItem | null>(null)
  const [entries, setEntries] = useState<CustomListEntryItem[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [entrySearchQuery, setEntrySearchQuery] = useState("")

  // Create List Dialog State
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newListName, setNewListName] = useState("")
  const [newListDescription, setNewListDescription] = useState("")
  const [newListIsPrivate, setNewListIsPrivate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Deezer Import Dialog State
  const [deezerImportOpen, setDeezerImportOpen] = useState(false)
  const [deezerPlaylistInput, setDeezerPlaylistInput] = useState("")
  const [deezerImporting, setDeezerImporting] = useState(false)

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchLists = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await elysia.user({ username }).watchlists.get()
      if (!error && data?.watchlists) {
        setLists(data.watchlists)
      }
    } catch {
      toast.error("Failed to load custom lists")
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  const fetchEntries = useCallback(
    async (watchlistId: string) => {
      setEntriesLoading(true)
      try {
        const { data, error } = await elysia
          .user({ username })
          .lists.custom({ watchlistId })
          .get()
        if (!error && data?.items) {
          setEntries(data.items)
        }
      } catch {
        toast.error("Failed to load custom list entries")
      } finally {
        setEntriesLoading(false)
      }
    },
    [username]
  )

  const handleSelectList = (list: CustomListItem) => {
    setSelectedList(list)
    fetchEntries(list.id)
  }

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim() || creating) return

    setCreating(true)
    try {
      const { data, error } = await elysia.user({ username }).watchlists.post({
        name: newListName.trim(),
        description: newListDescription.trim() || undefined,
        isPrivate: newListIsPrivate,
      })

      if (error || !data?.watchlist) {
        toast.error("Failed to create custom list")
        return
      }

      setLists((prev) => [data.watchlist, ...prev])
      setCreateDialogOpen(false)
      setNewListName("")
      setNewListDescription("")
      setNewListIsPrivate(false)
      toast.success(`Created custom list "${data.watchlist.name}"`)
    } catch {
      toast.error("An error occurred while creating custom list")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteList = async (listId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    setDeletingId(listId)
    try {
      const { error } = await elysia
        .user({ username })
        .lists.custom({ watchlistId: listId })
        .delete()

      if (error) {
        toast.error("Failed to delete custom list")
        return
      }

      setLists((prev) => prev.filter((l) => l.id !== listId))
      if (selectedList?.id === listId) {
        setSelectedList(null)
      }
      toast.success(`Deleted "${name}"`)
    } catch {
      toast.error("Failed to delete custom list")
    } finally {
      setDeletingId(null)
    }
  }

  const handleImportDeezerPlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deezerPlaylistInput.trim() || deezerImporting) return

    setDeezerImporting(true)
    try {
      const res = await elysia.media.music.import.deezer.post({
        playlistId: deezerPlaylistInput.trim(),
      })

      if (!res.error && res.data?.success) {
        toast.success(
          `Imported ${res.data.tracksImported} tracks into "${res.data.customList?.name || "Deezer Playlist"}"!`
        )
        setDeezerImportOpen(false)
        setDeezerPlaylistInput("")
        fetchLists()
      } else {
        const errorMsg =
          res.data?.error ||
          (typeof res.error?.value === "string"
            ? res.error.value
            : "Failed to import Deezer playlist.")
        toast.error(errorMsg)
      }
    } catch {
      toast.error("Failed to import playlist from Deezer.")
    } finally {
      setDeezerImporting(false)
    }
  }

  const handleRemoveEntry = async (item: CustomListEntryItem) => {
    if (!selectedList) return
    try {
      const { error } = await elysia
        .user({ username })
        .lists.custom({ watchlistId: selectedList.id })({ id: item.entry.mediaId })
        .delete({
          query: { mediaType: item.entry.mediaType },
        })

      if (error) {
        toast.error("Failed to remove item")
        return
      }

      setEntries((prev) =>
        prev.filter((e) => e.entry.id !== item.entry.id)
      )
      setLists((prev) =>
        prev.map((l) =>
          l.id === selectedList.id
            ? { ...l, entriesCount: Math.max(0, l.entriesCount - 1) }
            : l
        )
      )
      toast.info("Removed from custom list")
    } catch {
      toast.error("Failed to remove item")
    }
  }

  const getMediaUrl = (item: CustomListEntryItem): string => {
    const { mediaType, mediaId } = item.entry
    const media = item.media
    switch (mediaType) {
      case "ANIME":
        return `/IRIS-list/media/anime/${mediaId}`
      case "MANGA":
        return `/IRIS-list/media/manga/${mediaId}`
      case "MOVIE":
        return `/IRIS-list/media/movie/${mediaId}`
      case "TV":
        return `/IRIS-list/media/tv/${mediaId}`
      case "GAME":
        return `/IRIS-list/media/game/${mediaId}`
      case "BOOK":
        return `/IRIS-list/media/book/${mediaId}`
      case "MUSIC":
      case "MUSIC_TRACK":
      case "MUSIC_ALBUM": {
        const isTrack = media?.type === "TRACK" || mediaType === "MUSIC_TRACK"
        return `/IRIS-list/media/music/${isTrack ? "tracks" : "albums"}/${mediaId}`
      }
      default: {
        const fallbackType: string = mediaType
        return `/IRIS-list/media/${fallbackType.toLowerCase()}/${mediaId}`
      }
    }
  }

  const getMediaTypeIcon = (mediaType: string) => {
    switch (mediaType) {
      case "ANIME":
      case "TV":
        return <IconDeviceTv className="size-3.5 text-rose-500" />
      case "MANGA":
        return <IconBook2 className="size-3.5 text-amber-500" />
      case "MOVIE":
        return <IconMovie className="size-3.5 text-blue-500" />
      case "GAME":
        return <IconDeviceGamepad className="size-3.5 text-emerald-500" />
      case "BOOK":
        return <IconBook className="size-3.5 text-purple-500" />
      case "MUSIC":
      case "MUSIC_TRACK":
      case "MUSIC_ALBUM":
        return <IconMusic className="size-3.5 text-pink-500" />
      default:
        return <IconListDetails className="size-3.5 text-muted-foreground" />
    }
  }

  const filteredLists = lists.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredEntries = entries.filter((e) => {
    const title =
      e.media?.titlePrimary ||
      e.media?.titleEnglish ||
      e.media?.titleRomaji ||
      ""
    const artist = e.media?.artistName || ""
    const query = entrySearchQuery.toLowerCase()
    return (
      title.toLowerCase().includes(query) ||
      artist.toLowerCase().includes(query) ||
      (e.entry.customNotes && e.entry.customNotes.toLowerCase().includes(query))
    )
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <UserListBanner
        username={username}
        profile={initialProfile}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb / Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {selectedList ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedList(null)}
                className="gap-1.5 rounded-xl border-border/60 hover:bg-muted/50"
              >
                <IconArrowLeft className="size-4" />
                <span>All Custom Lists</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <IconListDetails className="size-6 text-rose-500" />
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Custom Lists
                </h1>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!selectedList && (
              <div className="relative w-full sm:w-64">
                <IconSearch className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search lists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-9 h-9 rounded-xl text-xs"
                />
              </div>
            )}

            {isOwner && !selectedList && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setDeezerImportOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl border-border/60 hover:bg-muted/50"
                >
                  <IconMusic className="size-4 text-rose-500" />
                  <span>Import Deezer</span>
                </Button>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  size="sm"
                  className="gap-1.5 rounded-xl bg-rose-500 font-semibold text-white hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700"
                >
                  <IconPlus className="size-4" />
                  <span>New List</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Selected List Detail View */}
        {selectedList ? (
          <div className="space-y-6">
            {/* List Header Banner Card */}
            <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-xs">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      {selectedList.name}
                    </h2>
                    {selectedList.isPrivate ? (
                      <Badge variant="outline" className="gap-1 text-xs font-medium text-muted-foreground">
                        <IconLock className="size-3" />
                        Private
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs font-medium text-muted-foreground/80">
                        <IconWorld className="size-3" />
                        Public
                      </Badge>
                    )}
                  </div>
                  {selectedList.description && (
                    <p className="text-sm text-muted-foreground">
                      {selectedList.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/75">
                    {entries.length} {entries.length === 1 ? "entry" : "entries"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-56">
                    <IconSearch className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search entries..."
                      value={entrySearchQuery}
                      onChange={(e) => setEntrySearchQuery(e.target.value)}
                      className="ps-9 h-8.5 rounded-xl text-xs"
                    />
                  </div>
                  {isOwner && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteList(selectedList.id, selectedList.name)}
                      disabled={deletingId === selectedList.id}
                      className="h-8.5 gap-1.5 rounded-xl text-xs"
                    >
                      <IconTrash className="size-3.5" />
                      <span>Delete List</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* List Entries Grid */}
            {entriesLoading ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                <IconLoader2 className="size-6 animate-spin text-rose-500" />
                <span className="text-sm">Loading list entries...</span>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                <IconListDetails className="size-10 opacity-30" />
                <p className="mt-3 text-sm font-semibold">No entries in this custom list</p>
                <p className="text-xs text-muted-foreground/75">
                  Browse media and use the "Custom Lists" modal tab to add items.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredEntries.map((item) => {
                  const media = item.media
                  const title =
                    media?.titlePrimary ||
                    media?.titleEnglish ||
                    media?.titleRomaji ||
                    "Untitled"
                  const cover = media?.coverImage || media?.images?.coverMedium || null
                  const href = getMediaUrl(item)

                  return (
                    <div
                      key={item.entry.id}
                      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/60 transition-all hover:border-rose-500/40 hover:shadow-md"
                    >
                      {/* Thumbnail */}
                      <Link
                        href={href}
                        className={cn(
                          "relative w-full overflow-hidden bg-muted/40",
                          item.entry.mediaType.includes("MUSIC")
                            ? "aspect-square"
                            : "aspect-2/3"
                        )}
                      >
                        {cover ? (
                          <Image
                            src={cover}
                            alt={title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                            {getMediaTypeIcon(item.entry.mediaType)}
                          </div>
                        )}

                        <div className="absolute start-2 top-2">
                          <Badge
                            variant="secondary"
                            className="gap-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-xs"
                          >
                            {getMediaTypeIcon(item.entry.mediaType)}
                            <span>{item.entry.mediaType}</span>
                          </Badge>
                        </div>
                      </Link>

                      {/* Content */}
                      <div className="flex flex-1 flex-col justify-between p-3">
                        <div>
                          <Link
                            href={href}
                            className="line-clamp-2 text-xs font-semibold text-foreground hover:text-rose-500"
                          >
                            {title}
                          </Link>
                          {media?.artistName && (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                              {media.artistName}
                            </p>
                          )}
                          {item.entry.customNotes && (
                            <p className="mt-1 line-clamp-2 rounded-md bg-muted/40 p-1.5 text-[10px] text-muted-foreground italic">
                              "{item.entry.customNotes}"
                            </p>
                          )}
                        </div>

                        {isOwner && (
                          <div className="mt-2 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEntry(item)}
                              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                            >
                              <IconTrash className="size-3.5 me-1" />
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Custom Lists Grid */
          <div>
            {loading ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                <IconLoader2 className="size-6 animate-spin text-rose-500" />
                <span className="text-sm">Loading custom lists...</span>
              </div>
            ) : filteredLists.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                <IconListDetails className="size-12 opacity-30" />
                <p className="mt-3 text-sm font-semibold">No custom lists found</p>
                <p className="text-xs text-muted-foreground/75">
                  {isOwner
                    ? "Create your first custom collection using the button above."
                    : `${username} hasn't created any public custom lists yet.`}
                </p>
                {isOwner && (
                  <Button
                    onClick={() => setCreateDialogOpen(true)}
                    size="sm"
                    className="mt-4 gap-1.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600"
                  >
                    <IconPlus className="size-4" />
                    <span>Create Custom List</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredLists.map((list) => (
                  <div
                    key={list.id}
                    onClick={() => handleSelectList(list)}
                    className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-border/50 bg-card/60 p-5 transition-all hover:border-rose-500/40 hover:bg-muted/20 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <IconListDetails className="size-4 text-rose-500" />
                          <h3 className="line-clamp-1 text-sm font-bold text-foreground group-hover:text-rose-500">
                            {list.name}
                          </h3>
                        </div>
                        {list.isPrivate ? (
                          <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                            <IconLock className="size-2.5" />
                            Private
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground/70">
                            <IconWorld className="size-2.5" />
                            Public
                          </Badge>
                        )}
                      </div>

                      {list.description ? (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {list.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs italic text-muted-foreground/50">
                          No description provided
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3 text-xs text-muted-foreground">
                      <span>
                        {list.entriesCount} {list.entriesCount === 1 ? "item" : "items"}
                      </span>
                      <div className="flex items-center gap-1 text-rose-500 group-hover:translate-x-0.5 transition-transform">
                        <span className="text-[11px] font-medium">View</span>
                        <IconChevronRight className="size-3.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create List Modal */}
      <Dialog isOpen={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <form onSubmit={handleCreateList} className="space-y-4 py-2">
          <DialogHeader>
            <DialogTitle>Create Custom List</DialogTitle>
          </DialogHeader>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                List Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Favorite Soundtracks, Weekend Marathon"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                maxLength={100}
                required
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="A brief note about this collection..."
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/50 p-3 bg-muted/20">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <IconLock className="size-3.5 text-muted-foreground" />
                  <span>Private List</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Only you will be able to see this list.
                </p>
              </div>
              <input
                type="checkbox"
                checked={newListIsPrivate}
                onChange={(e) => setNewListIsPrivate(e.target.checked)}
                className="h-4 w-4 rounded accent-rose-500 cursor-pointer"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newListName.trim() || creating}
                className="rounded-xl bg-rose-500 font-semibold text-white hover:bg-rose-600"
              >
                {creating ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  "Create List"
                )}
              </Button>
            </DialogFooter>
          </form>
      </Dialog>

      {/* Import Deezer Playlist Dialog */}
      <Dialog isOpen={deezerImportOpen} onOpenChange={setDeezerImportOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <IconMusic className="size-5 text-rose-500" />
            Import Deezer Playlist
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleImportDeezerPlaylist} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Deezer Playlist URL or ID
            </label>
            <Input
              placeholder="e.g. https://www.deezer.com/playlist/3008109866 or 3008109866"
              value={deezerPlaylistInput}
              onChange={(e) => setDeezerPlaylistInput(e.target.value)}
              required
              className="rounded-xl text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Tracks will be saved to your Music library (with synced lyrics from LRCLIB if available), artists to Person, and a new Custom List will be created.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeezerImportOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!deezerPlaylistInput.trim() || deezerImporting}
              className="rounded-xl bg-rose-500 font-semibold text-white hover:bg-rose-600"
            >
              {deezerImporting ? (
                <div className="flex items-center gap-1.5">
                  <IconLoader2 className="size-4 animate-spin" />
                  <span>Importing...</span>
                </div>
              ) : (
                "Import Playlist"
              )}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
