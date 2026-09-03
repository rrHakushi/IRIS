import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { TvDetails, SimilarMediaItem } from "@IRIS/elysia"
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
      title: "TV Show Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.tv({ id: numericId }).get()
    if (!data) {
      return {
        title: `TV Show #${numericId} | IRIS List`,
      }
    }

    const title =
      data.titlePrimary || data.titleSecondary || `TV Show #${numericId}`
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
      title: `TV Show #${numericId} | IRIS List`,
    }
  }
}

export default async function TvDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  // Parallel fetch TV details and similar TV series via Elysia client
  const [tvRes, similarRes] = await Promise.all([
    elysia.media.tv({ id: numericId }).get(),
    elysia.media.tv({ id: numericId }).similar.get({ query: { limit: 50 } }),
  ])

  if (tvRes.error || !tvRes.data) {
    notFound()
  }

  const tv: TvDetails = tvRes.data as unknown as TvDetails

  const normalized: NormalizedMediaData = {
    id: tv.id,
    category: "tv",
    titlePrimary: tv.titlePrimary,
    titleSecondary: tv.titleSecondary,
    titleNative: tv.titleNative,
    coverImage: tv.coverImage,
    bannerImage: tv.bannerImage,
    description: tv.description,
    format: "TV",
    status: tv.status,
    startDateYear: tv.firstAiredYear,
    countryOfOrigin: tv.countryOfOrigin,
    originalLanguage: tv.originalLanguage,
    tvDBId: tv.tvDBId,
    tmdbId: tv.tmdbId,
    imdbId: tv.imdbId,
    simklId: tv.simklId,
    isAdult: false,
    episodeCount: tv.episodeCount,
    seasonCount: tv.seasonCount,
    episodeDuration: tv.averageRuntime,
    averageScore: tv.averageScore,
    favorites: tv.favorites,
    popularity: tv.popularity,
    scoredCount: tv.scoredCount,
    imdbRating: tv.imdbRating,
    imdbVotes: tv.imdbVotes,
    genres: tv.genres,
    tags: tv.tags,
    studios: tv.studios,
    characters: tv.characters.map((c: TvDetails["characters"][number]) => ({
      id: c.id,
      characterId: c.character.id,
      namePrimary: c.character.namePrimary,
      nameNative: c.character.nameNative,
      image: c.character.image,
      role: c.role,
      order: c.order,
      actor: c.actor
        ? {
            id: c.actor.id,
            namePrimary: c.actor.namePrimary,
            nameNative: c.actor.nameNative,
            image: c.actor.image,
            language: c.actor.language,
          }
        : null,
    })),
    staff: tv.staff.map((s: TvDetails["staff"][number]) => ({
      id: s.id,
      personId: s.person.id,
      role: s.role,
      customRole: s.customRole,
      person: {
        id: s.person.id,
        namePrimary: s.person.namePrimary,
        nameNative: s.person.nameNative,
        image: s.person.image,
        language: s.person.language,
      },
    })),
    seasons: tv.seasons.map((s: TvDetails["seasons"][number]) => ({
      id: s.id,
      seasonNumber: s.seasonNumber,
      titlePrimary: s.titlePrimary,
      titleSecondary: s.titleSecondary,
      description: s.description,
      posterImage: s.posterImage,
      episodeCount: s.episodeCount,
    })),
    episodes: tv.episodes.map((ep: TvDetails["episodes"][number]) => ({
      id: ep.id,
      number: ep.episodeNumber,
      seasonNumber: ep.seasonNumber,
      titlePrimary: ep.titlePrimary,
      titleSecondary: ep.titleSecondary,
      titleNative: ep.titleNative,
      description: ep.description,
      duration: ep.duration,
      airDate: ep.airDate,
      thumbnail: ep.thumbnail,
      isFiller: ep.isFiller,
      isRecap: ep.isRecap,
    })),
    relations: tv.relations,
    trailers: tv.trailers as NormalizedMediaData["trailers"],
    images: tv.images as Record<string, string[]> | null,
    sources: tv.sources as NormalizedMediaData["sources"],
    statusDistribution: tv.statusDistribution as Record<string, number> | null,
    scoreDistribution: tv.scoreDistribution as Record<string, number> | null,
    tvmazeId: tv.tvmazeId,
    showType: tv.showType,
    broadcastTime: tv.broadcastTime,
    broadcastDays: tv.broadcastDays,
    networks: tv.networks,
    firstAiredYear: tv.firstAiredYear,
    firstAiredMonth: tv.firstAiredMonth,
    firstAiredDay: tv.firstAiredDay,
    lastAiredYear: tv.lastAiredYear,
    lastAiredMonth: tv.lastAiredMonth,
    lastAiredDay: tv.lastAiredDay,
    rottenTomatoesScore: tv.rottenTomatoesScore,
    tvmazeRating: tv.tvmazeRating,
    awards: tv.awards,
    synonyms: tv.synonyms,
    ageRating: tv.ageRating,
    ageRatingGuide: tv.ageRatingGuide,
    updatedAt: tv.updatedAt,
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
