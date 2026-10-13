import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { KiroshiHistoryModel } from '../../models/kiroshi/history.model'
import { KiroshiHistoryServ } from '../../../services/kiroshi/history.serv'

export const kiroshiHistory = new Elysia({ prefix: '/kiroshi/history' })
  .use(session())

  // --- 1. GET /kiroshi/history (Get user web search history) ---
  .get(
    '/',
    {
      query: KiroshiHistoryModel.historyQuery,
      detail: {
        summary: 'Get decrypted web search history for the authenticated user',
        tags: ['Kiroshi History'],
      },
      response: {
        200: KiroshiHistoryModel.historyResponse,
        401: KiroshiHistoryModel.unauthorizedError,
        422: KiroshiHistoryModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await KiroshiHistoryServ.getHistory(user.id, query?.limit)
    }
  )

  // --- 2. DELETE /kiroshi/history (Clear all search history or by query ?id=) ---
  .delete(
    '/',
    {
      query: KiroshiHistoryModel.historyDeleteQuery,
      detail: {
        summary: 'Clear all user search history or delete specific entry if query ?id is provided',
        tags: ['Kiroshi History'],
      },
      response: {
        200: KiroshiHistoryModel.deleteHistoryResponse,
        401: KiroshiHistoryModel.unauthorizedError,
        404: KiroshiHistoryModel.notFoundError,
        422: KiroshiHistoryModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      if (query?.id) {
        return await KiroshiHistoryServ.deleteHistoryItem(user.id, query.id)
      }
      return await KiroshiHistoryServ.clearHistory(user.id)
    }
  )

  // --- 3. DELETE /kiroshi/history/:id (Delete individual search history item) ---
  .delete(
    '/:id',
    {
      params: KiroshiHistoryModel.historyParam,
      detail: {
        summary: 'Delete individual search history item by ID',
        tags: ['Kiroshi History'],
      },
      response: {
        200: KiroshiHistoryModel.deleteHistoryResponse,
        401: KiroshiHistoryModel.unauthorizedError,
        404: KiroshiHistoryModel.notFoundError,
        422: KiroshiHistoryModel.validationError,
      },
    },
    async ({ params, session: userSession }) => {
      const user = userSession.requireUser()
      return await KiroshiHistoryServ.deleteHistoryItem(user.id, params.id)
    }
  )

export default kiroshiHistory
