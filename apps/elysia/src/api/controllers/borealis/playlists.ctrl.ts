import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisPlaylistsModel } from '../../models/borealis/playlists.model'
import { BorealisPlaylistsServ } from '../../../services/borealis/playlists.serv'
import { BadRequest } from '../../../lib/errors'

// Split into small Elysia instances to avoid TS2589 (excessively deep type instantiation).
const routes1 = new Elysia()
  .use(session())

  .get(
    '',
    {
      query: BorealisPlaylistsModel.listPlaylistsQuery,
      detail: {
        summary: 'Get user custom playlists',
        description: 'Lists all custom playlists belonging to the user or where user is a collaborator.',
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
        403: BorealisPlaylistsModel.forbiddenError,
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
        403: BorealisPlaylistsModel.forbiddenError,
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

const routes2 = new Elysia()
  .use(session())

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
        403: BorealisPlaylistsModel.forbiddenError,
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
  // Reorder Entries Endpoint (PUT /:playlistId/reorder)
  // ===========================================================================

  .put(
    '/:playlistId/reorder',
    {
      params: BorealisPlaylistsModel.playlistParam,
      body: BorealisPlaylistsModel.reorderEntriesBody,
      detail: {
        summary: 'Reorder playlist entries',
        description: 'Applies new sequential order to entries in the playlist.',
        tags: ['Borealis Playlist Entries'],
      },
      response: {
        200: BorealisPlaylistsModel.reorderEntriesResponse,
        400: BorealisPlaylistsModel.badRequestError,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.reorderEntries(user.id, playlistId, body.entryIds)
    }
  )

  // ===========================================================================
  // Collaborators Endpoints (/:playlistId/collaborators)
  // ===========================================================================

  // GET /borealis/playlists/:playlistId/collaborators
  .get(
    '/:playlistId/collaborators',
    {
      params: BorealisPlaylistsModel.playlistParam,
      detail: {
        summary: 'List playlist collaborators',
        description: 'Lists all users collaborating on this playlist with their roles.',
        tags: ['Borealis Playlist Collaborators'],
      },
      response: {
        200: BorealisPlaylistsModel.listCollaboratorsResponse,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.listCollaborators(user.id, playlistId)
    }
  )

  // POST /borealis/playlists/:playlistId/collaborators
  .post(
    '/:playlistId/collaborators',
    {
      params: BorealisPlaylistsModel.playlistParam,
      body: BorealisPlaylistsModel.addCollaboratorBody,
      detail: {
        summary: 'Add playlist collaborator',
        description: 'Invites a user by username as Editor or Viewer to this playlist.',
        tags: ['Borealis Playlist Collaborators'],
      },
      response: {
        200: BorealisPlaylistsModel.addCollaboratorResponse,
        400: BorealisPlaylistsModel.badRequestError,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.addCollaborator(user.id, playlistId, body)
    }
  )

  // PATCH /borealis/playlists/:playlistId/collaborators/:collaboratorId
  .patch(
    '/:playlistId/collaborators/:collaboratorId',
    {
      params: BorealisPlaylistsModel.collaboratorParam,
      body: BorealisPlaylistsModel.updateCollaboratorBody,
      detail: {
        summary: 'Update collaborator role',
        description: 'Updates a collaborator role between EDITOR and VIEWER.',
        tags: ['Borealis Playlist Collaborators'],
      },
      response: {
        200: BorealisPlaylistsModel.updateCollaboratorResponse,
        400: BorealisPlaylistsModel.badRequestError,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId, collaboratorId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.updateCollaborator(user.id, playlistId, collaboratorId, body.role)
    }
  )

  // DELETE /borealis/playlists/:playlistId/collaborators/:collaboratorId

const routes3 = new Elysia()
  .use(session())

  .delete(
    '/:playlistId/collaborators/:collaboratorId',
    {
      params: BorealisPlaylistsModel.collaboratorParam,
      detail: {
        summary: 'Remove collaborator',
        description: 'Removes a collaborator from the playlist.',
        tags: ['Borealis Playlist Collaborators'],
      },
      response: {
        200: BorealisPlaylistsModel.removeCollaboratorResponse,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId, collaboratorId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.removeCollaborator(user.id, playlistId, collaboratorId)
    }
  )

  // ===========================================================================
  // Comments Endpoints (/:playlistId/comments)
  // ===========================================================================

  // GET /borealis/playlists/:playlistId/comments
  .get(
    '/:playlistId/comments',
    {
      params: BorealisPlaylistsModel.playlistParam,
      query: BorealisPlaylistsModel.listCommentsQuery,
      detail: {
        summary: 'List custom list comments',
        description: 'Retrieves comments and replies for the specified custom playlist.',
        tags: ['Borealis Playlist Comments'],
      },
      response: {
        200: BorealisPlaylistsModel.listCommentsResponse,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, query, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.listComments(user.id, playlistId, query)
    }
  )

  // POST /borealis/playlists/:playlistId/comments
  .post(
    '/:playlistId/comments',
    {
      params: BorealisPlaylistsModel.playlistParam,
      body: BorealisPlaylistsModel.createCommentBody,
      detail: {
        summary: 'Post comment on custom list',
        description: 'Submits a new discussion comment on the specified custom playlist.',
        tags: ['Borealis Playlist Comments'],
      },
      response: {
        200: BorealisPlaylistsModel.createCommentResponse,
        400: BorealisPlaylistsModel.badRequestError,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.createComment(user.id, playlistId, body)
    }
  )

  // DELETE /borealis/playlists/:playlistId/comments/:commentId
  .delete(
    '/:playlistId/comments/:commentId',
    {
      params: BorealisPlaylistsModel.commentParam,
      detail: {
        summary: 'Delete comment on custom list',
        description: 'Deletes a comment (allowed for comment author, list owner, or admin).',
        tags: ['Borealis Playlist Comments'],
      },
      response: {
        200: BorealisPlaylistsModel.deleteCommentResponse,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId, commentId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.deleteComment(user, playlistId, commentId)
    }
  )

  // ===========================================================================
  // Activity Endpoint (GET /:playlistId/activity)
  // ===========================================================================

  .get(
    '/:playlistId/activity',
    {
      params: BorealisPlaylistsModel.playlistParam,
      detail: {
        summary: 'Get playlist activity trail',
        description: 'Chronological activity stream of changes and interactions in this playlist.',
        tags: ['Borealis Playlists'],
      },
      response: {
        200: BorealisPlaylistsModel.activityResponse,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.listActivity(user.id, playlistId)
    }
  )

  // ===========================================================================
  // Individual Playlist Operations (/:playlistId)
  // ===========================================================================

  // PATCH /borealis/playlists/:playlistId (Update playlist details)

const routes4 = new Elysia()
  .use(session())

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
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, body, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.updatePlaylist(user.id, playlistId, body)
    }
  )

  // DELETE /borealis/playlists/:playlistId (Delete playlist - strictly owner only)
  .delete(
    '/:playlistId',
    {
      params: BorealisPlaylistsModel.playlistParam,
      detail: {
        summary: 'Delete playlist',
        description: 'Permanently removes a playlist and its entry associations (owner only).',
        tags: ['Borealis Playlists'],
      },
      response: {
        200: BorealisPlaylistsModel.deletePlaylistResponse,
        401: BorealisPlaylistsModel.unauthorizedError,
        403: BorealisPlaylistsModel.forbiddenError,
        404: BorealisPlaylistsModel.notFoundError,
        422: BorealisPlaylistsModel.validationError,
      },
    },
    async ({ params: { playlistId }, session: userSession }) => {
      const user = userSession.requireUser()
      return await BorealisPlaylistsServ.deletePlaylist(user.id, playlistId)
    }
  )

export const borealisPlaylists = new Elysia({ prefix: '/borealis/playlists' })
  .use(routes1)
  .use(routes2)
  .use(routes3)
  .use(routes4)

export default borealisPlaylists
