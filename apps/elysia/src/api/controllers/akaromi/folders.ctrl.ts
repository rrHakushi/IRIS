import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { AkaromiFoldersModel } from '../../models/akaromi/folders.model'
import { AkaromiFoldersServ } from '../../../services/akaromi/folders.serv'

export const akaromiFolders = new Elysia({ prefix: '/akaromi/folders' })
  .use(session())

  // --- 1. GET /akaromi/folders (Get user vault folders) ---
  .get(
    '/',
    {
      detail: {
        summary: 'Get user vault folders with active cipher counts',
        tags: ['Akaromi Folders'],
      },
      response: {
        200: AkaromiFoldersModel.listFoldersResponse,
        401: AkaromiFoldersModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiFoldersServ.listFolders(user.id)
    }
  )

  // --- 2. POST /akaromi/folders (Create vault folder) ---
  .post(
    '/',
    {
      body: AkaromiFoldersModel.createFolderBody,
      detail: {
        summary: 'Create new vault folder with client-encrypted name',
        tags: ['Akaromi Folders'],
      },
      response: {
        200: AkaromiFoldersModel.createFolderResponse,
        400: AkaromiFoldersModel.badRequestError,
        401: AkaromiFoldersModel.unauthorizedError,
        404: AkaromiFoldersModel.notFoundError,
        422: AkaromiFoldersModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiFoldersServ.createFolder(user.id, body)
    }
  )

  // --- 3. PATCH /akaromi/folders/:folderId (Update vault folder) ---
  .patch(
    '/:folderId',
    {
      params: AkaromiFoldersModel.folderParam,
      body: AkaromiFoldersModel.updateFolderBody,
      detail: {
        summary: 'Update vault folder name or hierarchy parent',
        tags: ['Akaromi Folders'],
      },
      response: {
        200: AkaromiFoldersModel.updateFolderResponse,
        400: AkaromiFoldersModel.badRequestError,
        401: AkaromiFoldersModel.unauthorizedError,
        404: AkaromiFoldersModel.notFoundError,
        422: AkaromiFoldersModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiFoldersServ.updateFolder(user.id, params.folderId, body)
    }
  )

  // --- 4. PUT /akaromi/folders/:folderId (Update vault folder alias) ---
  .put(
    '/:folderId',
    {
      params: AkaromiFoldersModel.folderParam,
      body: AkaromiFoldersModel.updateFolderBody,
      detail: {
        summary: 'Update vault folder via PUT',
        tags: ['Akaromi Folders'],
      },
      response: {
        200: AkaromiFoldersModel.updateFolderResponse,
        400: AkaromiFoldersModel.badRequestError,
        401: AkaromiFoldersModel.unauthorizedError,
        404: AkaromiFoldersModel.notFoundError,
        422: AkaromiFoldersModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiFoldersServ.updateFolder(user.id, params.folderId, body)
    }
  )

  // --- 5. DELETE /akaromi/folders/:folderId (Delete vault folder) ---
  .delete(
    '/:folderId',
    {
      params: AkaromiFoldersModel.folderParam,
      detail: {
        summary: 'Delete vault folder, unlinking all contained ciphers first',
        tags: ['Akaromi Folders'],
      },
      response: {
        200: AkaromiFoldersModel.deleteFolderResponse,
        400: AkaromiFoldersModel.badRequestError,
        401: AkaromiFoldersModel.unauthorizedError,
        404: AkaromiFoldersModel.notFoundError,
        422: AkaromiFoldersModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await AkaromiFoldersServ.deleteFolder(user.id, params.folderId)
    }
  )

export default akaromiFolders
