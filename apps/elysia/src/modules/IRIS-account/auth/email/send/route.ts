import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    body: t.Object({
      mfaTicket: t.String({ minLength: 10 }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  },

  async POST({ body, session, prisma, cache }) {
    return {
      success: true,
      message: "Verification code sent to registered email",
    };
  },
});
