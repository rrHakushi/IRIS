export type DiscoverCategory =
  "anime" | "manga" | "movies" | "tv" | "games" | "books" | "music"

export interface DiscoverItem {
  id: number
  titlePrimary: string
  titleSecondary?: string | null
  titleNative?: string | null
  coverImage?: string | null
  bannerImage?: string | null
  description?: string | null
  format?: string | null
  averageScore?: number | null
  popularity?: number | null
  favorites?: number | null
  genres: string[]
  releaseYear?: number | null
  seasonSeason?: string | null
  status?: string | null
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

export interface DiscoverMediaMeta {
  key: DiscoverCategory
  label: string
  singularLabel: string
  description: string
  browseCategory: string
  href: string
}

export const DISCOVER_MEDIA_METAS: DiscoverMediaMeta[] = [
  {
    key: "anime",
    label: "Anime",
    singularLabel: "Anime",
    description:
      "Explore trending seasonal anime, critically acclaimed classics, and upcoming series.",
    browseCategory: "anime",
    href: "/IRIS-list/discover/anime",
  },
  {
    key: "manga",
    label: "Manga",
    singularLabel: "Manga",
    description:
      "Discover ongoing serializations, acclaimed graphic novels, and light novels.",
    browseCategory: "manga",
    href: "/IRIS-list/discover/manga",
  },
  {
    key: "movies",
    label: "Movies",
    singularLabel: "Movie",
    description:
      "Browse blockbusters, fresh releases, and cinematic hall-of-famers.",
    browseCategory: "movies",
    href: "/IRIS-list/discover/movies",
  },
  {
    key: "tv",
    label: "TV Shows",
    singularLabel: "TV Show",
    description:
      "Find binge-worthy television series, returning drama, and trending sitcoms.",
    browseCategory: "tv",
    href: "/IRIS-list/discover/tv",
  },
  {
    key: "games",
    label: "Games",
    singularLabel: "Game",
    description:
      "Uncover top video games across PC, consoles, and indie frontiers.",
    browseCategory: "games",
    href: "/IRIS-list/discover/games",
  },
  {
    key: "books",
    label: "Books",
    singularLabel: "Book",
    description:
      "Explore bestsellers, literary classics, and upcoming author publications.",
    browseCategory: "books",
    href: "/IRIS-list/discover/books",
  },
  {
    key: "music",
    label: "Music",
    singularLabel: "Music",
    description:
      "Listen to trending audio tracks, acclaimed studio albums, and chart hits.",
    browseCategory: "music",
    href: "/IRIS-list/discover/music",
  },
]
