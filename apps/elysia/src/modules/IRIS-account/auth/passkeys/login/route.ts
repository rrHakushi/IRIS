import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    body: t.Optional(
      t.Object({
        identifier: t.Optional(t.String({ minLength: 3 })),
      })
    ),
    response: {
      200: t.Object({
        challenge: t.String(),
        rpId: t.String(),
        allowCredentials: t.Optional(
          t.Array(
            t.Object({
              id: t.String(),
              type: t.Literal("public-key"),
              transports: t.Optional(t.Array(t.String())),
            })
          )
        ),
        timeout: t.Number(),
        userVerification: t.Union([
          t.Literal("required"),
          t.Literal("preferred"),
          t.Literal("discouraged"),
        ]),
      }),
    },
  },

  async POST({ body, session, prisma, cache }) {
    return {
      challenge: "",
      rpId: "localhost",
      timeout: 60000,
      userVerification: "preferred" as const,
    };
  },
});
