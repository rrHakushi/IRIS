import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { MangaDetails, SimilarMediaItem } from "@IRIS/elysia"
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
      title: "Manga Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.manga({ id: numericId }).get()
    if (!data) {
      return {
        title: `Manga #${numericId} | IRIS List`,
      }
    }

    const title =
      data.titlePrimary || data.titleSecondary || `Manga #${numericId}`
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
      title: `Manga #${numericId} | IRIS List`,
    }
  }
}

export default async function MangaDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  // Parallel fetch Manga details and similar Manga series via Elysia client
  const [mangaRes, similarRes] = await Promise.all([
    elysia.media.manga({ id: numericId }).get(),
    elysia.media.manga({ id: numericId }).similar.get({ query: { limit: 50 } }),
  ])

  if (mangaRes.error || !mangaRes.data) {
    notFound()
  }

  const manga: MangaDetails = mangaRes.data as unknown as MangaDetails

  const normalized: NormalizedMediaData = {
    id: manga.id,
    category: "manga",
    titlePrimary: manga.titlePrimary,
    titleSecondary: manga.titleSecondary,
    titleNative: manga.titleNative,
    coverImage: manga.coverImage,
    bannerImage: manga.bannerImage,
    description: manga.description,
    format: manga.format,
    status: manga.status,
    startDateYear: manga.startDateYear,
    endDateYear: manga.endDateYear,
    countryOfOrigin: manga.countryOfOrigin,
    isAdult: manga.isAdult,
    episodeCount: manga.chapterCount,
    chapterCount: manga.chapterCount,
    volumeCount: manga.volumeCount,
    averageScore: manga.averageScore,
    favorites: manga.favorites,
    popularity: manga.popularity,
    scoredCount: manga.scoredCount,
    genres: manga.genres,
    tags: manga.tags,
    studios: [],
    characters: manga.characters.map(
      (c: MangaDetails["characters"][number]) => ({
        id: c.id,
        characterId: c.character.id,
        namePrimary: c.character.namePrimary,
        nameNative: c.character.nameNative,
        image: c.character.image,
        role: c.role,
        order: c.order,
        actor: null,
      })
    ),
    staff: manga.staff.map((s: MangaDetails["staff"][number]) => ({
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
    relations: manga.relations,
    trailers: null,
    images: manga.images as Record<string, string[]> | null,
    sources: manga.sources as NormalizedMediaData["sources"],
    statusDistribution: manga.statusDistribution as Record<
      string,
      number
    > | null,
    scoreDistribution: manga.scoreDistribution as Record<string, number> | null,
    alAverageScore: manga.alAverageScore,
    malAverageScore: manga.malAverageScore,
    updatedAt: manga.updatedAt,
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
