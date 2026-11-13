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
      title: "Borealis | TV > Not Found",
    }
  }

  try {
    const { data } = await elysia.borealis.tv({ tvId: numericId }).get()
    const tvData = (data as any)?.media ?? data
    if (!tvData) {
      return {
        title: `Borealis | TV > #${numericId}`,
      }
    }

    const title =
      tvData.titlePrimary || tvData.titleSecondary || `TV Show #${numericId}`
    return {
      title: `Borealis | TV > ${title}`,
      description: tvData.description
        ? tvData.description.slice(0, 160).replace(/<[^>]*>/g, "")
        : `${title} details on Borealis`,
      openGraph: tvData.coverImage
        ? {
            images: [{ url: tvData.coverImage }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Borealis | TV > #${numericId}`,
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
  const res = await elysia.borealis.tv({ tvId: numericId }).get()
  if (res.error || !res.data) {
    notFound()
  }

  const raw = (res.data as any)?.media ?? res.data

  return (
    <MediaDetailView
      media={toNormalizedMediaOverview("tv", raw)}
      isQueuedFetch={isQueued}
    />
  )
}