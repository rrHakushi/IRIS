"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import { elysia } from "@/lib/elysia"
import {
  IconHeart,
  IconDeviceTv,
  IconBook,
  IconMovie,
  IconDeviceGamepad,
  IconUser,
  IconBuildingCommunity,
  IconSparkles,
  IconCategory,
} from "@tabler/icons-react"
import { resolveUserId } from "@/lib/user-profile"
import {
  BorealisCard,
  BorealisCardGroup,
  BorealisSectionHeader,
  type BorealisEntityType,
} from "@Runa/borealis"
import { saveListEntry } from "@/lib/save-list-entry"
import { useEncryption } from "@/context/encryption-context"
import {
  deriveVaultKey,
  safeDecryptText,
  safeEncryptText,
} from "@/lib/client-encryption"
import {
  toNormalizedMedia,
  toMediaListEntry,
} from "../lists/media-list-grid"
import type { ListEntryData, MediaListType } from "../lists/types"

const MediaListModal = dynamic(
  () =>
    import("../media/list/media-list-modal").then(
      (m) => m.MediaListModal
    ),
  { ssr: false }
)

export interface FavoritesTabProps {
  username: string
  userId?: string
  isOwner: boolean
}

interface FavoriteCategoryConfig {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
}

const FAVORITE_CATEGORIES: FavoriteCategoryConfig[] = [
  { id: "anime", name: "Anime", icon: IconDeviceTv },
  { id: "manga", name: "Manga", icon: IconBook },
  { id: "movie", name: "Movies", icon: IconMovie },
  { id: "tv", name: "TV Series", icon: IconDeviceTv },
  { id: "game", name: "Games", icon: IconDeviceGamepad },
  { id: "book", name: "Books", icon: IconBook },
  { id: "character", name: "Characters", icon: IconSparkles },
  { id: "person", name: "Staff & Cast", icon: IconUser },
  { id: "studio", name: "Studios", icon: IconBuildingCommunity },
  { id: "other", name: "Other", icon: IconCategory },
]

const inFlightRequests = new Map<string, Promise<any>>()
const favoritesClientCache = new Map<
  string,
  { data: Record<string, any[]>; timestamp: number }
>()
const CLIENT_CACHE_TTL_MS = 30_000

export function invalidateClientFavorites(username?: string) {
  if (username) {
    favoritesClientCache.delete(username)
  } else {
    favoritesClientCache.clear()
  }
}

