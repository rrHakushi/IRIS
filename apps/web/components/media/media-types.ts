export type MediaTabKey =
  | "overview"
  | "characters"
  | "staff"
  | "episodes"
  | "tracks"
  | "lyrics"
  | "images"
  | "trailers"
  | "stats"
  | "reviews"
  | "recommendations"

export interface MusicTrackItem {
  id: number
  trackNumber: number | null
  discNumber: number | null
  titlePrimary: string
  duration: number | null
  artistName: string | null
  artistPersonId?: number | null
  audioPreviewUrl: string | null
}

export interface MediaTabItem {
  key: MediaTabKey
  label: string
  count?: number
}

export interface CharacterItem {
  id: number
  characterId: number
  namePrimary: string
  nameNative: string | null
  image: string | null
  role: string
  order: number | null
  actor: {
    id: number
    namePrimary: string
    nameNative: string | null
    image: string | null
    language: string | null
  } | null
}

export interface StaffMemberItem {
  id: number
  personId: number
  role: string
  customRole: string | null
  person: {
    id: number
    namePrimary: string
    nameNative: string | null
    image: string | null
    language: string | null
  }
}

export interface SeasonItem {
  id: number
  seasonNumber: number
  titlePrimary?: string | null
  titleSecondary?: string | null
  description?: string | null
  posterImage?: string | null
  episodeCount?: number | null
}

export interface EpisodeItem {
  id: number
  number: number
  seasonNumber?: number | null
  titlePrimary: string
  titleSecondary: string | null
  titleNative: string | null
  description: string | null
  duration: number | null
  airDate: string | Date | null
  thumbnail: string | null
  isFiller: boolean
  isRecap: boolean
}

export interface AiringScheduleItem {
  id: number
  episodeNumber: number
  seasonNumber?: number | null
  airingAt: string | Date
}

export interface RelationItem {
  id: number
  sourceType: string
  sourceId: number
  targetType: string
  targetId: number
  type: string
  target?: {
    id: number
    titlePrimary: string
    titleSecondary?: string | null
    coverImage?: string | null
    format?: string | null
    seasonYear?: number | null
  } | null
}

export interface SimilarMediaCardItem {
  id: number
  type?: string | null
  format: string | null
  coverImage: string | null
  titlePrimary: string
  titleSecondary: string | null
  titleNative?: string | null
  year: number | null
  score: number | null
}

export interface TrailerItem {
  id?: string | number | null
  site?: string | null
  url?: string | null
  name?: string | null
  runtime?: number | null
  language?: string | null
  thumbnail?: string | null
}

export interface SourceLinkItem {
  id?: string | number | null
  url?: string | null
  updatedAt?: number | string | null
}

export interface ThemeSongItem {
  id?: number | null
  text: string
}

export interface ThemeSongsData {
  op?: Array<ThemeSongItem | string> | null
  ed?: Array<ThemeSongItem | string> | null
}

