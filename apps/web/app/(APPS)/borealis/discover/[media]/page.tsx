import React, { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import {
  type DiscoverCategory,
  DISCOVER_MEDIA_METAS,
} from "@/components/discover/discover-types"
import { DiscoverPageClient } from "@/components/discover/discover-page-client"
import { DiscoverSkeleton } from "@/components/discover/discover-skeleton"

interface DiscoverMediaPageProps {
  params: Promise<{ media: string }>
}

const VALID_CATEGORIES: Set<string> = new Set([
  "anime",
  "manga",
  "movies",
  "tv",
  "games",
  "books",
  "music",
  "characters",
  "staff",
  "people",
  "studios",
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

export default async function DiscoverMediaPage({
  params,
}: DiscoverMediaPageProps) {
  const { media } = await params

  if (!VALID_CATEGORIES.has(media)) {
    notFound()
  }

  const category = media as DiscoverCategory

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
      <Suspense fallback={<DiscoverSkeleton />}>
        <DiscoverPageClient category={category} />
      </Suspense>
    </div>
  )
}
