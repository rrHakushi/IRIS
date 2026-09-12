import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { BookDetails, SimilarMediaItem } from "@IRIS/elysia"
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
      title: "Book Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.books({ id: numericId }).get()
    if (!data) {
      return {
        title: `Book #${numericId} | IRIS List`,
      }
    }

    const title =
      data.titlePrimary || data.titleSecondary || `Book #${numericId}`
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
      title: `Book #${numericId} | IRIS List`,
    }
  }
}

export default async function BookDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  // Parallel fetch book details and similar books via Elysia client
  const [bookRes, similarRes] = await Promise.all([
    elysia.media.books({ id: numericId }).get(),
    elysia.media.books({ id: numericId }).similar.get({ query: { limit: 50 } }),
  ])

  if (bookRes.error || !bookRes.data) {
    notFound()
  }

  const book: BookDetails = bookRes.data as unknown as BookDetails

  const normalized: NormalizedMediaData = {
    id: book.id,
    category: "books",
    titlePrimary: book.titlePrimary,
    titleSecondary: book.titleSecondary || book.subtitle,
    titleNative: null,
    coverImage: book.coverImage,
    bannerImage: book.bannerImage,
    description: book.description,
    format: book.format || "BOOK",
    status: book.status,
    startDateYear: book.releaseDateYear,
    startDateMonth: book.releaseDateMonth,
    startDateDay: book.releaseDateDay,
    releaseDateYear: book.releaseDateYear,
    originalLanguage: book.originalLanguage,
    countryOfOrigin: book.countryOfOrigin,
    genres: book.genres,
    tags: book.tags,
    subjects: book.subjects,
    publishers: book.publishers,
    authors: book.authors,
    series: book.series,
    seriesPosition: book.seriesPosition,
    pageCount: book.pageCount,
    chapterCount: book.chapterCount,
    volumeCount: book.volumeCount,
    isAdult: book.isAdult,
    synonyms: book.synonyms,
    averageScore: book.averageScore,
    googleBooksRating: book.googleBooksRating,
    googleBooksRatingsCount: book.googleBooksRatingsCount,
    retailPrice: book.retailPrice,
    retailPriceCurrency: book.retailPriceCurrency,
    ageRating: book.ageRating,
    ageRatingGuide: book.ageRatingGuide,
    googleBookId: book.googleBookId,
    isbn10: book.isbn10,
    isbn13: book.isbn13,
    openLibraryId: book.openLibraryId,
    previewLink: book.previewLink,
    infoLink: book.infoLink,
    buyLink: book.buyLink,
    siteUrl: book.siteUrl || book.website,
    favorites: book.favorites,
    popularity: book.popularity,
    scoredCount: book.scoredCount,
    statusDistribution: book.statusDistribution as Record<
      string,
      number
    > | null,
    scoreDistribution: book.scoreDistribution as Record<string, number> | null,
    characters: book.characters.map((c: BookDetails["characters"][number]) => ({
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
    staff: book.staff.map((s: BookDetails["staff"][number]) => ({
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
    studios: book.studios,
    relations: book.relations,
    updatedAt: book.updatedAt,
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
