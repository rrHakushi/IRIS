import { defineRoute, t } from "@/router";
import { queueBookFetch } from "@/services/media-queue";

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.String(),
    }),
    response: {
      200: t.Any(),
    },
  },

  async GET({ params, prisma }) {
    // await queueBookFetch(params.id, { forceRefresh: true });

    const isNumeric = /^\d+$/.test(params.id);
    const numId = isNumeric ? parseInt(params.id, 10) : null;

    const data = await prisma.book.findFirst({
      where: {
        OR: [
          ...(numId ? [{ id: numId }] : []),
          { googleBookId: params.id },
          { isbn13: params.id },
          { isbn10: params.id },
        ],
      },
      include: {
        genres: true,
        tags: true,
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
        characters: {
          include: {
            character: true,
            actor: true,
          },
        },
      },
    });

    return data;
  },
});
