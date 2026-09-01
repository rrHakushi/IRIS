import { defineRoute, t } from "@/router";
import { queueTvFetch } from "@/services/media-queue";

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
    // await queueTvFetch(params.id, {
    //   forceRefresh: true
    // })

    const data = await prisma.tv.findUnique({
      where: {
        tvDBId: params.id
      },
      include: {
        characters: {
          include: {
            actor: true,
            character: true,
          }
        },
        staff: {
          include: {
            person: true,

          }
        },
        genres: true,
        tags: true,
        studios: {
          include: {
            studio: true,
          },
        },
        seasons: {
          orderBy: {
            seasonNumber: "asc",
          },
        },
        episodes: {
          orderBy: [
            { seasonNumber: "asc" },
            { episodeNumber: "asc" },
          ],
        },
      }
    });

    return data;
  },
});
