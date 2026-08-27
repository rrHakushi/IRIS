import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    query: t.Object({
      sessionToken: t.String({ minLength: 10 }),
    }),
    response: {
      200: t.Object({
        status: t.Union([
          t.Literal("pending"),
          t.Literal("approved"),
          t.Literal("expired"),
        ]),
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

  async GET({ query, session, prisma, cache }) {
    return {
      status: "pending" as const,
      user: null,
      token: null,
    };
  },
});
