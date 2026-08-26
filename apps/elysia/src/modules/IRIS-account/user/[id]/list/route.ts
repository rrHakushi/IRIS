import { defineRoute, t } from "@/router";

export default defineRoute({
  schema: {
    // Validates the dynamic route segment /user/:id
    params: t.Object({
      id: t.Number({ minimum: 1 }),
      username: t.String()
    }),

  },

  GET({ params, query, prisma }) {


    return {
      userId: params.id,
      limit: query.limit ?? 20,
      page: query.page ?? 1,
      description: "User list route operational",
      timestamp: new Date().toISOString(),
    };
  },
});
