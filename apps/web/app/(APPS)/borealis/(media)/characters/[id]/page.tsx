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
      title: "Borealis | Characters > Not Found",
    }
  }

  try {
    const { data } = await elysia.borealis.characters({ id: numericId }).get()
    const charData = (data as any)?.character ?? data
    if (!charData) {
      return {
        title: `Borealis | Characters > #${numericId}`,
      }
    }

    const name =
      charData.namePrimary || charData.nameNative || `Character #${numericId}`
    return {
      title: `Borealis | Characters > ${name}`,
      description: charData.description
        ? charData.description
            .slice(0, 160)
            .replace(/<[^>]*>/g, "")
            .trim()
        : `${name} character information and appearances on Borealis`,
      openGraph: charData.image
        ? {
            images: [{ url: charData.image }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Borealis | Characters > #${numericId}`,
    }
  }
}

export default async function CharacterDetailPage({ params }: Props) {
  const { id } = await params
  const numericId = parseInt(id, 10)

  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  const { data, error } = await elysia.borealis.characters({ id: numericId }).get()

  if (error || !data) {
    notFound()
  }

  const character: CharacterDetails = ((data as any)?.character ?? data) as CharacterDetails

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <CharacterDetailView character={character} />
    </div>
  )
}
