import { t } from "elysia"

export const MovieSearchResultSchema = t.Object({
  id: t.Number(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  bannerImage: t.Nullable(t.String()),
  releaseDateYear: t.Nullable(t.Number()),
  queuedForFetch: t.Optional(t.Boolean()),
})

export const MovieSearchResponseSchema = t.Array(MovieSearchResultSchema)

export interface MovieSearchResultItem {
  id: number
  titlePrimary: string
  titleSecondary: string | null
  titleNative: string | null
  coverImage: string | null
  bannerImage: string | null
  releaseDateYear: number | null
  queuedForFetch?: boolean
}

export type MovieSearchResponse = MovieSearchResultItem[]
