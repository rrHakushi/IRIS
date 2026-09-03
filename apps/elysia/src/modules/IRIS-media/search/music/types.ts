import { t } from "elysia"

export const MusicSearchResultSchema = t.Object({
  id: t.Number(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  artist: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  duration: t.Nullable(t.Number()),
  queuedForFetch: t.Optional(t.Boolean()),
})

export const MusicSearchResponseSchema = t.Array(MusicSearchResultSchema)

export interface MusicSearchResultItem {
  id: number
  titlePrimary: string
  titleSecondary: string | null
  artist: string | null
  coverImage: string | null
  duration: number | null
  queuedForFetch?: boolean
}

export type MusicSearchResponse = MusicSearchResultItem[]
