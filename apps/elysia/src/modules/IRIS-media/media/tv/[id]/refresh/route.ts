import { defineRoute, t } from "../../../../../../router";
import { IRISFlags } from "@IRIS/permissions";

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),
    body: t.Optional(
      t.Object({
        name: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean({ default: true })),
      })
    ),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        timestamp: t.String(),
      }),
    },
  },

  async POST({ params, body, session, prisma, cache }) {
    if (!session.hasPermission(IRISFlags.ADMINISTRATOR)) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin required" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    return {
      success: true,
      message: "POST /media/anime/[id]/refresh handled successfully",
      timestamp: new Date().toISOString(),
    };
  },
});
