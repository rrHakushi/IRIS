import { Elysia } from 'elysia'
import { PublicAssetsModel } from '../../models/carina/public.model'
import { PublicAssetsServ } from '../../../services/carina/public.serv'

export const carinaPublic = new Elysia()
  // --- 1. GET /public/* (Serve static / public uploaded files) ---
  .get(
    '/public/*',
    {
      params: PublicAssetsModel.wildcardParam,
      detail: {
        summary: 'Serve static / public uploaded files',
        tags: ['Public Assets'],
      },
      response: {
        400: PublicAssetsModel.badRequestError,
        404: PublicAssetsModel.notFoundError,
        422: PublicAssetsModel.validationError,
      },
    },
    async ({ params }) => {
      const wildcardKey = params['*']
      return await PublicAssetsServ.serveAsset(wildcardKey)
    }
  )

  // --- 2. GET /carina/public/* (Serve static / public uploaded files - Carina namespace alias) ---
  .get(
    '/carina/public/*',
    {
      params: PublicAssetsModel.wildcardParam,
      detail: {
        summary: 'Serve static / public uploaded files (Carina namespace alias)',
        tags: ['Public Assets'],
      },
      response: {
        400: PublicAssetsModel.badRequestError,
        404: PublicAssetsModel.notFoundError,
        422: PublicAssetsModel.validationError,
      },
    },
    async ({ params }) => {
      const wildcardKey = params['*']
      return await PublicAssetsServ.serveAsset(wildcardKey)
    }
  )

export default carinaPublic
