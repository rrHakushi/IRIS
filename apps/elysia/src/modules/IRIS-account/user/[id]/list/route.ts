import { defineRoute, t } from "../../../../../router";

export default defineRoute({
  schema: {
    // Validates the dynamic route segment /user/:id
    params: t.Object({
      id: t.Number({ minimum: 1 }),
    }),

    response: {
      200: t.Object({
        userId: t.Number(),
        limit: t.Number(),
        page: t.Number(),
        status: t.String(),
        authMethod: t.String(),
        currentUser: t.String(),
        description: t.String(),
        timestamp: t.String(),
      }),
    },
  },

  GET({ params, query, prisma, session }) {
    const user = session.getUser();


    return {
      userId: params.id,
      limit: query.limit ?? 20,
      page: query.page ?? 1,
      status: session.status,
      authMethod: session.method,
      currentUser: user?.username ?? null,
      description: "User list route operational",
      timestamp: new Date().toISOString(),
    };
  },
});
