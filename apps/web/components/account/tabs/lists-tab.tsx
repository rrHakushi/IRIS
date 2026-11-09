"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import { elysia } from "@/lib/elysia"
import { LinkButton } from "@workspace/ui/components/button"
import {
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconDeviceGamepad,
  IconArrowRight,
  IconPlayerPlay,
  IconCategory,
} from "@tabler/icons-react"
import { resolveUserId } from "@/lib/user-profile"
import { BorealisCard, BorealisCardGroup, BorealisSectionHeader } from "@Runa/borealis"
import { saveListEntry } from "@/lib/save-list-entry"
import { useEncryption } from "@/context/encryption-context"
import { deriveVaultKey, safeDecryptText, safeEncryptText } from "@/lib/client-encryption"
import {
  toNormalizedMedia,
  toMediaListEntry,
} from "@/components/lists/media-list-grid"
import type { ListEntryData, MediaListType } from "@/components/lists/types"

const MediaListModal = dynamic(
  () =>
    import("@/components/media/list/media-list-modal").then(
      (m) => m.MediaListModal
    ),
  { ssr: false }
)

export interface ListsTabProps {
  username: string
  userId?: string
  isOwner: boolean
}

interface MediaConfig {
  id: MediaListType
  name: string
  action: string
  icon: React.ComponentType<{ className?: string }>
  path: string
}

const MEDIA_CONFIGS: MediaConfig[] = [
  { id: "anime", name: "Anime", action: "Watching", icon: IconDeviceTv, path: "anime" },
  { id: "tv", name: "TV Series", action: "Watching", icon: IconDeviceTv, path: "tv" },
  { id: "movie", name: "Movies", action: "Watching", icon: IconMovie, path: "movies" },
  { id: "manga", name: "Manga", action: "Reading", icon: IconBook, path: "manga" },
  { id: "game", name: "Games", action: "Playing", icon: IconDeviceGamepad, path: "games" },
  { id: "book", name: "Books", action: "Reading", icon: IconBook, path: "books" },
  { id: "other", name: "Other", action: "Tracking", icon: IconCategory, path: "other" },
]

const inFlightRequests = new Map<string, Promise<any>>()
const listClientCache = new Map<string, { lists: Record<string, ListEntryData[]>; timestamp: number }>()
const CLIENT_CACHE_TTL_MS = 30_000

export function invalidateClientLists(username?: string) {
  if (username) {
    listClientCache.delete(username)
  } else {
    listClientCache.clear()
  }
}

