import { defineRoute, t } from "../../../../../../router";

export default defineRoute({
  schema: {
    body: t.Object({
      passkeyResponse: t.Object({
        id: t.String(),
        rawId: t.String(),
        response: t.Any(),
        type: t.Optional(t.String()),
        clientExtensionResults: t.Optional(t.Any()),
      }),
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
