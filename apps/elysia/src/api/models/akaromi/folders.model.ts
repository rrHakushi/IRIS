import { t, type UnwrapSchema } from 'elysia'

export const AkaromiFoldersModel = {
  // Path params
  folderParam: t.Object({
    folderId: t.String({
      minLength: 1,
      description: 'Folder unique identifier (UUID)',
    }),
  }),

  folderItem: t.Object({
    id: t.String({ description: 'Folder unique identifier (UUID)' }),
    encryptedName: t.String({ description: 'Client-encrypted folder name' }),
    parentId: t.Nullable(t.String({ description: 'Parent folder ID for nesting' })),
    cipherCount: t.Number({ description: 'Number of active ciphers in folder' }),
    createdAt: t.String({ description: 'Creation ISO timestamp' }),
    updatedAt: t.String({ description: 'Last update ISO timestamp' }),
  }),

  listFoldersResponse: t.Object({
    success: t.Boolean(),
    folders: t.Array(
      t.Object({
        id: t.String(),
        encryptedName: t.String(),
        parentId: t.Nullable(t.String()),
        cipherCount: t.Number(),
        createdAt: t.String(),
        updatedAt: t.String(),
      })
    ),
  }),

  createFolderBody: t.Object({
    encryptedName: t.String({
      minLength: 1,
      description: 'Client-encrypted folder name',
    }),
    parentId: t.Optional(t.Nullable(t.String())),
  }),

  createFolderResponse: t.Object({
    success: t.Boolean(),
    folder: t.Object({
      id: t.String(),
      encryptedName: t.String(),
      parentId: t.Nullable(t.String()),
      cipherCount: t.Number(),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
    message: t.String(),
  }),

  updateFolderBody: t.Object({
    encryptedName: t.Optional(t.String({ minLength: 1 })),
    parentId: t.Optional(t.Nullable(t.String())),
  }),

  updateFolderResponse: t.Object({
    success: t.Boolean(),
    folder: t.Object({
      id: t.String(),
      encryptedName: t.String(),
      parentId: t.Nullable(t.String()),
      createdAt: t.String(),
      updatedAt: t.String(),
    }),
    message: t.String(),
  }),

  deleteFolderResponse: t.Object({
    success: t.Boolean(),
    id: t.String(),
    message: t.String(),
  }),

  // Detailed RFC 9457 Error Schemas
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

  forbiddenError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("forbidden")' }),
    title: t.String({ description: 'Short summary ("Forbidden")' }),
    status: t.Literal(403, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed forbidden explanation' }),
    code: t.String({ description: 'Machine-readable token ("forbidden")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Insufficient permissions' }),

  notFoundError: t.Object({
    type: t.String({ description: 'Slug identifying problem type ("not-found")' }),
    title: t.String({ description: 'Short summary ("Not Found")' }),
    status: t.Literal(404, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Detailed missing folder explanation' }),
    code: t.String({ description: 'Machine-readable token ("not-found")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Folder not found' }),

  validationError: t.Object({
    type: t.String({ description: 'Slug identifying validation failure ("validation")' }),
    title: t.String({ description: 'Short summary ("Unprocessable Content")' }),
    status: t.Literal(422, { description: 'HTTP status code' }),
    detail: t.String({ description: 'Field validation error details from TypeBox schema validator' }),
    code: t.String({ description: 'Machine-readable token ("validation")' }),
    instance: t.Optional(t.String({ description: 'Specific request URI' })),
  }, { description: 'Request payload validation failed' }),
} as const

export type AkaromiFoldersModel = {
  [k in keyof typeof AkaromiFoldersModel]: UnwrapSchema<(typeof AkaromiFoldersModel)[k]>
}
