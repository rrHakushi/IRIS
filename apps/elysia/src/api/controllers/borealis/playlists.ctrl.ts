import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisPlaylistsModel } from '../../models/borealis/playlists.model'
import { BorealisPlaylistsServ } from '../../../services/borealis/playlists.serv'
import { BadRequest } from '../../../lib/errors'

export const borealisPlaylists = new Elysia({ prefix: '/borealis/playlists' })
  .use(session())

  // ===========================================================================
  // Playlists (Custom Lists) Root Endpoints
  // ===========================================================================

  // GET /borealis/playlists (Get user custom playlists)
  .get(
    '',
    {
      query: BorealisPlaylistsModel.listPlaylistsQuery,
      detail: {
        summary: 'Get user custom playlists',
        description: 'Lists all custom playlists belonging to the authenticated user.',
        tags: ['Borealis Playlists'],
      },
      response: {
        200: BorealisPlaylistsModel.listPlaylistsResponse,
        401: BorealisPlaylistsModel.unauthorizedError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.listPlaylists(user.id, query)
    }
  )

  // POST /borealis/playlists (Create new playlist)
  .post(
    '',
    {
      body: BorealisPlaylistsModel.createPlaylistBody,
      detail: {
        summary: 'Create new playlist',
        description: 'Creates a custom playlist for the authenticated user.',
        tags: ['Borealis Playlists'],
      },
      response: {
        200: BorealisPlaylistsModel.createPlaylistResponse,
        400: BorealisPlaylistsModel.badRequestError,
        401: BorealisPlaylistsModel.unauthorizedError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.createPlaylist(user.id, body)
    }
  )

  // ===========================================================================
  // Playlist Entries Sub-Endpoints (/:playlistId/entries)
  // ===========================================================================

  // GET /borealis/playlists/:playlistId/entries (Get playlist entries)
  .get(
    '/:playlistId/entries',
    {
      params: BorealisPlaylistsModel.playlistParam,
      query: BorealisPlaylistsModel.getEntriesQuery,
      detail: {
        summary: 'Get playlist entries',
        description: 'Retrieves entries within a custom playlist with catalog media details.',
        tags: ['Borealis Playlist Entries'],
      },
      response: {
        200: BorealisPlaylistsModel.getEntriesResponse,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.getPlaylistEntries(user.id, playlistId, query)
    }
  )

  // POST /borealis/playlists/:playlistId/entries (Add entry to playlist)
  .post(
    '/:playlistId/entries',
    {
      params: BorealisPlaylistsModel.playlistParam,
      body: BorealisPlaylistsModel.addEntryBody,
      detail: {
        summary: 'Add entry to playlist',
        description: 'Appends a media item to the specified playlist.',
        tags: ['Borealis Playlist Entries'],
      },
      response: {
        200: BorealisPlaylistsModel.addEntryResponse,
        400: BorealisPlaylistsModel.badRequestError,
        401: BorealisPlaylistsModel.unauthorizedError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.addPlaylistEntry(user.id, playlistId, body)
    }
  )

  // PATCH /borealis/playlists/:playlistId/entries (Update entry in playlist)
  .patch(
    '/:playlistId/entries',
    {
      params: BorealisPlaylistsModel.playlistParam,
      body: BorealisPlaylistsModel.updateEntryBody,
      detail: {
        summary: 'Update entry in playlist',
        description: 'Updates notes, position, or reorders entries within a playlist.',
        tags: ['Borealis Playlist Entries'],
      },
      response: {
        200: BorealisPlaylistsModel.updateEntryResponse,
        400: BorealisPlaylistsModel.badRequestError,
        401: BorealisPlaylistsModel.unauthorizedError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.updatePlaylistEntry(user.id, playlistId, body)
    }
  )

  // DELETE /borealis/playlists/:playlistId/entries (Remove entry from playlist)
  .delete(
    '/:playlistId/entries',
    {
      params: BorealisPlaylistsModel.playlistParam,
      query: BorealisPlaylistsModel.removeEntryQuery,
      body: BorealisPlaylistsModel.removeEntryBody,
      detail: {
        summary: 'Remove entry from playlist',
        description: 'Removes a media item from the specified playlist.',
        tags: ['Borealis Playlist Entries'],
      },
      response: {
        200: BorealisPlaylistsModel.removeEntryResponse,
        400: BorealisPlaylistsModel.badRequestError,
        401: BorealisPlaylistsModel.unauthorizedError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, body, query, session: userSession }) => {
      const user = userSession.requireUser()
      const targetId = body?.id || query?.id
      const targetMediaType = body?.mediaType || query?.mediaType
      const targetMediaId = body?.mediaId !== undefined ? body.mediaId : query?.mediaId

      if (!targetId && (!targetMediaType || targetMediaId === undefined)) {
        throw new BadRequest('Target entry id or mediaType and mediaId is required')
      }

      return await BorealisPlaylistsServ.removePlaylistEntry(user.id, playlistId, {
        id: targetId,
        mediaType: targetMediaType,
        mediaId: targetMediaId,
      })
    }
  )

  // ===========================================================================
  // Individual Playlist Operations (/:playlistId)
  // ===========================================================================

  // PATCH /borealis/playlists/:playlistId (Update playlist details)
  .patch(
    '/:playlistId',
    {
      params: BorealisPlaylistsModel.playlistParam,
      body: BorealisPlaylistsModel.updatePlaylistBody,
      detail: {
        summary: 'Update playlist details',
        description: 'Updates metadata, privacy, or cover image of an owned playlist.',
        tags: ['Borealis Playlists'],
      },
      response: {
        200: BorealisPlaylistsModel.updatePlaylistResponse,
        400: BorealisPlaylistsModel.badRequestError,
        401: BorealisPlaylistsModel.unauthorizedError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.updatePlaylist(user.id, playlistId, body)
    }
  )

  // DELETE /borealis/playlists/:playlistId (Delete playlist)
  .delete(
    '/:playlistId',
    {
      params: BorealisPlaylistsModel.playlistParam,
      detail: {
        summary: 'Delete playlist',
        description: 'Permanently removes a playlist and its entry associations.',
        tags: ['Borealis Playlists'],
      },
      response: {
        200: BorealisPlaylistsModel.deletePlaylistResponse,
        401: BorealisPlaylistsModel.unauthorizedError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.deletePlaylist(user.id, playlistId)
    }
  )

export default borealisPlaylists
