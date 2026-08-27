import { defineRoute, t } from "../../../../../router";
import { signUserJwt } from "../../../../../utils/auth-crypto";

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

  async GET({ query, prisma, cache }) {
    // 1. Inspect pairing session in cache
    const sessionData = await cache.get<{
      status: "pending" | "approved";
      code: string;
      deviceName: string;
      userId: string | null;
    }>(`auth:quickconnect:session:${query.sessionToken}`);

    if (!sessionData) {
      return {
        status: "expired" as const,
        user: null,
        token: null,
      };
    }

    if (sessionData.status === "pending" || !sessionData.userId) {
      return {
        status: "pending" as const,
        user: null,
        token: null,
      };
    }

    // 2. Fetch approving user
    const user = await prisma.user.findUnique({
      where: { id: sessionData.userId },
    });

    if (!user) {
      await cache.del(`auth:quickconnect:session:${query.sessionToken}`);
      return {
        status: "expired" as const,
        user: null,
        token: null,
      };
    }

    // 3. Invalidate session token immediately to prevent reuse
    await cache.del(`auth:quickconnect:session:${query.sessionToken}`);

    // 4. Issue authenticated session token
    const token = await signUserJwt({
      ...user,
      username: user.username.trim(),
    });

    return {
      status: "approved" as const,
      user: {
        id: user.id,
        username: user.username.trim(),
        email: user.email,
        passwordChangedAt: user.passwordChangedAt
          ? Math.floor(user.passwordChangedAt.getTime() / 1000)
          : null,
      },
      token,
    };
  },
});
