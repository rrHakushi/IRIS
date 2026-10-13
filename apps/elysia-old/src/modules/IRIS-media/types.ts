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

export const MediaTrailerItemSchema = t.Object(
  {
    id: t.Optional(t.Nullable(t.Union([t.String(), t.Number()]))),
    site: t.Optional(t.Nullable(t.String())),
    url: t.Optional(t.Nullable(t.String())),
    name: t.Optional(t.Nullable(t.String())),
    runtime: t.Optional(t.Nullable(t.Number())),
    language: t.Optional(t.Nullable(t.String())),
    thumbnail: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: true }
)

export const MediaImagesSchema = t.Record(t.String(), t.Array(t.String()))

export const MediaExternalLinkSchema = t.Object({
  id: t.Optional(t.Nullable(t.Union([t.String(), t.Number()]))),
  url: t.String(),
  site: t.Optional(t.Nullable(t.String())),
  type: t.Optional(t.Nullable(t.String())),
  icon: t.Optional(t.Nullable(t.String())),
})

export const MediaSourceItemSchema = t.Object({
  id: t.Optional(t.Nullable(t.Union([t.String(), t.Number()]))),
  url: t.Optional(t.Nullable(t.String())),
  updatedAt: t.Optional(t.Nullable(t.Union([t.Number(), t.String()]))),
})

export const MediaSourcesSchema = t.Record(t.String(), MediaSourceItemSchema)

export const MediaThemeSongItemSchema = t.Union([
  t.String(),
  t.Object({
    id: t.Optional(t.Nullable(t.Number())),
    text: t.String(),
    anime_id: t.Optional(t.Nullable(t.Number())),
    musicId: t.Optional(t.Nullable(t.Number())),
    title: t.Optional(t.Nullable(t.String())),
    titleNative: t.Optional(t.Nullable(t.String())),
    artist: t.Optional(t.Nullable(t.String())),
    episodes: t.Optional(t.Nullable(t.String())),
    deezerId: t.Optional(t.Nullable(t.Number())),
    deezerUrl: t.Optional(t.Nullable(t.String())),
    previewUrl: t.Optional(t.Nullable(t.String())),
    isDirectMatch: t.Optional(t.Nullable(t.Boolean())),
  }),
])

export const MediaThemeSongsSchema = t.Object({
  op: t.Optional(t.Nullable(t.Array(MediaThemeSongItemSchema))),
  ed: t.Optional(t.Nullable(t.Array(MediaThemeSongItemSchema))),
})

export const MediaStatusDistributionSchema = t.Record(t.String(), t.Number())
export const MediaScoreDistributionSchema = t.Record(t.String(), t.Number())
