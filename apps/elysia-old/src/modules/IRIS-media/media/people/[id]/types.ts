import { t } from "elysia"
import { CharacterSchema } from "@/modules/IRIS-media/types"

export const PersonVoicedCharacterItemSchema = t.Object({
  id: t.Number(),
  mediaType: t.String(),
  mediaId: t.Number(),
  role: t.String(),
  order: t.Nullable(t.Number()),
  character: CharacterSchema,
  anime: t.Nullable(
    t.Object({
      id: t.Number(),
      titlePrimary: t.String(),
      titleSecondary: t.Nullable(t.String()),
      titleNative: t.Nullable(t.String()),
      coverImage: t.Nullable(t.String()),
      bannerImage: t.Nullable(t.String()),
      format: t.Nullable(t.String()),
      startDateYear: t.Nullable(t.Number()),
      averageScore: t.Nullable(t.Number()),
    })
  ),
  movie: t.Nullable(
    t.Object({
      id: t.Number(),
      titlePrimary: t.String(),
      titleSecondary: t.Nullable(t.String()),
      titleNative: t.Nullable(t.String()),
      coverImage: t.Nullable(t.String()),
      bannerImage: t.Nullable(t.String()),
      releaseDateYear: t.Nullable(t.Number()),
      averageScore: t.Nullable(t.Number()),
    })
  ),
  tv: t.Nullable(
    t.Object({
      id: t.Number(),
      titlePrimary: t.String(),
      titleSecondary: t.Nullable(t.String()),
      titleNative: t.Nullable(t.String()),
      coverImage: t.Nullable(t.String()),
      bannerImage: t.Nullable(t.String()),
      showType: t.Nullable(t.String()),
      firstAiredYear: t.Nullable(t.Number()),
      averageScore: t.Nullable(t.Number()),
    })
  ),
  book: t.Nullable(
    t.Object({
      id: t.Number(),
      titlePrimary: t.String(),
      titleSecondary: t.Nullable(t.String()),
      coverImage: t.Nullable(t.String()),
      bannerImage: t.Nullable(t.String()),
      format: t.Nullable(t.String()),
      releaseDateYear: t.Nullable(t.Number()),
      averageScore: t.Nullable(t.Number()),
    })
  ),
})

export const PersonMediaStaffItemSchema = t.Object({
  id: t.Number(),
  mediaType: t.String(),
  mediaId: t.Number(),
  role: t.String(),
  customRole: t.Nullable(t.String()),
  anime: t.Nullable(
    t.Object({
      id: t.Number(),
      titlePrimary: t.String(),
      titleSecondary: t.Nullable(t.String()),
      titleNative: t.Nullable(t.String()),
      coverImage: t.Nullable(t.String()),
      bannerImage: t.Nullable(t.String()),
      format: t.Nullable(t.String()),
      startDateYear: t.Nullable(t.Number()),
      averageScore: t.Nullable(t.Number()),
    })
  ),
  manga: t.Nullable(
    t.Object({
      id: t.Number(),
      titlePrimary: t.String(),
      titleSecondary: t.Nullable(t.String()),
      titleNative: t.Nullable(t.String()),
      coverImage: t.Nullable(t.String()),
      bannerImage: t.Nullable(t.String()),
      format: t.Nullable(t.String()),
      startDateYear: t.Nullable(t.Number()),
      averageScore: t.Nullable(t.Number()),
    })
  ),
  movie: t.Nullable(
    t.Object({
      id: t.Number(),
      titlePrimary: t.String(),
      titleSecondary: t.Nullable(t.String()),
      titleNative: t.Nullable(t.String()),
      coverImage: t.Nullable(t.String()),
      bannerImage: t.Nullable(t.String()),
      releaseDateYear: t.Nullable(t.Number()),
      averageScore: t.Nullable(t.Number()),
    })
  ),
  tv: t.Nullable(
    t.Object({
      id: t.Number(),
      titlePrimary: t.String(),
      titleSecondary: t.Nullable(t.String()),
      titleNative: t.Nullable(t.String()),
      coverImage: t.Nullable(t.String()),
      bannerImage: t.Nullable(t.String()),
      showType: t.Nullable(t.String()),
      firstAiredYear: t.Nullable(t.Number()),
      averageScore: t.Nullable(t.Number()),
    })
  ),
  book: t.Nullable(
    t.Object({
      id: t.Number(),
      titlePrimary: t.String(),
      titleSecondary: t.Nullable(t.String()),
      coverImage: t.Nullable(t.String()),
      bannerImage: t.Nullable(t.String()),
      format: t.Nullable(t.String()),
      releaseDateYear: t.Nullable(t.Number()),
      averageScore: t.Nullable(t.Number()),
    })
  ),
  music: t.Optional(
    t.Nullable(
      t.Object({
        id: t.Number(),
        titlePrimary: t.String(),
        titleSecondary: t.Nullable(t.String()),
        titleNative: t.Nullable(t.String()),
        coverImage: t.Nullable(t.String()),
        type: t.String(),
        releaseDateYear: t.Nullable(t.Number()),
        popularity: t.Nullable(t.Number()),
        listeners: t.Nullable(t.Number()),
        playCount: t.Nullable(t.Number()),
      })
    )
  ),
  album: t.Optional(
    t.Nullable(
      t.Object({
        id: t.Number(),
        titlePrimary: t.String(),
        titleSecondary: t.Nullable(t.String()),
        titleNative: t.Nullable(t.String()),
        coverImage: t.Nullable(t.String()),
        bannerImage: t.Nullable(t.String()),
        albumType: t.Nullable(t.String()),
        releaseDateYear: t.Nullable(t.Number()),
        popularity: t.Nullable(t.Number()),
        listeners: t.Nullable(t.Number()),
        playCount: t.Nullable(t.Number()),
        lastFmListenersStat: t.Nullable(t.Number()),
        lastFmPlayCountStat: t.Nullable(t.Number()),
      })
    )
  ),
  track: t.Optional(
    t.Nullable(
      t.Object({
        id: t.Number(),
        titlePrimary: t.String(),
        titleSecondary: t.Nullable(t.String()),
        titleNative: t.Nullable(t.String()),
        coverImage: t.Nullable(t.String()),
        albumId: t.Nullable(t.Number()),
        trackNumber: t.Nullable(t.Number()),
        duration: t.Nullable(t.Number()),
        popularity: t.Nullable(t.Number()),
        listeners: t.Nullable(t.Number()),
        playCount: t.Nullable(t.Number()),
        lastFmListenersStat: t.Nullable(t.Number()),
        lastFmPlayCountStat: t.Nullable(t.Number()),
        album: t.Optional(
          t.Nullable(
            t.Object({
              id: t.Number(),
              titlePrimary: t.String(),
              coverImage: t.Nullable(t.String()),
            })
          )
        ),
      })
    )
  ),
})

