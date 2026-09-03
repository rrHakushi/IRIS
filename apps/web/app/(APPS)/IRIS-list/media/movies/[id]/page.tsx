import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { MovieDetails, SimilarMediaItem } from "@IRIS/elysia"
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
      title: "Movie Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.movies({ id: numericId }).get()
    if (!data) {
      return {
        title: `Movie #${numericId} | IRIS List`,
      }
    }

    const title =
      data.titlePrimary || data.titleSecondary || `Movie #${numericId}`
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
      title: `Movie #${numericId} | IRIS List`,
    }
  }
}

export default async function MovieDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  // Parallel fetch movie details and similar movies via Elysia client
  const [movieRes, similarRes] = await Promise.all([
    elysia.media.movies({ id: numericId }).get(),
    elysia.media
      .movies({ id: numericId })
      .similar.get({ query: { limit: 50 } }),
  ])

  if (movieRes.error || !movieRes.data) {
    notFound()
  }

  const movie: MovieDetails = movieRes.data as unknown as MovieDetails

  const normalized: NormalizedMediaData = {
    id: movie.id,
    category: "movies",
    titlePrimary: movie.titlePrimary,
    titleSecondary: movie.titleSecondary,
    titleNative: movie.titleNative,
    coverImage: movie.coverImage,
    bannerImage: movie.bannerImage,
    description: movie.description,
    format: "MOVIE",
    status: movie.status,
    startDateYear: movie.releaseDateYear,
    startDateMonth: movie.releaseDateMonth,
    startDateDay: movie.releaseDateDay,
    releaseDateYear: movie.releaseDateYear,
    synonyms: movie.synonyms,
    ageRating: movie.ageRating,
    ageRatingGuide: movie.ageRatingGuide,
    tvDBId: movie.tvDBId,
    tmdbId: movie.tmdbId,
    imdbId: movie.imdbId,
    simklId: movie.simklId,
    originalLanguage: movie.originalLanguage,
    countryOfOrigin: movie.countryOfOrigin,
    isAdult: movie.isAdult,
    runtime: movie.runtime,
    budget: movie.budget,
    revenue: movie.revenue,
    averageScore: movie.averageScore,
    favorites: movie.favorites,
    popularity: movie.popularity,
    scoredCount: movie.scoredCount,
    imdbRating: movie.imdbRating,
    imdbVotes: movie.imdbVotes,
    genres: movie.genres,
    tags: movie.tags,
    studios: movie.studios,
    characters: movie.characters.map(
      (c: MovieDetails["characters"][number]) => ({
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
      })
    ),
    staff: movie.staff.map((s: MovieDetails["staff"][number]) => ({
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
    relations: movie.relations,
    trailers: movie.trailers as NormalizedMediaData["trailers"],
    images: movie.images as Record<string, string[]> | null,
    sources: movie.sources as NormalizedMediaData["sources"],
    statusDistribution: movie.statusDistribution as Record<
      string,
      number
    > | null,
    scoreDistribution: movie.scoreDistribution as Record<string, number> | null,
    updatedAt: movie.updatedAt,
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
