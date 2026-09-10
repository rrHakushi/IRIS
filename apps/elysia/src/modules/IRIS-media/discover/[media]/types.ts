import { t } from "elysia"

export const DiscoverItemSchema = t.Object({
  id: t.Number(),
  titlePrimary: t.String(),
  titleSecondary: t.Nullable(t.String()),
  titleNative: t.Nullable(t.String()),
  coverImage: t.Nullable(t.String()),
  bannerImage: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  format: t.Nullable(t.String()),
  averageScore: t.Nullable(t.Number()),
  popularity: t.Nullable(t.Number()),
  favorites: t.Nullable(t.Number()),
  genres: t.Array(t.String()),
  releaseYear: t.Nullable(t.Number()),
  seasonSeason: t.Nullable(t.String()),
  status: t.Nullable(t.String()),
  isAdult: t.Boolean(),
  artistName: t.Optional(t.Nullable(t.String())),
  duration: t.Optional(t.Nullable(t.Number())),
  itemType: t.Optional(t.Nullable(t.String())),
  audioPreviewUrl: t.Optional(t.Nullable(t.String())),
})

export const DiscoverSectionSchema = t.Object({
  id: t.String(),
  title: t.String(),
  description: t.Optional(t.Nullable(t.String())),
  items: t.Array(DiscoverItemSchema),
})

export const DiscoverGenreSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  count: t.Optional(t.Number()),
})

export const DiscoverResponseSchema = t.Object({
  media: t.String(),
  hero: t.Array(DiscoverItemSchema),
  sections: t.Array(DiscoverSectionSchema),
  genres: t.Array(DiscoverGenreSchema),
})

export interface DiscoverItem {
  id: number
  titlePrimary: string
  titleSecondary: string | null
  titleNative: string | null
  coverImage: string | null
  bannerImage: string | null
  description: string | null
  format: string | null
  averageScore: number | null
  popularity: number | null
  favorites: number | null
  genres: string[]
  releaseYear: number | null
  seasonSeason: string | null
  status: string | null
  isAdult: boolean
  artistName?: string | null
  duration?: number | null
  itemType?: string | null
  audioPreviewUrl?: string | null
}

export interface DiscoverSection {
  id: string
  title: string
  description?: string | null
  items: DiscoverItem[]
}

export interface DiscoverGenre {
  id: number
  name: string
  count?: number
}

export interface DiscoverResponse {
  media: string
  hero: DiscoverItem[]
  sections: DiscoverSection[]
  genres: DiscoverGenre[]
}
