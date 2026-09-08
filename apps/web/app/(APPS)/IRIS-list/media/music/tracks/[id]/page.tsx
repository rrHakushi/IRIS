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
      title: "Track Not Found | IRIS List",
    }
  }

  try {
    const { data } = await elysia.media.music({ id: numericId }).get({
      query: { type: "TRACK" },
    })
    if (!data) {
      return {
        title: `Track #${numericId} | IRIS List`,
      }
    }

    const title =
      data.titlePrimary || data.titleSecondary || `Track #${numericId}`
    const artist = data.artist ? ` by ${data.artist}` : ""
    return {
      title: `${title}${artist} | IRIS List`,
      description: data.description
        ? data.description.slice(0, 160).replace(/<[^>]*>/g, "")
        : `${title}${artist} track details on IRIS List`,
      openGraph: data.coverImage
        ? {
            images: [{ url: data.coverImage }],
          }
        : undefined,
    }
  } catch {
    return {
      title: `Track #${numericId} | IRIS List`,
    }
  }
}

export default async function TrackDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { queuedFetch } = await searchParams
  const isQueued = queuedFetch === "true"

  const numericId = parseInt(id, 10)
  if (isNaN(numericId) || numericId <= 0) {
    notFound()
  }

  // Parallel fetch track details and similar tracks via Elysia client without waterfalls
  const [trackRes, similarRes] = await Promise.all([
    elysia.media.music({ id: numericId }).get({
      query: { type: "TRACK" },
    }),
    elysia.media
      .music({ id: numericId })
      .similar.get({ query: { type: "TRACK", limit: 50 } }),
  ])

  if (trackRes.error || !trackRes.data) {
    notFound()
  }

  const track = trackRes.data

  const normalized: NormalizedMediaData = {
    id: track.id,
    category: "music",
    titlePrimary: track.titlePrimary,
    titleSecondary: track.titleSecondary,
    titleNative: track.titleNative ?? null,
    coverImage: track.coverImage ?? null,
    bannerImage: track.bannerImage ?? null,
    description: track.description ?? null,
    format: "TRACK",
    status: track.status ?? null,
    startDateYear: track.releaseDateYear,
    startDateMonth: track.releaseDateMonth,
    startDateDay: track.releaseDateDay,
    releaseDateYear: track.releaseDateYear,
    genres: track.genres ?? [],
    tags: track.tags ?? [],
    characters: [],
    staff: (track.staff || []).map((s) => ({
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
    relations: track.relations || [],
    images: track.images ?? null,
    sources: track.sources ?? null,
    favorites: track.favorites,
    popularity: track.popularity,
    deezerId: track.deezerId,
    bpm: track.bpm,
    gain: track.gain,
    explicitLyrics: track.explicitLyrics,
    artist: track.artist,
    artists: track.artists,
    artistPersonId:
      (track.staff || []).find(
        (s) => s.role === "ARTIST" || s.role === "VOCALIST"
      )?.person.id ||
      track.staff?.[0]?.person.id ||
      null,
    album: track.album,
    albumId: track.albumId,
    trackNumber: track.trackNumber,
    discNumber: track.discNumber,
    duration: track.duration,
    audioPreviewUrl: track.audioPreviewUrl,
    lyrics: track.lyrics,
    syncedLyrics: track.syncedLyrics,
    spotifyId: track.spotifyId,
    appleMusicId: track.appleMusicId,
    youtubeMusicId: track.youtubeMusicId,
    musicBrainzId: track.musicBrainzId,
    isrc: track.isrc,
    listeners: track.listeners ?? 0,
    playCount: track.playCount ?? 0,
    lastFmListeners: track.lastFmListeners,
    lastFmPlayCount: track.lastFmPlayCount,
    lastFmUrl: track.lastFmUrl,
    isAdult: false,
    updatedAt: track.updatedAt,
  }

  const similarItems =
    !similarRes.error && Array.isArray(similarRes.data) ? similarRes.data : []
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
