export type MediaType =
  | "ANIME"
  | "MANGA"
  | "MOVIE"
  | "TV"
  | "MUSIC"
  | "GAME"
  | "BOOK";

export type MediaFormat =
  | "TV"
  | "TV_SHORT"
  | "MOVIE"
  | "SPECIAL"
  | "OVA"
  | "ONA"
  | "MUSIC"
  | "MANGA"
  | "NOVEL"
  | "ONE_SHOT";

export type MediaStatus =
  | "FINISHED"
  | "RELEASING"
  | "NOT_YET_RELEASED"
  | "CANCELLED"
  | "HIATUS";

export interface MediaSearchResult {
  id?: string;
  externalId: string;
  provider: string;
  mediaType: MediaType;
  title: {
    userPreferred: string;
    romaji?: string;
    english?: string;
    native?: string;
  };
  description?: string;
  coverImage?: {
    extraLarge?: string;
    large?: string;
    medium?: string;
    color?: string;
  };
  bannerImage?: string;
  format?: MediaFormat | string;
  status?: MediaStatus | string;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  durationMinutes?: number | null;
  averageScore?: number | null;
  popularity?: number | null;
  releaseYear?: number | null;
  season?: string | null;
  genres?: string[];
  url?: string;
}

export interface LibraryItem {
  id: string;
  externalId: string;
  provider: string;
  mediaType: MediaType;
  title: string;
  status: "CURRENT" | "PLANNING" | "COMPLETED" | "DROPPED" | "PAUSED" | "REPEATING";
  score?: number | null;
  progress?: number;
  progressVolumes?: number;
  totalEpisodes?: number | null;
  totalChapters?: number | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  notes?: string | null;
}

export interface ScrobblePayload {
  mediaType: MediaType;
  externalId?: string;
  title: string;
  artist?: string;
  album?: string;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  progressSeconds?: number;
  totalDurationSeconds?: number;
  action: "START" | "PAUSE" | "STOP" | "SCROBBLE";
  rating?: number;
  timestamp?: Date;
  extra?: Record<string, any>;
}

export interface UpdateMediaPayload {
  mediaId: string | number;
  mediaType?: MediaType;
  status?: string;
  progress?: number;
  score?: number | null;
  notes?: string | null;
  rewatched?: number;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  extra?: Record<string, unknown>;
}
