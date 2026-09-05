import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { MusicDetails, SimilarMediaItem } from "@IRIS/elysia"
import { elysia } from "@/lib/elysia"
import { MediaDetailView } from "@/components/media/media-detail-view"
import type {
  NormalizedMediaData,
  SimilarMediaCardItem,
} from "@/components/media/media-types"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    return {
      title: "Album Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.music({ id: numericId }).get({
      query: { type: "ALBUM" },
    })
    if (!data) {
      return {
        title: `Album #${numericId} | IRIS List`,
      }
    }

    const title =
      data.titlePrimary || data.titleSecondary || `Album #${numericId}`
    const artist = data.artist ? ` by ${data.artist}` : ""
    return {
      title: `${title}${artist} | IRIS List`,
      description: data.description
        ? data.description.slice(0, 160).replace(/<[^>]*>/g, "")
        : `${title}${artist} album details on IRIS List`,
      openGraph: data.coverImage
        ? {
            images: [{ url: data.coverImage }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Album #${numericId} | IRIS List`,
    }
  }
}

export default async function AlbumDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  // Parallel fetch album details and similar albums via Elysia client without waterfalls
  const [albumRes, similarRes] = await Promise.all([
    elysia.media.music({ id: numericId }).get({
      query: { type: "ALBUM" },
    }),
    elysia.media
      .music({ id: numericId })
      .similar.get({ query: { type: "ALBUM", limit: 50 } }),
  ])

  if (albumRes.error || !albumRes.data) {
    notFound()
  }

  const album: MusicDetails = albumRes.data as unknown as MusicDetails

  const normalized: NormalizedMediaData = {
    id: album.id,
    category: "music",
    titlePrimary: album.titlePrimary,
    titleSecondary: album.titleSecondary,
    titleNative: album.titleNative ?? null,
    coverImage: album.coverImage,
    bannerImage: album.bannerImage,
    description: album.description,
    format: album.albumType || "ALBUM",
    status: album.status,
    startDateYear: album.releaseDateYear,
    startDateMonth: album.releaseDateMonth,
    startDateDay: album.releaseDateDay,
    releaseDateYear: album.releaseDateYear,
    genres: album.genres,
    tags: album.tags,
    characters: [],
    staff: (album.staff || []).map((s) => ({
      id: s.id,
      personId: s.person.id,
      role: s.role,
      customRole: null,
      person: {
        id: s.person.id,
        namePrimary: s.person.namePrimary,
        nameNative: s.person.nameNative ?? null,
        image: s.person.image,
        language: null,
      },
    })),
    studios: [],
    relations: album.relations || [],
    images: album.images as Record<string, string[]> | null,
    sources: album.sources as NormalizedMediaData["sources"],
    favorites: album.favorites,
    popularity: album.popularity,
    artist: album.artist,
    artists: album.artists,
    artistPersonId:
      (album.staff || []).find(
        (s) => s.role === "ARTIST" || s.role === "VOCALIST"
      )?.person.id ||
      album.staff?.[0]?.person.id ||
      null,
    album: album.titlePrimary,
    albumId: album.id,
    albumType: album.albumType,
    totalTracks: album.totalTracks ?? album.tracks?.length ?? null,
    duration: album.duration,
    tracks: (album.tracks || []).map((t) => ({
      id: t.id,
      trackNumber: t.trackNumber,
      discNumber: t.discNumber,
      titlePrimary: t.titlePrimary,
      duration: t.duration,
      artistName: t.artistName,
      artistPersonId:
        (album.staff || []).find(
          (s) => s.role === "ARTIST" || s.role === "VOCALIST"
        )?.person.id ||
        album.staff?.[0]?.person.id ||
        null,
      audioPreviewUrl: t.audioPreviewUrl,
    })),
    spotifyId: album.spotifyId,
    appleMusicId: album.appleMusicId,
    musicBrainzId: album.musicBrainzId,
    listeners: album.listeners ?? 0,
    playCount: album.playCount ?? 0,
    lastFmListeners: album.lastFmListeners,
    lastFmPlayCount: album.lastFmPlayCount,
    lastFmUrl: album.lastFmUrl,
    isAdult: false,
    updatedAt: album.updatedAt,
  }

  const similarList: SimilarMediaCardItem[] =
    !similarRes.error && Array.isArray(similarRes.data)
      ? (similarRes.data as SimilarMediaItem[]).map((item: SimilarMediaItem) => ({
          id: item.id,
          type: item.type,
          format: item.format,
          coverImage: item.coverImage,
          titlePrimary: item.titles.primary,
          titleSecondary: item.titles.secondary,
          titleNative: item.titles.native,
          year: null,
          score: null,
        }))
      : []

  return (
    <MediaDetailView
      media={normalized}
      similarList={similarList}
      isQueuedFetch={isQueued}
    />
  )
}
