import type React from "react"
import {
  IconDeviceTv,
  IconBook2,
  IconMovie,
  IconDeviceGamepad,
  IconBook,
  IconMusic,
  IconUserHeart,
  IconUserCheck,
  IconBuildingSkyscraper,
} from "@tabler/icons-react"

export type DiscoverCategory =
  | "anime"
  | "manga"
  | "movies"
  | "tv"
  | "games"
  | "books"
  | "music"
  | "characters"
  | "staff"
  | "studios"

export type DiscoverStatusKey =
  "ALL" | "RELEASING" | "FINISHED" | "UPCOMING" | "NOT_YET_RELEASED"

export type DiscoverSortByOption =
  "popularity" | "score" | "favorites" | "title" | "releaseDate" | "updatedAt"

export type DiscoverSortOrderOption = "asc" | "desc"

export interface DiscoverFilterFacets {
  statuses: Array<{ value: string; count: number }>
  formats: Array<{ value: string; count: number }>
  genres: Array<{ value: string; count: number }>
  years: Array<{ value: number; count: number }>
  seasons?: Array<{ value: string; count: number }>
  artists?: Array<{ value: string; count: number }>
}

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

export interface DiscoverMediaMeta {
  key: DiscoverCategory
  label: string
  singularLabel: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export const DISCOVER_MEDIA_METAS: DiscoverMediaMeta[] = [
  {
    key: "anime",
    label: "Anime",
    singularLabel: "Anime",
    description:
      "Explore trending seasonal anime, critically acclaimed classics, and upcoming series.",
    href: "/IRIS-list/discover/anime",
    icon: IconDeviceTv,
  },
  {
    key: "manga",
    label: "Manga",
    singularLabel: "Manga",
    description:
      "Discover ongoing serializations, acclaimed graphic novels, and light novels.",
    href: "/IRIS-list/discover/manga",
    icon: IconBook2,
  },
  {
    key: "movies",
    label: "Movies",
    singularLabel: "Movie",
    description:
      "Browse blockbusters, fresh releases, and cinematic hall-of-famers.",
    href: "/IRIS-list/discover/movies",
    icon: IconMovie,
  },
  {
    key: "tv",
    label: "TV Shows",
    singularLabel: "TV Show",
    description:
      "Find binge-worthy television series, returning drama, and trending sitcoms.",
    href: "/IRIS-list/discover/tv",
    icon: IconDeviceTv,
  },
  {
    key: "games",
    label: "Games",
    singularLabel: "Game",
    description:
      "Uncover top video games across PC, consoles, and indie frontiers.",
    href: "/IRIS-list/discover/games",
    icon: IconDeviceGamepad,
  },
  {
    key: "books",
    label: "Books",
    singularLabel: "Book",
    description:
      "Explore bestsellers, literary classics, and upcoming author publications.",
    href: "/IRIS-list/discover/books",
    icon: IconBook,
  },
  {
    key: "music",
    label: "Music",
    singularLabel: "Music",
    description:
      "Listen to trending audio tracks, acclaimed studio albums, and chart hits.",
    href: "/IRIS-list/discover/music",
    icon: IconMusic,
  },
  {
    key: "characters",
    label: "Characters",
    singularLabel: "Character",
    description:
      "Discover popular and beloved fictional characters across anime, manga, and media.",
    href: "/IRIS-list/discover/characters",
    icon: IconUserHeart,
  },
  {
    key: "staff",
    label: "Staff",
    singularLabel: "Person",
    description:
      "Explore voice actors, directors, authors, composers, and creative staff.",
    href: "/IRIS-list/discover/staff",
    icon: IconUserCheck,
  },
  {
    key: "studios",
    label: "Studios",
    singularLabel: "Studio",
    description:
      "Discover leading animation studios, production houses, and game developers.",
    href: "/IRIS-list/discover/studios",
    icon: IconBuildingSkyscraper,
  },
]
