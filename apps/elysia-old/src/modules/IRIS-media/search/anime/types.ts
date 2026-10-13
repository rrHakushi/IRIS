import { t } from "elysia"

export const AnimeSearchResultSchema = t.Object({
  id: t.Number(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  isAdult: t.Boolean(),
  format: t.String(),
  seasonYear: t.Nullable(t.Number()),
  seasonSeason: t.String(),
  queuedForFetch: t.Optional(t.Boolean()),
})

export const AnimeSearchResponseSchema = t.Array(AnimeSearchResultSchema)

export interface AnimeSearchResultItem {
  id: number
  titlePrimary: string
  titleSecondary: string | null
  titleNative: string | null
  coverImage: string | null
  isAdult: boolean
  format: string
  seasonYear: number | null
  seasonSeason: string
  queuedForFetch?: boolean
}

export type AnimeSearchResponse = AnimeSearchResultItem[]
