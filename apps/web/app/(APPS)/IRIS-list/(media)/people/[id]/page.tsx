import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { PersonDetails } from "@IRIS/elysia"
import { elysia } from "@/lib/elysia"
import { PersonDetailView } from "@/components/media/people/person-detail-view"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    return {
      title: "Person Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.people({ id: numericId }).get()
    if (!data) {
      return {
        title: `Person #${numericId} | IRIS List`,
      }
    }

    const name = data.namePrimary || data.nameNative || `Person #${numericId}`
    return {
      title: `${name} | People | IRIS List`,
      description: data.description
        ? data.description
            .slice(0, 160)
            .replace(/<[^>]*>/g, "")
            .trim()
        : `${name} voice actor and staff information on IRIS List`,
      openGraph: data.image
        ? {
            images: [{ url: data.image }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Person #${numericId} | IRIS List`,
    }
  }
}

export default async function PersonDetailPage({ params }: Props) {
  const { id } = await params
  const numericId = parseInt(id, 10)

  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  const { data, error } = await elysia.media.people({ id: numericId }).get()

  if (error || !data) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <PersonDetailView person={data} />
    </div>
  )
}
