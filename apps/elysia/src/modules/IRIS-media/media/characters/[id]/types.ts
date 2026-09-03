import { t } from "elysia"
import { PersonSchema } from "@/modules/IRIS-media/types"

export const MediaAppearanceItemSchema = t.Object({
  id: t.Number(),
  mediaType: t.String(),
  mediaId: t.Number(),
  role: t.String(),
  order: t.Nullable(t.Number()),
  actor: t.Nullable(PersonSchema),
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
})

export const CharacterResponseSchema = t.Object({
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

  mediaCharacters: t.Array(MediaAppearanceItemSchema),
})