export function ListsTab({ username, userId, isOwner }: ListsTabProps): React.JSX.Element {
  const [resolvedId, setResolvedId] = useState<string | undefined>(userId)
  const cacheKey = username
  const cached = listClientCache.get(cacheKey)
  const isFresh = Boolean(cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS)

  const [listsData, setListsData] = useState<Record<string, ListEntryData[]>>(() =>
    isFresh && cached
      ? cached.lists
      : {
          anime: [],
          tv: [],
          movie: [],
          manga: [],
          game: [],
          book: [],
          other: [],
        }
  )
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(!isFresh)
  const [editingItem, setEditingItem] = useState<{
    item: ListEntryData
    mediaType: MediaListType
  } | null>(null)

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }, [])

  useEffect(() => {
    let isMounted = true

    if (listClientCache.has(cacheKey)) {
      const entry = listClientCache.get(cacheKey)!
      if (Date.now() - entry.timestamp < CLIENT_CACHE_TTL_MS) {
        setListsData(entry.lists)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)

    async function fetchAllWatchingLists() {
      let promise = inFlightRequests.get(cacheKey)
      if (!promise) {
        promise = (async () => {
          let targetId = userId
          if (!targetId) {
            targetId = (await resolveUserId(username)) || undefined
          }
          if (targetId && isMounted) {
            setResolvedId(targetId)
          }

          const query: any = { limit: 50 }
          if (targetId) query.userId = targetId

          return await (elysia.borealis.lists as any).watching.get({ query })
        })().finally(() => {
          inFlightRequests.delete(cacheKey)
        })
        inFlightRequests.set(cacheKey, promise)
      }

      try {
        const res = await promise
        if (isMounted && res && !res.error && res.data?.success && res.data.lists) {
          const fetchedLists: Record<string, ListEntryData[]> = {
            anime: res.data.lists.anime || [],
            tv: res.data.lists.tv || [],
            movie: res.data.lists.movie || [],
            manga: res.data.lists.manga || [],
            game: res.data.lists.game || [],
            book: res.data.lists.book || [],
            other: res.data.lists.other || [],
          }
          listClientCache.set(cacheKey, {
            lists: fetchedLists,
            timestamp: Date.now(),
          })
          setListsData(fetchedLists)
        }
      } catch (err) {
        console.error("[ListsTab] Failed to fetch watching lists:", err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchAllWatchingLists()

    return () => {
      isMounted = false
    }
  }, [cacheKey, username, userId])

  const handleOpenEditModal = useCallback(
    (item: ListEntryData, mediaType: MediaListType) => {
      if (isOwner) {
        setEditingItem({ item, mediaType })
      }
    },
    [isOwner]
  )

  const handleIncrementProgress = useCallback(
    async (item: ListEntryData, count: number, mediaType: MediaListType) => {
      const type = mediaType
      const entryId = item.entry.id
      const mediaId =
        (item.media as any)?.id ??
        (item.entry as any)?.animeId ??
        (item.entry as any)?.mangaId ??
        (item.entry as any)?.movieId ??
        (item.entry as any)?.tvId ??
        (item.entry as any)?.gameId ??
        (item.entry as any)?.bookId ??
        (item.entry as any)?.otherId

      if (!mediaId) return

      // Optimistic state update across listsData
      setListsData((prev) => {
        const currentList = prev[type] || []
        const updatedList = currentList.map((it) => {
          if (it.entry.id === entryId) {
            if (type === "manga") {
              return {
                ...it,
                entry: {
                  ...it.entry,
                  chaptersProgress: (it.entry.chaptersProgress ?? 0) + count,
                },
              }
            }
            return {
              ...it,
              entry: {
                ...it.entry,
                progress: (it.entry.progress ?? 0) + count,
              },
            }
          }
          return it
        })
        return {
          ...prev,
          [type]: updatedList,
        }
      })

      try {
        const numMediaId = Number(mediaId)
        if (type === "anime") {
          await elysia.borealis.lists.anime({ animeId: numMediaId }).increment.post({ count })
        } else if (type === "tv") {
          await elysia.borealis.lists.tv({ tvId: numMediaId }).increment.post({ count })
        } else if (type === "manga") {
          await elysia.borealis.lists.manga({ mangaId: numMediaId }).increment.post({ count, type: "chapter" })
        } else if (type === "movie") {
          await elysia.borealis.lists.movies({ movieId: numMediaId }).increment.post({ count: 1 })
        } else if (type === "game") {
          await elysia.borealis.lists.games({ gameId: numMediaId }).increment.post({ count })
        } else if (type === "book") {
          await elysia.borealis.lists.books({ bookId: numMediaId }).increment.post({ count, type: "chapter" })
        } else if (type === "other") {
          await (elysia.borealis.lists as any).other({ otherId: numMediaId }).increment.post({ count })
        }
      } catch (err) {
        console.error("[ListsTab] Failed to increment progress:", err)
      }
    },
    []
  )

  const { secretKey, isActive: isVaultActive } = useEncryption()
  const vaultKey = useMemo(
    () => (isVaultActive && secretKey ? deriveVaultKey(secretKey) : null),
    [isVaultActive, secretKey]
  )

  const prepareCardItem = useCallback(
    (item: ListEntryData): ListEntryData => {
      if (!item?.entry?.notes || !isOwner) return item
      const decrypted = safeDecryptText(item.entry.notes, vaultKey)
      if (decrypted === item.entry.notes) return item
      return {
        ...item,
        entry: {
          ...item.entry,
          notes: decrypted,
        },
      }
    },
    [vaultKey, isOwner]
  )

  const handleItemUpdated = useCallback(
    (type: MediaListType, entryId: number, updated: any) => {
      setListsData((prev) => {
        const currentList = prev[type] || []
        if (!updated) {
          return {
            ...prev,
            [type]: currentList.filter((it) => it.entry.id !== entryId),
          }
        }
        return {
          ...prev,
          [type]: currentList.map((it) => {
            if (it.entry.id === entryId) {
              return {
                ...it,
                entry: {
                  ...it.entry,
                  ...updated,
                },
              }
            }
            return it
          }),
        }
      })
      invalidateClientLists(username)
    },
    [username]
  )

  const handleStatusChange = useCallback(
    async (item: ListEntryData, newStatus: any, mediaType: MediaListType) => {
      if (!isOwner) return
      const entryId = item.entry.id
      const mediaId = Number(
        item.media?.id ||
          (item.entry as any)?.animeId ||
          (item.entry as any)?.mangaId ||
          (item.entry as any)?.movieId ||
          (item.entry as any)?.tvId ||
          (item.entry as any)?.gameId ||
          (item.entry as any)?.bookId ||
          (item.entry as any)?.otherId
      )
      handleItemUpdated(mediaType, entryId, { status: newStatus })
      try {
        await saveListEntry(mediaType, mediaId, { status: newStatus } as any)
      } catch (err) {
        console.error("[ListsTab] Failed to update status:", err)
      }
    },
    [isOwner, handleItemUpdated]
  )

  const handleScoreChange = useCallback(
    async (item: ListEntryData, newScore: number | null, mediaType: MediaListType) => {
      if (!isOwner) return
      const entryId = item.entry.id
      const mediaId = Number(
        item.media?.id ||
          (item.entry as any)?.animeId ||
          (item.entry as any)?.mangaId ||
          (item.entry as any)?.movieId ||
          (item.entry as any)?.tvId ||
          (item.entry as any)?.gameId ||
          (item.entry as any)?.bookId ||
          (item.entry as any)?.otherId
      )
      handleItemUpdated(mediaType, entryId, { score: newScore ?? 0 })
      try {
        await saveListEntry(mediaType, mediaId, { score: newScore } as any)
      } catch (err) {
        console.error("[ListsTab] Failed to update score:", err)
      }
    },
    [isOwner, handleItemUpdated]
  )

  const handleSaveEntry = useCallback(
    async (item: ListEntryData, payload: any, mediaType: MediaListType) => {
      if (!isOwner) return
      const mediaId = Number(
        item.media?.id ||
          (item.entry as any)?.animeId ||
          (item.entry as any)?.mangaId ||
          (item.entry as any)?.movieId ||
          (item.entry as any)?.tvId ||
          (item.entry as any)?.gameId ||
          (item.entry as any)?.bookId ||
          (item.entry as any)?.otherId
      )
      const encryptedPayload = {
        ...payload,
        notes: payload.notes
          ? safeEncryptText(payload.notes, vaultKey)
          : payload.notes,
      }
      await saveListEntry(mediaType, mediaId, encryptedPayload)
      handleItemUpdated(mediaType, item.entry.id, payload)
    },
    [isOwner, vaultKey, handleItemUpdated]
  )

  const totalItemsCount = Object.values(listsData).reduce(
    (sum, list) => sum + list.length,
    0
  )

  return (
    <div className="flex flex-col gap-8 pb-8">
      {isLoading ? (
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((sectionIdx) => (
            <div key={sectionIdx} className="flex animate-pulse flex-col gap-3 py-2">
              <div className="flex items-center gap-2 border-b border-border/40 pb-2.5">
                <div className="size-5 rounded-md bg-muted/60" />
                <div className="h-5 w-28 rounded bg-muted/60" />
              </div>
              <div className="flex gap-2.5 overflow-hidden">
                {[1, 2, 3, 4, 5, 6].map((cardIdx) => (
                  <div
                    key={cardIdx}
                    className="aspect-2/3 w-[140px] shrink-0 rounded-2xl border border-border/20 bg-muted/20"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : totalItemsCount === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-card/20 py-16 text-center">
          <IconPlayerPlay className="size-8 text-muted-foreground/40" />
          <div className="space-y-1">
            <h4 className="font-heading text-sm font-bold text-foreground">
              No in-progress media
            </h4>
            <p className="text-xs text-muted-foreground">
              @{username} doesn&apos;t have any media marked as in-progress right now.
            </p>
          </div>
        </div>
      ) : (
        /* Show all categories at once using same dropdowns as homepage */
        <div className="flex flex-col gap-8">
          {MEDIA_CONFIGS.map((config) => {
            const categoryItems = listsData[config.id] || []
            if (categoryItems.length === 0) return null

            const isCollapsed = Boolean(collapsedSections[config.id])
            const SectionIcon = config.icon

            return (
              <section
                key={config.id}
                aria-label={`${config.name} in progress`}
                className="flex flex-col gap-3"
              >
                <BorealisSectionHeader
                  title={config.name}
                  count={categoryItems.length}
                  icon={SectionIcon}
                  isCollapsed={isCollapsed}
                  onToggle={() => handleToggleCollapse(config.id)}
                  actions={
                    <LinkButton
                      href={`/borealis/lists/${resolvedId || userId || username}/${config.path}`}
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <span>See Full List</span>
                      <IconArrowRight className="size-3.5" />
                    </LinkButton>
                  }
                />

                {!isCollapsed && (
                  <BorealisCardGroup
                    rowCount={1}
                    dragFree
                    className="w-full"
                  >
                    {categoryItems.map((item, idx) => {
                      const normalizedItem: ListEntryData =
                        item.entry && item.media
                          ? item
                          : {
                              entry: (item as any).entry || item,
                              media:
                                (item as any).media ||
                                (item as any).anime ||
                                (item as any).manga ||
                                (item as any).movie ||
                                (item as any).tv ||
                                (item as any).game ||
                                (item as any).book ||
                                (item as any).other ||
                                {},
                            }

                      const cardData = prepareCardItem(normalizedItem)

                      return (
                        <BorealisCard
                          key={`${normalizedItem.entry?.id ?? idx}-${normalizedItem.media?.id ?? idx}`}
                          type={config.id}
                          data={cardData}
                          showSubtitle={false}
                          showHoverSubtitle={false}
                          showTabNav={isOwner}
                          showExtras={true}
                          statusIconOnly={true}
                          canEdit={isOwner}
                          onStatusChange={
                            isOwner
                              ? (newStatus) =>
                                  handleStatusChange(cardData, newStatus, config.id)
                              : undefined
                          }
                          onScoreChange={
                            isOwner
                              ? (newScore) =>
                                  handleScoreChange(cardData, newScore, config.id)
                              : undefined
                          }
                          onEdit={
                            isOwner
                              ? () => handleOpenEditModal(cardData, config.id)
                              : undefined
                          }
                          onSaveEntry={
                            isOwner
                              ? (payload) =>
                                  handleSaveEntry(cardData, payload, config.id)
                              : undefined
                          }
                          onIncrement={
                            isOwner
                              ? (count) =>
                                  handleIncrementProgress(
                                    normalizedItem,
                                    count,
                                    config.id
                                  )
                              : undefined
                          }
                          priority={idx < 4}
                        />
                      )
                    })}
                  </BorealisCardGroup>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Edit List Modal */}
      {editingItem && (
        <MediaListModal
          isOpen={Boolean(editingItem)}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null)
          }}
          media={toNormalizedMedia(editingItem.item.media, editingItem.mediaType)}
          initialEntry={toMediaListEntry(editingItem.item.entry)}
          onEntryUpdated={(updated) => {
            handleItemUpdated(
              editingItem.mediaType,
              editingItem.item.entry.id,
              updated
            )
            setEditingItem(null)
          }}
        />
      )}
    </div>
  )
}
