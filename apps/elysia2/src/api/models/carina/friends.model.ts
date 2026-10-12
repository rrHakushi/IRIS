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

export const CarinaFriendsModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schemas (Strictly IDs) ---
  friendParam: t.Object({
    friendId: t.String({
      minLength: 1,
      description: 'Target friend user ID (UUID)',
    }),
  }),

  requestParam: t.Object({
    requestId: t.String({
      minLength: 1,
      description: 'Unique friend request ID',
    }),
  }),

  mediaTrackingParam: t.Object({
    mediaType: t.String({
      minLength: 1,
      description: 'Media domain type (anime, manga, movie, tv, game, book, music)',
    }),
    id: t.Numeric({
      minimum: 1,
      description: 'Media item unique ID',
    }),
  }),

  // --- GET /carina/friends (Get friends list) ---
  listFriendsQuery: t.Object({
    page: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50, description: 'Friends per page' })),
  }),

  friendUserPreview: t.Object({
    id: t.String({ description: 'Friend user ID (UUID)' }),
    username: t.String({ description: 'Friend unique username' }),
    displayName: t.Nullable(t.String({ description: 'Friend profile display name' })),
    avatarUrl: t.Nullable(t.String({ description: 'Friend profile avatar URL' })),
    avatarFrame: t.Nullable(t.String({ description: 'Friend profile avatar frame overlay URL' })),
    badges: t.Array(t.Number(), { description: 'Unlocked badge IDs' }),
  }),

  friendItem: t.Object({
    id: t.String({ description: 'Friendship record ID' }),
    friendId: t.String({ description: 'Friend user ID (UUID)' }),
    nickname: t.Nullable(t.String({ description: 'Optional custom friend nickname' })),
    isPrivate: t.Boolean({ description: 'Whether friendship is hidden on public profile' }),
    createdAt: t.String({ description: 'Friendship establishment ISO timestamp' }),
    user: t.Object({
      id: t.String(),
      username: t.String(),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
      badges: t.Array(t.Number()),
    }),
  }),

  listFriendsResponse: t.Object({
    success: t.Boolean(),
    friends: t.Array(
      t.Object({
        id: t.String(),
        friendId: t.String(),
        nickname: t.Nullable(t.String()),
        isPrivate: t.Boolean(),
        createdAt: t.String(),
        user: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
          badges: t.Array(t.Number()),
        }),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- DELETE /carina/friends/:friendId (Remove friend) ---
  deleteFriendResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- GET /carina/friends/requests (Get pending requests) ---
  listRequestsQuery: t.Object({
    type: t.Optional(
      t.Union([t.Literal('incoming'), t.Literal('outgoing'), t.Literal('all')], {
        default: 'incoming',
        description: 'Direction of friend requests to list (incoming, outgoing, or all)',
      })
    ),
    page: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50, description: 'Requests per page' })),
  }),

  requestUserPreview: t.Object({
    id: t.String({ description: 'User ID (UUID)' }),
    username: t.String({ description: 'Username' }),
    displayName: t.Nullable(t.String({ description: 'Display name' })),
    avatarUrl: t.Nullable(t.String({ description: 'Avatar URL' })),
    avatarFrame: t.Nullable(t.String({ description: 'Avatar frame overlay URL' })),
  }),

  friendRequestItem: t.Object({
    id: t.String({ description: 'Friend request ID' }),
    senderId: t.String({ description: 'Sender user ID (UUID)' }),
    receiverId: t.String({ description: 'Receiver user ID (UUID)' }),
    message: t.Nullable(t.String({ description: 'Optional greeting note' })),
    status: t.String({ description: 'Friend request status (PENDING, ACCEPTED, DECLINED, BLOCKED)' }),
    createdAt: t.String({ description: 'Request created ISO timestamp' }),
    sender: t.Object({
      id: t.String(),
      username: t.String(),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
    }),
    receiver: t.Object({
      id: t.String(),
      username: t.String(),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
    }),
  }),

  listRequestsResponse: t.Object({
    success: t.Boolean(),
    requests: t.Array(
      t.Object({
        id: t.String(),
        senderId: t.String(),
        receiverId: t.String(),
        message: t.Nullable(t.String()),
        status: t.String(),
        createdAt: t.String(),
        sender: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
        }),
        receiver: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
        }),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- POST /carina/friends/requests (Send friend request) ---
  sendRequestBody: t.Object({
    targetUserId: t.String({
      minLength: 1,
      description: 'Recipient user ID (UUID) - strictly user ID, never username',
    }),
    message: t.Optional(
      t.String({
        maxLength: 50,
        description: 'Optional introductory note (max 50 chars)',
      })
    ),
  }),

  sendRequestResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    requestId: t.String({ description: 'Generated or resolved friend request ID' }),
  }),

  // --- POST /carina/friends/requests/:requestId/accept ---
  acceptRequestResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    friendId: t.String({ description: 'New friend user ID (UUID)' }),
  }),

  // --- POST /carina/friends/requests/:requestId/decline ---
  declineRequestResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
  }),

  // --- GET /carina/friends/media/:mediaType/:id ---
  mediaTrackingFriendItem: t.Object({
    id: t.String({ description: 'Friendship ID' }),
    friendId: t.String({ description: 'Friend user ID (UUID)' }),
    nickname: t.Nullable(t.String()),
    status: t.String({ description: 'Media tracking status (e.g. COMPLETED, WATCHING, READING)' }),
    progress: t.Nullable(t.Number({ description: 'Current progress episodes/chapters' })),
    progressVolumes: t.Nullable(t.Number({ description: 'Current progress volumes' })),
    score: t.Nullable(t.Number({ description: 'Rating score' })),
    updatedAt: t.String({ description: 'Last tracked entry update timestamp' }),
    user: t.Object({
      id: t.String(),
      username: t.String(),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
    }),
  }),

  mediaTrackingResponse: t.Object({
    success: t.Boolean(),
    mediaType: t.String(),
    mediaId: t.Number(),
    friends: t.Array(
      t.Object({
        id: t.String(),
        friendId: t.String(),
        nickname: t.Nullable(t.String()),
        status: t.String(),
        progress: t.Nullable(t.Number()),
        progressVolumes: t.Nullable(t.Number()),
        score: t.Nullable(t.Number()),
        updatedAt: t.String(),
        user: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
        }),
      })
    ),
  }),

  // --- POST /carina/friends/recommend ---
  recommendBody: t.Object({
    friendIds: t.Array(
      t.String({
        minLength: 1,
        description: 'Target friend user ID (UUID) - strictly user ID, never username',
      }),
      { minItems: 1, description: 'List of target friend user IDs' }
    ),
    mediaType: t.String({
      minLength: 1,
      description: 'Media domain type (anime, manga, movie, tv, game, book, music)',
    }),
    mediaId: t.Number({
      minimum: 1,
      description: 'Media item database identifier',
    }),
    mediaTitle: t.String({
      minLength: 1,
      description: 'Title of the recommended media',
    }),
    mediaCover: t.Optional(t.String({ description: 'Optional media cover thumbnail URL' })),
    message: t.Optional(t.String({ maxLength: 250, description: 'Personal recommendation note' })),
  }),

  recommendResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    sentCount: t.Number({ description: 'Number of friends successfully recommended to' }),
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

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying the problem type ("not-found")' }),
    title: t.String({ description: 'Short human-readable summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed explanation of missing friend or request' }),
    code: t.String({ description: 'Machine-readable error token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Friend, user, or request not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short human-readable summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable error token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request occurrence URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaFriendsModel = {
  [k in keyof typeof CarinaFriendsModel]: UnwrapSchema<(typeof CarinaFriendsModel)[k]>
}
