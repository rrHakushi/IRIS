import type { Models } from '@Iris/db'

export interface MediaRelationItem {
  id: number
  sourceType: string
  sourceId: number
  targetType: string
  targetId: number
  type: string
  target: any | null
}

export interface SimilarMediaTitles {
  primary: string
  secondary: string | null
  native: string | null
}

export interface SimilarMediaItem {
  id: number
  type: string
  format: string
  coverImage: string | null
  titles: SimilarMediaTitles
}

// 1. Anime
export const animeInclude = {
  characters: {
    include: {
      character: true,
      actor: true,
    },
  },
  airingSchedule: { orderBy: { episodeNumber: 'asc' } },
  episodes: { orderBy: { number: 'asc' } },
  genres: true,
  tags: true,
  staff: {
    include: {
      person: true,
    },
  },
  studios: {
    include: {
      studio: true,
    },
  },
} as const

export type AnimeDetails = Models.public_Anime & {
  relations: MediaRelationItem[]
}

// 2. Movie
export const movieInclude = {
  characters: {
    include: {
      character: true,
      actor: true,
    },
  },
  genres: true,
  tags: true,
  staff: {
    include: {
      person: true,
    },
  },
  studios: {
    include: {
      studio: true,
    },
  },
} as const

export type MovieDetails = Omit<Models.public_Movie, 'budget' | 'revenue'> & {
  budget: number | bigint | null
  revenue: number | bigint | null
  relations: MediaRelationItem[]
}

// 3. TV
export const tvInclude = {
  characters: {
    include: {
      character: true,
      actor: true,
    },
  },
  genres: true,
  tags: true,
  staff: {
    include: {
      person: true,
    },
  },
  studios: {
    include: {
      studio: true,
    },
  },
  seasons: {
    orderBy: {
      seasonNumber: 'asc',
    },
  },
  episodes: {
    orderBy: [{ seasonNumber: 'asc' }, { episodeNumber: 'asc' }],
  },
} as const

export type TvDetails = Models.public_Tv & {
  relations: MediaRelationItem[]
}

// 4. Manga
export const mangaInclude = {
  characters: {
    include: {
      character: true,
      actor: true,
    },
  },
  genres: true,
  tags: true,
  staff: {
    include: {
      person: true,
    },
  },
} as const

export type MangaDetails = Models.public_Manga & {
  relations: MediaRelationItem[]
}

// 5. Game
export const gameInclude = {
  genres: true,
  tags: true,
  studios: {
    include: {
      studio: true,
    },
  },
} as const

export type GameDetails = Models.public_Game & {
  relations: MediaRelationItem[]
}

// 6. Book
export const bookInclude = {
  characters: {
    include: {
      character: true,
      actor: true,
    },
  },
  genres: true,
  tags: true,
  staff: {
    include: {
      person: true,
    },
  },
  studios: {
    include: {
      studio: true,
    },
  },
} as const

export type BookDetails = Models.public_Book & {
  relations: MediaRelationItem[]
}


// 7. Character
export interface MediaAppearanceItem {
  id: number
  mediaType: string
  mediaId: number
  role: string
  order: number | null
  actor: {
    id: number
    namePrimary: string
    nameNative?: string | null
    image: string | null
    language?: string | null
  } | null
  anime: {
    id: number
    titlePrimary: string
    titleSecondary: string | null
    titleNative: string | null
    coverImage: string | null
    bannerImage: string | null
    format: string | null
    startDateYear: number | null
    averageScore: number | null
  } | null
  manga: {
    id: number
    titlePrimary: string
    titleSecondary: string | null
    titleNative: string | null
    coverImage: string | null
    bannerImage: string | null
    format: string | null
    startDateYear: number | null
    averageScore: number | null
  } | null
  movie: {
    id: number
    titlePrimary: string
    titleSecondary: string | null
    titleNative: string | null
    coverImage: string | null
    bannerImage: string | null
    releaseDateYear: number | null
    averageScore: number | null
  } | null
  tv: {
    id: number
    titlePrimary: string
    titleSecondary: string | null
    titleNative: string | null
    coverImage: string | null
    bannerImage: string | null
    showType: string | null
    firstAiredYear: number | null
    averageScore: number | null
  } | null
  book: {
    id: number
    titlePrimary: string
    titleSecondary: string | null
    coverImage: string | null
    bannerImage: string | null
    format: string | null
    releaseDateYear: number | null
    averageScore: number | null
  } | null
}

export interface CharacterDetails {
  id: number
  anilistId: number | null
  malId: number | null
  aniDBId: number | null
  tvDBId: number | null
  bangumiId: number | null
  namePrimary: string
  nameNative: string | null
  nameAlternative: string[]
  nameAlternativeSpoiler: string[]
  image: string | null
  images: any | null
  description: string | null
  gender: string | null
  age: string | null
  dateOfBirthYear: number | null
  dateOfBirthMonth: number | null
  dateOfBirthDay: number | null
  favorites: number | null
  createdAt: Date | string
  updatedAt: Date | string
  mediaCharacters: MediaAppearanceItem[]
}

