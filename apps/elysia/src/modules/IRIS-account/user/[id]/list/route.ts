import { defineRoute } from "@/router";

export default defineRoute({
  GET({ params, prisma }) {

    return {
      userId: params.id,
      description: "User list route operational",
      timestamp: new Date().toISOString(),
    };
  },
});
