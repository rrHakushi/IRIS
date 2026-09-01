import { defineRoute, t } from "@/router";
import { queueGameFetch } from "@/services/media-queue";

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    response: {
      200: t.Any(),
    },
  },

  async GET({ params, prisma }) {
    // await queueGameFetch(params.id, { forceRefresh: true });

    const data = await prisma.game.findUnique({
      where: {
        igdbId: params.id,
      },
      include: {
        genres: true,
        tags: true,
        studios: {
          include: {
            studio: true,
          },
        },
      },
    });

    return data;
  },
});
