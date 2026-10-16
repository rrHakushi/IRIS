import { t, type UnwrapSchema } from 'elysia'

export const ProgressFieldSchema = t.Object({
  key: t.String({ minLength: 1, description: 'Unique identifier key for progress field' }),
  label: t.String({ minLength: 1, description: 'Display label for progress field' }),
  unit: t.Optional(t.Nullable(t.String({ description: 'Optional unit of measurement (e.g. ep, ch, pages)' }))),
  max: t.Optional(t.Nullable(t.Number({ minimum: 1, description: 'Optional maximum value for completion' }))),
})

export const StatusOptionSchema = t.Object({
  key: t.String({ minLength: 1, description: 'Status identifier key (e.g. PLANNING, IN_PROGRESS)' }),
  label: t.String({ minLength: 1, description: 'Display label for status' }),
  isCompleted: t.Optional(t.Boolean({ description: 'Whether this status signifies completion' })),
})

export const BorealisOtherModel = {
  otherParam: t.Object({
    otherId: t.Numeric({ minimum: 1, description: 'Other item unique ID' }),
  }),

  progressField: ProgressFieldSchema,
  statusOption: StatusOptionSchema,

  createOtherBody: t.Object({
    titlePrimary: t.String({ minLength: 1, description: 'Primary title for custom item' }),
    titleSecondary: t.Optional(t.Nullable(t.String({ description: 'Secondary or alternative title' }))),
    description: t.Optional(t.Nullable(t.String({ description: 'Item description or notes' }))),
    coverImage: t.Optional(t.Nullable(t.String({ description: 'Cover image URL' }))),
    bannerImage: t.Optional(t.Nullable(t.String({ description: 'Banner image URL' }))),
    format: t.Optional(t.Nullable(t.String({ description: 'Format of custom item (normalized to lowercase, e.g. app, activity, course, habit, workout, project, podcast, other)' }))),
    startDate: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    endDate: t.Optional(t.Nullable(t.String({ description: 'End date ISO string' }))),
    isPublished: t.Optional(t.Boolean({ default: false, description: 'Whether item is published to public search' })),
    progressFields: t.Array(ProgressFieldSchema, {
      minItems: 1,
      description: 'At least one progress field definition is required',
    }),
    incrementFieldKey: t.String({
      minLength: 1,
      description: 'Designated field key to increment via /increment route (max 1)',
    }),
    statuses: t.Optional(
      t.Array(StatusOptionSchema, {
        description: 'Optional custom status options overriding defaults',
      })
    ),
  }),

  updateOtherBody: t.Object({
    titlePrimary: t.Optional(t.String({ minLength: 1, description: 'Primary title for custom item' })),
    titleSecondary: t.Optional(t.Nullable(t.String({ description: 'Secondary or alternative title' }))),
    description: t.Optional(t.Nullable(t.String({ description: 'Item description or notes' }))),
    coverImage: t.Optional(t.Nullable(t.String({ description: 'Cover image URL' }))),
    bannerImage: t.Optional(t.Nullable(t.String({ description: 'Banner image URL' }))),
    format: t.Optional(t.Nullable(t.String({ description: 'Format of custom item (normalized to lowercase, e.g. app, activity, course, habit, workout, project, podcast, other)' }))),
    startDate: t.Optional(t.Nullable(t.String({ description: 'Start date ISO string' }))),
    endDate: t.Optional(t.Nullable(t.String({ description: 'End date ISO string' }))),
    isPublished: t.Optional(t.Boolean({ description: 'Whether item is published to public search' })),
    progressFields: t.Optional(
      t.Array(ProgressFieldSchema, {
        minItems: 1,
        description: 'Updated progress field definitions',
      })
    ),
    incrementFieldKey: t.Optional(
      t.String({
        minLength: 1,
        description: 'Designated field key to increment via /increment route (max 1)',
      })
    ),
    statuses: t.Optional(
      t.Array(StatusOptionSchema, {
        description: 'Optional custom status options',
      })
    ),
  }),

  uploadAssetBody: t.Object({
    file: t.File({ description: 'Image file (JPEG, PNG, WebP, GIF, max 1MB)' }),
    type: t.Union([t.Literal('cover'), t.Literal('banner')], {
      description: 'Image asset type',
    }),
  }),

  uploadAssetResponse: t.Object({
    success: t.Boolean(),
    url: t.String({ description: 'Public URL of uploaded and converted image' }),
  }),

  itemResponse: t.Object({
    success: t.Boolean(),
    item: t.Any({ description: 'Custom item details' }),
  }),

  forkResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    item: t.Any({ description: 'Cloned private item details' }),
    entry: t.Optional(t.Any({ description: 'Updated list entry if repointed' })),
  }),

  deleteResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // RFC 9457 Problem Details
  unauthorizedError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(401),
    detail: t.String(),
    code: t.String(),
  }),

  forbiddenError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(403),
    detail: t.String(),
    code: t.String(),
  }),

  notFoundError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(404),
    detail: t.String(),
    code: t.String(),
  }),

  conflictError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(409),
    detail: t.String(),
    code: t.String(),
  }),

  validationError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(422),
    detail: t.String(),
    code: t.String(),
    errors: t.Optional(t.Array(t.Any())),
  }),

  filtersResponse: t.Object({
    success: t.Boolean(),
    statuses: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    formats: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    genres: t.Array(t.Object({ value: t.String(), count: t.Number() })),
    years: t.Array(t.Object({ value: t.Number(), count: t.Number() })),
  }),
}

export type CreateOtherBody = UnwrapSchema<typeof BorealisOtherModel.createOtherBody>
export type UpdateOtherBody = UnwrapSchema<typeof BorealisOtherModel.updateOtherBody>
