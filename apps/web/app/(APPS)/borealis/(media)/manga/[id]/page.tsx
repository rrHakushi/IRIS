import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { elysia } from "@/lib/elysia"
import { MediaDetailView, toNormalizedMediaOverview } from "@Runa/borealis"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    return {
      title: "Borealis | Manga > Not Found",
    }
  }

  try {
    const { data } = await elysia.borealis.manga({ mangaId: numericId }).get()
    const mangaData = (data as any)?.media ?? data
    if (!mangaData) {
      return {
        title: `Borealis | Manga > #${numericId}`,
      }
    }

    const title =
      mangaData.titlePrimary || mangaData.titleSecondary || `Manga #${numericId}`
    return {
      title: `Borealis | Manga > ${title}`,
      description: mangaData.description
        ? mangaData.description.slice(0, 160).replace(/<[^>]*>/g, "")
        : `${title} details on Borealis`,
      openGraph: mangaData.coverImage
        ? {
            images: [{ url: mangaData.coverImage }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Borealis | Manga > #${numericId}`,
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
  const res = await elysia.borealis.manga({ mangaId: numericId }).get()
  if (res.error || !res.data) {
    notFound()
  }

  const raw = (res.data as any)?.media ?? res.data

  return (
    <MediaDetailView
      media={toNormalizedMediaOverview("manga", raw)}
      isQueuedFetch={isQueued}
    />
  )
}