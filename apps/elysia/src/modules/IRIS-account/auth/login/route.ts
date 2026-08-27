import { defineRoute, t } from "../../../../router";

export default defineRoute({
  schema: {
    body: t.Object({
      identifier: t.String({ minLength: 3, maxLength: 255 }),
      password: t.String({ minLength: 1, maxLength: 128 }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        mfaRequired: t.Boolean(),
        mfaTicket: t.Nullable(t.String()),
        allowedMfaTypes: t.Nullable(
          t.Array(t.Union([t.Literal("totp"), t.Literal("email"), t.Literal("passkey")]))
        ),
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
      mfaRequired: false,
      mfaTicket: null,
      allowedMfaTypes: null,
      user: null,
      token: null,
    };
  },
});
