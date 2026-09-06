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
    const { data } = await elysia.media.music({ id: numericId }).get()
    if (!data) {
      return {
        title: `Music #${numericId} | IRIS List`,
      }
    }

    const title = data.titlePrimary || data.titleSecondary || `Music #${numericId}`
    const artist = data.artist ? ` by ${data.artist}` : ""
    return {
      title: `${title}${artist} | IRIS List`,
    }
  } catch {
    return {
      title: `Music #${numericId} | IRIS List`,
    }
  }
}

export default async function MusicDetailPage({ params }: Props) {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  const { data, error } = await elysia.media.music({ id: numericId }).get()
  if (error || !data) {
    notFound()
  }

  if (data.type === "ALBUM") {
    redirect(`/IRIS-list/media/music/albums/${numericId}`)
  } else {
    redirect(`/IRIS-list/media/music/tracks/${numericId}`)
  }
}
