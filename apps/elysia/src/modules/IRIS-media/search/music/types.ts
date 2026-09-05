import { t } from "elysia"

export const MusicSearchResultSchema = t.Object({
  id: t.Number(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  artist: t.Nullable(t.String()),
  artistName: t.Optional(t.Nullable(t.String())),
  coverImage: t.Nullable(t.String()),
  duration: t.Optional(t.Nullable(t.Number())),
  album: t.Optional(t.Nullable(t.String())),
  albumId: t.Optional(t.Nullable(t.Number())),
  type: t.Optional(t.Union([t.Literal("ALBUM"), t.Literal("TRACK")])),
  queuedForFetch: t.Optional(t.Boolean()),
})

export const MusicSearchResponseSchema = t.Array(MusicSearchResultSchema)

export interface MusicSearchResultItem {
  id: number
  titlePrimary: string
  titleSecondary: string | null
  artist: string | null
  artistName?: string | null
  coverImage: string | null
  duration?: number | null
  album?: string | null
  albumId?: number | null
  type?: "ALBUM" | "TRACK"
  queuedForFetch?: boolean
}

export type MusicSearchResponse = MusicSearchResultItem[]