// 8. Person
export interface VoicedCharacterItem {
  id: number
  mediaType: string
  mediaId: number
  role: string
  order: number | null
  character: {
    id: number
    namePrimary: string
    nameNative: string | null
    image: string | null
  } | null
  anime: {
    id: number
    titlePrimary: string
    titleSecondary: string | null
    titleNative: string | null
    coverImage: string | null
    bannerImage: string | null
    format: string | null
    startDateYear: number | null
    averageScore: number | null
  } | null
  movie: {
    id: number
    titlePrimary: string
    titleSecondary: string | null
    titleNative: string | null
    coverImage: string | null
    bannerImage: string | null
    releaseDateYear: number | null
    averageScore: number | null
  } | null
  tv: {
    id: number
    titlePrimary: string
    titleSecondary: string | null
    titleNative: string | null
    coverImage: string | null
    bannerImage: string | null
    showType: string | null
    firstAiredYear: number | null
    averageScore: number | null
  } | null
  book?: {
    id: number
    titlePrimary: string
    titleSecondary: string | null
    coverImage: string | null
    format?: string | null
    releaseDateYear: number | null
    averageScore: number | null
  } | null
}

export interface StaffRoleItem {
  id: number
  role: string
  customRole: string | null
  year: number | null
  anime: any | null
  manga: any | null
  movie: any | null
  tv: any | null
  book: any | null
}

export interface MediaStaffItem {
  id: number
  mediaType: string
  mediaId: number
  personId: number
  role: string
  customRole: string | null
  anime?: any | null
  manga?: any | null
  movie?: any | null
  tv?: any | null
  book?: any | null
  music?: any | null
}

export interface PersonDetails {
  id: number
  anilistId: number | null
  malId: number | null
  tmdbId: number | null
  aniDBId?: number | null
  tvDBId?: number | null
  bangumiId?: number | null
  imdbId?: string | null
  musicBrainzId: string | null
  namePrimary: string
  nameNative: string | null
  nameAlternative: string[]
  image: string | null
  images: any | null
  description: string | null
  gender: string | null
  language?: string | null
  age: number | null
  dateOfBirthYear: number | null
  dateOfBirthMonth: number | null
  dateOfBirthDay: number | null
  dateOfDeathYear: number | null
  dateOfDeathMonth: number | null
  dateOfDeathDay: number | null
  hometown: string | null
  primaryOccupations: string[]
  favorites: number | null
  createdAt: Date | string
  updatedAt: Date | string
  voicedCharacters: VoicedCharacterItem[]
  staffRoles: StaffRoleItem[]
  mediaStaff: MediaStaffItem[]
}

// 9. Studio
export interface StudioCreationItem {
  id: number
  mediaType: string
  mediaId: number
  isMain: boolean
  titlePrimary: string
  titleSecondary: string | null
  titleNative: string | null
  coverImage: string | null
  bannerImage: string | null
  format: string | null
  releaseYear: number | null
  averageScore: number | null
  popularity: number | null
  favorites: number | null
  genres: string[]
  status: string | null
}

export interface StudioDetails {
  id: number
  name: string
  isAnimationStudio: boolean
  siteUrl: string | null
  favorites: number | null
  alFavorites: number | null
  sources: any | null
  creationsCount: number
  creations: StudioCreationItem[]
  pagination: {
    nextCursor: number | null
    hasMore: boolean
    total: number
  }
}

export interface StudioCreationsResponse {
  creations: StudioCreationItem[]
  pagination: {
    nextCursor: number | null
    hasMore: boolean
    total: number
  }
}

// 10. Music
export interface MusicTrackSummary {
  id: number
  trackNumber: number | null
  discNumber: number | null
  titlePrimary: string
  duration: number | null
  artistName: string | null
  audioPreviewUrl: string | null
}

export interface MusicStaffMember {
  id: number
  role: string
  person: {
    id: number
    namePrimary: string
    nameNative?: string | null
    image: string | null
  }
}

export interface MusicDetails {
  id: number
  type?: 'ALBUM' | 'TRACK'
  deezerId?: string | null
  spotifyId: string | null
  appleMusicId: string | null
  youtubeMusicId?: string | null
  musicBrainzId: string | null
  isrc?: string | null
  titlePrimary: string
  titleSecondary: string | null
  titleNative?: string | null
  artist: string | null
  artists: string[]
  artistId?: number | null
  album?: string | null
  albumId?: number | null
  albumType?: string | null
  totalTracks?: number | null
  trackNumber?: number | null
  discNumber?: number | null
  coverImage: string | null
  bannerImage: string | null
  coverImages?: Record<string, string | null> | null
  images?: Record<string, string | null> | null
  description: string | null
  duration: number | null
  releaseDateYear: number | null
  releaseDateMonth: number | null
  releaseDateDay: number | null
  releaseDate: Date | string | null
  bpm?: number | null
  gain?: number | null
  explicitLyrics?: boolean | null
  explicitContentCover?: number | null
  explicitContentLyrics?: number | null
  genres: Array<{ id: number; name: string; slug: string }>
  tags: Array<{
    id: number
    name: string
    slug: string
    description: string | null
  }>
  audioPreviewUrl?: string | null
  lyrics?: string | null
  syncedLyrics?: string | null
  sources?: Record<string, string | number | boolean | null> | null
  status: string
  favorites: number
  popularity: number
  listeners?: number | null
  playCount?: number | null
  lastFmListeners?: number | null
  lastFmPlayCount?: number | null
  lastFmUrl?: string | null
  deezerUpdatedAt?: number | null
  musicBrainzUpdatedAt: number | null
  createdAt: Date | string
  updatedAt: Date | string
  relations: MediaRelationItem[]
  staff?: MusicStaffMember[]
  tracks?: MusicTrackSummary[]
}
