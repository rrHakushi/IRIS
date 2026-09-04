"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { IconHeart } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { useUser } from "@/context/user-context"

export type FavoriteType =
  | "ANIME"
  | "MANGA"
  | "MOVIE"
  | "TV"
  | "GAME"
  | "BOOK"
  | "MUSIC"
  | "CHARACTER"
  | "PERSON"
  | "STUDIO"
  | "USER"

export interface FavoriteButtonProps {
  targetId: number
  type: FavoriteType
  title?: string
  variant?: "default" | "secondary" | "outline" | "ghost"
  size?: "default" | "sm" | "xs" | "icon" | "icon-sm"
  showLabel?: boolean
  className?: string
}

// Module-level deduplication cache and in-flight request tracker
const favoriteStatusCache = new Map<string, { isFavorited: boolean; timestamp: number }>()
const favoriteInFlight = new Map<string, Promise<boolean>>()
const CACHE_TTL_MS = 60_000

export async function fetchFavoriteStatusDeduplicated(
  username: string,
  type: string,
  targetId: number
): Promise<boolean> {
  const fetchKey = `${username}:${type}:${targetId}`

  const cached = favoriteStatusCache.get(fetchKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.isFavorited
  }

  const inFlight = favoriteInFlight.get(fetchKey)
  if (inFlight) {
    return inFlight
  }

  const promise = (async () => {
    try {
      const { data, error } = await elysia
        .user({ username })
        .favorites({ targetId })
        .get({
          query: { type: type as any },
        })

      const isFav = !error && Boolean(data?.isFavorited)
      favoriteStatusCache.set(fetchKey, { isFavorited: isFav, timestamp: Date.now() })
      return isFav
    } catch {
      return false
    } finally {
      favoriteInFlight.delete(fetchKey)
    }
  })()

  favoriteInFlight.set(fetchKey, promise)
  return promise
}

export function updateFavoriteCache(
  username: string,
  type: string,
  targetId: number,
  isFavorited: boolean
) {
  const fetchKey = `${username}:${type}:${targetId}`
  favoriteStatusCache.set(fetchKey, { isFavorited, timestamp: Date.now() })
}

export function FavoriteButton({
  targetId,
  type,
  title,
  variant = "secondary",
  size = "sm",
  showLabel = false,
  className,
}: FavoriteButtonProps) {
  const { data: session } = useSession()
  const { user } = useUser()
  const username = user?.username || (session?.user as { username?: string })?.username
  const isAuthenticated = Boolean(username)

  const numericTargetId = Number(targetId)

  const [isFavorited, setIsFavorited] = useState(false)
  const [isPending, setIsPending] = useState(false)

  // Fetch favorite status whenever target entity or authentication changes (deduplicated)
  useEffect(() => {
    if (!isAuthenticated || !username || !numericTargetId) {
      setIsFavorited(false)
      return
    }

    const fetchKey = `${username}:${type}:${numericTargetId}`
    const cached = favoriteStatusCache.get(fetchKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setIsFavorited(cached.isFavorited)
      return
    }

    let isMounted = true
    fetchFavoriteStatusDeduplicated(username, type, numericTargetId).then((status) => {
      if (isMounted) {
        setIsFavorited(status)
      }
    })

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, username, numericTargetId, type])

  // Listen for favorite updates dispatched elsewhere (e.g. modal)
  useEffect(() => {
    const handleFavoriteUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        targetId: number
        type: string
        isFavorited: boolean
      }>
      if (
        customEvent.detail &&
        customEvent.detail.targetId === numericTargetId &&
        customEvent.detail.type === type
      ) {
        setIsFavorited(customEvent.detail.isFavorited)
        if (username) {
          updateFavoriteCache(username, type, numericTargetId, customEvent.detail.isFavorited)
        }
      }
    }

    window.addEventListener("iris:favorite-updated", handleFavoriteUpdate)
    return () => {
      window.removeEventListener("iris:favorite-updated", handleFavoriteUpdate)
    }
  }, [username, numericTargetId, type])

  const handleToggleFavorite = useCallback(async () => {
    if (!isAuthenticated || !username) {
      toast.info("Please sign in to favorite this item")
      return
    }

    if (isPending) return

    const previousState = isFavorited
    const nextState = !previousState

    // Instant optimistic update without animations
    setIsFavorited(nextState)
    setIsPending(true)

    try {
      const { data, error } = await elysia
        .user({ username })
        .favorites({ targetId: numericTargetId })
        .post({
          type: type as any,
          title: title || undefined,
        })

      if (error || !data) {
        // Rollback on error
        setIsFavorited(previousState)
        toast.error("Failed to update favorites")
        return
      }

      const newStatus = Boolean(data.isFavorited)
      setIsFavorited(newStatus)
      updateFavoriteCache(username, type, numericTargetId, newStatus)
      window.dispatchEvent(
        new CustomEvent("iris:favorite-updated", {
          detail: {
            targetId: numericTargetId,
            type,
            isFavorited: newStatus,
          },
        })
      )
      const fallbackMsg = nextState
        ? `Added ${title || `${type} #${numericTargetId}`} to favorites`
        : `Removed ${title || `${type} #${numericTargetId}`} from favorites`
      toast.success(data.message || fallbackMsg)
    } catch {
      setIsFavorited(previousState)
      toast.error("An error occurred while updating favorites")
    } finally {
      setIsPending(false)
    }
  }, [isAuthenticated, username, isPending, isFavorited, numericTargetId, type, title])

  const tooltipText = isFavorited
    ? "Remove from favorites"
    : "Add to favorites"

  const buttonContent = (
    <Button
      variant={isFavorited ? "default" : variant}
      size={size}
      aria-label={tooltipText}
      aria-pressed={isFavorited}
      aria-busy={isPending}
      disabled={isPending}
      onClick={handleToggleFavorite}
      className={cn(
        "transition-none", // strictly no animations
        isFavorited
          ? "bg-rose-500 text-white hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      <IconHeart
        data-icon="inline-start"
        className={cn(
          "transition-none",
          isFavorited && "fill-current text-white"
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span className="text-xs font-semibold">
          {isFavorited ? "Favorited" : "Favorite"}
        </span>
      )}
    </Button>
  )

  return (
    <TooltipTrigger delay={200}>
      {buttonContent}
      <Tooltip className="transition-none">{tooltipText}</Tooltip>
    </TooltipTrigger>
  )
}
