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
    const { data } = await elysia.borealis.media.music({ id: numericId }).get()
    const albumData = (data as any)?.media ?? (data as any)
    if (!albumData) {
      return {
        title: `Album #${numericId} | IRIS List`,
      }
    }

    const title =
      albumData.titlePrimary || albumData.titleSecondary || `Album #${numericId}`
    const artist = albumData.artist ? ` by ${albumData.artist}` : ""
    return {
      title: `${title}${artist} | IRIS List`,
      description: albumData.description
        ? albumData.description.slice(0, 160).replace(/<[^>]*>/g, "")
        : `${title}${artist} album details on IRIS List`,
      openGraph: albumData.coverImage
        ? {
            images: [{ url: albumData.coverImage }],
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
    elysia.borealis.media.music({ id: numericId }).get(),
    elysia.borealis.media
      .music({ id: numericId })
      .similar.get({ query: { limit: 50 } }),
  ])

  const album = (albumRes.data as any)?.media ?? (albumRes.data as any)
  if (albumRes.error || !album) {
    notFound()
  }

  const normalized: NormalizedMediaData = {
    id: album.id,
    category: "music",
    titlePrimary: album.titlePrimary,
    titleSecondary: album.titleSecondary,
    titleNative: album.titleNative ?? null,
    coverImage: album.coverImage ?? null,
    bannerImage: album.bannerImage ?? null,
    description: album.description ?? null,
    format: album.albumType || "ALBUM",
    status: album.status ?? null,
    startDateYear: album.releaseDateYear,
    startDateMonth: album.releaseDateMonth,
    startDateDay: album.releaseDateDay,
    releaseDateYear: album.releaseDateYear,
    genres: album.genres ?? [],
    tags: album.tags ?? [],
    characters: [],
    staff: (album.staff || []).map((s: any) => ({
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
    images: album.images ?? null,
    sources: album.sources ?? null,
    favorites: album.favorites,
    popularity: album.popularity,
    deezerId: album.deezerId,
    artist: album.artist,
    artists: album.artists,
    artistPersonId:
      (album.staff || []).find(
        (s: any) => s.role === "ARTIST" || s.role === "VOCALIST"
      )?.person.id ||
      album.staff?.[0]?.person.id ||
      null,
    album: album.titlePrimary,
    albumId: album.id,
    albumType: album.albumType,
    totalTracks: album.totalTracks ?? album.tracks?.length ?? null,
    duration: album.duration,
    tracks: (album.tracks || []).map((t: any) => ({
      id: t.id,
      trackNumber: t.trackNumber ?? null,
      discNumber: t.discNumber ?? null,
      titlePrimary: t.titlePrimary,
      duration: t.duration ?? null,
      artistName: t.artistName ?? null,
      artistPersonId:
        (album.staff || []).find(
          (s: any) => s.role === "ARTIST" || s.role === "VOCALIST"
        )?.person.id ||
        album.staff?.[0]?.person.id ||
        null,
      audioPreviewUrl: t.audioPreviewUrl ?? null,
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

  const similarItems: SimilarMediaItem[] =
    !similarRes.error && (similarRes.data as any)?.items
      ? (similarRes.data as any).items
      : !similarRes.error && Array.isArray(similarRes.data)
        ? (similarRes.data as any)
        : []
  const similarList: SimilarMediaCardItem[] = similarItems.map((item) => ({
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

  return (
    <MediaDetailView
      media={normalized}
      similarList={similarList}
      isQueuedFetch={isQueued}
    />
  )
}
