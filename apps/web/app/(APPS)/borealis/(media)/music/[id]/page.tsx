import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { elysia } from "@/lib/elysia"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    return {
      title: "Music Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.borealis.media.music({ id: numericId }).get()
    const musicData = (data as any)?.media ?? data
    if (!musicData) {
      return {
        title: `Music #${numericId} | Borealis`,
      }
    }

    const title =
      musicData.titlePrimary || musicData.titleSecondary || `Music #${numericId}`
    const artist = musicData.artist ? ` by ${musicData.artist}` : ""
    return {
      title: `${title}${artist} | Borealis`,
    }
  } catch {
    return {
      title: `Music #${numericId} | Borealis`,
    }
  }
}

export default async function MusicDetailPage({ params }: Props) {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  const { data, error } = await elysia.borealis.media.music({ id: numericId }).get()
  const musicData = (data as any)?.media ?? data
  if (error || !musicData) {
    notFound()
  }

  if (musicData.type === "ALBUM") {
    redirect(`/borealis/music/albums/${numericId}`)
  } else {
    redirect(`/borealis/music/tracks/${numericId}`)
  }
}
