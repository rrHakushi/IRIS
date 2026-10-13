import { t, type UnwrapSchema } from 'elysia'

/**
 * Reusable pagination metadata schema
 */
export const PaginationMetaSchema = t.Object({
  page: t.Number({ description: 'Current page number' }),
  limit: t.Number({ description: 'Items per page limit' }),
  total: t.Number({ description: 'Total number of items' }),
  totalPages: t.Number({ description: 'Total number of pages available' }),
  hasMore: t.Boolean({ description: 'Whether additional pages exist beyond this one' }),
})

export const CarinaUsersModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schemas ---
  userParam: t.Object({
    userId: t.String({
      minLength: 1,
      description: 'Target user ID (UUID)',
    }),
  }),

  usernameParam: t.Object({
    username: t.String({
      minLength: 1,
      description: 'Target user username',
    }),
  }),

  activityCategoryParam: t.Object({
    userId: t.String({
      minLength: 1,
      description: 'Target user ID (UUID)',
    }),
    category: t.String({
      minLength: 1,
      description: 'Activity category filter (media, lists, social, posts, status, or specific ActivityType enum)',
    }),
  }),

  activityItemParam: t.Object({
    id: t.String({
      minLength: 1,
      description: 'Unique activity log database identifier',
    }),
  }),

  favoritesCategoryParam: t.Object({
    userId: t.String({
      minLength: 1,
      description: 'Target user ID (UUID)',
    }),
    category: t.String({
      minLength: 1,
      description: 'Favorite item category (anime, manga, movie, tv, game, book, music, character, person, studio, user)',
    }),
  }),

  // --- GET /carina/users ---
  listUsersQuery: t.Object({
    q: t.Optional(t.String({ description: 'Search term filtering username' })),
    page: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50, description: 'Users per page' })),
  }),

  userSummaryItem: t.Object({
    id: t.String({ description: 'User unique identifier' }),
    username: t.String({ description: 'Unique user handle' }),
    displayName: t.Nullable(t.String({ description: 'Profile display name' })),
    avatarUrl: t.Nullable(t.String({ description: 'Profile avatar image URL' })),
    avatarFrame: t.Nullable(t.String({ description: 'Profile avatar frame overlay URL' })),
    bannerUrl: t.Nullable(t.String({ description: 'Profile banner image URL' })),
    bio: t.Nullable(t.String({ description: 'User biography description' })),
    badges: t.Array(t.Number(), { description: 'Array of unlocked badge IDs' }),
    createdAt: t.String({ description: 'Account creation ISO timestamp' }),
  }),

  listUsersResponse: t.Object({
    success: t.Boolean(),
    users: t.Array(
      t.Object({
        id: t.String(),
        username: t.String(),
        displayName: t.Nullable(t.String()),
        avatarUrl: t.Nullable(t.String()),
        avatarFrame: t.Nullable(t.String()),
        bannerUrl: t.Nullable(t.String()),
        bio: t.Nullable(t.String()),
        badges: t.Array(t.Number()),
        createdAt: t.String(),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- GET /carina/users/:userId ---
  userProfileResponse: t.Object({
    success: t.Boolean(),
    user: t.Object({
      id: t.String(),
      username: t.String(),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
      bannerUrl: t.Nullable(t.String()),
      bannerOverlayUrl: t.Nullable(t.String()),
      nameplateUrl: t.Nullable(t.String()),
      bio: t.Nullable(t.String()),
      statusText: t.Nullable(t.String()),
      pronouns: t.Nullable(t.String()),
      badges: t.Array(t.Number()),
      customization: t.Nullable(t.Any()),
      createdAt: t.String(),
      stats: t.Object({
        friendsCount: t.Number(),
        favoritesCount: t.Number(),
        badgesCount: t.Number(),
      }),
    }),
  }),

  // --- POST /carina/users/:userId/block ---
  blockUserResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    blockedId: t.String({ description: 'ID of the newly blocked user' }),
  }),

  // --- POST /carina/users/:userId/unblock ---
  unblockUserResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- GET /carina/users/:userId/friendship ---
  friendshipResponse: t.Object({
    success: t.Boolean(),
    status: t.Union([
      t.Literal('none'),
      t.Literal('friends'),
      t.Literal('incoming_request'),
      t.Literal('outgoing_request'),
      t.Literal('blocked'),
      t.Literal('blocked_by'),
      t.Literal('self'),
    ]),
    isFriend: t.Boolean(),
    isBlocked: t.Boolean(),
    isBlockedBy: t.Boolean(),
    isPending: t.Boolean(),
    requestId: t.Nullable(t.String()),
  }),

  // --- GET /carina/users/:userId/assets ---
  userAssetsResponse: t.Object({
    success: t.Boolean(),
    assets: t.Object({
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
      bannerUrl: t.Nullable(t.String()),
      bannerOverlayUrl: t.Nullable(t.String()),
      nameplateUrl: t.Nullable(t.String()),
      sidebarBannerUrl: t.Nullable(t.String()),
      accentColor: t.Nullable(t.String()),
    }),
  }),

  // --- POST /carina/users/me/assets (Upload user asset to storage) ---
  uploadAssetBody: t.Object({
    file: t.File({ description: 'Asset file buffer' }),
    assetType: t.Union([
      t.Literal('avatar'),
      t.Literal('banner'),
      t.Literal('bannerOverlay'),
      t.Literal('nameplate'),
      t.Literal('sidebarBanner'),
      t.Literal('avatarFrame'),
    ]),
  }),

  uploadAssetResponse: t.Object({
    success: t.Boolean(),
    url: t.String(),
    key: t.String(),
    assetType: t.String(),
  }),

  // --- DELETE /carina/users/me/assets (Delete user asset from storage) ---
  deleteAssetBody: t.Object({
    key: t.String({ description: 'S3 storage asset key to remove' }),
  }),

  deleteAssetResponse: t.Object({
    success: t.Boolean(),
  }),

  // --- GET /carina/users/:userId/badges ---
  badgeDetailItem: t.Object({
    id: t.Number(),
    name: t.String(),
    description: t.String(),
    icon: t.String(),
    color: t.String(),
    category: t.String(),
    earnable: t.Boolean(),
  }),

  userBadgesResponse: t.Object({
    success: t.Boolean(),
    badges: t.Array(
      t.Object({
        id: t.Number(),
        name: t.String(),
        description: t.String(),
        icon: t.String(),
        color: t.String(),
        category: t.String(),
        earnable: t.Boolean(),
      })
    ),
    total: t.Number(),
  }),

  // --- POST /carina/users/:userId/badges/evaluate ---
  evaluateBadgesResponse: t.Object({
    success: t.Boolean(),
    newlyAwardedCount: t.Number(),
    newlyAwardedBadgeIds: t.Array(t.Number()),
    badges: t.Array(t.Number()),
    message: t.String(),
  }),

  // --- GET /carina/users/:userId/activity and /:category ---
  activityPaginationQuery: t.Object({
    page: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50, description: 'Activities per page' })),
  }),

  activityAuthorPreview: t.Object({
    id: t.String(),
    username: t.String(),
    displayName: t.Nullable(t.String()),
    avatarUrl: t.Nullable(t.String()),
    avatarFrame: t.Nullable(t.String()),
  }),

  activityLogItem: t.Object({
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
    createdAt: t.String(),
    user: t.Object({
      id: t.String(),
      username: t.String(),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
    }),
    canDelete: t.Boolean(),
  }),

  activityResponse: t.Object({
    success: t.Boolean(),
    activities: t.Array(
      t.Object({
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
        createdAt: t.String(),
        user: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
        }),
        canDelete: t.Boolean(),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- DELETE /carina/users/activity/:id ---
  deleteActivityResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- GET /carina/users/:userId/favorites and /:category ---
  favoriteItem: t.Object({
    id: t.String(),
    userId: t.String(),
    type: t.String(),
    targetId: t.Number(),
    createdAt: t.String(),
  }),

  favoritesResponse: t.Object({
    success: t.Boolean(),
    favorites: t.Array(
      t.Object({
        id: t.String(),
        userId: t.String(),
        type: t.String(),
        targetId: t.Number(),
        createdAt: t.String(),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- GET /carina/users/me ---
  fullAccountUser: t.Object({
    id: t.String(),
    username: t.String(),
    email: t.String(),
    customization: t.Nullable(t.Any()),
    settings: t.Nullable(t.Any()),
    permissions: t.Array(t.Number()),
    badges: t.Array(t.Number()),
    TOTPEnabled: t.Boolean(),
    emailMfaEnabled: t.Boolean(),
    publicKey: t.Nullable(t.String()),
    createdAt: t.String(),
    updatedAt: t.String(),
  }),

  currentUserResponse: t.Object({
    success: t.Boolean(),
    user: t.Object({
      id: t.String(),
      username: t.String(),
      email: t.String(),
      customization: t.Nullable(t.Any()),
      settings: t.Nullable(t.Any()),
      permissions: t.Array(t.Number()),
      badges: t.Array(t.Number()),
      TOTPEnabled: t.Boolean(),
      emailMfaEnabled: t.Boolean(),
      publicKey: t.Nullable(t.String()),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  }),

  // --- PATCH /carina/users/me ---
  updateMeBody: t.Object({
    username: t.Optional(
      t.String({
        minLength: 3,
        maxLength: 32,
        pattern: '^[a-zA-Z0-9_-]+$',
        description: 'Updated username (letters, numbers, hyphens, and underscores)',
      })
    ),
    email: t.Optional(t.String({ format: 'email', description: 'Updated email address' })),
    customization: t.Optional(t.Any({ description: 'Full or partial user customization object' })),
    settings: t.Optional(t.Any({ description: 'Full or partial user settings JSON' })),
    assets: t.Optional(
      t.Object({
        avatarUrl: t.Optional(t.Nullable(t.String())),
        bannerUrl: t.Optional(t.Nullable(t.String())),
        bannerOverlayUrl: t.Optional(t.Nullable(t.String())),
        nameplateUrl: t.Optional(t.Nullable(t.String())),
        avatarFrame: t.Optional(t.Nullable(t.String())),
      }, { description: 'Convenience asset URLs to automatically merge into profile customization' })
    ),
  }),

  updateMeResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    user: t.Object({
      id: t.String(),
      username: t.String(),
      email: t.String(),
      customization: t.Nullable(t.Any()),
      settings: t.Nullable(t.Any()),
      permissions: t.Array(t.Number()),
      badges: t.Array(t.Number()),
      TOTPEnabled: t.Boolean(),
      emailMfaEnabled: t.Boolean(),
      publicKey: t.Nullable(t.String()),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  }),

  // --- Detailed Error Responses (RFC 9457) ---
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("bad-request")' }),
    title: t.String({ description: 'Short human-readable summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable error token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Bad request or invalid parameters' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("unauthorized")' }),
    title: t.String({ description: 'Short human-readable summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized reason' }),
    code: t.String({ description: 'Machine-readable error token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Unauthorized request or missing/invalid session' }),

  forbiddenError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("forbidden")' }),
    title: t.String({ description: 'Short human-readable summary ("Forbidden")' }),
    status: t.Literal(403, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed forbidden reason' }),
    code: t.String({ description: 'Machine-readable error token ("forbidden")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Forbidden action (insufficient permissions)' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("not-found")' }),
    title: t.String({ description: 'Short human-readable summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed explanation of missing user or resource' }),
    code: t.String({ description: 'Machine-readable error token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'User or resource not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short human-readable summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable error token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaUsersModel = {
  [k in keyof typeof CarinaUsersModel]: UnwrapSchema<(typeof CarinaUsersModel)[k]>
}
