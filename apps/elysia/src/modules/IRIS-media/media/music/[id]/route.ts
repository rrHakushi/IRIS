import { defineRoute, t } from "@/router";
import { queueMusicFetch } from "@/services/media-queue";

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
    await queueMusicFetch(params.id, { forceRefresh: true });

    const isNumeric = /^\d+$/.test(params.id);
    const numId = isNumeric ? parseInt(params.id, 10) : null;

    const data = await prisma.music.findFirst({
      where: {
        OR: [
          ...(numId ? [{ id: numId }] : []),
          { musicBrainzId: params.id },
          { spotifyId: params.id },
          { isrc: params.id },
        ],
      },
      include: {
        genres: true,
        tags: true,
      },
    });

    return data;
  },
});
