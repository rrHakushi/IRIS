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

export const CarinaCommentsModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schemas (Strictly IDs) ---
  userParam: t.Object({
    userId: t.String({
      minLength: 1,
      description: 'Target profile user ID (UUID)',
    }),
  }),

  listUserParam: t.Object({
    userId: t.String({
      minLength: 1,
      description: 'Target list owner user ID (UUID)',
    }),
    mediaType: t.String({
      minLength: 1,
      description: 'Media domain type (anime, manga, movie, tv, game, book, music)',
    }),
  }),

  commentParam: t.Object({
    commentId: t.String({
      minLength: 1,
      description: 'Target comment unique ID (UUID)',
    }),
  }),

  replyParam: t.Object({
    commentId: t.String({
      minLength: 1,
      description: 'Parent comment unique ID (UUID)',
    }),
    replyId: t.String({
      minLength: 1,
      description: 'Target reply unique ID (UUID)',
    }),
  }),

  // Shared author preview representation
  authorPreview: t.Object({
    id: t.String({ description: 'Author user ID (UUID)' }),
    username: t.String({ description: 'Author username' }),
    displayName: t.Nullable(t.String({ description: 'Author custom display name' })),
    avatarUrl: t.Nullable(t.String({ description: 'Author avatar image URL' })),
    avatarFrame: t.Nullable(t.String({ description: 'Author avatar frame URL' })),
    bannerUrl: t.Nullable(t.String({ description: 'Author banner image URL' })),
  }),

  // Shared reply representation
  replyItem: t.Object({
    id: t.String({ description: 'Reply unique identifier (UUID)' }),
    commentId: t.String({ description: 'Associated parent comment ID' }),
    authorId: t.String({ description: 'Reply author user ID (UUID)' }),
    content: t.String({ description: 'Text content of the reply' }),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
    updatedAt: t.String({ description: 'Last update ISO timestamp' }),
    author: t.Object({
      id: t.String(),
      username: t.String(),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
      bannerUrl: t.Nullable(t.String()),
    }),
  }),

  // Shared comment representation
  commentItem: t.Object({
    id: t.String({ description: 'Comment unique identifier (UUID)' }),
    listOwnerId: t.String({ description: 'Profile or list owner user ID (UUID)' }),
    mediaType: t.String({ description: 'Context identifier ("profile" or media domain)' }),
    authorId: t.String({ description: 'Comment author user ID (UUID)' }),
    content: t.String({ description: 'Text content of the comment' }),
    isSpoiler: t.Boolean({ description: 'Whether the comment contains spoilers' }),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
    updatedAt: t.String({ description: 'Last update ISO timestamp' }),
    author: t.Object({
      id: t.String(),
      username: t.String(),
      displayName: t.Nullable(t.String()),
      avatarUrl: t.Nullable(t.String()),
      avatarFrame: t.Nullable(t.String()),
      bannerUrl: t.Nullable(t.String()),
    }),
    reply: t.Nullable(
      t.Object({
        id: t.String(),
        commentId: t.String(),
        authorId: t.String(),
        content: t.String(),
        createdAt: t.String(),
        updatedAt: t.String(),
        author: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
          bannerUrl: t.Nullable(t.String()),
        }),
      })
    ),
  }),

  // --- Query Schema for Comments (10 per page default) ---
  listCommentsQuery: t.Object({
    page: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50, description: 'Comments per page' })),
  }),

  listCommentsResponse: t.Object({
    success: t.Boolean(),
    comments: t.Array(
      t.Object({
        id: t.String(),
        listOwnerId: t.String(),
        mediaType: t.String(),
        authorId: t.String(),
        content: t.String(),
        isSpoiler: t.Boolean(),
        createdAt: t.String(),
        updatedAt: t.String(),
        author: t.Object({
          id: t.String(),
          username: t.String(),
          displayName: t.Nullable(t.String()),
          avatarUrl: t.Nullable(t.String()),
          avatarFrame: t.Nullable(t.String()),
          bannerUrl: t.Nullable(t.String()),
        }),
        reply: t.Nullable(
          t.Object({
            id: t.String(),
            commentId: t.String(),
            authorId: t.String(),
            content: t.String(),
            createdAt: t.String(),
            updatedAt: t.String(),
            author: t.Object({
              id: t.String(),
              username: t.String(),
              displayName: t.Nullable(t.String()),
              avatarUrl: t.Nullable(t.String()),
              avatarFrame: t.Nullable(t.String()),
              bannerUrl: t.Nullable(t.String()),
            }),
          })
        ),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- Create Comment Body ---
  createCommentBody: t.Object({
    content: t.String({
      minLength: 1,
      maxLength: 5000,
      description: 'Text content of the comment (max 5000 chars)',
    }),
    isSpoiler: t.Optional(
      t.Boolean({ default: false, description: 'Mark comment as containing spoilers' })
    ),
  }),

  createCommentResponse: t.Object({
    success: t.Boolean(),
    comment: t.Object({
      id: t.String(),
      listOwnerId: t.String(),
      mediaType: t.String(),
      authorId: t.String(),
      content: t.String(),
      isSpoiler: t.Boolean(),
      createdAt: t.String(),
      updatedAt: t.String(),
      author: t.Object({
        id: t.String(),
        username: t.String(),
        displayName: t.Nullable(t.String()),
        avatarUrl: t.Nullable(t.String()),
        avatarFrame: t.Nullable(t.String()),
        bannerUrl: t.Nullable(t.String()),
      }),
      reply: t.Nullable(
        t.Object({
          id: t.String(),
          commentId: t.String(),
          authorId: t.String(),
          content: t.String(),
          createdAt: t.String(),
          updatedAt: t.String(),
          author: t.Object({
            id: t.String(),
            username: t.String(),
            displayName: t.Nullable(t.String()),
            avatarUrl: t.Nullable(t.String()),
            avatarFrame: t.Nullable(t.String()),
            bannerUrl: t.Nullable(t.String()),
          }),
        })
      ),
    }),
  }),

  // --- Delete Comment Response ---
  deleteCommentResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    message: t.String(),
  }),

  // --- Create Reply Body ---
  createReplyBody: t.Object({
    content: t.String({
      minLength: 1,
      maxLength: 5000,
      description: 'Text content of the owner reply (max 5000 chars)',
    }),
  }),

  createReplyResponse: t.Object({
    success: t.Boolean(),
    reply: t.Object({
      id: t.String(),
      commentId: t.String(),
      authorId: t.String(),
      content: t.String(),
      createdAt: t.String(),
      updatedAt: t.String(),
      author: t.Object({
        id: t.String(),
        username: t.String(),
        displayName: t.Nullable(t.String()),
        avatarUrl: t.Nullable(t.String()),
        avatarFrame: t.Nullable(t.String()),
        bannerUrl: t.Nullable(t.String()),
      }),
    }),
  }),

  // --- Delete Reply Response ---
  deleteReplyResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    message: t.String(),
  }),

  // --- Detailed RFC 9457 Error Schemas ---
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Bad request, invalid media type, or empty content' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("unauthorized")' }),
    title: t.String({ description: 'Short summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized explanation' }),
    code: t.String({ description: 'Machine-readable token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  forbiddenError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("forbidden")' }),
    title: t.String({ description: 'Short summary ("Forbidden")' }),
    status: t.Literal(403, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed forbidden explanation' }),
    code: t.String({ description: 'Machine-readable token ("forbidden")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Insufficient permissions to delete or reply to comment' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing resource explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Target user, comment, or reply not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaCommentsModel = {
  [k in keyof typeof CarinaCommentsModel]: UnwrapSchema<(typeof CarinaCommentsModel)[k]>
}
