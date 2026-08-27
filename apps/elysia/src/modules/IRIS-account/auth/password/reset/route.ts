import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    body: t.Object({
      token: t.String({ minLength: 10 }),
      newPassword: t.String({ minLength: 12, maxLength: 64 }),
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
      message: "Password reset successfully",
    };
  },
});
