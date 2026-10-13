import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { BorealisCalendarModel } from '../../models/borealis/calendar.model'
import { BorealisCalendarServ } from '../../../services/borealis/calendar.serv'

export const borealisCalendar = new Elysia({ prefix: '/borealis' })
  .use(session())
  // GET /borealis/calendar (Media broadcast / release calendar)
  .get(
    '/calendar',
    {
      query: BorealisCalendarModel.calendarQuery,
      detail: {
        summary: 'Media broadcast / release calendar',
        description:
          'Fetches upcoming and past media releases across Anime (airing schedules), Manga (start/end dates), Games, Books, Movies, TV Episodes (air dates and seasons), and Music with list filtering.',
        tags: ['Borealis - Calendar'],
      },
      response: {
        200: BorealisCalendarModel.calendarResponse,
        422: BorealisCalendarModel.validationError,
      },
    },
    async ({ query, session: userSession }) => {
      const user = userSession.getUser()
      return await BorealisCalendarServ.getCalendar(query, user?.id)
    }
  )

export default borealisCalendar
