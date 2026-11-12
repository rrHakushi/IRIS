import { t, type UnwrapSchema } from 'elysia'

export const ActivityPaginationMetaSchema = t.Object({
  page: t.Number({ description: 'Current page number' }),
  limit: t.Number({ description: 'Items per page limit' }),
  total: t.Number({ description: 'Total number of items' }),
  totalPages: t.Number({ description: 'Total number of pages available' }),
  hasMore: t.Boolean({ description: 'Whether additional pages exist beyond this one' }),
})

export const ActivityAuthorPreviewSchema = t.Object({
  id: t.String(),
  username: t.String(),
  displayName: t.Nullable(t.String()),
  avatarUrl: t.Nullable(t.String()),
  avatarFrame: t.Nullable(t.String()),
  bannerUrl: t.Optional(t.Nullable(t.String())),
  bannerOverlayUrl: t.Optional(t.Nullable(t.String())),
  nameplateUrl: t.Optional(t.Nullable(t.String())),
  accentColor: t.Optional(t.Nullable(t.String())),
  bio: t.Optional(t.Nullable(t.String())),
  statusText: t.Optional(t.Nullable(t.String())),
  pronouns: t.Optional(t.Nullable(t.String())),
  displayNameStyle: t.Optional(t.Nullable(t.Any())),
  showcaseBadgeIds: t.Optional(t.Array(t.Number())),
  pinnedSpotlight: t.Optional(t.Nullable(t.Any())),
  socialLinks: t.Optional(t.Array(t.Any())),
})

export const ActivityLogItemSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  type: t.String(),
  mediaType: t.Nullable(t.String()),
  mediaId: t.Nullable(t.Number()),
  status: t.Nullable(t.String()),
  progress: t.Nullable(t.Number()),
  progressVolumes: t.Nullable(t.Number()),
  score: t.Nullable(t.Number()),
  title: t.Nullable(t.String()),
  content: t.Nullable(t.String()),
  metadata: t.Optional(t.Nullable(t.Any())),
  isPrivate: t.Boolean(),
  isSpoiler: t.Boolean(),
  likeCount: t.Number(),
  replyCount: t.Number(),
  isLiked: t.Boolean(),
  createdAt: t.String(),
  user: ActivityAuthorPreviewSchema,
  canDelete: t.Boolean(),
})

export const ActivityReplyItemSchema = t.Object({
  id: t.String(),
  activityId: t.String(),
  userId: t.String(),
  content: t.String(),
  likeCount: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
  user: ActivityAuthorPreviewSchema,
  canDelete: t.Boolean(),
})

export const CarinaActivityModel = {
  activityParam: t.Object({
    id: t.String({
      minLength: 1,
      description: 'Activity log entry ID',
    }),
  }),

  replyParam: t.Object({
    id: t.String({
      minLength: 1,
      description: 'Activity log entry ID',
    }),
    replyId: t.String({
      minLength: 1,
      description: 'Activity reply ID',
    }),
  }),

  repliesQuery: t.Object({
    page: t.Optional(t.Numeric({ minimum: 1 })),
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
  }),

  createStatusPostBody: t.Object({
    content: t.String({
      minLength: 1,
      maxLength: 2000,
      description: 'Status post content',
    }),
    isSpoiler: t.Optional(t.Boolean()),
    isPrivate: t.Optional(t.Boolean()),
    mediaType: t.Optional(t.Nullable(t.String())),
    mediaId: t.Optional(t.Nullable(t.Numeric({ minimum: 1 }))),
  }),

  createStatusPostResponse: t.Object({
    success: t.Boolean(),
    activity: ActivityLogItemSchema,
  }),

  toggleLikeResponse: t.Object({
    success: t.Boolean(),
    liked: t.Boolean(),
    likeCount: t.Number(),
  }),

  repliesResponse: t.Object({
    success: t.Boolean(),
    replies: t.Array(ActivityReplyItemSchema),
    pagination: ActivityPaginationMetaSchema,
  }),

  createReplyBody: t.Object({
    content: t.String({
      minLength: 1,
      maxLength: 1000,
      description: 'Reply text content',
    }),
  }),

  createReplyResponse: t.Object({
    success: t.Boolean(),
    reply: ActivityReplyItemSchema,
    replyCount: t.Number(),
  }),

  deleteReplyResponse: t.Object({
    success: t.Boolean(),
    replyCount: t.Number(),
    message: t.String(),
  }),

  badRequestError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(400),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),

  unauthorizedError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(401),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),

  forbiddenError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(403),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),

  notFoundError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(404),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),

  validationError: t.Object({
    type: t.String(),
    title: t.String(),
    status: t.Literal(422),
    detail: t.String(),
    code: t.String(),
    instance: t.Optional(t.String()),
  }),
} as const

export type CarinaActivityModel = {
  [k in keyof typeof CarinaActivityModel]: UnwrapSchema<(typeof CarinaActivityModel)[k]>
}

