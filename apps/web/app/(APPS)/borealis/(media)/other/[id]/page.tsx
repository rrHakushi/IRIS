import { notFound } from "next/navigation"
import type { Metadata } from "next"
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
      title: "Borealis | Other > Not Found",
    }
  }

  try {
    const { data } = await elysia.borealis.other({ otherId: numericId }).get()
    const item = data?.item
    if (!item) {
      return {
        title: `Borealis | Other > #${numericId}`,
      }
    }

    const title =
      item.titlePrimary || item.titleSecondary || `Custom Item #${numericId}`
    return {
      title: `Borealis | Other > ${title}`,
      description: item.description
        ? item.description.slice(0, 160).replace(/<[^>]*>/g, "")
        : `${title} custom item tracking on Borealis`,
      openGraph: item.coverImage
        ? {
            images: [{ url: item.coverImage }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Borealis | Other > #${numericId}`,
    }
  }
}

export default async function OtherDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  const { data, error } = await elysia.borealis.other({ otherId: numericId }).get()

  if (error || !data?.item) {
    notFound()
  }

  const item = data.item

  const startDateObj = item.startDate ? new Date(item.startDate) : null
  const endDateObj = item.endDate ? new Date(item.endDate) : null

  const normalized: NormalizedMediaData = {
    id: item.id,
    category: "other",
    titlePrimary: item.titlePrimary,
    titleSecondary: item.titleSecondary || null,
    titleNative: null,
    coverImage: item.coverImage || null,
    bannerImage: item.bannerImage || null,
    description: item.description || null,
    format: item.format
      ? item.format.charAt(0).toUpperCase() + item.format.slice(1)
      : "Other",
    status: item.isPublished ? "PUBLISHED" : "PRIVATE",
    startDateYear: startDateObj ? startDateObj.getFullYear() : null,
    startDateMonth: startDateObj ? startDateObj.getMonth() + 1 : null,
    startDateDay: startDateObj ? startDateObj.getDate() : null,
    endDateYear: endDateObj ? endDateObj.getFullYear() : null,
    endDateMonth: endDateObj ? endDateObj.getMonth() + 1 : null,
    endDateDay: endDateObj ? endDateObj.getDate() : null,
    isAdult: false,
    averageScore: item.averageScore ?? null,
    favorites: item.favorites ?? 0,
    popularity: item.popularity ?? 0,
    statusDistribution: (item.statusDistribution as Record<string, number>) || null,
    scoreDistribution: (item.scoreDistribution as Record<string, number>) || null,
    genres: [],
    tags: [],
    characters: [],
    staff: [],
    studios: [],
    relations: [],
    episodeCount: null,
    seasonCount: null,
    chapterCount: null,
    volumeCount: null,
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
  }

  const similarList: SimilarMediaCardItem[] = []

  return (
    <MediaDetailView
      media={normalized}
      similarList={similarList}
      isQueuedFetch={isQueued}
    />
  )
}
