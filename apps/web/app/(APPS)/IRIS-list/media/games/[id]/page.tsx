import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { GameDetails, SimilarMediaItem } from "@IRIS/elysia"
import { elysia } from "@/lib/elysia"
import { MediaDetailView } from "@/components/media/media-detail-view"
import type {
  NormalizedMediaData,
  SimilarMediaCardItem,
} from "@/components/media/media-types"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    return {
      title: "Game Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.games({ id: numericId }).get()
    if (!data) {
      return {
        title: `Game #${numericId} | IRIS List`,
      }
    }

    const title =
      data.titlePrimary || data.titleSecondary || `Game #${numericId}`
    return {
      title: `${title} | IRIS List`,
      description: data.description
        ? data.description.slice(0, 160).replace(/<[^>]*>/g, "")
        : `${title} details on IRIS List`,
      openGraph: data.coverImage
        ? {
            images: [{ url: data.coverImage }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Game #${numericId} | IRIS List`,
    }
  }
}

export default async function GameDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  // Parallel fetch game details and similar games via Elysia client
  const [gameRes, similarRes] = await Promise.all([
    elysia.media.games({ id: numericId }).get(),
    elysia.media.games({ id: numericId }).similar.get({ query: { limit: 50 } }),
  ])

  if (gameRes.error || !gameRes.data) {
    notFound()
  }

  const game: GameDetails = gameRes.data as unknown as GameDetails

  const normalized: NormalizedMediaData = {
    id: game.id,
    category: "games",
    titlePrimary: game.titlePrimary,
    titleSecondary: game.titleSecondary,
    titleNative: game.titleNative,
    coverImage: game.coverImage,
    bannerImage: game.bannerImage || game.backgroundImage,
    description: game.description,
    format: "GAME",
    status: game.status,
    startDateYear: game.releaseDateYear,
    startDateMonth: game.releaseDateMonth,
    startDateDay: game.releaseDateDay,
    releaseDateYear: game.releaseDateYear,
    genres: game.genres,
    tags: game.tags,
    platforms: game.platforms,
    developers: game.developers,
    publishers: game.publishers,
    franchise: game.franchise,
    gameModes: game.gameModes,
    playerPerspectives: game.playerPerspectives,
    isAdult: game.isAdult,
    synonyms: game.synonyms,
    trailers: game.trailers as NormalizedMediaData["trailers"],
    images: game.images as Record<string, string[]> | null,
    sources: game.sources as NormalizedMediaData["sources"],
    averageScore: game.averageScore,
    igdbRating: game.igdbRating,
    igdbRatingCount: game.igdbRatingCount,
    averagePlaytime: game.averagePlaytime,
    controllerSupport: game.controllerSupport,
    steamDeckStatus: game.steamDeckStatus,
    esrbRating: game.esrbRating,
    pegiRating: game.pegiRating,
    ageRating: game.ageRating || game.esrbRating || game.pegiRating,
    tagline: game.tagline,
    requirements: game.requirements as NormalizedMediaData["requirements"],
    languages: game.languages,
    linuxSupport: game.linuxSupport,
    rawgId: game.rawgId,
    igdbId: game.igdbId,
    steamAppId: game.steamAppId,
    giantbombId: game.giantbombId,
    vndbId: game.vndbId,
    favorites: game.favorites,
    popularity: game.popularity,
    scoredCount: game.scoredCount,
    statusDistribution: game.statusDistribution as Record<
      string,
      number
    > | null,
    scoreDistribution: game.scoreDistribution as Record<string, number> | null,
    characters: [],
    staff: [],
    studios: game.studios,
    relations: game.relations,
    updatedAt: game.updatedAt,
  }

  const similarList: SimilarMediaCardItem[] =
    !similarRes.error && Array.isArray(similarRes.data)
      ? (similarRes.data as SimilarMediaItem[]).map(
          (item: SimilarMediaItem) => ({
            id: item.id,
            type: item.type,
            format: item.format,
            coverImage: item.coverImage,
            titlePrimary: item.titles.primary,
            titleSecondary: item.titles.secondary,
            titleNative: item.titles.native,
            year: null,
            score: null,
          })
        )
      : []

  return (
    <MediaDetailView
      media={normalized}
      similarList={similarList}
      isQueuedFetch={isQueued}
    />
  )
}
