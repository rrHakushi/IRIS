"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { IconAlertTriangle } from "@tabler/icons-react"
import { toast } from "sonner"
import { cn } from "@workspace/ui/lib/utils"
import { useSession } from "@/context/session-context"
import { useUser } from "@/context/user-context"
import { elysia } from "@/lib/elysia"
import { saveListEntry } from "@/lib/save-list-entry"
import { getMediaPreferences } from "@IRIS/shared"
import { formatMediaTitle } from "@/lib/browse-search"
import { BorealisCard } from "../borealis-card"
import type { BorealisCardSavePayload } from "../types"
import type { ListStatus } from "../media-list-status-text"
import type {
  MediaTabItem,
  MediaTabKey,
  NormalizedMediaData,
} from "./media-types"
import { MediaTabNav } from "./media-tab-nav"
import { toCanonicalCategory } from "./list/types"
import { GlassCard } from "../glass-card"

interface MediaHeroProps {
  media: NormalizedMediaData
  isQueuedFetch?: boolean
  tabs?: MediaTabItem[]
  activeTab?: MediaTabKey
  onSelectTab?: (tab: MediaTabKey) => void
}

export function MediaHero({
  media,
  isQueuedFetch,
  tabs,
  activeTab,
  onSelectTab,
}: MediaHeroProps) {
  const [posterError, setPosterError] = useState(false)
  const [bannerError, setBannerError] = useState(false)
  const [listEntry, setListEntry] = useState<any | null>(null)
  const fetchedKeyRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)

  const { data: session, status: authStatus } = useSession()
  const { user } = useUser()
  const username =
    user?.username || (session?.user as { username?: string })?.username
  const isAuthenticated = authStatus === "authenticated" && Boolean(username)
  const titlePref = getMediaPreferences(user?.customization).title || "primary"

  const canonicalCategory = toCanonicalCategory(media.category)

  const fetchListEntry = useCallback(async () => {
    if (!isAuthenticated || !username || !media.id) return
    const key = `${username}:${canonicalCategory}:${media.id}`
    if (fetchedKeyRef.current === key || isFetchingRef.current) return

    isFetchingRef.current = true
    try {
      const numericId = Number(media.id)
      let res: { data?: any; error?: any }

      switch (canonicalCategory) {
        case "anime":
          res = await elysia.borealis.lists.anime({ animeId: numericId }).get()
          break
        case "manga":
          res = await elysia.borealis.lists.manga({ mangaId: numericId }).get()
          break
        case "movie":
          res = await elysia.borealis.lists.movies({ movieId: numericId }).get()
          break
        case "tv":
          res = await elysia.borealis.lists.tv({ tvId: numericId }).get()
          break
        case "game":
          res = await elysia.borealis.lists.games({ gameId: numericId }).get()
          break
        case "book":
          res = await elysia.borealis.lists.books({ bookId: numericId }).get()
          break
        case "music":
          res = await elysia.borealis.lists.music({ musicId: numericId }).get()
          break
        case "other":
          res = await elysia.borealis.lists.other({ otherId: numericId }).get()
          break
      }

      fetchedKeyRef.current = key
      if (!res.error && res.data?.inList && res.data.entry) {
        setListEntry(res.data.entry)
      }
    } catch {
      // Silently ignore hover fetch errors
    } finally {
      isFetchingRef.current = false
    }
  }, [isAuthenticated, username, canonicalCategory, media.id])

  useEffect(() => {
    fetchListEntry()
  }, [fetchListEntry])

  const handleSaveEntry = useCallback(
    async (payload: BorealisCardSavePayload) => {
      if (!isAuthenticated) return
      try {
        const nextPayload: BorealisCardSavePayload = {
          ...payload,
          notes: payload.notes || null,
        }
        const saved = await saveListEntry(media.category, media.id, nextPayload)
        setListEntry((prev: any) => ({
          ...(prev ?? {}),
          ...(saved ?? {}),
          status: payload.status,
          score: payload.score,
          progress: payload.progress,
          chaptersProgress: payload.chaptersProgress ?? payload.progress,
          volumesProgress: payload.volumesProgress,
          notes: nextPayload.notes,
          private: payload.isPrivate,
          priority: payload.priority,
          startedAt: payload.startedAt,
          completedAt: payload.completedAt,
        }))
        toast.success("List entry updated")
      } catch (err: any) {
        toast.error(err?.message || "Failed to update list entry")
      }
    },
    [isAuthenticated, media.category, media.id]
  )

  const handleStatusChange = useCallback(
    async (newStatus: ListStatus) => {
      const currentProgress =
        listEntry?.progress ??
        listEntry?.chaptersProgress ??
        listEntry?.progressChapters ??
        0
      const currentVolumes =
        listEntry?.volumesProgress ?? listEntry?.progressVolumes ?? 0

      let nextProgress = currentProgress
      let nextChapters = currentProgress
      let nextVolumes = currentVolumes

      if (newStatus === "COMPLETED") {
        if (typeof media.episodeCount === "number" && media.episodeCount > 0) {
          nextProgress = media.episodeCount
        }
        const chapterMax =
          typeof media.chapterCount === "number" && media.chapterCount > 0
            ? media.chapterCount
            : typeof media.pageCount === "number" && media.pageCount > 0
              ? media.pageCount
              : undefined
        if (chapterMax !== undefined) {
          nextChapters = chapterMax
          if (canonicalCategory === "manga" || canonicalCategory === "book") {
            nextProgress = chapterMax
          }
        }
        if (typeof media.volumeCount === "number" && media.volumeCount > 0) {
          nextVolumes = media.volumeCount
        }
      }

      await handleSaveEntry({
        status: newStatus,
        score: listEntry?.score ?? null,
        progress: nextProgress,
        chaptersProgress: nextChapters,
        volumesProgress: nextVolumes,
        notes: listEntry?.notes ?? null,
        isPrivate: listEntry?.private ?? false,
        priority: listEntry?.priority,
      })
    },
    [
      handleSaveEntry,
      listEntry,
      canonicalCategory,
      media.episodeCount,
      media.chapterCount,
      media.pageCount,
      media.volumeCount,
    ]
  )

  const handleScoreChange = useCallback(
    async (newScore: number | null) => {
      const currentProgress =
        listEntry?.progress ??
        listEntry?.chaptersProgress ??
        listEntry?.progressChapters ??
        0
      await handleSaveEntry({
        status: listEntry?.status ?? "IN_PROGRESS",
        score: newScore,
        progress: currentProgress,
        notes: listEntry?.notes ?? null,
        isPrivate: listEntry?.private ?? false,
        priority: listEntry?.priority,
      })
    },
    [handleSaveEntry, listEntry]
  )

  const handleIncrement = useCallback(
    async (count: number) => {
      const currentProgress =
        listEntry?.progress ??
        listEntry?.chaptersProgress ??
        listEntry?.progressChapters ??
        0
      await handleSaveEntry({
        status: listEntry?.status ?? "IN_PROGRESS",
        score: listEntry?.score ?? null,
        progress: Math.max(0, Number(currentProgress) + count),
        notes: listEntry?.notes ?? null,
        isPrivate: listEntry?.private ?? false,
        priority: listEntry?.priority,
      })
    },
    [handleSaveEntry, listEntry]
  )

  const mainTitle = formatMediaTitle(media, titlePref)

  const artistDisplay =
    typeof media.artist === "object" && media.artist !== null
      ? (media.artist as any).namePrimary
      : typeof media.artist === "string"
        ? media.artist
        : null

  const albumDisplay =
    typeof media.album === "object" && media.album !== null
      ? (media.album as any).titlePrimary
      : typeof media.album === "string"
        ? media.album
        : null

  return (
    <div className="relative w-full">
      {/* Backdrop Banner */}
      <div className="relative h-40 w-full overflow-hidden bg-muted sm:h-52 md:h-60">
        {media.bannerImage && !bannerError ? (
          <img
            src={media.bannerImage}
            alt=""
            aria-hidden="true"
            onError={() => setBannerError(true)}
            className="h-full w-full object-cover object-center"
          />
        ) : media.coverImage && !posterError ? (
          <img
            src={media.coverImage}
            alt=""
            aria-hidden="true"
            className="h-full w-full scale-125 object-cover object-center blur-xl brightness-50"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-muted/80 via-muted/40 to-background" />
        )}

        {/* Queued Fetch Warning - frosted pill in top end of banner */}
        {isQueuedFetch && (
          <div className="border-frost bg-frost absolute end-3 top-3 z-10 flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold text-amber-300 shadow-lg backdrop-blur-md select-none sm:end-6 sm:top-4">
            <IconAlertTriangle
              className="size-3.5 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            <span>Syncing background details...</span>
          </div>
        )}
      </div>

      {/* Hero Row: BorealisCard Cover + Right Column (Title GlassCard on top, Tabs GlassCard below) */}
      <div className="relative z-10 -mt-28 w-full px-4 sm:-mt-36 sm:px-6 md:-mt-40 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end md:gap-5">
          {/* Library BorealisCard for Cover Image */}
          <div className="shrink-0 self-start sm:self-end">
            <BorealisCard
              key={listEntry ? "entry-loaded" : "entry-pending"}
              type={media.category}
              data={listEntry ? { media, entry: listEntry } : media}
              href="#"
              titlePreference={titlePref}
              showHoverCard={true}
              showTabNav={true}
              showSubtitle={false}
              showHoverSubtitle={false}
              showBadges={false}
              canEdit={isAuthenticated}
              statusIconOnly
              onSaveEntry={isAuthenticated ? handleSaveEntry : undefined}
              onStatusChange={isAuthenticated ? handleStatusChange : undefined}
              onScoreChange={isAuthenticated ? handleScoreChange : undefined}
              onIncrement={isAuthenticated ? handleIncrement : undefined}
              className={cn(
                "shadow-2xl",
                media.category === "music"
                  ? "w-28 sm:w-36 md:w-40"
                  : "w-28 sm:w-32 md:w-36"
              )}
            >
              <BorealisCard.Image
                aspectRatio={media.category === "music" ? "square" : "poster"}
                showBadges={false}
              />
              {isAuthenticated && <BorealisCard.Extras />}
              <BorealisCard.HoverContent />
            </BorealisCard>
          </div>

          {/* Right Column: Title GlassCard moved up (content-width), Tabs GlassCard directly underneath */}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <GlassCard
              variant="tinted"
              className="flex w-fit max-w-full flex-col gap-1 self-start p-4 sm:px-5 sm:py-4"
            >
              <h1 className="font-mono text-xl leading-tight font-bold tracking-tight text-balance text-foreground sm:text-2xl lg:text-3xl">
                {mainTitle}
              </h1>

              {/* Music: Artist and Album info */}
              {media.category === "music" &&
                (artistDisplay ||
                  (albumDisplay &&
                    media.albumId &&
                    media.format === "TRACK")) && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-muted-foreground">
                    {artistDisplay && (
                      <span className="font-semibold text-foreground">
                        by{" "}
                        {media.artistPersonId ? (
                          <Link
                            href={`/borealis/people/${media.artistPersonId}`}
                            className="text-foreground transition-colors hover:text-primary hover:underline"
                          >
                            {artistDisplay}
                          </Link>
                        ) : (
                          artistDisplay
                        )}
                      </span>
                    )}
                    {albumDisplay &&
                      media.albumId &&
                      media.format === "TRACK" && (
                        <>
                          {artistDisplay && <span>•</span>}
                          <span>
                            From album{" "}
                            <Link
                              href={`/borealis/music/albums/${media.albumId}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {albumDisplay}
                            </Link>
                          </span>
                        </>
                      )}
                  </div>
                )}

              {/* Tagline */}
              {media.tagline && (
                <p className="text-xs text-muted-foreground italic select-text">
                  &ldquo;{media.tagline.replace(/^["“”]|["“”]$/g, "")}
                  &rdquo;
                </p>
              )}
            </GlassCard>

            {/* Separated Navigation Tabs Bar directly under Title */}
            {tabs && activeTab && onSelectTab && (
              <GlassCard variant="normal" className="px-3 py-1.5 sm:px-4">
                <MediaTabNav
                  tabs={tabs}
                  activeTab={activeTab}
                  onSelectTab={onSelectTab}
                  embedded
                />
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
