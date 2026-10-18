import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { StudioDetails } from "@IRIS/elysia"
import { elysia } from "@/lib/elysia"
import { StudioDetailView } from "@/components/media/studios/studio-detail-view"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    return {
      title: "Borealis | Studios > Not Found",
    }
  }

  try {
    const { data } = await elysia.borealis.studios({ id: numericId }).get()
    const studio = ((data as any)?.studio ?? data) as StudioDetails
    if (!studio) {
      return {
        title: `Borealis | Studios > #${numericId}`,
      }
    }

    const name = studio.name || `Studio #${numericId}`
    return {
      title: `Borealis | Studios > ${name}`,
      description: `Explore all anime, movies, and creations produced by ${name} on Borealis.`,
    }
  } catch {
    return {
      title: `Borealis | Studios > #${numericId}`,
    }
  }
}

export default async function StudioDetailPage({ params }: Props) {
  const { id } = await params
  const numericId = parseInt(id, 10)

  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  const { data, error } = await elysia.borealis.studios({ id: numericId }).get()

  if (error || !data) {
    notFound()
  }

  const studio = ((data as any)?.studio ?? data) as StudioDetails

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <StudioDetailView studio={studio} />
    </div>
  )
}
