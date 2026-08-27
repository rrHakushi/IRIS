import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    body: t.Object({
      mfaTicket: t.String({ minLength: 10 }),
      code: t.String({ minLength: 6, maxLength: 32 }),
      mfaType: t.Union([
        t.Literal("totp"),
        t.Literal("email"),
        t.Literal("backup_code"),
      ]),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        user: t.Nullable(
          t.Object({
            id: t.String(),
            username: t.String(),
            email: t.String(),
            passwordChangedAt: t.Nullable(t.Number()),
          })
        ),
        token: t.Nullable(t.String()),
      }),
    },
  },

  async POST({ body, session, prisma, cache }) {
    return {
      success: true,
      user: null,
      token: null,
    };
  },
});
