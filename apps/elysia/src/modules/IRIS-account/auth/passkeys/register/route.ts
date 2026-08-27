import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    response: {
      200: t.Object({
        challenge: t.String(),
        rp: t.Object({
          name: t.String(),
          id: t.String(),
        }),
        user: t.Object({
          id: t.String(),
          name: t.String(),
          displayName: t.String(),
        }),
        pubKeyCredParams: t.Array(
          t.Object({
            alg: t.Number(),
            type: t.Literal("public-key"),
          })
        ),
        timeout: t.Number(),
        attestation: t.String(),
      }),
    },
  },

  async POST({ session, prisma, cache }) {
    if (!session.isAuthenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const user = session.getUser();
    return {
      challenge: "",
      rp: { name: "IRIS", id: "localhost" },
      user: {
        id: user?.id ?? "",
        name: user?.username ?? "",
        displayName: user?.username ?? "",
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" as const }],
      timeout: 60000,
      attestation: "none",
    };
  },
});
