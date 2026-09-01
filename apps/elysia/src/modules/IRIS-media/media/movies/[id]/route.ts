import { defineRoute, t } from "@/router";
import { queueMovieFetch } from "@/services/media-queue";

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: t.Any()
    },
  },

  async GET({ params, prisma, cache }) {
    // await queueMovieFetch(params.id, {
    //   forceRefresh: true
    // });

    const data = await prisma.movie.findUnique({
      where: {
        tvDBId: params.id
      },
      include: {
        characters: {
          include: {
            character: true,
            actor: true,
          }
        },
        genres: true,
        studios: {
          include: {
            studio: true,
          },
        },
        staff: {
          include: {
            person: true,
          },
        },
      }
    });


    return data
  },
});
