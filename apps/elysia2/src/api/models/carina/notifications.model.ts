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

export const CarinaNotificationsModel = {
  // Shared pagination schema
  paginationMeta: PaginationMetaSchema,

  // --- Path Parameter Schema (Strictly ID) ---
  notificationParam: t.Object({
    notificationId: t.String({
      minLength: 1,
      description: 'Notification unique database ID (UUID)',
    }),
  }),

  // Shared notification item representation (Post-Quantum Encrypted)
  notificationItem: t.Object({
    id: t.String({ description: 'Notification unique identifier (UUID)' }),
    userId: t.String({ description: 'Recipient user ID (UUID)' }),
    app: t.String({ description: 'Source application origin (e.g. IRIS, carina)' }),
    category: t.String({ description: 'Notification category identifier' }),
    type: t.String({ description: 'Notification type (INFO, ACTION_CONFIRM, ACTION_INPUT, ACTION_SELECT)' }),
    priority: t.String({ description: 'Priority level (LOW, NORMAL, HIGH, URGENT)' }),
    isRead: t.Boolean({ description: 'Whether notification has been marked as read' }),
    readAt: t.Nullable(t.String({ description: 'ISO timestamp when marked as read, or null' })),
    actionStatus: t.Nullable(t.String({ description: 'Current interactive action status, or null' })),
    actionPayload: t.Nullable(t.Any({ description: 'Dynamic action payload, or null' })),
    actionHandler: t.Nullable(t.String({ description: 'Server action handler route identifier, or null' })),
    kemCiphertext: t.String({ description: 'ML-KEM-768 post-quantum key encapsulation ciphertext (Base64)' }),
    encryptedData: t.String({ description: 'AES-256-GCM symmetric ciphertext format (iv:authTag:cipher hex)' }),
    expiresAt: t.Nullable(t.String({ description: 'Expiration ISO timestamp, or null' })),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
    updatedAt: t.String({ description: 'Last update ISO timestamp' }),
  }),

  // --- GET /carina/notifications (Get notifications - 10 per page default) ---
  listNotificationsQuery: t.Object({
    page: t.Optional(t.Number({ default: 1, minimum: 1, description: 'Page number' })),
    limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 50, description: 'Notifications per page' })),
    isRead: t.Optional(t.Boolean({ description: 'Filter by read status' })),
    app: t.Optional(t.String({ description: 'Filter by source app' })),
    category: t.Optional(t.String({ description: 'Filter by category' })),
    priority: t.Optional(
      t.Union([
        t.Literal('LOW'),
        t.Literal('NORMAL'),
        t.Literal('HIGH'),
        t.Literal('URGENT'),
      ], { description: 'Filter by priority' })
    ),
    type: t.Optional(
      t.Union([
        t.Literal('INFO'),
        t.Literal('ACTION_CONFIRM'),
        t.Literal('ACTION_INPUT'),
        t.Literal('ACTION_SELECT'),
      ], { description: 'Filter by notification type' })
    ),
  }),

  listNotificationsResponse: t.Object({
    success: t.Boolean(),
    total: t.Number({ description: 'Total number of notifications matching filters' }),
    unreadCount: t.Number({ description: 'Total number of unread notifications for user' }),
    notifications: t.Array(
      t.Object({
        id: t.String(),
        userId: t.String(),
        app: t.String(),
        category: t.String(),
        type: t.String(),
        priority: t.String(),
        isRead: t.Boolean(),
        readAt: t.Nullable(t.String()),
        actionStatus: t.Nullable(t.String()),
        actionPayload: t.Nullable(t.Any()),
        actionHandler: t.Nullable(t.String()),
        kemCiphertext: t.String(),
        encryptedData: t.String(),
        expiresAt: t.Nullable(t.String()),
        createdAt: t.String(),
        updatedAt: t.String(),
      })
    ),
    pagination: PaginationMetaSchema,
  }),

  // --- DELETE /carina/notifications (Delete all notifications) ---
  deleteNotificationsQuery: t.Object({
    onlyRead: t.Optional(t.Boolean({ default: false, description: 'Delete only read notifications' })),
  }),

  deleteNotificationsResponse: t.Object({
    success: t.Boolean(),
    deletedCount: t.Number({ description: 'Number of notifications removed' }),
    unreadCount: t.Number({ description: 'Remaining unread count' }),
    message: t.String(),
  }),

  // --- GET /carina/notifications/:notificationId (Get single notification) ---
  singleNotificationResponse: t.Object({
    success: t.Boolean(),
    notification: t.Object({
      id: t.String(),
      userId: t.String(),
      app: t.String(),
      category: t.String(),
      type: t.String(),
      priority: t.String(),
      isRead: t.Boolean(),
      readAt: t.Nullable(t.String()),
      actionStatus: t.Nullable(t.String()),
      actionPayload: t.Nullable(t.Any()),
      actionHandler: t.Nullable(t.String()),
      kemCiphertext: t.String(),
      encryptedData: t.String(),
      expiresAt: t.Nullable(t.String()),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
  }),

  // --- DELETE /carina/notifications/:notificationId (Delete single notification) ---
  deleteSingleNotificationResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    unreadCount: t.Number(),
    message: t.String(),
  }),

  // --- POST /carina/notifications/:notificationId/action (Execute action) ---
  actionBody: t.Object({
    action: t.String({ minLength: 1, description: 'Action identifier (e.g. CONFIRM, REJECT, SUBMIT)' }),
    payload: t.Optional(t.Any({ description: 'Optional dynamic user input or response data' })),
  }),

  actionResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    actionStatus: t.String({ description: 'New action status (CONFIRMED, REJECTED, SUBMITTED)' }),
    actionPayload: t.Nullable(t.Any()),
    isRead: t.Boolean(),
    unreadCount: t.Number(),
    message: t.String(),
  }),

  // --- POST /carina/notifications/:notificationId/read (Mark single as read) ---
  readSingleResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    isRead: t.Boolean(),
    readAt: t.String(),
    unreadCount: t.Number(),
    message: t.String(),
  }),

  // --- POST /carina/notifications/read (Mark all as read) ---
  readAllResponse: t.Object({
    success: t.Boolean(),
    markedCount: t.Number({ description: 'Number of notifications marked as read' }),
    unreadCount: t.Literal(0),
    message: t.String(),
  }),

  // --- Detailed Error Responses (RFC 9457) ---
  badRequestError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("bad-request")' }),
    title: t.String({ description: 'Short summary ("Bad Request")' }),
    status: t.Literal(400, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed failure explanation' }),
    code: t.String({ description: 'Machine-readable token ("bad-request")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Bad request or invalid parameters' }),

  unauthorizedError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("unauthorized")' }),
    title: t.String({ description: 'Short summary ("Unauthorized")' }),
    status: t.Literal(401, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed unauthorized explanation' }),
    code: t.String({ description: 'Machine-readable token ("unauthorized")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Unauthorized request or invalid authentication credentials' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing notification explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Notification not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type CarinaNotificationsModel = {
  [k in keyof typeof CarinaNotificationsModel]: UnwrapSchema<(typeof CarinaNotificationsModel)[k]>
}
