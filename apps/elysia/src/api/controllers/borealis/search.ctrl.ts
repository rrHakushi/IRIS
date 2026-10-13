import { Elysia } from 'elysia'
import { BorealisSearchModel } from '../../models/borealis/search.model'
import { BorealisSearchServ } from '../../../services/borealis/search.serv'

export const borealisSearch = new Elysia({ prefix: '/borealis' })
  // GET /borealis/search (Search media catalog)
  .get(
    '/search',
    {
      query: BorealisSearchModel.searchQuery,
      detail: {
        summary: 'Search media catalog (?q=...&category=...)',
        description:
          'Searches media catalog items across media, anime, manga, movies, tv, music, books, characters, people, studios.',
        tags: ['Borealis - Search'],
      },
      response: {
        200: BorealisSearchModel.searchResponse,
        422: BorealisSearchModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisSearchServ.search(query)
    }
  )

export default borealisSearch
