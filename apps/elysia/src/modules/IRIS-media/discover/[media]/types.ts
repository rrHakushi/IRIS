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

export const DiscoverQuerySchema = t.Object({
  q: t.Optional(
    t.String({
      description: "Search query string to filter by title or synonyms",
    })
  ),
  cursor: t.Optional(
    t.Union([t.String(), t.Number()], {
      description: "Entry ID cursor for pagination",
    })
  ),
  limit: t.Optional(t.Number({ default: 30, minimum: 1, maximum: 100 })),
  status: t.Optional(
    t.String({
      description:
        "Comma-separated release status filter e.g. RELEASING,FINISHED",
    })
  ),
  mediaFormat: t.Optional(
    t.String({
      description: "Comma-separated format filter e.g. TV,MOVIE,MANGA,ALBUM",
    })
  ),
  genres: t.Optional(
    t.String({
      description: "Comma-separated genre names",
    })
  ),
  year: t.Optional(
    t.String({
      description: "Comma-separated release years e.g. 2024,2023",
    })
  ),
  seasonSeason: t.Optional(
    t.String({
      description: "Comma-separated seasons e.g. WINTER,SPRING,SUMMER,FALL",
    })
  ),
  artist: t.Optional(
    t.String({
      description: "Comma-separated artist names (for music)",
    })
  ),
  sortBy: t.Optional(
    t.Union(
      [
        t.Literal("popularity"),
        t.Literal("score"),
        t.Literal("favorites"),
        t.Literal("title"),
        t.Literal("releaseDate"),
        t.Literal("updatedAt"),
      ],
      { default: "popularity" }
    )
  ),
  order: t.Optional(
    t.Union([t.Literal("asc"), t.Literal("desc")], { default: "desc" })
  ),
})

export const DiscoverPaginatedResponseSchema = t.Object({
  success: t.Boolean(),
  media: t.String(),
  items: t.Array(DiscoverItemSchema),
  pagination: t.Object({
    nextCursor: t.Nullable(t.Union([t.String(), t.Number()])),
    hasMore: t.Boolean(),
    total: t.Number(),
  }),
})

export const DiscoverFiltersResponseSchema = t.Object({
  success: t.Boolean(),
  media: t.String(),
  statuses: t.Array(t.Object({ value: t.String(), count: t.Number() })),
  formats: t.Array(t.Object({ value: t.String(), count: t.Number() })),
  genres: t.Array(t.Object({ value: t.String(), count: t.Number() })),
  years: t.Array(t.Object({ value: t.Number(), count: t.Number() })),
  seasons: t.Optional(
    t.Array(t.Object({ value: t.String(), count: t.Number() }))
  ),
  artists: t.Optional(
    t.Array(t.Object({ value: t.String(), count: t.Number() }))
  ),
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

export interface DiscoverPaginatedResponse {
  success: boolean
  media: string
  items: DiscoverItem[]
  pagination: {
    nextCursor: string | number | null
    hasMore: boolean
    total: number
  }
}

export interface DiscoverFiltersResponse {
  success: boolean
  media: string
  statuses: Array<{ value: string; count: number }>
  formats: Array<{ value: string; count: number }>
  genres: Array<{ value: string; count: number }>
  years: Array<{ value: number; count: number }>
  seasons?: Array<{ value: string; count: number }>
  artists?: Array<{ value: string; count: number }>
}
