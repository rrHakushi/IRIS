"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useUser } from "@/context/user-context"
import {
  IconFolderPlus,
  IconLock,
  IconWorld,
  IconCheck,
  IconLoader2,
  IconListDetails,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import type { CanonicalMediaCategory } from "./types"
import { toBackendMediaType } from "./types"

interface WatchlistSummaryItem {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  entriesCount: number
  containsMedia?: boolean
}

interface MediaListWatchlistsTabProps {
  mediaId: number
  category: CanonicalMediaCategory
  titlePrimary: string
}

export function MediaListWatchlistsTab({
  mediaId,
  category,
  titlePrimary,
}: MediaListWatchlistsTabProps) {
  const { data: session } = useSession()
  const { user } = useUser()
  const userId = user?.id || (session?.user as any)?.id

  const [watchlists, setWatchlists] = useState<WatchlistSummaryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newWatchlistName, setNewWatchlistName] = useState("")
  const [creating, setCreating] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const backendMediaType = toBackendMediaType(category)
  const fetchedRef = useRef(false)

  const loadWatchlists = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await elysia.borealis.playlists.get()

      if (!error && (data as any)?.playlists) {
        setWatchlists((data as any).playlists)
      }
    } catch {
      toast.error("Failed to load custom lists")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!fetchedRef.current && userId) {
      fetchedRef.current = true
      loadWatchlists()
    }
  }, [userId, loadWatchlists])

  const handleToggleWatchlist = async (
    watchlist: WatchlistSummaryItem,
    nextState: boolean
  ) => {
    if (!userId) return
    if (pendingIds.has(watchlist.id)) return

    setPendingIds((prev) => new Set(prev).add(watchlist.id))

    // Optimistic UI update
    setWatchlists((prev) =>
      prev.map((w) =>
        w.id === watchlist.id
          ? {
              ...w,
              containsMedia: nextState,
              entriesCount: nextState
                ? w.entriesCount + 1
                : Math.max(0, w.entriesCount - 1),
            }
          : w
      )
    )

    try {
      if (nextState) {
        const { error } = await elysia.borealis
          .playlists({ playlistId: watchlist.id })
          .entries.post({
            mediaType: backendMediaType,
            mediaId,
          })

        if (error) {
          throw new Error("Failed to add to custom list")
        }
        toast.success(`Added to "${watchlist.name}"`)
      } else {
        const { error } = await elysia.borealis
          .playlists({ playlistId: watchlist.id })
          .entries.delete({
            mediaType: backendMediaType,
            mediaId,
          })

        if (error) {
          throw new Error("Failed to remove from custom list")
        }
        toast.info(`Removed from "${watchlist.name}"`)
      }
    } catch {
      // Revert on failure
      setWatchlists((prev) =>
        prev.map((w) =>
          w.id === watchlist.id
            ? {
                ...w,
                containsMedia: !nextState,
                entriesCount: !nextState
                  ? w.entriesCount + 1
                  : Math.max(0, w.entriesCount - 1),
              }
            : w
        )
      )
      toast.error("Failed to update custom list entry")
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(watchlist.id)
        return next
      })
    }
  }

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !newWatchlistName.trim() || creating) return

    const name = newWatchlistName.trim()
    setCreating(true)

    try {
      const { data, error } = await elysia.borealis.playlists.post({
        name,
        isPrivate: false,
      })

      if (error || !(data as any)?.playlist) {
        toast.error("Failed to create custom list")
        return
      }

      const created = (data as any).playlist

      // Automatically add current media to newly created watchlist
      await elysia.borealis
        .playlists({ playlistId: created.id })
        .entries.post({
          mediaType: backendMediaType,
          mediaId,
        })

      setWatchlists((prev) => [
        {
          ...created,
          containsMedia: true,
          entriesCount: 1,
        },
        ...prev,
      ])

      setNewWatchlistName("")
      toast.success(`Created "${name}" and added ${titlePrimary}`)
    } catch {
      toast.error("An error occurred while creating custom list")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
        <IconLoader2 className="size-5 animate-spin text-primary" />
        <span className="text-xs">Loading custom lists...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Custom Lists</h3>
      </div>

      {/* New Custom List Inline Creator */}
      <form
        onSubmit={handleCreateWatchlist}
        className="flex items-center gap-2"
      >
        <Input
          type="text"
          placeholder="New list name..."
          value={newWatchlistName}
          onChange={(e) => setNewWatchlistName(e.target.value)}
          className="h-8.5 rounded-xl text-xs"
        />
        <Button
          type="submit"
          size="sm"
          isDisabled={!newWatchlistName.trim() || creating}
          className="h-8.5 shrink-0 gap-1.5 rounded-xl px-3 text-xs"
        >
          {creating ? (
            <IconLoader2 className="size-3.5 animate-spin" />
          ) : (
            <IconFolderPlus className="size-3.5" />
          )}
          <span>Create</span>
        </Button>
      </form>

      {/* Custom Lists */}
      {watchlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-6 text-center text-muted-foreground">
          <IconListDetails className="size-8 opacity-40" />
          <p className="mt-2 text-xs font-medium">No custom lists yet</p>
          <p className="text-[11px] text-muted-foreground/75">
            Type a name above to create your first collection.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30 rounded-2xl border border-border/50 bg-card/40">
          {watchlists.map((wl) => {
            const isChecked = Boolean(wl.containsMedia)
            const isPending = pendingIds.has(wl.id)

            return (
              <div
                key={wl.id}
                className="flex items-center justify-between gap-3 p-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/30"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {wl.name}
                    </span>
                    {wl.isPrivate ? (
                      <IconLock
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-label="Private"
                      />
                    ) : (
                      <IconWorld
                        className="size-3 shrink-0 text-muted-foreground/60"
                        aria-label="Public"
                      />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {wl.entriesCount} {wl.entriesCount === 1 ? "item" : "items"}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isPending && (
                    <IconLoader2 className="size-3.5 animate-spin text-muted-foreground" />
                  )}
                  <Switch
                    isSelected={isChecked}
                    isDisabled={isPending}
                    onChange={(checked: boolean) =>
                      handleToggleWatchlist(wl, checked)
                    }
                    aria-label={`Include in ${wl.name}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
