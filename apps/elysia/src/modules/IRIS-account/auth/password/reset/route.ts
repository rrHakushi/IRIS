import { defineRoute, t } from "../../../../../router";
import { hashPassword } from "../../../../../utils/auth-crypto";

export default defineRoute({
  schema: {
    body: t.Object({
      token: t.String({ minLength: 10 }),
      newPassword: t.String({ minLength: 12, maxLength: 64 }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
      }),
    },
  },

  async POST({ body, prisma, cache }) {
    // 1. Validate reset token from cache
    const userId = await cache.get<string>(`auth:pwd-reset:${body.token}`);

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Invalid or expired password reset token.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // 2. Hash new password and record revocation timestamp
    const newHash = await hashPassword(body.newPassword);
    const now = new Date();

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        passwordChangedAt: now,
      },
    });

    // 3. Invalidate token immediately
    await cache.del(`auth:pwd-reset:${body.token}`);

    return {
      success: true,
      message: "Password reset successfully",
    };
  },
});