export interface NormalizedMediaData {
  id: number
  category: "anime" | "movies" | "tv" | "manga" | "books" | "games" | "music"
  titlePrimary: string
  titleSecondary: string | null
  titleNative: string | null
  coverImage: string | null
  bannerImage: string | null
  description: string | null
  format: string | null
  status: string | null
  seasonSeason?: string | null
  seasonYear?: number | null
  startDateYear?: number | null
  startDateMonth?: number | null
  startDateDay?: number | null
  endDateYear?: number | null
  endDateMonth?: number | null
  endDateDay?: number | null
  releaseDateYear?: number | null
  source?: string | null
  hashtag?: string | null
  synonyms?: string[]
  siteUrl?: string | null
  externalLinks?: Array<{
    id?: string | number | null
    url: string
    site?: string | null
    type?: string | null
    icon?: string | null
  }> | null
  ageRating?: string | null
  ageRatingGuide?: string | null
  anilistId?: number | null
  malId?: number | null
  aniDBId?: number | null
  tvDBId?: number | null
  bangumiId?: number | null
  kitsuId?: number | null
  countryOfOrigin?: string | null
  isAdult: boolean
  episodeCount?: number | null
  episodeDuration?: number | null
  runtime?: number | null
  averageScore?: number | null
  favorites?: number | null
  popularity?: number | null
  scoredCount?: number | null
  genres: Array<{ id: number; name: string; slug: string }>
  tags: Array<{
    id: number
    name: string
    slug: string
    description: string | null
  }>
  studios: Array<{
    id: number
    isMain?: boolean
    studio: { id: number; name: string; isAnimationStudio?: boolean }
  }>
  characters: CharacterItem[]
  staff: StaffMemberItem[]
  seasons?: SeasonItem[]
  seasonCount?: number | null
  episodes?: EpisodeItem[]
  airingSchedule?: AiringScheduleItem[]
  nextAiringEpisodeNumber?: number | null
  nextAiringAt?: string | Date | null
  relations: RelationItem[]
  themeSongs?: ThemeSongsData | null
  trailers?: TrailerItem[] | null
  images?: Record<string, string[]> | null
  tmdbId?: number | null
  imdbId?: string | null
  simklId?: number | null
  originalLanguage?: string | null
  budget?: number | bigint | string | null
  revenue?: number | bigint | string | null
  imdbRating?: number | null
  imdbVotes?: number | null
  sources?: Record<string, SourceLinkItem> | null
  statusDistribution?: Record<string, number> | null
  scoreDistribution?: Record<string, number> | null
  alAverageScore?: number | null
  malAverageScore?: number | null

  tagline?: string | null
  awards?: string | null

  // TV specific fields
  showType?: string | null
  broadcastTime?: string | null
  broadcastDays?: string[] | null
  networks?: string[] | null
  firstAiredYear?: number | null
  firstAiredMonth?: number | null
  firstAiredDay?: number | null
  lastAiredYear?: number | null
  lastAiredMonth?: number | null
  lastAiredDay?: number | null
  rottenTomatoesScore?: number | null
  tvmazeRating?: number | null
  tvmazeId?: number | null

  // Game specific fields
  rawgId?: number | null
  igdbId?: number | null
  steamAppId?: number | null
  giantbombId?: string | null
  vndbId?: string | null
  platforms?: string[] | null
  developers?: string[] | null
  publishers?: string[] | null
  franchise?: string | null
  gameModes?: string[] | null
  playerPerspectives?: string[] | null
  igdbRating?: number | null
  igdbRatingCount?: number | null
  averagePlaytime?: number | null
  controllerSupport?: string | null
  steamDeckStatus?: string | null
  linuxSupport?: boolean | null
  languages?: string[] | null
  requirements?: any | null
  esrbRating?: string | null
  pegiRating?: string | null

  // Book specific fields
  googleBookId?: string | null
  isbn10?: string | null
  isbn13?: string | null
  openLibraryId?: string | null
  pageCount?: number | null
  chapterCount?: number | null
  volumeCount?: number | null
  authors?: string[] | null
  subjects?: string[] | null
  series?: string | null
  seriesPosition?: number | null
  googleBooksRating?: number | null
  googleBooksRatingsCount?: number | null
  retailPrice?: number | null
  retailPriceCurrency?: string | null
  previewLink?: string | null
  infoLink?: string | null
  buyLink?: string | null

  // Music specific fields
  artist?: string | null
  artists?: string[] | null
  artistPersonId?: number | null
  album?: string | null
  albumId?: number | null
  albumType?: string | null
  totalTracks?: number | null
  trackNumber?: number | null
  discNumber?: number | null
  duration?: number | null
  audioPreviewUrl?: string | null
  lyrics?: string | null
  syncedLyrics?: string | null
  tracks?: MusicTrackItem[] | null
  spotifyId?: string | null
  appleMusicId?: string | null
  youtubeMusicId?: string | null
  musicBrainzId?: string | null
  isrc?: string | null
  listeners?: number | null
  playCount?: number | null
  lastFmListeners?: number | null
  lastFmPlayCount?: number | null
  lastFmUrl?: string | null

  updatedAt: string | Date
}
