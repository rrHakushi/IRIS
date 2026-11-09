import { elysia } from "@/lib/elysia"
import type { ListStatus, BorealisCardSavePayload } from "@Runa/borealis"

export async function saveListEntry(
  mediaType: string,
  mediaId: number | string,
  payload: BorealisCardSavePayload
) {
  const numericId = Number(mediaId)
  if (!numericId || isNaN(numericId)) {
    throw new Error("Invalid media id")
  }

  const category = (mediaType || "").toLowerCase()
  const finalStartedAt =
    category === "movie" || category === "movies"
      ? payload.completedAt || payload.startedAt
      : payload.startedAt
  const finalCompletedAt =
    category === "movie" || category === "movies"
      ? finalStartedAt
      : payload.completedAt

  const commonPayload = {
    status: payload.status,
    priority: payload.priority ? (String(payload.priority).toUpperCase() as any) : undefined,
    score:
      payload.score !== null && payload.score !== undefined && payload.score > 0
        ? Math.round(Number(payload.score) * 10) / 10
        : null,
    notes: payload.notes || null,
    private: payload.isPrivate ?? false,
    startedAt: finalStartedAt ? new Date(finalStartedAt).toISOString() : null,
    completedAt: finalCompletedAt ? new Date(finalCompletedAt).toISOString() : null,
    connections: payload.connections,
  }

  let res: { data?: any; error?: any }

  switch (category) {
    case "anime":
      res = await elysia.borealis.lists
        .anime({ animeId: numericId })
        .post({
          ...commonPayload,
          progress: payload.progress,
          rewatched: payload.rewatched ?? 0,
          rewatchHistory: payload.rewatchHistory,
          watchedEpisodes: payload.watchedEpisodes,
        } as any)
      break
    case "manga":
      res = await elysia.borealis.lists
        .manga({ mangaId: numericId })
        .post({
          ...commonPayload,
          chaptersProgress: payload.chaptersProgress ?? payload.progress,
          volumesProgress: payload.volumesProgress ?? 0,
          reread: payload.rewatched ?? 0,
          rereadHistory: payload.rereadHistory ?? payload.rewatchHistory,
        } as any)
      break
    case "movie":
    case "movies":
      res = await elysia.borealis.lists
        .movies({ movieId: numericId })
        .post({
          ...commonPayload,
          rewatched: payload.rewatched ?? 0,
          rewatchHistory: payload.rewatchHistory,
        } as any)
      break
    case "tv":
      res = await elysia.borealis.lists
        .tv({ tvId: numericId })
        .post({
          ...commonPayload,
          progress: payload.progress,
          rewatched: payload.rewatched ?? 0,
          rewatchHistory: payload.rewatchHistory,
          watchedEpisodes: payload.watchedEpisodes,
        } as any)
      break
    case "game":
      res = await elysia.borealis.lists
        .games({ gameId: numericId })
        .post({
          ...commonPayload,
          progress: payload.progress,
          replayed: payload.rewatched ?? 0,
        })
      break
    case "book":
    case "books":
      res = await elysia.borealis.lists
        .books({ bookId: numericId })
        .post({
          ...commonPayload,
          progressChapters: payload.chaptersProgress ?? payload.progress,
          progressVolumes: payload.volumesProgress ?? 0,
          reread: payload.rewatched ?? 0,
          rereadHistory: payload.rereadHistory ?? payload.rewatchHistory,
        } as any)
      break
    case "music":
      res = await elysia.borealis.lists
        .music({ musicId: numericId })
        .post({
          ...commonPayload,
          playCount: payload.rewatched ?? 0,
        })
      break
    case "other":
    default:
      res = await elysia.borealis.lists
        .other({ otherId: numericId })
        .post({
          ...commonPayload,
          progress: payload.progress,
        })
      break
  }

  if (res.error) {
    throw new Error(
      res.error.value?.message || "Failed to update list entry"
    )
  }

  // Dispatch global event for reactive UI updates across all components
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("iris:list-updated", {
        detail: {
          mediaId: numericId,
          mediaType: category,
          entry: res.data?.entry ?? {
            id: res.data?.entry?.id,
            status: payload.status,
            progress: payload.progress,
            chaptersProgress: payload.chaptersProgress,
            volumesProgress: payload.volumesProgress,
            score: payload.score,
            notes: payload.notes,
            private: payload.isPrivate,
            rewatched: payload.rewatched,
            startedAt: payload.startedAt,
            completedAt: payload.completedAt,
          },
        },
      })
    )
  }

  return res.data
}

