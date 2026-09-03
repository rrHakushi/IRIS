import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { CharacterDetails } from "@IRIS/elysia"
import { elysia } from "@/lib/elysia"
import { CharacterDetailView } from "@/components/media/characters/character-detail-view"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    return {
      title: "Character Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.characters({ id: numericId }).get()
    if (!data) {
      return {
        title: `Character #${numericId} | IRIS List`,
      }
    }

    const name =
      data.namePrimary || data.nameNative || `Character #${numericId}`
    return {
      title: `${name} | Characters | IRIS List`,
      description: data.description
        ? data.description
            .slice(0, 160)
            .replace(/<[^>]*>/g, "")
            .trim()
        : `${name} character information and appearances on IRIS List`,
      openGraph: data.image
        ? {
            images: [{ url: data.image }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Character #${numericId} | IRIS List`,
    }
  }
}

export default async function CharacterDetailPage({ params }: Props) {
  const { id } = await params
  const numericId = parseInt(id, 10)

  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  const { data, error } = await elysia.media.characters({ id: numericId }).get()

  if (error || !data) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <CharacterDetailView character={data} />
    </div>
  )
}
