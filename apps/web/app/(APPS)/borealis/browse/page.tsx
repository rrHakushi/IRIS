import { Suspense } from "react"
import type { Metadata } from "next"
import { BrowsePageClient } from "@/components/browse/browse-page-client"
import { Skeleton } from "@workspace/ui/components/skeleton"

export const metadata: Metadata = {
  title: "Browse Media | IRIS List",
  description:
    "Browse and discover media across Anime, Manga, Movies, TV, Games, Books, Music, Characters, People, and Studios.",
}

function BrowseLoadingFallback() {
  return (
    <div className="flex w-full flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 shrink-0 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-2xl border border-border/40 p-2"
            >
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<BrowseLoadingFallback />}>
      <BrowsePageClient />
    </Suspense>
  )
}
