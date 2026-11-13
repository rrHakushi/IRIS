import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { hasPermission, IRISFlags } from '@NamelessLiberty/permissions'
import { BorealisOtherModel } from '../../models/borealis/other.model'
import { BorealisOtherServ } from '../../../services/borealis/other.serv'

// Split into small Elysia instances to avoid TS2589 (excessively deep type instantiation).
const routes1 = new Elysia()
  .use(session())

  .get(
    '',
    {
      query: BorealisOtherModel.catalogQuery,
      detail: {
        summary: 'Get public custom items catalog',
        description: 'Returns 50 published custom items per page with cursor/page pagination.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.catalogResponse,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisOtherServ.getCatalog(query)
    }
  )

  // GET /borealis/other/filters (Aggregated filters)
  .get(
    '/filters',
    {
      detail: {
        summary: 'Get catalog filters for custom items',
        description: 'Returns available formats and statuses for custom items.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.filtersResponse,
      },
    },
    async () => {
      return await BorealisOtherServ.getFilters()
    }
  )

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

const routes2 = new Elysia()
  .use(session())

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

  // GET /borealis/other/:otherId/stats (Stats)

const routes3 = new Elysia()
  .use(session())

  .get(
    '/:otherId/stats',
    {
      params: BorealisOtherModel.otherParam,
      detail: {
        summary: 'Get stats for custom item',
        description: 'Returns score and status distributions, favorites, and popularity.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.statsResponse,
        404: BorealisOtherModel.notFoundError,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ params: { otherId } }) => {
      return await BorealisOtherServ.getStats(otherId)
    }
  )

  // GET /borealis/other/:otherId/friends (Friends list entries)
  .get(
    '/:otherId/friends',
    {
      params: BorealisOtherModel.otherParam,
      detail: {
        summary: 'Get friends tracking this custom item',
        description: 'Returns public list entries for accepted friends tracking this custom item.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.friendsResponse,
        404: BorealisOtherModel.notFoundError,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ params: { otherId }, session: userSession }) => {
      const user = userSession.getUser()
      return await BorealisOtherServ.getFriends(otherId, user?.id)
    }
  )

  // GET /borealis/other/:otherId/people (All public list entries)
  .get(
    '/:otherId/people',
    {
      params: BorealisOtherModel.otherParam,
      query: BorealisOtherModel.peopleQuery,
      detail: {
        summary: 'Get all public users tracking this custom item',
        description: 'Paginated list of users tracking this item with primary and secondary progress.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.peopleResponse,
        404: BorealisOtherModel.notFoundError,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ params: { otherId }, query }) => {
      return await BorealisOtherServ.getPeople(otherId, query)
    }
  )

  // GET /borealis/other/:otherId/recommendations (Recommendations)
  .get(
    '/:otherId/recommendations',
    {
      params: BorealisOtherModel.otherParam,
      detail: {
        summary: 'Get recommendations for this custom item',
        description: 'Returns community recommendations for this custom item.',
        tags: ['Borealis - Other'],
      },
      response: {
        200: BorealisOtherModel.recommendationsResponse,
        404: BorealisOtherModel.notFoundError,
        422: BorealisOtherModel.validationError,
      },
    },
    async ({ params: { otherId } }) => {
      return await BorealisOtherServ.getRecommendations(otherId)
    }
  )

export const borealisOther = new Elysia({ prefix: '/borealis/other' })
  .use(routes1)
  .use(routes2)
  .use(routes3)

export default borealisOther