export function FavoritesTab({
  username,
  userId,
  isOwner,
}: FavoritesTabProps): React.JSX.Element {
  const cacheKey = username
  const cached = favoritesClientCache.get(cacheKey)
  const isFresh = Boolean(
    cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS
  )

  const [resolvedId, setResolvedId] = useState<string | undefined>(userId)
  const [favoritesData, setFavoritesData] = useState<Record<string, any[]>>(() =>
    isFresh && cached
      ? cached.data
      : {
          anime: [],
          manga: [],
          movie: [],
          tv: [],
          game: [],
          book: [],
          character: [],
          person: [],
          studio: [],
          other: [],
        }
  )
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({})
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

    if (favoritesClientCache.has(cacheKey)) {
      const entry = favoritesClientCache.get(cacheKey)!
      if (Date.now() - entry.timestamp < CLIENT_CACHE_TTL_MS) {
        setFavoritesData(entry.data)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)

    async function fetchAllFavorites() {
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
          if (!targetId) return null

          return await (elysia.carina.users as any)({
            userId: targetId,
          }).favorites.all.get({
            query: { limit: 50 },
          })
        })().finally(() => {
          inFlightRequests.delete(cacheKey)
        })
        inFlightRequests.set(cacheKey, promise)
      }

      try {
        const res = await promise
        if (
          isMounted &&
          res &&
          !res.error &&
          res.data?.success &&
          res.data.favorites
        ) {
          const data = res.data.favorites
          favoritesClientCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
          })
          setFavoritesData(data)
        }
      } catch (err) {
        console.error("[FavoritesTab] Failed to fetch favorites:", err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchAllFavorites()

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

      // Optimistic state update across favoritesData
      setFavoritesData((prev) => {
        const currentList = prev[type] || []
        const updatedList = currentList.map((it: any) => {
          const itMediaId =
            it.media?.id ??
            it.targetId ??
            it.entry?.animeId ??
            it.entry?.mangaId ??
            it.entry?.movieId ??
            it.entry?.tvId ??
            it.entry?.gameId ??
            it.entry?.bookId ??
            it.entry?.otherId
          if (
            (it.entry && it.entry.id === entryId && entryId > 0) ||
            itMediaId === Number(mediaId)
          ) {
            const currentProg =
              it.entry?.progress ?? it.entry?.chaptersProgress ?? 0
            if (type === "manga") {
              return {
                ...it,
                entry: {
                  ...it.entry,
                  chaptersProgress: currentProg + count,
                },
              }
            }
            return {
              ...it,
              entry: {
                ...it.entry,
                progress: currentProg + count,
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
        console.error("[FavoritesTab] Failed to increment progress:", err)
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
    (type: MediaListType, mediaId: number, entryId: number, updated: any) => {
      setFavoritesData((prev) => {
        const currentList = prev[type] || []
        return {
          ...prev,
          [type]: currentList.map((it: any) => {
            const itMediaId =
              it.media?.id ??
              it.targetId ??
              it.entry?.animeId ??
              it.entry?.mangaId ??
              it.entry?.movieId ??
              it.entry?.tvId ??
              it.entry?.gameId ??
              it.entry?.bookId ??
              it.entry?.otherId
            if (
              (it.entry && it.entry.id === entryId && entryId > 0) ||
              itMediaId === mediaId
            ) {
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
      invalidateClientFavorites(username)
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
      handleItemUpdated(mediaType, mediaId, entryId, { status: newStatus })
      try {
        await saveListEntry(mediaType, mediaId, { status: newStatus } as any)
      } catch (err) {
        console.error("[FavoritesTab] Failed to update status:", err)
      }
    },
    [isOwner, handleItemUpdated]
  )

  const handleScoreChange = useCallback(
    async (
      item: ListEntryData,
      newScore: number | null,
      mediaType: MediaListType
    ) => {
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
      handleItemUpdated(mediaType, mediaId, entryId, { score: newScore ?? 0 })
      try {
        await saveListEntry(mediaType, mediaId, { score: newScore } as any)
      } catch (err) {
        console.error("[FavoritesTab] Failed to update score:", err)
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
      handleItemUpdated(mediaType, mediaId, item.entry.id, payload)
    },
    [isOwner, vaultKey, handleItemUpdated]
  )

  const totalFavoritesCount = Object.values(favoritesData).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  )

  return (
    <div className="flex flex-col gap-8 pb-8">
      {isLoading ? (
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((sectionIdx) => (
            <div
              key={sectionIdx}
              className="flex animate-pulse flex-col gap-3 py-2"
            >
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
      ) : totalFavoritesCount === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/20 py-16 text-center">
          <IconHeart className="size-8 text-muted-foreground/40" />
          <h4 className="font-heading text-sm font-bold text-foreground">
            No favorites added yet
          </h4>
          <p className="text-xs text-muted-foreground">
            @{username} hasn&apos;t added any items to their favorites yet.
          </p>
        </div>
      ) : (
        /* Show all categories at once using same dropdowns as homepage */
        <div className="flex flex-col gap-8">
          {FAVORITE_CATEGORIES.map((cat) => {
            const items = favoritesData[cat.id] || []
            if (items.length === 0) return null

            const isCollapsed = Boolean(collapsedSections[cat.id])
            const SectionIcon = cat.icon

            return (
              <section
                key={cat.id}
                aria-label={`${cat.name} favorites`}
                className="flex flex-col gap-3"
              >
                <BorealisSectionHeader
                  title={cat.name}
                  count={items.length}
                  icon={SectionIcon}
                  isCollapsed={isCollapsed}
                  onToggle={() => handleToggleCollapse(cat.id)}
                />

                {!isCollapsed && (
                  <BorealisCardGroup rowCount={1} dragFree className="w-full">
                    {items.map((fav, idx) => {
                      const entity = fav.entity || {}
                      const title =
                        entity.title || `${fav.type} #${fav.targetId}`
                      const subtitle = entity.subtitle
                      const coverImage = entity.coverImage

                      if (fav.type === "CHARACTER") {
                        const charData = fav.media || fav.entity?.raw || {}
                        return (
                          <BorealisCard
                            key={`${fav.id}-${fav.targetId}`}
                            type="character"
                            showSubtitle={false}
                            data={{
                              id: fav.targetId,
                              characterId: fav.targetId,
                              namePrimary: charData.namePrimary || title,
                              nameNative: charData.nameNative || subtitle,
                              image: charData.image || coverImage,
                              role: "FAVORITE",
                              description: charData.description,
                              gender: charData.gender,
                              age: charData.age,
                              dateOfBirthYear: charData.dateOfBirthYear,
                              dateOfBirthMonth: charData.dateOfBirthMonth,
                              dateOfBirthDay: charData.dateOfBirthDay,
                              favorites: charData.favorites,
                            }}
                            priority={idx < 4}
                          />
                        )
                      }

                      if (fav.type === "PERSON") {
                        const personData = fav.media || fav.entity?.raw || {}
                        const role =
                          Array.isArray(personData.primaryOccupations) &&
                          personData.primaryOccupations.length > 0
                            ? personData.primaryOccupations[0]
                            : subtitle || "Staff"
                        return (
                          <BorealisCard
                            key={`${fav.id}-${fav.targetId}`}
                            type="staff"
                            showSubtitle={false}
                            data={{
                              id: fav.targetId,
                              personId: fav.targetId,
                              namePrimary: personData.namePrimary || title,
                              nameNative: personData.nameNative || subtitle,
                              image: personData.image || coverImage,
                              role,
                              customRole: role,
                              description: personData.description,
                              gender: personData.gender,
                              age: personData.age,
                              dateOfBirthYear: personData.dateOfBirthYear,
                              dateOfBirthMonth: personData.dateOfBirthMonth,
                              dateOfBirthDay: personData.dateOfBirthDay,
                              favorites: personData.favorites,
                            }}
                            priority={idx < 4}
                          />
                        )
                      }

                      if (fav.type === "STUDIO") {
                        return (
                          <BorealisCard
                            key={`${fav.id}-${fav.targetId}`}
                            type="studio"
                            data={{
                              id: fav.targetId,
                              name: title,
                              image: coverImage,
                            }}
                            priority={idx < 4}
                          />
                        )
                      }

                      // Media Items
                      const mediaType = cat.id as MediaListType
                      const normalizedItem: ListEntryData =
                        fav.entry && fav.media
                          ? fav
                          : {
                              entry: fav.entry || {
                                id: 0,
                                userId: resolvedId || userId || "",
                                status: null,
                                score:
                                  typeof entity.score === "number"
                                    ? entity.score
                                    : null,
                                progress: 0,
                                notes: null,
                                private: false,
                                createdAt: fav.createdAt,
                                updatedAt: fav.createdAt,
                              },
                              media: fav.media || {
                                id: fav.targetId,
                                titlePrimary: title,
                                title,
                                titleSecondary: subtitle,
                                coverImage,
                                format: entity.format,
                                updatedAt: fav.createdAt,
                              },
                            }

                      const cardData = prepareCardItem(normalizedItem)

                      return (
                        <BorealisCard
                          key={`${fav.id}-${fav.targetId}`}
                          type={cat.id as BorealisEntityType}
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
                                  handleStatusChange(
                                    cardData,
                                    newStatus,
                                    mediaType
                                  )
                              : undefined
                          }
                          onScoreChange={
                            isOwner
                              ? (newScore) =>
                                  handleScoreChange(
                                    cardData,
                                    newScore,
                                    mediaType
                                  )
                              : undefined
                          }
                          onEdit={
                            isOwner
                              ? () => handleOpenEditModal(cardData, mediaType)
                              : undefined
                          }
                          onSaveEntry={
                            isOwner
                              ? (payload) =>
                                  handleSaveEntry(cardData, payload, mediaType)
                              : undefined
                          }
                          onIncrement={
                            isOwner
                              ? (count) =>
                                  handleIncrementProgress(
                                    normalizedItem,
                                    count,
                                    mediaType
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

      {editingItem && (
        <MediaListModal
          isOpen={Boolean(editingItem)}
          onOpenChange={(open: boolean) => {
            if (!open) setEditingItem(null)
          }}
          media={toNormalizedMedia(
            editingItem.item.media,
            editingItem.mediaType
          )}
          initialEntry={toMediaListEntry(editingItem.item.entry)}
          onEntryUpdated={(updated: any) => {
            handleItemUpdated(
              editingItem.mediaType,
              editingItem.item.media.id,
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
