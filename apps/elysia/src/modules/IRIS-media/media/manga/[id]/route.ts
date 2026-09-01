import { defineRoute, t } from "@/router";
import { queueMangaFetch } from "@/services/media-queue";

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
    // await queueMangaFetch(params.id, {
    //   forceRefresh: true,
    // });

    const data = await prisma.manga.findUnique({
      where: {
        anilistId: params.id
      },
      include: {
        characters: {
          include: {
            character: true,
          }
        },
        genres: true,
        staff: {
          include: {
            person: true,
          }
        }

      }
    })

    return data;
  },
});
