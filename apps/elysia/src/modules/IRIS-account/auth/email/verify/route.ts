import { verify as verifyTotp } from "otplib";
import { defineRoute, t } from "../../../../../router";
import {
  decryptSecret,
  verifyBackupCode,
  signUserJwt,
} from "../../../../../utils/auth-crypto";

export default defineRoute({
  schema: {
    body: t.Object({
      mfaTicket: t.String({ minLength: 10 }),
      code: t.String({ minLength: 6, maxLength: 32 }),
      mfaType: t.Union([
        t.Literal("totp"),
        t.Literal("email"),
        t.Literal("backup_code"),
      ]),
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

  async POST({ body, prisma, cache }) {
    // 1. Resolve MFA session ticket
    const ticketData = await cache.get<{ userId: string }>(
      `auth:mfa-ticket:${body.mfaTicket}`
    );

    if (!ticketData || !ticketData.userId) {
      return new Response(
        JSON.stringify({
          error: "BadRequest",
          message: "Invalid or expired MFA session ticket.",
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // 2. Fetch user
    const user = await prisma.user.findUnique({
      where: { id: ticketData.userId },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "NotFound", message: "User not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }

    const cleanCode = body.code.trim();
    let isVerified = false;

    // 3. Verify based on method
    if (body.mfaType === "totp") {
      if (!user.TOTPEnabled || !user.TOTPSecret) {
        return new Response(
          JSON.stringify({
            error: "BadRequest",
            message: "TOTP authentication is not enabled on this account.",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      const secret = decryptSecret(user.TOTPSecret);
      const result = await verifyTotp({ token: cleanCode, secret });
      isVerified = result.valid;
    } else if (body.mfaType === "email") {
      if (!user.emailMfaEnabled) {
        return new Response(
          JSON.stringify({
            error: "BadRequest",
            message: "Email MFA is not enabled on this account.",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      const cachedCode = await cache.get<string>(
        `auth:mfa-email-code:${user.id}`
      );
      if (cachedCode && cachedCode === cleanCode) {
        isVerified = true;
        await cache.del(`auth:mfa-email-code:${user.id}`);
      }
    } else if (body.mfaType === "backup_code") {
      if (user.backupCodes.length === 0) {
        return new Response(
          JSON.stringify({
            error: "BadRequest",
            message: "No backup codes are configured for this account.",
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      const matchedIndex = await verifyBackupCode(cleanCode, user.backupCodes);
      if (matchedIndex !== -1) {
        isVerified = true;
        // Consume backup code (single-use)
        const updatedCodes = user.backupCodes.filter(
          (_, idx) => idx !== matchedIndex
        );
        await prisma.user.update({
          where: { id: user.id },
          data: { backupCodes: updatedCodes },
        });
      }
    }

    if (!isVerified) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid verification code.",
        }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    // 4. Invalidate MFA ticket
    await cache.del(`auth:mfa-ticket:${body.mfaTicket}`);

    // 5. Issue session token
    const token = await signUserJwt({
      ...user,
      username: user.username.trim(),
    });

    return {
      success: true,
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
