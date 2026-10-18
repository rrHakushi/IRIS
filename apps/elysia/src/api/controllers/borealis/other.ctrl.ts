import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { hasPermission, IRISFlags } from '@IRIS/permissions'
import { BorealisOtherModel } from '../../models/borealis/other.model'
import { BorealisOtherServ } from '../../../services/borealis/other.serv'

export const borealisOther = new Elysia({ prefix: '/borealis/other' })
  .use(session())

  // POST /borealis/other/upload (Upload image asset <= 1MB)
  .post(
    '/upload',
    {
      body: BorealisOtherModel.uploadAssetBody,
      detail: {
        summary: 'Upload cover or banner image asset (max 1MB)',
        description: 'Uploads and converts an image to WebP format. Maximum file size is 1MB.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.uploadAssetResponse,
        400: BorealisOtherModel.validationError,
        401: BorealisOtherModel.unauthorizedError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisOtherServ.uploadAsset(user.id, body.file, body.type)
    }
  )

  // POST /borealis/other (Create custom item)
  .post(
    '',
    {
      body: BorealisOtherModel.createOtherBody,
      detail: {
        summary: 'Create custom trackable item',
        description:
          'Creates a new custom item in the catalog. Normal users have a limit of 500 items, while administrators have unlimited creations.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.itemResponse,
        400: BorealisOtherModel.validationError,
        401: BorealisOtherModel.unauthorizedError,
        403: BorealisOtherModel.forbiddenError,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      const isAdmin = hasPermission(user.permissions, IRISFlags.ADMINISTRATOR)
      return await BorealisOtherServ.createItem(user.id, body, isAdmin)
    }
  )

  // GET /borealis/other/:otherId (Get custom item details)
  .get(
    '/:otherId',
    {
      params: BorealisOtherModel.otherParam,
      detail: {
        summary: 'Get custom item details',
        description: 'Retrieves custom item details by ID.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.itemResponse,
        404: BorealisOtherModel.notFoundError,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ params: { otherId }, session: userSession }) => {
      const user = userSession.getUser()
      const isAdmin = hasPermission(user?.permissions ?? null, IRISFlags.ADMINISTRATOR)
      return await BorealisOtherServ.getItem(otherId, user?.id, isAdmin)
    }
  )

  // PUT /borealis/other/:otherId (Update custom item)
  .put(
    '/:otherId',
    {
      params: BorealisOtherModel.otherParam,
      body: BorealisOtherModel.updateOtherBody,
      detail: {
        summary: 'Update custom item',
        description:
          'Updates custom item details. If the item is published and tracked by other users, creates a pre-update snapshot and dispatches in-app notifications with a one-click fork action.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.itemResponse,
        400: BorealisOtherModel.validationError,
        401: BorealisOtherModel.unauthorizedError,
        403: BorealisOtherModel.forbiddenError,
        404: BorealisOtherModel.notFoundError,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ params: { otherId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      const isAdmin = hasPermission(user.permissions, IRISFlags.ADMINISTRATOR)
      return await BorealisOtherServ.updateItem(user.id, otherId, body, isAdmin)
    }
  )

  // DELETE /borealis/other/:otherId (Delete custom item)
  .delete(
    '/:otherId',
    {
      params: BorealisOtherModel.otherParam,
      detail: {
        summary: 'Delete custom item',
        description:
          'Deletes custom item if no other users have it tracked or favorited. Strict deletion integrity is enforced even for administrators.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.deleteResponse,
        401: BorealisOtherModel.unauthorizedError,
        403: BorealisOtherModel.forbiddenError,
        404: BorealisOtherModel.notFoundError,
        409: BorealisOtherModel.conflictError,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ params: { otherId }, session: userSession }) => {
      const user = userSession.requireUser()
      const isAdmin = hasPermission(user.permissions, IRISFlags.ADMINISTRATOR)
      return await BorealisOtherServ.deleteItem(user.id, otherId, isAdmin)
    }
  )

  // POST /borealis/other/:otherId/fork (Fork pre-update copy)
  .post(
    '/:otherId/fork',
    {
      params: BorealisOtherModel.otherParam,
      detail: {
        summary: 'Fork pre-update copy into private item',
        description:
          'Clones pre-update snapshot into a new private item for the requesting user and repoints their list entry.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.forkResponse,
        401: BorealisOtherModel.unauthorizedError,
        403: BorealisOtherModel.forbiddenError,
        404: BorealisOtherModel.notFoundError,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ params: { otherId }, session: userSession }) => {
      const user = userSession.requireUser()
      const isAdmin = hasPermission(user.permissions, IRISFlags.ADMINISTRATOR)
      return await BorealisOtherServ.forkItem(user.id, otherId, isAdmin)
    }
  )

export default borealisOther
