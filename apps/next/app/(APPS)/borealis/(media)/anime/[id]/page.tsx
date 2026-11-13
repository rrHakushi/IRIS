import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { elysia } from "@/lib/elysia"
import { MediaDetailView, toNormalizedMediaOverview } from "@NamelessLiberty/borealis"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    return {
      title: "Borealis | Anime > Not Found",
    }
  }

  try {
    const { data } = await elysia.borealis.anime({ animeId: numericId }).get()
    const animeData = (data as any)?.media ?? data
    if (!animeData) {
      return {
        title: `Borealis | Anime > #${numericId}`,
      }
    }

    const title =
      animeData.titlePrimary || animeData.titleSecondary || `Anime #${numericId}`
    return {
      title: `Borealis | Anime > ${title}`,
      description: animeData.description
        ? animeData.description.slice(0, 160).replace(/<[^>]*>/g, "")
        : `${title} details on Borealis`,
      openGraph: animeData.coverImage
        ? {
            images: [{ url: animeData.coverImage }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Borealis | Anime > #${numericId}`,
    }
  }
}

export default async function DetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  // Overview only. Every tab (relations, characters, staff, episodes, images,
  // stats, similar...) fetches its own data client-side and caches it.
  const res = await elysia.borealis.anime({ animeId: numericId }).get()
  if (res.error || !res.data) {
    notFound()
  }

  const raw = (res.data as any)?.media ?? res.data

  return (
    <MediaDetailView
      media={toNormalizedMediaOverview("anime", raw)}
      isQueuedFetch={isQueued}
    />
  )
}