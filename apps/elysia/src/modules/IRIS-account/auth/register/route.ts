import { defineRoute, t } from "../../../../router";

export default defineRoute({
  schema: {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 32 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 12, maxLength: 64 }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        user: t.Object({
          id: t.String(),
          username: t.String(),
          email: t.String(),
          passwordChangedAt: t.Nullable(t.Number()),
          publicKey: t.Nullable(t.String()),
        }),
      }),
    },
  },

  async POST({ body, session, prisma, cache }) {
    return {
      success: true,
      user: {
        id: "",
        username: body.username,
        email: body.email,
        passwordChangedAt: null,
        publicKey: null,
      },
    };
  },
});