export const PersonResponseSchema = t.Object({
  id: t.Number(),
  anilistId: t.Nullable(t.Number()),
  malId: t.Nullable(t.Number()),
  aniDBId: t.Nullable(t.Number()),
  tvDBId: t.Nullable(t.Number()),
  bangumiId: t.Nullable(t.Number()),
  imdbId: t.Nullable(t.String()),
  tmdbId: t.Nullable(t.Number()),

  deezerId: t.Optional(t.Nullable(t.String())),
  spotifyId: t.Optional(t.Nullable(t.String())),
  lastFmUrl: t.Optional(t.Nullable(t.String())),
  musicBrainzId: t.Optional(t.Nullable(t.String())),
  lastFmListenersStat: t.Optional(t.Nullable(t.Number())),
  lastFmPlayCountStat: t.Optional(t.Nullable(t.Number())),

  namePrimary: t.String(),
  nameNative: t.Nullable(t.String()),
  nameAlternative: t.Array(t.String()),
  givenName: t.Optional(t.Nullable(t.String())),
  familyName: t.Optional(t.Nullable(t.String())),

  image: t.Nullable(t.String()),
  images: t.Optional(t.Nullable(t.Record(t.String(), t.String()))),
  description: t.Nullable(t.String()),
  gender: t.Optional(t.Nullable(t.String())),
  bloodType: t.Optional(t.Nullable(t.String())),
  homeTown: t.Optional(t.Nullable(t.String())),
  birthPlace: t.Optional(t.Nullable(t.String())),
  language: t.Nullable(t.String()),
  primaryOccupations: t.Optional(t.Array(t.String())),

  dateOfBirth: t.Optional(t.Nullable(t.Union([t.Date(), t.String()]))),
  dateOfBirthYear: t.Optional(t.Nullable(t.Number())),
  dateOfBirthMonth: t.Optional(t.Nullable(t.Number())),
  dateOfBirthDay: t.Optional(t.Nullable(t.Number())),
  dateOfDeath: t.Optional(t.Nullable(t.Union([t.Date(), t.String()]))),
  dateOfDeathYear: t.Optional(t.Nullable(t.Number())),
  dateOfDeathMonth: t.Optional(t.Nullable(t.Number())),
  dateOfDeathDay: t.Optional(t.Nullable(t.Number())),
  age: t.Optional(t.Nullable(t.Number())),
  yearsActive: t.Optional(t.Array(t.Number())),

  nbAlbum: t.Optional(t.Nullable(t.Number())),
  nbFan: t.Optional(t.Nullable(t.Number())),
  deezerLink: t.Optional(t.Nullable(t.String())),
  deezerShare: t.Optional(t.Nullable(t.String())),
  hasRadio: t.Optional(t.Nullable(t.Boolean())),

  favorites: t.Nullable(t.Number()),

  createdAt: t.Union([t.Date(), t.String()]),
  updatedAt: t.Union([t.Date(), t.String()]),

  voicedCharacters: t.Array(PersonVoicedCharacterItemSchema),
  mediaStaff: t.Array(PersonMediaStaffItemSchema),
  musicTracks: t.Optional(
    t.Array(
      t.Object({
        id: t.Number(),
        titlePrimary: t.String(),
        titleSecondary: t.Nullable(t.String()),
        type: t.String(),
        coverImage: t.Nullable(t.String()),
        duration: t.Nullable(t.Number()),
        popularity: t.Nullable(t.Number()),
        releaseDateYear: t.Optional(t.Nullable(t.Number())),
        recordType: t.Optional(t.Nullable(t.String())),
        albumId: t.Optional(t.Nullable(t.Number())),
        trackPosition: t.Optional(t.Nullable(t.Number())),
        listeners: t.Optional(t.Nullable(t.Number())),
        playCount: t.Optional(t.Nullable(t.Number())),
        album: t.Optional(
          t.Nullable(
            t.Object({
              id: t.Number(),
              titlePrimary: t.String(),
              coverImage: t.Nullable(t.String()),
            })
          )
        ),
      })
    )
  ),
})
