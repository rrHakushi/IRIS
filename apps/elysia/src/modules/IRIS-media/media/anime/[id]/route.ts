import { defineRoute, t } from "@/router";
import { queueAnimeFetch } from "@/services/media-queue";

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: t.Any(),
    },
  },

  async GET({ params, prisma, cache }) {
    // await queueAnimeFetch(params.id, {
    //   forceRefresh: true,
    // });


    const data = await prisma.anime.findUnique({
      where: {
        anilistId: params.id
      },
      include: {

        characters: {
          include: {
            character: true,
            actor: true,
          },
        },
        airingSchedule: true,
        episodes: true,
        genres: true,
        staff: true,
        studios: true,
      }
    })

    return data
  },
});
