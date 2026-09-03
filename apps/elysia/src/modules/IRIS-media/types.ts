import { t } from "elysia"

export const GenreSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  slug: t.String(),
  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),
})

export const TagSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  slug: t.String(),
  category: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),
})

export const StudioSchema = t.Object({
  id: t.Number(),
  anilistId: t.Nullable(t.Number()),
  malId: t.Nullable(t.Number()),
  aniDBId: t.Nullable(t.Number()),
  tvDBId: t.Nullable(t.Number()),
  bangumiId: t.Nullable(t.Number()),
  name: t.String(),
  isAnimationStudio: t.Boolean(),
  siteUrl: t.Nullable(t.String()),
  favorites: t.Nullable(t.Number()),
  alFavorites: t.Nullable(t.Number()),
  sources: t.Nullable(t.Any()),
  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),
})

export const MediaStudioSchema = t.Object({
  id: t.Number(),
  mediaType: t.String(),
  mediaId: t.Number(),
  studioId: t.Number(),
  isMain: t.Boolean(),
  animeId: t.Nullable(t.Number()),
  movieId: t.Nullable(t.Number()),
  tvId: t.Nullable(t.Number()),
  gameId: t.Nullable(t.Number()),
  bookId: t.Nullable(t.Number()),
  studio: StudioSchema,
})

export const PersonSchema = t.Object({
  id: t.Number(),
  anilistId: t.Nullable(t.Number()),
  malId: t.Nullable(t.Number()),
  aniDBId: t.Nullable(t.Number()),
  tvDBId: t.Nullable(t.Number()),
  bangumiId: t.Nullable(t.Number()),
  imdbId: t.Nullable(t.String()),
  tmdbId: t.Nullable(t.Number()),
  namePrimary: t.String(),
  nameNative: t.Nullable(t.String()),
  nameAlternative: t.Array(t.String()),
  image: t.Nullable(t.String()),
  images: t.Nullable(t.Any()),
  description: t.Nullable(t.String()),
  language: t.Nullable(t.String()),
  favorites: t.Nullable(t.Number()),
  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),
})

export const MediaStaffSchema = t.Object({
  id: t.Number(),
  mediaType: t.String(),
  mediaId: t.Number(),
  personId: t.Number(),
  role: t.String(),
  customRole: t.Nullable(t.String()),
  animeId: t.Nullable(t.Number()),
  mangaId: t.Nullable(t.Number()),
  movieId: t.Nullable(t.Number()),
  tvId: t.Nullable(t.Number()),
  bookId: t.Nullable(t.Number()),
  person: PersonSchema,
})

export const CharacterSchema = t.Object({
  id: t.Number(),
  anilistId: t.Nullable(t.Number()),
  malId: t.Nullable(t.Number()),
  aniDBId: t.Nullable(t.Number()),
  tvDBId: t.Nullable(t.Number()),
  bangumiId: t.Nullable(t.Number()),
  namePrimary: t.String(),
  nameNative: t.Nullable(t.String()),
  nameAlternative: t.Array(t.String()),
  nameAlternativeSpoiler: t.Array(t.String()),
  image: t.Nullable(t.String()),
  images: t.Nullable(t.Any()),
  description: t.Nullable(t.String()),
  gender: t.Nullable(t.String()),
  age: t.Nullable(t.String()),
  dateOfBirthYear: t.Nullable(t.Number()),
  dateOfBirthMonth: t.Nullable(t.Number()),
  dateOfBirthDay: t.Nullable(t.Number()),
  favorites: t.Nullable(t.Number()),
  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),
})

export const MediaCharacterSchema = t.Object({
  id: t.Number(),
  mediaType: t.String(),
  mediaId: t.Number(),
  characterId: t.Number(),
  actorId: t.Nullable(t.Number()),
  role: t.String(),
  order: t.Nullable(t.Number()),
  animeId: t.Nullable(t.Number()),
  mangaId: t.Nullable(t.Number()),
  movieId: t.Nullable(t.Number()),
  tvId: t.Nullable(t.Number()),
  bookId: t.Nullable(t.Number()),
  character: CharacterSchema,
  actor: t.Nullable(PersonSchema),
})

export const MediaRelationSchema = t.Object({
  id: t.Number(),
  sourceType: t.String(),
  sourceId: t.Number(),
  targetType: t.String(),
  targetId: t.Number(),
  type: t.String(),
  target: t.Nullable(t.Any()),
})
