"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { IconHeart } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"

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

export function FavoriteButton({
  targetId,
  type,
  title,
  variant = "secondary",
  size = "sm",
  showLabel = false,
  className,
}: FavoriteButtonProps) {
  const { data: session, status } = useSession()
  const [isFavorited, setIsFavorited] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const username = session?.user?.username
  const isAuthenticated = status === "authenticated" && Boolean(username)

  const lastFetchedKeyRef = React.useRef<string | null>(null)
  const isFetchingRef = React.useRef(false)

  // Fetch favorite status only when authenticated and deduplicate across StrictMode / re-renders
  useEffect(() => {
    if (!isAuthenticated || !username || !targetId) {
      return
    }

    const fetchKey = `${username}:${type}:${targetId}`
    if (lastFetchedKeyRef.current === fetchKey || isFetchingRef.current) {
      return
    }

    lastFetchedKeyRef.current = fetchKey
    isFetchingRef.current = true
    let isMounted = true

    async function fetchFavoriteStatus() {
      try {
        const { data, error } = await elysia
          .user({ username: username! })
          .favorites({ targetId })
          .get({
            query: { type: type as any },
          })

        if (isMounted && !error && data) {
          setIsFavorited(Boolean(data.isFavorited))
        }
      } catch {
        // Silently fail if unavailable
      } finally {
        isFetchingRef.current = false
      }
    }

    fetchFavoriteStatus()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, username, targetId, type])

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
        .favorites({ targetId })
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

      setIsFavorited(Boolean(data.isFavorited))
      const fallbackMsg = nextState
        ? `Added ${title || `${type} #${targetId}`} to favorites`
        : `Removed ${title || `${type} #${targetId}`} from favorites`
      toast.success(data.message || fallbackMsg)
    } catch {
      setIsFavorited(previousState)
      toast.error("An error occurred while updating favorites")
    } finally {
      setIsPending(false)
    }
  }, [isAuthenticated, username, isPending, isFavorited, targetId, type, title])

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
