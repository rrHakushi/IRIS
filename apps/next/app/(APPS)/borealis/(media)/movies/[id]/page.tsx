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
      title: "Borealis | Movies > Not Found",
    }
  }

  try {
    const { data } = await elysia.borealis.movies({ movieId: numericId }).get()
    const movieData = (data as any)?.media ?? data
    if (!movieData) {
      return {
        title: `Borealis | Movies > #${numericId}`,
      }
    }

    const title =
      movieData.titlePrimary || movieData.titleSecondary || `Movie #${numericId}`
    return {
      title: `Borealis | Movies > ${title}`,
      description: movieData.description
        ? movieData.description.slice(0, 160).replace(/<[^>]*>/g, "")
        : `${title} details on Borealis`,
      openGraph: movieData.coverImage
        ? {
            images: [{ url: movieData.coverImage }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Borealis | Movies > #${numericId}`,
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
  const res = await elysia.borealis.movies({ movieId: numericId }).get()
  if (res.error || !res.data) {
    notFound()
  }

  const raw = (res.data as any)?.media ?? res.data

  return (
    <MediaDetailView
      media={toNormalizedMediaOverview("movies", raw)}
      isQueuedFetch={isQueued}
    />
  )
}