import React, { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { elysia } from "@/lib/elysia"
import {
  type DiscoverCategory,
  type DiscoverResponse,
  DISCOVER_MEDIA_METAS,
} from "@/components/discover/discover-types"
import { DiscoverPageClient } from "@/components/discover/discover-page-client"
import { DiscoverSkeleton } from "@/components/discover/discover-skeleton"

interface DiscoverMediaPageProps {
  params: Promise<{ media: string }>
  searchParams: Promise<{ genre?: string }>
}

const VALID_CATEGORIES: Set<string> = new Set([
  "anime",
  "manga",
  "movies",
  "tv",
  "games",
  "books",
  "music",
])

export async function generateMetadata({
  params,
}: DiscoverMediaPageProps): Promise<Metadata> {
  const { media } = await params
  if (!VALID_CATEGORIES.has(media)) {
    return {
      title: "Discover Media | IRIS List",
    }
  }

  const meta = DISCOVER_MEDIA_METAS.find((m) => m.key === media)
  const label = meta ? meta.label : media

  return {
    title: `Discover ${label} | IRIS List`,
    description:
      meta?.description ||
      `Discover trending and top-rated ${label} on IRIS List`,
  }
}

async function DiscoverContent({
  category,
  genre,
}: {
  category: DiscoverCategory
  genre?: string
}) {
  const { data, error } = await elysia.discover({ media: category }).get({
    query: { genre: genre || undefined },
  })

  if (error || !data) {
    // If backend returns 404 or error, fallback to empty discovery response
    const fallbackResponse: DiscoverResponse = {
      media: category,
      hero: [],
      sections: [],
      genres: [],
    }
    return (
      <DiscoverPageClient
        category={category}
        initialData={fallbackResponse}
        initialGenre={genre}
      />
    )
  }

  return (
    <DiscoverPageClient
      category={category}
      initialData={data as DiscoverResponse}
      initialGenre={genre}
    />
  )
}

export default async function DiscoverMediaPage({
  params,
  searchParams,
}: DiscoverMediaPageProps) {
  const { media } = await params
  const { genre } = await searchParams

  if (!VALID_CATEGORIES.has(media)) {
    notFound()
  }

  const category = media as DiscoverCategory

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
      <Suspense fallback={<DiscoverSkeleton />}>
        <DiscoverContent category={category} genre={genre} />
      </Suspense>
    </div>
  )
}
