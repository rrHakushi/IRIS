import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { AnimeDetails, SimilarMediaItem } from "@IRIS/elysia"
import { elysia } from "@/lib/elysia"
import { MediaDetailView } from "@/components/media/media-detail-view"
import type {
  NormalizedMediaData,
  SimilarMediaCardItem,
  ThemeSongsData,
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
      title: "Anime Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.anime({ id: numericId }).get()
    if (!data) {
      return {
        title: `Anime #${numericId} | IRIS List`,
      }
    }

    const title =
      data.titlePrimary || data.titleSecondary || `Anime #${numericId}`
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
      title: `Anime #${numericId} | IRIS List`,
    }
  }
}

export default async function AnimeDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  // Parallel fetch: Media details and similar media via Elysia client without waterfalls
  const [animeRes, similarRes] = await Promise.all([
    elysia.media.anime({ id: numericId }).get(),
    elysia.media.anime({ id: numericId }).similar.get({ query: { limit: 50 } }),
  ])

  if (animeRes.error || !animeRes.data) {
    notFound()
  }

  const anime: AnimeDetails = animeRes.data as unknown as AnimeDetails

  const normalized: NormalizedMediaData = {
    id: anime.id,
    category: "anime",
    titlePrimary: anime.titlePrimary,
    titleSecondary: anime.titleSecondary,
    titleNative: anime.titleNative,
    coverImage: anime.coverImage,
    bannerImage: anime.bannerImage,
    description: anime.description,
    format: anime.format,
    status: anime.status,
    seasonSeason: anime.seasonSeason,
    seasonYear: anime.seasonYear,
    startDateYear: anime.startDateYear,
    startDateMonth: anime.startDateMonth,
    startDateDay: anime.startDateDay,
    endDateYear: anime.endDateYear,
    endDateMonth: anime.endDateMonth,
    endDateDay: anime.endDateDay,
    source: anime.source,
    hashtag: anime.hashtag,
    synonyms: anime.synonyms,
    siteUrl: anime.siteUrl,
    externalLinks: anime.externalLinks as NormalizedMediaData["externalLinks"],
    ageRating: anime.ageRating,
    ageRatingGuide: anime.ageRatingGuide,
    anilistId: anime.anilistId,
    malId: anime.malId,
    aniDBId: anime.aniDBId,
    tvDBId: anime.tvDBId,
    bangumiId: anime.bangumiId,
    kitsuId: anime.kitsuId,
    countryOfOrigin: anime.countryOfOrigin,
    isAdult: anime.isAdult,
    episodeCount: anime.episodeCount,
    episodeDuration: anime.episodeDuration,
    averageScore: anime.averageScore,
    favorites: anime.favorites,
    popularity: anime.popularity,
    scoredCount: anime.scoredCount,
    genres: anime.genres,
    tags: anime.tags,
    studios: anime.studios,
    characters: anime.characters.map(
      (c: AnimeDetails["characters"][number]) => ({
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
    staff: anime.staff.map((s: AnimeDetails["staff"][number]) => ({
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
    episodes: anime.episodes,
    airingSchedule: anime.airingSchedule,
    nextAiringEpisodeNumber: anime.nextAiringEpisodeNumber,
    nextAiringAt: anime.nextAiringAt,
    relations: anime.relations,
    themeSongs: anime.themeSongs as ThemeSongsData | null,
    trailers: anime.trailers as NormalizedMediaData["trailers"],
    images: anime.images as Record<string, string[]> | null,
    sources: anime.sources as NormalizedMediaData["sources"],
    statusDistribution: anime.statusDistribution as Record<
      string,
      number
    > | null,
    scoreDistribution: anime.scoreDistribution as Record<string, number> | null,
    alAverageScore: anime.alAverageScore,
    malAverageScore: anime.malAverageScore,
    updatedAt: anime.updatedAt,
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
