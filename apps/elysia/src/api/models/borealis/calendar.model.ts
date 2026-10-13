import { t, type UnwrapSchema } from 'elysia'

export const BorealisCalendarModel = {
  calendarQuery: t.Optional(
    t.Object({
      start: t.Optional(
        t.String({
          description: 'Range start ISO timestamp or YYYY-MM-DD (defaults to first day of current month)',
        })
      ),
      end: t.Optional(
        t.String({
          description: 'Range end ISO timestamp or YYYY-MM-DD (defaults to last day of current month)',
        })
      ),
      types: t.Optional(
        t.String({
          description: 'Comma-separated media types e.g. anime,tv,movies,manga,games,books,music',
        })
      ),
      onlyInLists: t.Optional(
        t.Union([t.Boolean(), t.String()], {
          description: "Whether to only return items in authenticated user's lists",
        })
      ),
    })
  ),

  calendarItem: t.Object({
    id: t.String({ description: 'Unique calendar event identifier' }),
    mediaType: t.Union([
      t.Literal('anime'),
      t.Literal('manga'),
      t.Literal('movie'),
      t.Literal('tv'),
      t.Literal('game'),
      t.Literal('book'),
      t.Literal('music'),
    ]),
    mediaId: t.Number({ description: 'Primary media resource ID' }),
    title: t.String(),
    titleSecondary: t.Optional(t.Nullable(t.String())),
    titleNative: t.Optional(t.Nullable(t.String())),
    coverImage: t.Optional(t.Nullable(t.String())),
    bannerImage: t.Optional(t.Nullable(t.String())),
    releaseDate: t.String({ description: 'ISO 8601 release timestamp' }),
    detail: t.Optional(t.Nullable(t.String())),
    format: t.Optional(t.Nullable(t.String())),
    status: t.Optional(t.Nullable(t.String())),
    episodeNumber: t.Optional(t.Nullable(t.Number())),
    seasonNumber: t.Optional(t.Nullable(t.Number())),
    episodeTitle: t.Optional(t.Nullable(t.String())),
    eventKind: t.Optional(t.Nullable(t.String())),
    inUserList: t.Optional(t.Boolean()),
  }),

  calendarResponse: t.Object({
    success: t.Boolean(),
    items: t.Array(
      t.Object({
        id: t.String({ description: 'Unique calendar event identifier' }),
        mediaType: t.Union([
          t.Literal('anime'),
          t.Literal('manga'),
          t.Literal('movie'),
          t.Literal('tv'),
          t.Literal('game'),
          t.Literal('book'),
          t.Literal('music'),
        ]),
        mediaId: t.Number({ description: 'Primary media resource ID' }),
        title: t.String(),
        titleSecondary: t.Optional(t.Nullable(t.String())),
        titleNative: t.Optional(t.Nullable(t.String())),
        coverImage: t.Optional(t.Nullable(t.String())),
        bannerImage: t.Optional(t.Nullable(t.String())),
        releaseDate: t.String({ description: 'ISO 8601 release timestamp' }),
        detail: t.Optional(t.Nullable(t.String())),
        format: t.Optional(t.Nullable(t.String())),
        status: t.Optional(t.Nullable(t.String())),
        episodeNumber: t.Optional(t.Nullable(t.Number())),
        seasonNumber: t.Optional(t.Nullable(t.Number())),
        episodeTitle: t.Optional(t.Nullable(t.String())),
        eventKind: t.Optional(t.Nullable(t.String())),
        inUserList: t.Optional(t.Boolean()),
      })
    ),
    meta: t.Object({
      start: t.String(),
      end: t.String(),
      total: t.Number(),
      counts: t.Record(t.String(), t.Number()),
    }),
  }),

  validationError: t.Object(
    {
      type: t.String(),
      title: t.String(),
      status: t.Literal(422),
      detail: t.String(),
      code: t.String(),
      instance: t.Optional(t.String()),
    },
    { description: 'Validation error' }
  ),
} as const

export type BorealisCalendarModel = {
  [k in keyof typeof BorealisCalendarModel]: UnwrapSchema<(typeof BorealisCalendarModel)[k]>
}
