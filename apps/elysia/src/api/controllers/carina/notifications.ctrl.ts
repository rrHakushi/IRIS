import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { CarinaNotificationsModel } from '../../models/carina/notifications.model'
import { CarinaNotificationsServ } from '../../../services/carina/notifications.serv'

export const carinaNotifications = new Elysia({ prefix: '/carina/notifications' })
  .use(session())

  // --- 1. GET /carina/notifications (Get notifications - 10 per page default) ---
  .get(
    '/',
    {
      query: CarinaNotificationsModel.listNotificationsQuery,
      detail: {
        summary: 'Get paginated encrypted notifications for authenticated user (10 per page default)',
        tags: ['Carina Notifications'],
      },
      response: {
        200: CarinaNotificationsModel.listNotificationsResponse,
        401: CarinaNotificationsModel.unauthorizedError,
        422: CarinaNotificationsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaNotificationsServ.listNotifications(user.id, query)
    }
  )

  // --- 2. DELETE /carina/notifications (Delete all notifications) ---
  .delete(
    '/',
    {
      query: CarinaNotificationsModel.deleteNotificationsQuery,
      detail: {
        summary: 'Delete all (or only read) notifications for authenticated user',
        tags: ['Carina Notifications'],
      },
      response: {
        200: CarinaNotificationsModel.deleteNotificationsResponse,
        401: CarinaNotificationsModel.unauthorizedError,
        422: CarinaNotificationsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaNotificationsServ.deleteAllNotifications(user.id, query)
    }
  )

  // --- 3. POST /carina/notifications/read (Mark all notifications as read) ---
  .post(
    '/read',
    {
      detail: {
        summary: 'Mark all unread notifications as read for authenticated user',
        tags: ['Carina Notifications'],
      },
      response: {
        200: CarinaNotificationsModel.readAllResponse,
        401: CarinaNotificationsModel.unauthorizedError,
      },
    },
    async ({ session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaNotificationsServ.markAllRead(user.id)
    }
  )

  // --- 4. POST /carina/notifications/:notificationId/read (Mark single notification as read) ---
  .post(
    '/:notificationId/read',
    {
      params: CarinaNotificationsModel.notificationParam,
      detail: {
        summary: 'Mark a single notification as read strictly by notification ID (UUID)',
        tags: ['Carina Notifications'],
      },
      response: {
        200: CarinaNotificationsModel.readSingleResponse,
        401: CarinaNotificationsModel.unauthorizedError,
        404: CarinaNotificationsModel.notFoundError,
        422: CarinaNotificationsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaNotificationsServ.markNotificationRead(
        user.id,
        params.notificationId
      )
    }
  )

  // --- 5. POST /carina/notifications/:notificationId/action (Execute action on notification) ---
  .post(
    '/:notificationId/action',
    {
      params: CarinaNotificationsModel.notificationParam,
      body: CarinaNotificationsModel.actionBody,
      detail: {
        summary: 'Execute an interactive action on a notification strictly by notification ID (UUID)',
        tags: ['Carina Notifications'],
      },
      response: {
        200: CarinaNotificationsModel.actionResponse,
        400: CarinaNotificationsModel.badRequestError,
        401: CarinaNotificationsModel.unauthorizedError,
        404: CarinaNotificationsModel.notFoundError,
        422: CarinaNotificationsModel.validationError,
      },
    },
    async ({ params, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaNotificationsServ.executeNotificationAction(
        user.id,
        params.notificationId,
        body
      )
    }
  )

  // --- 6. GET /carina/notifications/:notificationId (Get single notification details) ---
  .get(
    '/:notificationId',
    {
      params: CarinaNotificationsModel.notificationParam,
      detail: {
        summary: 'Get single encrypted notification details strictly by notification ID (UUID)',
        tags: ['Carina Notifications'],
      },
      response: {
        200: CarinaNotificationsModel.singleNotificationResponse,
        401: CarinaNotificationsModel.unauthorizedError,
        404: CarinaNotificationsModel.notFoundError,
        422: CarinaNotificationsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaNotificationsServ.getNotification(
        user.id,
        params.notificationId
      )
    }
  )

  // --- 7. DELETE /carina/notifications/:notificationId (Delete single notification) ---
  .delete(
    '/:notificationId',
    {
      params: CarinaNotificationsModel.notificationParam,
      detail: {
        summary: 'Delete single notification strictly by notification ID (UUID)',
        tags: ['Carina Notifications'],
      },
      response: {
        200: CarinaNotificationsModel.deleteSingleNotificationResponse,
        401: CarinaNotificationsModel.unauthorizedError,
        404: CarinaNotificationsModel.notFoundError,
        422: CarinaNotificationsModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await CarinaNotificationsServ.deleteNotification(
        user.id,
        params.notificationId
      )
    }
  )

export default carinaNotifications
