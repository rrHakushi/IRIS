import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    body: t.Optional(
      t.Object({
        deviceName: t.Optional(t.String({ maxLength: 64 })),
      })
    ),
    response: {
      200: t.Object({
        code: t.String(),
        sessionToken: t.String(),
        qrPayload: t.String(),
        expiresIn: t.Number(),
      }),
    },
  },

  async POST({ body, session, prisma, cache }) {
    return {
      code: "ABC-123",
      sessionToken: "sess_sample",
      qrPayload: "iris://auth/quick-connect?token=sess_sample",
      expiresIn: 300,
    };
  },
});
