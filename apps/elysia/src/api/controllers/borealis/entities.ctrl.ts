import { Elysia } from 'elysia'
import { BorealisEntitiesModel } from '../../models/borealis/entities.model'
import { BorealisEntitiesServ } from '../../../services/borealis/entities.serv'

export const borealisEntities = new Elysia({ prefix: '/borealis' })
  // ===========================================================================
  // 1. Characters
  // ===========================================================================

  // GET /borealis/characters (Get characters catalog, 40 per page)
  .get(
    '/characters',
    {
      query: BorealisEntitiesModel.characterCatalogQuery,
      detail: {
        summary: 'Get characters catalog (40 per page)',
        description: 'Browse paginated characters catalog with keyword searching, gender filters, and sorting.',
        tags: ['Borealis - Characters'],
      },
      response: {
        200: BorealisEntitiesModel.characterCatalogResponse,
        422: BorealisEntitiesModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisEntitiesServ.getCharacterCatalog(query)
    }
  )

  // GET /borealis/characters/filters (Get available character filters)
  .get(
    '/characters/filters',
    {
      detail: {
        summary: 'Get available character filters',
        description: 'Returns available filter facets and distribution counts across character genders.',
        tags: ['Borealis - Characters'],
      },
      response: {
        200: BorealisEntitiesModel.characterFiltersResponse,
      },
    },
    async () => {
      return await BorealisEntitiesServ.getCharacterFilters()
    }
  )

  // GET /borealis/characters/:id (Get character details by ID)
  .get(
    '/characters/:id',
    {
      params: BorealisEntitiesModel.entityDetailParam,
      detail: {
        summary: 'Get character details by ID',
        description: 'Fetches character details with appearances across anime, manga, movies, tv, books, and voice actors.',
        tags: ['Borealis - Characters'],
      },
      response: {
        200: BorealisEntitiesModel.characterDetailResponse,
        404: BorealisEntitiesModel.notFoundError,
        422: BorealisEntitiesModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisEntitiesServ.getCharacterById(id)
    }
  )

  // ===========================================================================
  // 2. People (Staff / Voice Actors)
  // ===========================================================================

  // GET /borealis/people (Get people, 40 per page)
  .get(
    '/people',
    {
      query: BorealisEntitiesModel.personCatalogQuery,
      detail: {
        summary: 'Get people (staff/voice actors) (40 per page)',
        description: 'Browse paginated people catalog with occupation, language, and gender filters.',
        tags: ['Borealis - People'],
      },
      response: {
        200: BorealisEntitiesModel.personCatalogResponse,
        422: BorealisEntitiesModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisEntitiesServ.getPeopleCatalog(query)
    }
  )

  // GET /borealis/people/filters (Get available people filters)
  .get(
    '/people/filters',
    {
      detail: {
        summary: 'Get available people filters',
        description: 'Returns available filter facets and counts for primary occupations, languages, and genders.',
        tags: ['Borealis - People'],
      },
      response: {
        200: BorealisEntitiesModel.personFiltersResponse,
      },
    },
    async () => {
      return await BorealisEntitiesServ.getPeopleFilters()
    }
  )

  // GET /borealis/people/:id (Get person details by ID)
  .get(
    '/people/:id',
    {
      params: BorealisEntitiesModel.entityDetailParam,
      detail: {
        summary: 'Get person details by ID',
        description: 'Fetches detailed person profile with voiced characters, staff credits across media, and music discography.',
        tags: ['Borealis - People'],
      },
      response: {
        200: BorealisEntitiesModel.personDetailResponse,
        404: BorealisEntitiesModel.notFoundError,
        422: BorealisEntitiesModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisEntitiesServ.getPersonById(id)
    }
  )

  // ===========================================================================
  // 3. Studios
  // ===========================================================================

  // GET /borealis/studios (Get studios, 40 per page)
  .get(
    '/studios',
    {
      query: BorealisEntitiesModel.studioCatalogQuery,
      detail: {
        summary: 'Get studios (40 per page)',
        description: 'Browse paginated studios catalog with animation studio filtering and sorting.',
        tags: ['Borealis - Studios'],
      },
      response: {
        200: BorealisEntitiesModel.studioCatalogResponse,
        422: BorealisEntitiesModel.validationError,
      },
    },
    async ({ query }) => {
      return await BorealisEntitiesServ.getStudioCatalog(query)
    }
  )

  // GET /borealis/studios/filters (Get available studio filters)
  .get(
    '/studios/filters',
    {
      detail: {
        summary: 'Get available studio filters',
        description: 'Returns available studio classification facets (animation studios vs production companies).',
        tags: ['Borealis - Studios'],
      },
      response: {
        200: BorealisEntitiesModel.studioFiltersResponse,
      },
    },
    async () => {
      return await BorealisEntitiesServ.getStudioFilters()
    }
  )

  // GET /borealis/studios/:id (Get studio details by ID)
  .get(
    '/studios/:id',
    {
      params: BorealisEntitiesModel.entityDetailParam,
      detail: {
        summary: 'Get studio details by ID',
        description: 'Fetches studio metadata, favorites, and list of media creations across anime, movies, tv, games, and books.',
        tags: ['Borealis - Studios'],
      },
      response: {
        200: BorealisEntitiesModel.studioDetailResponse,
        404: BorealisEntitiesModel.notFoundError,
        422: BorealisEntitiesModel.validationError,
      },
    },
    async ({ params: { id } }) => {
      return await BorealisEntitiesServ.getStudioById(id)
    }
  )

export default borealisEntities
